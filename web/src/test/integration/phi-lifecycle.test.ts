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
 * (useful locally without a dedicated Postgres). DAL modules are imported
 * dynamically inside `beforeAll` so the suite does not trigger the production
 * DATABASE_URL validation when skipped.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';

const hasTestDb = Boolean(process.env.DATABASE_URL_TEST);

const USER_ID = '00000000-0000-0000-0000-0000000fdf01';
const PATIENT_CREATED = 'PATIENT_CREATED';
const PATIENT_UPDATED = 'PATIENT_UPDATED';
const PATIENT_ARCHIVED = 'PATIENT_ARCHIVED';
const NOTE_SAVED = 'NOTE_SAVED';
const NOTE_UPDATED = 'NOTE_UPDATED';
const SOAP_TEMPLATE_ID = '00000000-0000-0000-0000-000000000001';
const SUB_SECTION_ID = '00000000-0000-0000-0000-000000000011';
const OBJ_SECTION_ID = '00000000-0000-0000-0000-000000000012';
const ASS_SECTION_ID = '00000000-0000-0000-0000-000000000013';
const PLA_SECTION_ID = '00000000-0000-0000-0000-000000000014';

async function seedUser(pool: pg.Pool): Promise<string> {
  // Minimal user row so patients.user_id FK is satisfied.
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
  let patientDal: typeof import('@/server/dal/patients');
  let auditDal: typeof import('@/server/dal/audit-logs');
  let notesDal: typeof import('@/server/dal/clinical-notes');
  let versionsDal: typeof import('@/server/dal/note-versions');

  beforeAll(async () => {
    // Lazy-load to avoid importing DATABASE_URL-validating modules when the
    // suite is skipped (no DATABASE_URL_TEST in the environment).
    const harness = await import('@/test/db-harness');
    const handle = await harness.setupTestDb();
    pool = handle.pool;
    cleanup = handle.cleanup;
    patientDal = await import('@/server/dal/patients');
    auditDal = await import('@/server/dal/audit-logs');
    notesDal = await import('@/server/dal/clinical-notes');
    versionsDal = await import('@/server/dal/note-versions');
    await seedUser(pool);
  });

  afterAll(async () => {
    await cleanup?.();
  });

  it('create patient + audit fires inside same transaction', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const patient = await patientDal.createPatient(
        { userId: USER_ID, organizationId: null },
        { firstName: 'Jane', lastName: 'Doe' },
        client,
      );
      await auditDal.insertAuditLogWithClient(client, {
        userId: USER_ID,
        action: PATIENT_CREATED as never,
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
        [PATIENT_CREATED, patient.id],
      );
      expect(auditResult.rows).toHaveLength(1);
    } finally {
      client.release();
    }
  });

  it('update patient context then archive — both audit rows committed atomically', async () => {
    const seedClient = await pool.connect();
    let patientId: string;
    try {
      await seedClient.query('BEGIN');
      const patient = await patientDal.createPatient(
        { userId: USER_ID, organizationId: null },
        { firstName: 'Seed', lastName: 'Patient' },
        seedClient,
      );
      patientId = patient.id;
      await seedClient.query('COMMIT');
    } finally {
      seedClient.release();
    }

    const updClient = await pool.connect();
    try {
      await updClient.query('BEGIN');
      const updated = await patientDal.updatePatient(
        { type: 'user', userId: USER_ID },
        patientId,
        { context: 'Chronic knee pain' },
        updClient,
      );
      expect(updated).not.toBeNull();
      await auditDal.insertAuditLogWithClient(updClient, {
        userId: USER_ID,
        action: PATIENT_UPDATED as never,
        status: 'SUCCESS',
        metadata: { patientId, fields: ['context'] },
      });
      await updClient.query('COMMIT');
    } finally {
      updClient.release();
    }

    const afterUpdate = await patientDal.findPatientById(
      { type: 'user', userId: USER_ID },
      patientId,
    );
    expect(afterUpdate).not.toBeNull();
    expect(afterUpdate?.context).toBe('Chronic knee pain');

    const arcClient = await pool.connect();
    try {
      await arcClient.query('BEGIN');
      const archived = await patientDal.archivePatient(
        { type: 'user', userId: USER_ID },
        patientId,
        arcClient,
      );
      expect(archived).toBe(true);
      await auditDal.insertAuditLogWithClient(arcClient, {
        userId: USER_ID,
        action: PATIENT_ARCHIVED as never,
        status: 'SUCCESS',
        metadata: { patientId },
      });
      await arcClient.query('COMMIT');
    } finally {
      arcClient.release();
    }

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
    const actions: string[] = auditRows.rows.map(
      (r: { action: string }) => r.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining([PATIENT_UPDATED, PATIENT_ARCHIVED]),
    );
  });

  // -------------------------------------------------------------------------
  // Plan 04-03 scenarios — notes save + update + versioning + M-1 conflict
  // -------------------------------------------------------------------------

  it('save note + createInitialVersions + NOTE_SAVED audit commit atomically', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const note = await notesDal.createClinicalNote(
        client,
        { userId: USER_ID, organizationId: null },
        {
          patientId: null,
          templateId: SOAP_TEMPLATE_ID,
          noteType: 'daily_note',
          content: [
            { sectionId: SUB_SECTION_ID, title: 'Subjective', content: 'S.' },
            { sectionId: OBJ_SECTION_ID, title: 'Objective', content: 'O.' },
            { sectionId: ASS_SECTION_ID, title: 'Assessment', content: 'A.' },
            { sectionId: PLA_SECTION_ID, title: 'Plan', content: 'P.' },
          ],
          quickNotes: 'pt reports pain 5/10',
          patientContext: null,
        },
      );
      await versionsDal.createInitialVersions(
        client,
        note.id,
        [
          { sectionId: SUB_SECTION_ID, title: 'Subjective', content: 'S.' },
          { sectionId: OBJ_SECTION_ID, title: 'Objective', content: 'O.' },
          { sectionId: ASS_SECTION_ID, title: 'Assessment', content: 'A.' },
          { sectionId: PLA_SECTION_ID, title: 'Plan', content: 'P.' },
        ],
        USER_ID,
      );
      await auditDal.insertAuditLogWithClient(client, {
        userId: USER_ID,
        action: NOTE_SAVED as never,
        status: 'SUCCESS',
        metadata: { noteId: note.id, sectionCount: 4 },
      });
      await client.query('COMMIT');

      // Verify atomic landing:
      const noteRow = await pool.query(
        'SELECT id FROM clinical_notes WHERE id = $1',
        [note.id],
      );
      expect(noteRow.rows).toHaveLength(1);

      const versionRows = await pool.query<{ version: number; source: string }>(
        'SELECT version, source FROM note_versions WHERE note_id = $1 ORDER BY section_id',
        [note.id],
      );
      expect(versionRows.rows).toHaveLength(4);
      for (const row of versionRows.rows) {
        expect(row.version).toBe(1);
        expect(row.source).toBe('generated');
      }

      const auditRow = await pool.query(
        `SELECT action FROM audit_logs WHERE action = $1 AND (metadata->>'noteId') = $2`,
        [NOTE_SAVED, note.id],
      );
      expect(auditRow.rows).toHaveLength(1);
    } finally {
      client.release();
    }
  });

  it('induced rollback (note save): createInitialVersions throws → 0 rows written', async () => {
    // Arrange: pre-create a patient we can link to (not strictly necessary but
    // verifies isolation of the rollback — patient should remain after rollback).
    const seedClient = await pool.connect();
    let patientId: string;
    try {
      await seedClient.query('BEGIN');
      const patient = await patientDal.createPatient(
        { userId: USER_ID, organizationId: null },
        { firstName: 'RollbackTest', lastName: 'Patient' },
        seedClient,
      );
      patientId = patient.id;
      await seedClient.query('COMMIT');
    } finally {
      seedClient.release();
    }

    // Act: start a note transaction, make an invalid version INSERT that must
    // fail (duplicate version=1 for same section_id), expect rollback.
    const client = await pool.connect();
    let note: Awaited<ReturnType<typeof notesDal.createClinicalNote>> | null = null;
    try {
      await client.query('BEGIN');
      note = await notesDal.createClinicalNote(
        client,
        { userId: USER_ID, organizationId: null },
        {
          patientId,
          templateId: SOAP_TEMPLATE_ID,
          noteType: 'daily_note',
          content: [
            { sectionId: SUB_SECTION_ID, title: 'Subjective', content: 'S.' },
          ],
          quickNotes: 'qn',
          patientContext: null,
        },
      );
      await versionsDal.createInitialVersions(
        client,
        note.id,
        [{ sectionId: SUB_SECTION_ID, title: 'Subjective', content: 'S.' }],
        USER_ID,
      );
      // Induce failure: insert the SAME (note_id, section_id, version=1) again.
      // UNIQUE constraint should trigger 23505.
      await versionsDal.createInitialVersions(
        client,
        note.id,
        [{ sectionId: SUB_SECTION_ID, title: 'Subjective', content: 'duplicate' }],
        USER_ID,
      );
      await client.query('COMMIT');
      // We should never reach here.
      expect.fail('Expected UNIQUE violation on duplicate (note_id, section_id, version)');
    } catch (err) {
      // ROLLBACK
      await client.query('ROLLBACK');
      expect((err as { code?: string }).code).toBe('23505');
    } finally {
      client.release();
    }

    // After rollback: no rows for this note id should exist.
    if (note) {
      const noteRows = await pool.query(
        'SELECT id FROM clinical_notes WHERE id = $1',
        [note.id],
      );
      expect(noteRows.rows).toHaveLength(0);
      const versionRows = await pool.query(
        'SELECT id FROM note_versions WHERE note_id = $1',
        [note.id],
      );
      expect(versionRows.rows).toHaveLength(0);
      const auditRows = await pool.query(
        `SELECT action FROM audit_logs WHERE (metadata->>'noteId') = $1`,
        [note.id],
      );
      expect(auditRows.rows).toHaveLength(0);
    }

    // Patient created in the seed transaction should remain (separate txn).
    const patientRow = await pool.query(
      'SELECT id FROM patients WHERE id = $1',
      [patientId],
    );
    expect(patientRow.rows).toHaveLength(1);
  });

  it('optimistic lock rejects stale update (updateClinicalNoteContent returns null)', async () => {
    // Create a note in its own transaction.
    const seedClient = await pool.connect();
    let note: Awaited<ReturnType<typeof notesDal.createClinicalNote>>;
    try {
      await seedClient.query('BEGIN');
      note = await notesDal.createClinicalNote(
        seedClient,
        { userId: USER_ID, organizationId: null },
        {
          patientId: null,
          templateId: SOAP_TEMPLATE_ID,
          noteType: 'daily_note',
          content: [
            { sectionId: SUB_SECTION_ID, title: 'Subjective', content: 'initial' },
          ],
          quickNotes: 'qn',
          patientContext: null,
        },
      );
      await seedClient.query('COMMIT');
    } finally {
      seedClient.release();
    }

    // Winner: update with correct expectedUpdatedAt, commits.
    const winClient = await pool.connect();
    try {
      await winClient.query('BEGIN');
      const result = await notesDal.updateClinicalNoteContent(
        winClient,
        { type: 'user', userId: USER_ID },
        note.id,
        [{ sectionId: SUB_SECTION_ID, title: 'Subjective', content: 'winner-edit' }],
        note.updatedAt,
      );
      expect(result).not.toBeNull();
      await winClient.query('COMMIT');
    } finally {
      winClient.release();
    }

    // Loser: retries with the pre-winner updatedAt → should return null.
    const loseClient = await pool.connect();
    try {
      await loseClient.query('BEGIN');
      const result = await notesDal.updateClinicalNoteContent(
        loseClient,
        { type: 'user', userId: USER_ID },
        note.id,
        [{ sectionId: SUB_SECTION_ID, title: 'Subjective', content: 'loser-edit' }],
        note.updatedAt, // stale token
      );
      expect(result).toBeNull();
      await loseClient.query('ROLLBACK');
    } finally {
      loseClient.release();
    }

    // Verify the winner's content is persisted (not the loser's).
    const contentRow = await pool.query<{ content: string }>(
      `SELECT (content->0->>'content') AS content
       FROM clinical_notes
       WHERE id = $1`,
      [note.id],
    );
    expect(contentRow.rows[0].content).toBe('winner-edit');
  });

  it('M-1 UNIQUE (note_id, section_id, version) violation is catchable as pg code 23505', async () => {
    const seedClient = await pool.connect();
    let note: Awaited<ReturnType<typeof notesDal.createClinicalNote>>;
    try {
      await seedClient.query('BEGIN');
      note = await notesDal.createClinicalNote(
        seedClient,
        { userId: USER_ID, organizationId: null },
        {
          patientId: null,
          templateId: SOAP_TEMPLATE_ID,
          noteType: 'daily_note',
          content: [
            { sectionId: SUB_SECTION_ID, title: 'Subjective', content: 'v1' },
          ],
          quickNotes: 'qn',
          patientContext: null,
        },
      );
      await versionsDal.createInitialVersions(
        seedClient,
        note.id,
        [{ sectionId: SUB_SECTION_ID, title: 'Subjective', content: 'v1' }],
        USER_ID,
      );
      // Pre-insert version 2 so the next caller's createVersionForSection
      // targeting version=2 will race.
      await versionsDal.createVersionForSection(
        seedClient,
        note.id,
        SUB_SECTION_ID,
        'v2',
        'manual',
        USER_ID,
      );
      await seedClient.query('COMMIT');
    } finally {
      seedClient.release();
    }

    // A fresh transaction tries to insert version=2 again (simulating the
    // concurrent-edit losing race). The UNIQUE index fires 23505.
    const conflictClient = await pool.connect();
    let caughtCode: string | undefined;
    try {
      await conflictClient.query('BEGIN');
      // Force a duplicate insert by using the internal path that computes
      // version as MAX(version)+1 — if that returns 2 due to stale snapshot,
      // the INSERT hits the UNIQUE constraint.
      // Simpler deterministic trigger: directly insert version=2 twice.
      await conflictClient.query(
        `INSERT INTO note_versions (note_id, section_id, version, content, source, created_by)
         VALUES ($1, $2, 2, 'conflict-edit', 'manual', $3)`,
        [note.id, SUB_SECTION_ID, USER_ID],
      );
      await conflictClient.query('COMMIT');
      expect.fail('Expected 23505 UNIQUE violation');
    } catch (err) {
      await conflictClient.query('ROLLBACK');
      caughtCode = (err as { code?: string }).code;
    } finally {
      conflictClient.release();
    }

    expect(caughtCode).toBe('23505');

    // Verify version=2 is still the original (seed) row, not the conflict one.
    const versionRow = await pool.query<{ content: string }>(
      `SELECT content FROM note_versions
         WHERE note_id = $1 AND section_id = $2 AND version = 2`,
      [note.id, SUB_SECTION_ID],
    );
    expect(versionRow.rows[0].content).toBe('v2');
  });

  it('audit row appears in the same transaction as the note update', async () => {
    // Create a note.
    const seedClient = await pool.connect();
    let note: Awaited<ReturnType<typeof notesDal.createClinicalNote>>;
    try {
      await seedClient.query('BEGIN');
      note = await notesDal.createClinicalNote(
        seedClient,
        { userId: USER_ID, organizationId: null },
        {
          patientId: null,
          templateId: SOAP_TEMPLATE_ID,
          noteType: 'daily_note',
          content: [
            { sectionId: SUB_SECTION_ID, title: 'Subjective', content: 'v1' },
          ],
          quickNotes: 'qn',
          patientContext: null,
        },
      );
      await seedClient.query('COMMIT');
    } finally {
      seedClient.release();
    }

    // Updating + audit in same transaction → both land.
    const updClient = await pool.connect();
    try {
      await updClient.query('BEGIN');
      const updated = await notesDal.updateClinicalNoteContent(
        updClient,
        { type: 'user', userId: USER_ID },
        note.id,
        [{ sectionId: SUB_SECTION_ID, title: 'Subjective', content: 'v2' }],
        note.updatedAt,
      );
      expect(updated).not.toBeNull();
      await versionsDal.createVersionForSection(
        updClient,
        note.id,
        SUB_SECTION_ID,
        'v2',
        'manual',
        USER_ID,
      );
      await auditDal.insertAuditLogWithClient(updClient, {
        userId: USER_ID,
        action: NOTE_UPDATED as never,
        status: 'SUCCESS',
        metadata: { noteId: note.id, editedSectionCount: 1 },
      });
      await updClient.query('COMMIT');
    } finally {
      updClient.release();
    }

    // Both NOTE_UPDATED audit + new version row visible after commit.
    const auditRows = await pool.query(
      `SELECT action FROM audit_logs
         WHERE action = $1 AND (metadata->>'noteId') = $2`,
      [NOTE_UPDATED, note.id],
    );
    expect(auditRows.rows).toHaveLength(1);

    const versionRows = await pool.query<{ version: number; source: string }>(
      `SELECT version, source FROM note_versions
         WHERE note_id = $1 AND section_id = $2
         ORDER BY version`,
      [note.id, SUB_SECTION_ID],
    );
    expect(versionRows.rows).toHaveLength(2);
    expect(versionRows.rows[1].version).toBe(2);
    expect(versionRows.rows[1].source).toBe('manual');
  });
});
