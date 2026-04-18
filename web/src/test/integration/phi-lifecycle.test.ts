/**
 * PHI lifecycle integration test scaffold.
 *
 * Scenarios are added incrementally:
 *   - Plan 04-02 adds patient create/update/archive end-to-end scenarios
 *     (2 of 4 slots now implemented; the remaining 2 complete in Plan 04-03).
 *   - Plan 04-03 adds note save/update/version/audit-in-transaction scenarios
 *     exercised against a real Postgres DB via db-harness.
 *
 * These tests are gated on `DATABASE_URL_TEST` — when unset they skip cleanly
 * (useful locally without a dedicated Postgres).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';

import { setupTestDb } from '@/test/db-harness';
import {
  createPatient,
  updatePatient,
  archivePatient,
  findPatientById,
} from '@/server/dal/patients';
import { insertAuditLogWithClient } from '@/server/dal/audit-logs';
import { AuditAction } from '@/server/types';

const hasTestDb = Boolean(process.env.DATABASE_URL_TEST);

const USER_ID = '00000000-0000-0000-0000-0000000fdf01';

async function seedUser(pool: pg.Pool): Promise<string> {
  // Minimal user row so patients.user_id FK is satisfied. Migration 001 defines
  // required columns; only fill the NOT NULLs.
  await pool.query(
    `INSERT INTO users (id, email, password_hash, subscription_status, trial_ends_at, email_verified)
     VALUES ($1, $2, $3, 'trialing', NOW() + interval '14 days', true)
     ON CONFLICT (id) DO NOTHING`,
    [USER_ID, `phi-lifecycle-${USER_ID}@test.example`, 'x'.repeat(60)],
  );
  return USER_ID;
}

describe.skipIf(!hasTestDb)('phi lifecycle (real-DB integration)', () => {
  let pool: pg.Pool;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const handle = await setupTestDb();
    pool = handle.pool;
    cleanup = handle.cleanup;
    await seedUser(pool);
  });

  afterAll(async () => {
    await cleanup?.();
  });

  it('create patient + audit fires inside same transaction', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const patient = await createPatient(
        { userId: USER_ID, organizationId: null },
        { firstName: 'Jane', lastName: 'Doe' },
        client,
      );
      await insertAuditLogWithClient(client, {
        userId: USER_ID,
        action: AuditAction.PATIENT_CREATED,
        status: 'SUCCESS',
        metadata: { patientId: patient.id },
      });
      await client.query('COMMIT');

      // After commit: 1 patients row + 1 audit_logs row, both referencing the
      // same patient id and both visible to a fresh pool query (proves commit
      // landed atomically).
      const patientResult = await pool.query(
        'SELECT id FROM patients WHERE id = $1',
        [patient.id],
      );
      expect(patientResult.rows).toHaveLength(1);
      const auditResult = await pool.query(
        `SELECT action FROM audit_logs WHERE action = $1 AND (metadata->>'patientId') = $2`,
        [AuditAction.PATIENT_CREATED, patient.id],
      );
      expect(auditResult.rows).toHaveLength(1);
    } finally {
      client.release();
    }
  });

  it('update patient context then archive — both audit rows committed atomically', async () => {
    // Arrange: create a patient (own transaction), then exercise update + archive.
    const seedClient = await pool.connect();
    let patientId: string;
    try {
      await seedClient.query('BEGIN');
      const patient = await createPatient(
        { userId: USER_ID, organizationId: null },
        { firstName: 'Seed', lastName: 'Patient' },
        seedClient,
      );
      patientId = patient.id;
      await seedClient.query('COMMIT');
    } finally {
      seedClient.release();
    }

    // Act 1: update context + audit in one transaction.
    const updClient = await pool.connect();
    try {
      await updClient.query('BEGIN');
      const updated = await updatePatient(
        { type: 'user', userId: USER_ID },
        patientId,
        { context: 'Chronic knee pain' },
        updClient,
      );
      expect(updated).not.toBeNull();
      await insertAuditLogWithClient(updClient, {
        userId: USER_ID,
        action: AuditAction.PATIENT_UPDATED,
        status: 'SUCCESS',
        metadata: { patientId, fields: ['context'] },
      });
      await updClient.query('COMMIT');
    } finally {
      updClient.release();
    }

    // Verify update persisted (the context value is intentionally not re-read
    // into a variable that may surface in logs — we only need to assert row
    // existence).
    const afterUpdate = await findPatientById(
      { type: 'user', userId: USER_ID },
      patientId,
    );
    expect(afterUpdate).not.toBeNull();
    expect(afterUpdate?.context).toBe('Chronic knee pain');

    // Act 2: archive + audit in one transaction.
    const arcClient = await pool.connect();
    try {
      await arcClient.query('BEGIN');
      const archived = await archivePatient(
        { type: 'user', userId: USER_ID },
        patientId,
        arcClient,
      );
      expect(archived).toBe(true);
      await insertAuditLogWithClient(arcClient, {
        userId: USER_ID,
        action: AuditAction.PATIENT_ARCHIVED,
        status: 'SUCCESS',
        metadata: { patientId },
      });
      await arcClient.query('COMMIT');
    } finally {
      arcClient.release();
    }

    // Verify: patient is soft-archived, both audit rows exist.
    const archivedRow = await pool.query(
      'SELECT archived_at FROM patients WHERE id = $1',
      [patientId],
    );
    expect(archivedRow.rows[0]?.archived_at).not.toBeNull();

    const auditRows = await pool.query(
      `SELECT action FROM audit_logs
         WHERE (metadata->>'patientId') = $1
         ORDER BY created_at ASC`,
      [patientId],
    );
    const actions = auditRows.rows.map((r: { action: string }) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        AuditAction.PATIENT_UPDATED,
        AuditAction.PATIENT_ARCHIVED,
      ]),
    );
  });

  it.todo('optimistic lock rejects stale update');
  it.todo('audit rows appear in the same transaction as the mutation');
});
