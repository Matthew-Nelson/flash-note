/**
 * Test-side arrangement against the e2e database.
 *
 * Each test that needs a particular account state creates its own user here
 * rather than sharing seeded rows, so tests stay independent under parallel
 * workers and Playwright retries (a retry never finds a token already used or
 * an account already locked by its first attempt).
 *
 * Only arrangement goes through here. Every assertion goes through the UI.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';

import { E2E_DATABASE_URL } from '../setup/env';

// Meets the password policy: 8+ chars, upper, lower, digit
export const TEST_PASSWORD = 'E2ePassword1';

// Cost 4 is bcrypt's minimum; login verifies any cost, and 12 would add
// ~250ms per created user for no coverage.
const passwordHash = bcrypt.hashSync(TEST_PASSWORD, 4);

const pool = new pg.Pool({
  connectionString: E2E_DATABASE_URL,
  max: 2,
  allowExitOnIdle: true,
});

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/** Letters only, so it reads as a word in names and survives search tokenizing. */
export function uniqueWord(prefix: string): string {
  const letters = Array.from(crypto.randomBytes(8), (b) => String.fromCharCode(97 + (b % 26))).join('');
  return `${prefix}${letters}`;
}

export function uniqueEmail(label: string): string {
  return `e2e-${label}-${crypto.randomUUID()}@example.com`;
}

export async function createUser(options: {
  label?: string;
  emailVerified?: boolean;
  subscriptionStatus?: 'trialing' | 'active' | 'canceled' | 'past_due' | 'unpaid';
  trialEndsAt?: Date;
} = {}): Promise<TestUser> {
  const email = uniqueEmail(options.label ?? 'user');
  const emailVerified = options.emailVerified ?? true;
  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, email_verified, email_verified_at,
                        subscription_status, trial_ends_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      email,
      passwordHash,
      emailVerified,
      emailVerified ? new Date() : null,
      options.subscriptionStatus ?? 'trialing',
      options.trialEndsAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('createUser: INSERT returned no row');
  return { id: row.id, email, password: TEST_PASSWORD };
}

/**
 * Store an email token the way the app does (SHA-256 of a random token) and
 * return the plaintext, standing in for the link the app would have emailed.
 */
export async function issueEmailToken(
  userId: string,
  type: 'email_verification' | 'password_reset',
): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await pool.query(
    `INSERT INTO email_tokens (user_id, token_hash, token_type, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')`,
    [userId, tokenHash, type],
  );
  return token;
}

export async function findUserByEmail(
  email: string,
): Promise<{ id: string; emailVerified: boolean } | null> {
  const result = await pool.query<{ id: string; email_verified: boolean }>(
    'SELECT id, email_verified FROM users WHERE email = $1',
    [email],
  );
  const row = result.rows[0];
  return row ? { id: row.id, emailVerified: row.email_verified } : null;
}

export async function createPatient(
  userId: string,
  patient: { firstName: string; lastName: string },
): Promise<{ id: string }> {
  const result = await pool.query<{ id: string }>(
    'INSERT INTO patients (user_id, first_name, last_name) VALUES ($1, $2, $3) RETURNING id',
    [userId, patient.firstName, patient.lastName],
  );
  const row = result.rows[0];
  if (!row) throw new Error('createPatient: INSERT returned no row');
  return { id: row.id };
}

// Builtin SOAP template and its sections, seeded by migration 002
const SOAP_TEMPLATE_ID = '00000000-0000-0000-0000-000000000001';
const SOAP_SECTIONS = [
  { sectionId: '00000000-0000-0000-0000-000000000011', title: 'Subjective' },
  { sectionId: '00000000-0000-0000-0000-000000000012', title: 'Objective' },
  { sectionId: '00000000-0000-0000-0000-000000000013', title: 'Assessment' },
  { sectionId: '00000000-0000-0000-0000-000000000014', title: 'Plan' },
] as const;

/**
 * Insert a saved SOAP note with its initial version rows, matching what
 * saveNoteAction persists. Needed because no UI control calls saveNoteAction yet.
 */
export async function createNote(
  userId: string,
  note: { subjective: string; patientId?: string },
): Promise<{ id: string }> {
  const content = SOAP_SECTIONS.map((section) => ({
    ...section,
    content: section.title === 'Subjective' ? note.subjective : `${section.title} findings.`,
  }));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<{ id: string }>(
      `INSERT INTO clinical_notes (user_id, patient_id, template_id, note_type, content, quick_notes, modality)
       VALUES ($1, $2, $3, 'daily_note', $4::jsonb, $5, 'in_person')
       RETURNING id`,
      [userId, note.patientId ?? null, SOAP_TEMPLATE_ID, JSON.stringify(content), 'e2e shorthand'],
    );
    const row = result.rows[0];
    if (!row) throw new Error('createNote: INSERT returned no row');
    for (const section of content) {
      await client.query(
        `INSERT INTO note_versions (note_id, section_id, version, content, source, created_by)
         VALUES ($1, $2, 1, $3, 'generated', $4)`,
        [row.id, section.sectionId, section.content, userId],
      );
    }
    await client.query('COMMIT');
    return { id: row.id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
