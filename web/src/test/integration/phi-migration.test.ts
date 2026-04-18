/**
 * Integration test for the 002_phi_storage.sql migration.
 *
 * Boots a real Postgres database via db-harness, applies both migrations,
 * and asserts:
 *   - 6 new tables exist
 *   - SOAP template seed row exists (hard-coded UUID)
 *   - 4 SOAP sections seeded in correct sort order
 *   - note_versions UPDATE trigger raises the expected exception
 *   - note_versions DELETE trigger raises the expected exception
 *
 * Skipped when DATABASE_URL_TEST is not set (CI/local without Postgres).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type pg from 'pg';
import { setupTestDb } from '../db-harness';

const SOAP_TEMPLATE_ID = '00000000-0000-0000-0000-000000000001';

describe.skipIf(!process.env.DATABASE_URL_TEST)('002_phi_storage migration', () => {
  let pool: pg.Pool;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const handle = await setupTestDb();
    pool = handle.pool;
    cleanup = handle.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  it('creates all 6 new tables', async () => {
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN (
           'note_templates',
           'note_template_sections',
           'patients',
           'clinical_notes',
           'note_versions',
           'user_style_preferences'
         )
       ORDER BY table_name`
    );
    const names = result.rows.map((r) => r.table_name);
    expect(names).toEqual([
      'clinical_notes',
      'note_template_sections',
      'note_templates',
      'note_versions',
      'patients',
      'user_style_preferences',
    ]);
  });

  it('seeds SOAP template row with is_builtin = TRUE', async () => {
    const result = await pool.query<{ id: string; name: string; is_builtin: boolean }>(
      `SELECT id, name, is_builtin FROM note_templates WHERE id = $1`,
      [SOAP_TEMPLATE_ID]
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('SOAP Note');
    expect(result.rows[0].is_builtin).toBe(true);
  });

  it('seeds 4 SOAP sections in Subjective/Objective/Assessment/Plan order', async () => {
    const result = await pool.query<{ title: string; sort_order: number; id: string }>(
      `SELECT id, title, sort_order
       FROM note_template_sections
       WHERE template_id = $1
       ORDER BY sort_order`,
      [SOAP_TEMPLATE_ID]
    );
    expect(result.rows).toHaveLength(4);
    expect(result.rows.map((r) => r.title)).toEqual([
      'Subjective',
      'Objective',
      'Assessment',
      'Plan',
    ]);
    expect(result.rows.map((r) => r.sort_order)).toEqual([1, 2, 3, 4]);
    expect(result.rows.map((r) => r.id)).toEqual([
      '00000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-000000000012',
      '00000000-0000-0000-0000-000000000013',
      '00000000-0000-0000-0000-000000000014',
    ]);
  });

  it('registers immutability triggers on note_versions', async () => {
    const result = await pool.query<{ trigger_name: string }>(
      `SELECT trigger_name
       FROM information_schema.triggers
       WHERE event_object_table = 'note_versions'
       ORDER BY trigger_name`
    );
    const names = result.rows.map((r) => r.trigger_name);
    expect(names).toContain('note_versions_no_update');
    expect(names).toContain('note_versions_no_delete');
  });

  it('rejects UPDATE on note_versions at the DB level', async () => {
    // Seed minimum FK chain: user → clinical_note → note_version
    const userResult = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash)
       VALUES ('mig-test@example.com', '$2a$12$fakehashfakehashfakehashfakehas')
       RETURNING id`
    );
    const userId = userResult.rows[0].id;

    const noteResult = await pool.query<{ id: string }>(
      `INSERT INTO clinical_notes
         (user_id, template_id, note_type, content, quick_notes)
       VALUES ($1, $2, 'daily_note', '[]'::jsonb, 'test notes')
       RETURNING id`,
      [userId, SOAP_TEMPLATE_ID]
    );
    const noteId = noteResult.rows[0].id;

    const versionResult = await pool.query<{ id: string }>(
      `INSERT INTO note_versions
         (note_id, section_id, version, content, source, created_by)
       VALUES ($1, '00000000-0000-0000-0000-000000000011', 1, 'original', 'generated', $2)
       RETURNING id`,
      [noteId, userId]
    );
    const versionId = versionResult.rows[0].id;

    await expect(
      pool.query(`UPDATE note_versions SET content = 'changed' WHERE id = $1`, [versionId])
    ).rejects.toThrow(/note_versions rows cannot be modified/);
  });

  it('rejects DELETE on note_versions at the DB level', async () => {
    // Reuse a seeded version row (depends on row inserted in the UPDATE-rejection test).
    const result = await pool.query<{ id: string }>(
      `SELECT id FROM note_versions LIMIT 1`
    );
    expect(result.rows).toHaveLength(1);
    const versionId = result.rows[0].id;

    await expect(
      pool.query(`DELETE FROM note_versions WHERE id = $1`, [versionId])
    ).rejects.toThrow(/note_versions rows cannot be deleted/);
  });

  it('enforces UNIQUE (note_id, section_id, version) on note_versions', async () => {
    // Try to insert a duplicate of the existing (noteId, section_id, version=1) row.
    const existing = await pool.query<{ note_id: string; section_id: string; created_by: string }>(
      `SELECT note_id, section_id, created_by FROM note_versions LIMIT 1`
    );
    const { note_id, section_id, created_by } = existing.rows[0];

    await expect(
      pool.query(
        `INSERT INTO note_versions
           (note_id, section_id, version, content, source, created_by)
         VALUES ($1, $2, 1, 'dup', 'generated', $3)`,
        [note_id, section_id, created_by]
      )
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it('enforces CHECK constraint on note_versions.source', async () => {
    const existing = await pool.query<{ note_id: string; created_by: string }>(
      `SELECT note_id, created_by FROM note_versions LIMIT 1`
    );
    await expect(
      pool.query(
        `INSERT INTO note_versions
           (note_id, section_id, version, content, source, created_by)
         VALUES ($1, '00000000-0000-0000-0000-000000000012', 1, 'x', 'invalid_source', $2)`,
        [existing.rows[0].note_id, existing.rows[0].created_by]
      )
    ).rejects.toThrow(/note_versions_source_check|check constraint/i);
  });

  it('enforces CHECK constraint on clinical_notes.note_type', async () => {
    const userResult = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash)
       VALUES ('mig-test-check@example.com', '$2a$12$fakehashfakehashfakehashfakehas')
       RETURNING id`
    );
    await expect(
      pool.query(
        `INSERT INTO clinical_notes
           (user_id, template_id, note_type, content, quick_notes)
         VALUES ($1, $2, 'invalid_type', '[]'::jsonb, 'notes')`,
        [userResult.rows[0].id, SOAP_TEMPLATE_ID]
      )
    ).rejects.toThrow(/clinical_notes_note_type_check|check constraint/i);
  });
});
