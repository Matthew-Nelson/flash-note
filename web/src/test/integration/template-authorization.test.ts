/**
 * Template authorization against real Postgres: the ownership predicate in
 * isTemplateUsableByUser (used by saveNoteAction) must hold in SQL, not just
 * in the string the unit tests match. findTemplateWithUserStyle uses the same
 * predicate but queries through the module pool, which this harness doesn't
 * point at the test database.
 *
 * Gated on DATABASE_URL_TEST; skips cleanly without it.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';

const hasTestDb = Boolean(process.env.DATABASE_URL_TEST);

const USER_A = '00000000-0000-0000-0000-00000000a0a1';
const USER_B = '00000000-0000-0000-0000-00000000b0b1';
const BUILTIN_SOAP_ID = '00000000-0000-0000-0000-000000000001';
const B_TEMPLATE_ID = '00000000-0000-0000-0000-00000000b7e1';
const B_ARCHIVED_TEMPLATE_ID = '00000000-0000-0000-0000-00000000b7e2';

describe.skipIf(!hasTestDb)('template authorization (real-DB integration)', () => {
  let pool: pg.Pool;
  let cleanup: () => Promise<void>;
  let templatesDal: typeof import('@/server/dal/note-templates');

  beforeAll(async () => {
    const harness = await import('@/test/db-harness');
    const handle = await harness.setupTestDb();
    pool = handle.pool;
    cleanup = handle.cleanup;
    templatesDal = await import('@/server/dal/note-templates');

    for (const id of [USER_A, USER_B]) {
      await pool.query(
        `INSERT INTO users (id, email, password_hash, subscription_status, trial_ends_at, email_verified)
         VALUES ($1, $2, $3, 'trialing', NOW() + interval '14 days', true)`,
        [id, `template-authz-${id}@test.example`, 'x'.repeat(60)],
      );
    }
    await pool.query(
      `INSERT INTO note_templates (id, user_id, name, is_builtin, archived_at)
       VALUES ($1, $3, 'B custom', FALSE, NULL),
              ($2, $3, 'B archived', FALSE, NOW())`,
      [B_TEMPLATE_ID, B_ARCHIVED_TEMPLATE_ID, USER_B],
    );
  });

  afterAll(async () => {
    await cleanup?.();
  });

  async function usable(templateId: string, userId: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      return await templatesDal.isTemplateUsableByUser(client, templateId, userId);
    } finally {
      client.release();
    }
  }

  it("user A cannot use user B's template", async () => {
    expect(await usable(B_TEMPLATE_ID, USER_A)).toBe(false);
  });

  it('user B can use their own template', async () => {
    expect(await usable(B_TEMPLATE_ID, USER_B)).toBe(true);
  });

  it('any user can use the built-in SOAP template', async () => {
    expect(await usable(BUILTIN_SOAP_ID, USER_A)).toBe(true);
  });

  it('an archived template is unusable, even by its owner', async () => {
    expect(await usable(B_ARCHIVED_TEMPLATE_ID, USER_B)).toBe(false);
  });

  it('an unknown template id is unusable', async () => {
    expect(await usable('00000000-0000-0000-0000-0000000dead1', USER_A)).toBe(false);
  });
});
