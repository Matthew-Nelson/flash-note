---
phase: 04-phi-storage
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/src/server/db/migrations/002_phi_storage.sql
  - web/src/lib/types/database.ts
  - web/src/lib/types/index.ts
  - web/src/server/types.ts
  - web/src/lib/schemas/patients.ts
  - web/src/lib/schemas/notes.ts
  - web/src/lib/schemas/index.ts
  - web/src/server/dal/note-templates.ts
  - web/src/server/dal/note-templates.test.ts
  - web/src/server/dal/patients.ts
  - web/src/server/dal/patients.test.ts
  - web/src/server/dal/clinical-notes.ts
  - web/src/server/dal/clinical-notes.test.ts
  - web/src/server/dal/note-versions.ts
  - web/src/server/dal/note-versions.test.ts
  - web/src/server/dal/user-style-preferences.ts
  - web/src/server/dal/user-style-preferences.test.ts
  - web/src/server/dal/index.ts
  - web/src/hooks/use-phi-cleanup.ts
  - web/src/hooks/use-phi-cleanup.test.tsx
  - web/src/server/lib/logger.ts
  - web/src/server/lib/logger.test.ts
  - web/src/test/factories/patient-factory.ts
  - web/src/test/factories/clinical-note-factory.ts
  - web/src/test/factories/note-version-factory.ts
  - web/src/test/factories/note-template-factory.ts
  - web/src/test/factories/user-style-preference-factory.ts
  - web/src/test/db-harness.ts
  - web/src/test/integration/phi-migration.test.ts
  - web/src/test/integration/phi-lifecycle.test.ts
autonomous: true
requirements:
  - PHI-05
  - PHI-09
  - PHI-10
  - PROMPT-03
must_haves:
  truths:
    - "Migration 002_phi_storage.sql applies cleanly against a fresh DB"
    - "SOAP seed template (id=00000000-0000-0000-0000-000000000001) exists with exactly 4 sections (Subjective/Objective/Assessment/Plan) after migration"
    - "note_versions UPDATE raises 'note_versions rows cannot be modified' at the DB level"
    - "note_versions DELETE raises 'note_versions rows cannot be deleted' at the DB level"
    - "findPatientById(userScope, id) returns null when patient belongs to a different user (Rule 5 enforcement)"
    - "usePhiCleanup fires the cleanup ref on pathname change and on flashnote:logout event"
    - "DB pool configuration verifies TLS is required for Cloud SQL connections (PHI-10 code-side prerequisite)"
    - "pnpm test --coverage passes with statements >= 97.79% and branches >= 95.46%"
  artifacts:
    - path: web/src/server/db/migrations/002_phi_storage.sql
      provides: "Schema for note_templates, note_template_sections, patients, clinical_notes, note_versions, user_style_preferences tables + SOAP seed"
      contains: "CREATE TABLE note_templates, CREATE TABLE note_template_sections, CREATE TABLE patients, CREATE TABLE clinical_notes, CREATE TABLE note_versions, CREATE TABLE user_style_preferences, prevent_note_version_update, prevent_note_version_delete, '00000000-0000-0000-0000-000000000001'"
    - path: web/src/server/dal/patients.ts
      provides: "createPatient, findPatientById, findPatientsByScope, updatePatient, archivePatient"
      exports: ["createPatient", "findPatientById", "findPatientsByScope", "updatePatient", "archivePatient"]
    - path: web/src/server/dal/clinical-notes.ts
      provides: "createClinicalNote, findClinicalNoteById, findClinicalNotesByScope, updateClinicalNoteContent, archiveClinicalNote"
      exports: ["createClinicalNote", "findClinicalNoteById", "findClinicalNotesByScope", "updateClinicalNoteContent", "archiveClinicalNote"]
    - path: web/src/server/dal/note-versions.ts
      provides: "createInitialVersions, createVersionForSection, findVersionsByNoteId, findLatestVersionsByNoteId"
      exports: ["createInitialVersions", "createVersionForSection", "findVersionsByNoteId", "findLatestVersionsByNoteId"]
    - path: web/src/server/dal/note-templates.ts
      provides: "findBuiltinTemplates, findTemplateById, findTemplatesByScope, findTemplateWithUserStyle"
      exports: ["findBuiltinTemplates", "findTemplateById", "findTemplatesByScope", "findTemplateWithUserStyle"]
    - path: web/src/server/dal/user-style-preferences.ts
      provides: "upsertUserSectionStyle, findUserStylePreferences"
      exports: ["upsertUserSectionStyle", "findUserStylePreferences"]
    - path: web/src/hooks/use-phi-cleanup.ts
      provides: "PHI state clearing on route change and logout"
      exports: ["usePhiCleanup"]
    - path: web/src/lib/schemas/patients.ts
      provides: "Zod schemas for patient inputs"
      exports: ["createPatientSchema", "updatePatientSchema", "updatePatientContextSchema", "patientSearchSchema", "pronounSchema"]
  key_links:
    - from: web/src/server/dal/patients.ts
      to: web/src/server/db/index.ts
      via: "db.query / getPoolClient"
      pattern: "import.*from '@/server/db'"
    - from: web/src/server/dal/index.ts
      to: web/src/server/dal/patients.ts
      via: "barrel export"
      pattern: "export \\* from './patients'"
    - from: web/src/server/dal/note-versions.ts
      to: web/src/lib/types
      via: "NoteVersion type consumption"
      pattern: "NoteVersion|NoteVersionSource"
    - from: web/src/hooks/use-phi-cleanup.ts
      to: next/navigation
      via: "usePathname"
      pattern: "usePathname"
---

<objective>
Plan 04-01 is the structural foundation for Phase 4 PHI Storage. Ships the database migration (5 new tables + 1 overlay table + triggers + SOAP seed data), all new DAL modules with scoped authorization, Zod schemas, domain + database TypeScript types, the `usePhiCleanup` hook for Rule 4 compliance, test factories, and a real-DB integration harness. No user-facing changes — existing pages and generator continue to work unchanged.

Purpose: de-risk the phase by landing the migration and data-access layer first. This plan is runtime-invisible but establishes every contract that Plan 04-02 (patients end-to-end) and Plan 04-03 (notes + templates + versioning) will consume. Schema is additive-only (forward-only migration rule from Phase 3). Coverage guardrails (95%+ branches, 97.79%+ statements) maintained by ~80 new tests across DAL + hook + schemas + migration smoke.

Output:
- Migration file committed and applies cleanly to a fresh DB
- 5 new DAL modules (patients, clinical-notes, note-versions, note-templates, user-style-preferences)
- Domain types + row types + new AuditAction enum values
- Zod schemas for patient + note inputs (including explicit `patientContextSnapshot` in saveNoteSchema)
- `usePhiCleanup` hook
- Test factories + real-DB harness (`web/src/test/db-harness.ts`)
- Pino redaction path list extended with PHI fields (APPENDED, not replacing existing paths)
- `phi-migration.test.ts` integration test asserting SOAP seed present
- Empty `phi-lifecycle.test.ts` scaffold (scenarios added incrementally in 04-02 and 04-03)
- PHI-10 code-side prerequisite: DB pool TLS configuration test (ops verification deferred to deploy phase per D-10)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/04-phi-storage/04-CONTEXT.md
@.planning/phases/04-phi-storage/04-RESEARCH.md
@.planning/phases/04-phi-storage/04-VALIDATION.md
@web/src/server/db/migrations/001_initial_schema.sql
@web/src/server/dal/users.ts
@web/src/server/dal/index.ts
@web/src/server/types.ts
@web/src/lib/types/index.ts
@web/src/lib/types/database.ts
@web/src/lib/schemas/notes.ts
@web/src/test/dal-helpers.ts

<interfaces>
<!-- Key contracts extracted from codebase — executor consumes these without exploring -->

From web/src/server/db/index.ts:
```typescript
export const pool: pg.Pool;
export function getPoolClient(): Promise<pg.PoolClient>;
export const db: { query: (text: string, params?: unknown[]) => Promise<pg.QueryResult> };
```

From web/src/server/types.ts (existing AuditAction enum — extend by adding new values, never replace):
```typescript
export enum AuditAction {
  LOGIN, LOGIN_FAILED, LOGOUT, REGISTER, NOTE_GENERATED,
  SUBSCRIPTION_*, ACCESS_DENIED, /* ...existing values... */
  // ADD in this plan (keep existing ones):
  PATIENT_CREATED, PATIENT_UPDATED, PATIENT_ARCHIVED, PATIENT_VIEWED,
  NOTE_SAVED, NOTE_UPDATED, NOTE_ARCHIVED, NOTE_VIEWED, NOTE_HISTORY_VIEWED,
  USER_PREFERENCES_UPDATED,
}
```

From web/src/server/dal/users.ts (reference pattern for row mapper + COLUMN constants + Rule 10 checks):
```typescript
const USER_COLUMNS = `id, email, password_hash, /* ... */`;
function rowToUser(row: UserRow): User { /* snake_case -> camelCase */ }
// INSERT ... RETURNING with result.rows.length === 0 defensive check
```

From web/src/server/services/audit.ts:
```typescript
export const auditService: {
  log(entry: AuditLogEntry): void;        // fire-and-forget
  logWithClient(client: pg.PoolClient, entry: AuditLogEntry): Promise<void>;  // transactional (Rule 9)
};
```

From web/src/lib/types/index.ts (existing):
```typescript
export type NoteType = 'daily_note' | 'initial_eval' | 'progress_note' | 'discharge';
export type SubscriptionStatus = /* ... */;
export type OrgRole = /* ... */;
// Phase 4 adds: Verbosity, Styling, NoteVersionSource, Pronoun, NoteSection,
// NoteTemplate, NoteTemplateSection, NoteTemplateWithSections, Patient,
// ClinicalNote, ClinicalNoteWithPatient, NoteVersion, NoteVersionWithSection.
```

From web/src/test/dal-helpers.ts:
```typescript
export function mockDbQuery(result: unknown): void;        // mocks pool.query return
export function mockClientQuery(result: unknown): void;    // mocks PoolClient.query return
export function setupMockClient(): MockPoolClient;         // returns spy-able PoolClient
export function createMockUserRow(overrides?: Partial<UserRow>): UserRow;
// Phase 4 adds: createMockPatientRow, createMockPatient, createMockNoteRow,
// createMockVersionRow, createMockTemplateRow, createMockTemplateSectionRow.
```

From web/src/server/db/migrations/001_initial_schema.sql (reference for trigger syntax — audit_logs immutability):
```sql
CREATE OR REPLACE FUNCTION prevent_audit_log_update() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'audit_logs rows cannot be modified'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_update();
-- Mirror this pattern for note_versions in 002.
```

QueryScope type (NEW — add to web/src/lib/types/index.ts or web/src/server/dal/types.ts):
```typescript
export type QueryScope =
  | { type: 'user'; userId: string }
  | { type: 'organization'; organizationId: string };
```
</interfaces>

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1a: Migration 002_phi_storage.sql + Pino redaction + db-harness + phi-migration integration + PHI-10 TLS config test</name>
  <files>
    web/src/server/db/migrations/002_phi_storage.sql,
    web/src/server/lib/logger.ts,
    web/src/server/lib/logger.test.ts,
    web/src/test/db-harness.ts,
    web/src/test/integration/phi-migration.test.ts,
    web/src/test/integration/db-config.test.ts
  </files>
  <read_first>
    - web/src/server/db/migrations/001_initial_schema.sql (trigger + immutability patterns, column ordering conventions, default DEFAULT NOW(), pg_extension check)
    - web/src/server/db/migrate.ts (confirm migration-runner reads files and tracks applied state by filename)
    - web/src/server/db/index.ts (DB pool config — SSL/TLS settings for Cloud SQL: confirm `ssl: { rejectUnauthorized: true }` or equivalent when `NODE_ENV === 'production'` and `DATABASE_URL` is Cloud SQL)
    - web/src/server/lib/logger.ts (existing Pino redaction paths — APPEND, do not replace; existing Phase 2 paths for `password`, `email`, `token` etc. MUST remain)
    - web/src/server/lib/logger.test.ts (existing Pino tests — add new PHI redaction path tests alongside the existing tests; verify pre-existing paths still pass)
    - .planning/phases/04-phi-storage/04-RESEARCH.md §2 (Schema & Migrations) and §2.1-2.8 (migration SQL — copy verbatim)
    - .planning/phases/04-phi-storage/04-RESEARCH.md §6.2 Option A (user_style_preferences table)
    - .planning/phases/04-phi-storage/04-CONTEXT.md §D-10 (PHI-10 split — code-side TLS config ships here, ops verification deferred)
  </read_first>
  <behavior>
    - Migration applies to empty DB without errors, creates 6 tables: note_templates, note_template_sections, patients, clinical_notes, note_versions, user_style_preferences.
    - set_updated_at() function created and attached to note_templates, note_template_sections, patients, clinical_notes via BEFORE UPDATE trigger. NOT attached to note_versions (append-only).
    - prevent_note_version_update() + prevent_note_version_delete() functions created and attached to note_versions.
    - SOAP template seeded with id '00000000-0000-0000-0000-000000000001' and is_builtin=TRUE.
    - 4 SOAP sections seeded with IDs '00000000-0000-0000-0000-00000000001[1-4]' and sort_order 1..4.
    - Section prompt_instructions placeholders ($PROMPT$<...>$PROMPT$) are literal placeholder strings in this plan — Plan 04-03 replaces them during prompt cutover. Use `$PROMPT$<Subjective section — prompt content ported in Plan 04-03>$PROMPT$` etc so the seed is valid SQL even pre-cutover.
    - INSERT statements use `ON CONFLICT DO NOTHING` as defense-in-depth (idempotent if re-run).
    - Pino redaction paths in `web/src/server/lib/logger.ts`: EXISTING paths (e.g., `password`, `email`, `token`, body/header paths added in Phase 2 02-01) MUST remain unchanged — new PHI field names (`firstName`, `lastName`, `dateOfBirth`, `phone`, `context`, `patientContext`, `quickNotes`, `content`) are APPENDED to the same array.
    - Pino redaction tests in `logger.test.ts` cover BOTH the old paths (regression guard) AND the new PHI paths — no Phase 2 redaction test may silently break.
    - db-harness.ts: boots a clean test DB via pg.Pool (DATABASE_URL_TEST env var), runs migrations 001 + 002, exports `setupTestDb(): Promise<{ pool, cleanup }>`. Skip tests if DATABASE_URL_TEST not set (use vitest.skipIf).
    - phi-migration.test.ts integration: runs db-harness, asserts SOAP template row exists with 4 sections in correct sort order, asserts immutability triggers exist via pg_trigger catalog query, asserts UPDATE and DELETE against note_versions raise the expected exceptions.
    - PHI-10 code-side prerequisite (per D-10): `web/src/test/integration/db-config.test.ts` asserts that when `NODE_ENV === 'production'` the DB pool is configured with `ssl.rejectUnauthorized: true` (or equivalent TLS enforcement). This is the code-side half of PHI-10 — the ops-side half (Cloud Logging sink + 6-year retention) remains deferred to the deploy phase.
  </behavior>
  <action>
1. Create `web/src/server/db/migrations/002_phi_storage.sql`. Copy the EXACT DDL from 04-RESEARCH.md §2.2 through §2.8, plus the user_style_preferences table from §6.2 Option A. Structure the file:

```sql
-- 002_phi_storage.sql
-- Phase 4: PHI Storage — patients, clinical notes, per-section append-only versioning, templates.

-- Ensure pgcrypto for gen_random_uuid() (check extensions first — pattern from 001)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Shared updated_at trigger function (reused across new tables)
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- note_templates
CREATE TABLE IF NOT EXISTS note_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE RESTRICT,
  organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  name            TEXT NOT NULL,
  is_builtin      BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_note_templates_user_name ON note_templates(user_id, name) WHERE archived_at IS NULL AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_note_templates_builtin ON note_templates(is_builtin) WHERE is_builtin = TRUE AND archived_at IS NULL;
CREATE TRIGGER note_templates_updated_at BEFORE UPDATE ON note_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- note_template_sections
CREATE TABLE IF NOT EXISTS note_template_sections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id         UUID NOT NULL REFERENCES note_templates(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  sort_order          INT NOT NULL,
  verbosity           TEXT NOT NULL DEFAULT 'concise' CHECK (verbosity IN ('concise', 'detailed')),
  styling             TEXT NOT NULL DEFAULT 'paragraph' CHECK (styling IN ('paragraph', 'bullets')),
  prompt_instructions TEXT NOT NULL,
  include_in_copy_all BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_note_template_sections_template_sort ON note_template_sections(template_id, sort_order);
CREATE TRIGGER note_template_sections_updated_at BEFORE UPDATE ON note_template_sections FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- patients (per 04-RESEARCH.md §2.5)
-- ... (copy exact DDL — includes user_id NOT NULL, organization_id nullable, first_name/last_name NOT NULL, date_of_birth DATE, pronoun TEXT, phone TEXT, email TEXT, context TEXT, archived_at, indexes, trigger)

-- clinical_notes (per §2.6) — includes modality + duration_minutes as first-class columns

-- note_versions (per §2.7 — append-only, UNIQUE INDEX on (note_id, section_id, version), prevent_note_version_update + prevent_note_version_delete triggers)

-- user_style_preferences (per §6.2 Option A — composite PK (user_id, section_id), updated_at trigger using set_updated_at)

-- SOAP seed (per §2.8 — hard-coded UUIDs, prompt_instructions use placeholder strings that Plan 04-03 replaces during prompt cutover)
INSERT INTO note_templates (id, user_id, organization_id, name, is_builtin)
VALUES ('00000000-0000-0000-0000-000000000001', NULL, NULL, 'SOAP Note', TRUE)
ON CONFLICT (id) DO NOTHING;
INSERT INTO note_template_sections (id, template_id, title, sort_order, verbosity, styling, prompt_instructions, include_in_copy_all) VALUES
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Subjective', 1, 'concise', 'paragraph', $PROMPT$<Subjective section — prompt content ported in Plan 04-03>$PROMPT$, TRUE),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Objective', 2, 'detailed', 'paragraph', $PROMPT$<Objective section — prompt content ported in Plan 04-03>$PROMPT$, TRUE),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Assessment', 3, 'concise', 'paragraph', $PROMPT$<Assessment section — prompt content ported in Plan 04-03>$PROMPT$, TRUE),
  ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'Plan', 4, 'concise', 'bullets', $PROMPT$<Plan section — prompt content ported in Plan 04-03>$PROMPT$, TRUE)
ON CONFLICT (id) DO NOTHING;
```

2. Extend `web/src/server/lib/logger.ts` Pino redaction paths. **CRITICAL — APPEND, do not replace.** Find the existing `redact` config (introduced Phase 2, 02-01 plan) which already includes Phase 2 paths like `password`, `email`, `token`, `*.password`, `req.headers.authorization` etc. Add NEW field names: `*.firstName`, `*.lastName`, `*.dateOfBirth`, `*.phone`, `*.context`, `*.patientContext`, `*.quickNotes`, `*.content`. Do not change the censor string. Do not remove any existing path.

3. Extend `web/src/server/lib/logger.test.ts`:
- PRESERVE every existing Phase 2 redaction test unchanged. New tests go alongside.
- Add new tests for each NEW PHI field name — assert logger output redacts `firstName`, `lastName`, `dateOfBirth`, `phone`, `context`, `patientContext`, `quickNotes`, `content` under nested paths.
- Add a "regression guard" test that explicitly asserts at least one legacy path (e.g. `password`) STILL redacts — any executor who accidentally replaces the paths array will fail this test.

4. Create `web/src/test/db-harness.ts`:
```typescript
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
export async function setupTestDb(): Promise<{ pool: pg.Pool; cleanup: () => Promise<void> }> {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('DATABASE_URL_TEST not set — skip db-harness tests');
  const pool = new pg.Pool({ connectionString: url });
  // Apply both migrations in order
  for (const file of ['001_initial_schema.sql', '002_phi_storage.sql']) {
    const sql = fs.readFileSync(path.join(process.cwd(), 'src/server/db/migrations', file), 'utf8');
    await pool.query(sql);
  }
  return { pool, cleanup: async () => { await pool.end(); } };
}
```

5. Create `web/src/test/integration/phi-migration.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb } from '../db-harness';
describe.skipIf(!process.env.DATABASE_URL_TEST)('phi migration', () => {
  let db: Awaited<ReturnType<typeof setupTestDb>>;
  beforeAll(async () => { db = await setupTestDb(); });
  afterAll(async () => { await db.cleanup(); });
  it('seeds SOAP template with 4 sections in sort order', async () => {
    const template = await db.pool.query("SELECT id FROM note_templates WHERE id='00000000-0000-0000-0000-000000000001'");
    expect(template.rows).toHaveLength(1);
    const sections = await db.pool.query("SELECT title, sort_order FROM note_template_sections WHERE template_id='00000000-0000-0000-0000-000000000001' ORDER BY sort_order");
    expect(sections.rows.map(r => r.title)).toEqual(['Subjective', 'Objective', 'Assessment', 'Plan']);
  });
  it('rejects UPDATE on note_versions at DB level', async () => {
    // Insert a note + version row via raw SQL, then attempt UPDATE and expect error
    await expect(db.pool.query("UPDATE note_versions SET content='x' WHERE id='...'"))
      .rejects.toThrow(/note_versions rows cannot be modified/);
  });
  it('rejects DELETE on note_versions at DB level', async () => {
    await expect(db.pool.query("DELETE FROM note_versions WHERE id='...'"))
      .rejects.toThrow(/note_versions rows cannot be deleted/);
  });
});
```

6. Create `web/src/test/integration/db-config.test.ts` — the PHI-10 code-side prerequisite (per D-10). Asserts the production DB pool config enforces TLS:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('DB pool TLS configuration (PHI-10 code-side)', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { process.env = originalEnv; });

  it('enforces TLS when NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://user:pass@example-cloud-sql:5432/flashnote';
    // Inspect the exported pool config — expect `ssl.rejectUnauthorized === true` OR the connection string to include `?sslmode=require` / `?sslmode=verify-full`.
    const { pool } = await import('@/server/db');
    const poolOptions = (pool as unknown as { options: { ssl?: { rejectUnauthorized?: boolean } } }).options;
    expect(
      poolOptions.ssl?.rejectUnauthorized === true
      || /sslmode=(require|verify-full)/.test(process.env.DATABASE_URL ?? ''),
    ).toBe(true);
  });
});
```
(Note: exact property access depends on pg.Pool internals — the executor may inspect `pool.options` directly or assert via the module's exported config builder. The point is a grep-verifiable + automated check that TLS is not accidentally dropped.)

7. Run `cd web && pnpm test logger db-config phi-migration` and confirm green (or skipped when no DATABASE_URL_TEST). Run `cd web && pnpm tsc --noEmit`.
  </action>
  <verify>
    <automated>cd web && pnpm test logger.test db-config.test 2>&1 | tail -40 && pnpm tsc --noEmit 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - File `web/src/server/db/migrations/002_phi_storage.sql` exists
    - `grep -c "CREATE TABLE" web/src/server/db/migrations/002_phi_storage.sql` returns 6
    - `grep "prevent_note_version_update\|prevent_note_version_delete" web/src/server/db/migrations/002_phi_storage.sql` finds both function definitions AND both trigger creations (4 matches total)
    - `grep "00000000-0000-0000-0000-000000000001" web/src/server/db/migrations/002_phi_storage.sql` finds the SOAP template UUID
    - `grep -E "00000000-0000-0000-0000-00000000001[1234]" web/src/server/db/migrations/002_phi_storage.sql` finds all 4 section UUIDs
    - `grep "ON CONFLICT.*DO NOTHING" web/src/server/db/migrations/002_phi_storage.sql` finds at least 2 matches
    - `grep "user_style_preferences" web/src/server/db/migrations/002_phi_storage.sql` finds the overlay table
    - **M-4 / Pino redaction preservation:** `grep -c "password\|email\|token" web/src/server/lib/logger.ts` returns >= 3 (legacy Phase 2 paths preserved)
    - **M-4 / Pino redaction preservation:** `grep -c "redact\|censor" web/src/server/lib/logger.test.ts` returns >= 2 (tests cover both old and new paths)
    - `grep "firstName\|lastName\|dateOfBirth\|context\|quickNotes\|patientContext" web/src/server/lib/logger.ts` confirms new Pino redaction paths appended
    - File `web/src/test/db-harness.ts` exists and exports `setupTestDb`
    - File `web/src/test/integration/phi-migration.test.ts` exists and references `note_versions cannot be modified` / `note_versions cannot be deleted`
    - **B-1 option (a):** File `web/src/test/integration/db-config.test.ts` exists and asserts `ssl.rejectUnauthorized` or `sslmode=require` is present when NODE_ENV=production (PHI-10 code-side prerequisite; ops-side verification deferred per D-10)
    - `cd web && pnpm test logger.test db-config.test` exits 0
    - `cd web && pnpm tsc --noEmit` exits 0
    - No `console.*` calls introduced (ESLint no-console enforced)
  </acceptance_criteria>
  <done>
    Migration creates 6 tables, triggers, and SOAP seed. Pino redaction appends new PHI field paths while preserving every Phase 2 path (regression guard test in place). db-harness + phi-migration integration test written. PHI-10 code-side prerequisite (TLS enforcement in DB pool config) shipped with an automated test; ops verification remains deferred to deploy phase per D-10.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 1b: Types + Zod schemas + AuditAction extension + test factories + phi-lifecycle scaffold</name>
  <files>
    web/src/lib/types/database.ts,
    web/src/lib/types/index.ts,
    web/src/server/types.ts,
    web/src/lib/schemas/patients.ts,
    web/src/lib/schemas/patients.test.ts,
    web/src/lib/schemas/notes.ts,
    web/src/lib/schemas/index.ts,
    web/src/test/integration/phi-lifecycle.test.ts,
    web/src/test/factories/patient-factory.ts,
    web/src/test/factories/clinical-note-factory.ts,
    web/src/test/factories/note-version-factory.ts,
    web/src/test/factories/note-template-factory.ts,
    web/src/test/factories/user-style-preference-factory.ts
  </files>
  <read_first>
    - web/src/server/types.ts (existing AuditAction enum — EXTEND, do not rewrite; existing values like LOGIN, LOGOUT, REGISTER, NOTE_GENERATED MUST remain)
    - web/src/lib/types/database.ts (existing row types — append new types)
    - web/src/lib/types/index.ts (existing domain types — append new types)
    - web/src/lib/schemas/notes.ts (existing generateNoteSchema — EXTEND with templateId + patientId; ADD saveNoteSchema with explicit `patientContextSnapshot` field and updateNoteSectionsSchema)
    - web/src/lib/schemas/index.ts (barrel export pattern)
    - web/src/test/dal-helpers.ts (factory/mock pattern — mirror for new factories)
    - .planning/phases/04-phi-storage/04-RESEARCH.md §2.9-2.10 (Row types + Domain types — copy verbatim)
    - .planning/phases/04-phi-storage/04-RESEARCH.md §5.1 (Zod schemas for patients), §5.2 (saveNoteSchema / updateNoteSectionsSchema), §5.4 (AuditAction additions), §6.2 (user_style_preferences types)
  </read_first>
  <behavior>
    - AuditAction enum extended with exactly 10 new values (PATIENT_CREATED, PATIENT_UPDATED, PATIENT_ARCHIVED, PATIENT_VIEWED, NOTE_SAVED, NOTE_UPDATED, NOTE_ARCHIVED, NOTE_VIEWED, NOTE_HISTORY_VIEWED, USER_PREFERENCES_UPDATED). Existing values (LOGIN, LOGOUT, REGISTER, NOTE_GENERATED, SUBSCRIPTION_*, etc.) MUST remain.
    - Zod schemas in web/src/lib/schemas/patients.ts reject: firstName/lastName outside 1-100 chars, invalid pronoun (not in 4-item enum), invalid email, context over 2000 chars, search query over 100 chars, pagination limit over 100.
    - Zod schemas in web/src/lib/schemas/notes.ts:
      - generateNoteSchema extended with `templateId: z.string().uuid()` + `patientId: z.string().uuid().optional().nullable()`.
      - **`saveNoteSchema` MUST include an explicit `patientContextSnapshot: z.string().max(2000).nullable().optional()` field** (B-3 — this field is consumed by saveNoteAction in 04-03; without it strict-mode Zod would strip it on parse).
      - `updateNoteSectionsSchema` validates `expectedUpdatedAt` as ISO datetime and `sections` as a non-empty Record<string, string>.
    - Test factories export: createMockPatient / createMockPatientRow / createMockNote / createMockNoteRow / createMockNoteSection / createMockVersionRow / createMockTemplate / createMockTemplateSection / createMockUserStylePreference — all with sensible defaults.
    - phi-lifecycle.test.ts scaffold: describes `describe('phi lifecycle')` with `it.todo('patient + note + version end-to-end happy path')`, `it.todo('induced rollback leaves no partial rows')`, `it.todo('optimistic lock rejects stale update')`, `it.todo('audit rows appear in the same transaction as the mutation')` — stubs Plans 04-02/04-03 will flesh out.
    - Zod schema tests (patients.test.ts) cover rejection paths for every constraint; notes.ts schema test additions cover saveNoteSchema accepting `patientContextSnapshot` and rejecting when > 2000 chars.
  </behavior>
  <action>
1. Add row types to `web/src/lib/types/database.ts` verbatim from 04-RESEARCH.md §2.9 (NoteTemplateRow, NoteTemplateSectionRow, PatientRow, ClinicalNoteRow, ClinicalNoteWithPatientRow, NoteVersionRow, NoteVersionWithSectionRow, UserStylePreferenceRow).

2. Add domain types to `web/src/lib/types/index.ts` verbatim from 04-RESEARCH.md §2.10 (Verbosity, Styling, NoteVersionSource, Pronoun, NoteSection, NoteTemplate, NoteTemplateSection, NoteTemplateWithSections, Patient, ClinicalNote, ClinicalNoteWithPatient, NoteVersion, NoteVersionWithSection) + add `export type QueryScope = { type: 'user'; userId: string } | { type: 'organization'; organizationId: string };`

3. Extend `web/src/server/types.ts` AuditAction enum by adding 10 new values **after** the existing ones:
```typescript
PATIENT_CREATED = 'PATIENT_CREATED',
PATIENT_UPDATED = 'PATIENT_UPDATED',
PATIENT_ARCHIVED = 'PATIENT_ARCHIVED',
PATIENT_VIEWED = 'PATIENT_VIEWED',
NOTE_SAVED = 'NOTE_SAVED',
NOTE_UPDATED = 'NOTE_UPDATED',
NOTE_ARCHIVED = 'NOTE_ARCHIVED',
NOTE_VIEWED = 'NOTE_VIEWED',
NOTE_HISTORY_VIEWED = 'NOTE_HISTORY_VIEWED',
USER_PREFERENCES_UPDATED = 'USER_PREFERENCES_UPDATED',
```
Do NOT remove or reorder existing enum values (LOGIN, LOGOUT, REGISTER, NOTE_GENERATED, SUBSCRIPTION_*, ACCESS_DENIED, etc. — they stay intact).

4. Create `web/src/lib/schemas/patients.ts` with verbatim schemas from 04-RESEARCH.md §5.1: `pronounSchema`, `createPatientSchema`, `updatePatientSchema`, `updatePatientContextSchema`, `patientSearchSchema`, and `CreatePatientInput`/`UpdatePatientInput`/`UpdatePatientContextInput` type aliases. Export a `patientIdSchema = z.string().uuid()` for URL param validation.

5. Extend `web/src/lib/schemas/notes.ts`: keep existing `generateNoteSchema`, ADD `templateId: z.string().uuid()` and `patientId: z.string().uuid().optional().nullable()` to its shape. ADD new schemas:

```typescript
// saveNoteSchema — B-3: MUST include explicit patientContextSnapshot field
// Without this, strict-mode Zod strips the field and saveNoteAction (in 04-03)
// fails to persist the context snapshot recorded at generation time.
export const saveNoteSchema = z.object({
  templateId: z.string().uuid(),
  patientId: z.string().uuid().nullable().optional(),
  noteType: z.enum(['daily_note', 'initial_eval', 'progress_note', 'discharge']),
  content: z.array(z.object({
    sectionId: z.string().uuid(),
    title: z.string().min(1).max(100),
    content: z.string().max(10000),
  })).min(1).max(20),
  quickNotes: z.string().min(10).max(5000),
  patientContextSnapshot: z.string().max(2000).nullable().optional(),  // <-- REQUIRED (B-3)
  modality: z.enum(['in_person', 'telehealth']).nullable().optional(),
  durationMinutes: z.number().int().positive().max(600).nullable().optional(),
  generationTimeMs: z.number().int().nonnegative().nullable().optional(),
});

export const updateNoteSectionsSchema = z.object({
  noteId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime(),
  sections: z.record(z.string().uuid(), z.string().max(10000))
    .refine(v => Object.keys(v).length > 0, 'At least one section required'),
});

export const updateSectionStyleSchema = z.object({
  sectionId: z.string().uuid(),
  verbosity: z.enum(['concise', 'detailed']).optional(),
  styling: z.enum(['paragraph', 'bullets']).optional(),
}).refine(v => v.verbosity !== undefined || v.styling !== undefined, 'At least one of verbosity or styling required');

export const noteIdSchema = z.string().uuid();
```

6. Extend `web/src/lib/schemas/index.ts` barrel to re-export patient schemas: `export * from './patients';`.

7. Create `web/src/test/integration/phi-lifecycle.test.ts` scaffold:
```typescript
import { describe, it } from 'vitest';
describe('phi lifecycle', () => {
  it.todo('patient + note + version end-to-end happy path');
  it.todo('induced rollback leaves no partial rows');
  it.todo('optimistic lock rejects stale update');
  it.todo('audit rows appear in the same transaction as the mutation');
});
```

8. Create factory files under `web/src/test/factories/`:
- `patient-factory.ts` — `createMockPatient`, `createMockPatientRow` with sensible fake data (non-PHI-looking; use "Test" "Patient").
- `clinical-note-factory.ts` — `createMockNote`, `createMockNoteRow`, `createMockNoteSection` (ensure content is `NoteSection[]`).
- `note-version-factory.ts` — `createMockVersionRow`, `createMockVersion`.
- `note-template-factory.ts` — `createMockTemplate`, `createMockTemplateSection`, `createMockTemplateWithSections`.
- `user-style-preference-factory.ts` — `createMockUserStylePreference`.
All accept `overrides: Partial<T>` and return deep-frozen objects.

9. Create `web/src/lib/schemas/patients.test.ts`: unit tests for every Zod rejection path (name too short/long, invalid pronoun, invalid email, context over 2000, search over 100, limit over 100, negative offset). Use `.safeParse` pattern.

10. Extend existing `web/src/lib/schemas/notes.test.ts` (or create if absent) with tests for the new `saveNoteSchema` including **a test that `patientContextSnapshot` is accepted when provided and stripped fields do NOT include it** — i.e., parse an input with `patientContextSnapshot: 'hx TKA 2024'` and assert `parsed.data.patientContextSnapshot === 'hx TKA 2024'` (B-3 verification).

11. Run `cd web && pnpm test schemas patients.test notes.test` and confirm green. Run `cd web && pnpm tsc --noEmit`.
  </action>
  <verify>
    <automated>cd web && pnpm test patients.test notes.test schemas 2>&1 | tail -40 && pnpm tsc --noEmit 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep "PATIENT_CREATED\|PATIENT_UPDATED\|PATIENT_ARCHIVED\|PATIENT_VIEWED\|NOTE_SAVED\|NOTE_UPDATED\|NOTE_ARCHIVED\|NOTE_VIEWED\|NOTE_HISTORY_VIEWED\|USER_PREFERENCES_UPDATED" web/src/server/types.ts` finds all 10 new enum values
    - **m-3 / AuditAction preservation:** `grep -cE "LOGIN|LOGOUT|REGISTER|NOTE_GENERATED" web/src/server/types.ts` returns >= 4 (existing values preserved)
    - `grep "createPatientSchema\|updatePatientSchema\|updatePatientContextSchema\|patientSearchSchema\|pronounSchema" web/src/lib/schemas/patients.ts` finds all 5 schemas
    - `grep "saveNoteSchema\|updateNoteSectionsSchema\|updateSectionStyleSchema" web/src/lib/schemas/notes.ts` finds all 3 new schemas
    - **B-3:** `grep "patientContextSnapshot" web/src/lib/schemas/notes.ts` returns >= 1 match (explicit field in saveNoteSchema)
    - `grep "templateId.*uuid\|z\\.string\\(\\)\\.uuid\\(\\)" web/src/lib/schemas/notes.ts` confirms generateNoteSchema was extended with templateId
    - `grep "QueryScope" web/src/lib/types/index.ts` finds the union type definition
    - `grep "PatientRow\|ClinicalNoteRow\|NoteVersionRow\|NoteTemplateRow\|NoteTemplateSectionRow\|UserStylePreferenceRow" web/src/lib/types/database.ts` finds all 6 row interfaces
    - `grep "Patient\\b\\|ClinicalNote\\b\\|NoteVersion\\b\\|NoteTemplate\\b\\|NoteSection\\b" web/src/lib/types/index.ts` confirms domain types exported
    - File `web/src/test/integration/phi-lifecycle.test.ts` exists with at least 3 `it.todo(` calls
    - Factory files exist at web/src/test/factories/{patient-factory,clinical-note-factory,note-version-factory,note-template-factory,user-style-preference-factory}.ts
    - `cd web && pnpm tsc --noEmit` exits 0
    - `cd web && pnpm test patients.test notes.test schemas` exits 0
    - No `console.*` calls introduced (ESLint no-console enforced)
  </acceptance_criteria>
  <done>
    Domain types, row types, Zod schemas (including explicit `patientContextSnapshot` in saveNoteSchema per B-3), and AuditAction enum extensions (preserving all existing values per m-3) are in place. Factory helpers + phi-lifecycle scaffold shipped. All unit tests for schemas pass, TS strict-mode compile passes.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: DAL modules + barrel export + DAL unit tests</name>
  <files>
    web/src/server/dal/patients.ts,
    web/src/server/dal/patients.test.ts,
    web/src/server/dal/clinical-notes.ts,
    web/src/server/dal/clinical-notes.test.ts,
    web/src/server/dal/note-versions.ts,
    web/src/server/dal/note-versions.test.ts,
    web/src/server/dal/note-templates.ts,
    web/src/server/dal/note-templates.test.ts,
    web/src/server/dal/user-style-preferences.ts,
    web/src/server/dal/user-style-preferences.test.ts,
    web/src/server/dal/index.ts
  </files>
  <read_first>
    - web/src/server/dal/users.ts (gold-standard DAL module: column constants, rowToUser mapper, Rule 10 defensive `result.rows.length === 0` checks, parameterized queries)
    - web/src/server/dal/sessions.ts (transaction handling with `PoolClient` + `getPoolClient()` + BEGIN/COMMIT/ROLLBACK)
    - web/src/server/dal/organizations.ts (scope-based filtering pattern — org_id membership checks)
    - web/src/server/dal/audit-logs.ts (auditService interface; logWithClient signature)
    - web/src/server/dal/index.ts (barrel export convention)
    - web/src/server/db/index.ts (pool + getPoolClient exports)
    - web/src/test/dal-helpers.ts (mockDbQuery / setupMockClient / createMockUserRow pattern — mirror for new DAL tests)
    - web/src/lib/types/index.ts AND web/src/lib/types/database.ts (domain types + row types added in Task 1b — needed for mapper signatures)
    - web/src/server/dal/users.test.ts (test pattern for DAL: mock pool.query, verify SQL substring, verify params, verify row mapping, verify Rule 5 scope enforcement)
    - .planning/phases/04-phi-storage/04-RESEARCH.md §4 (DAL Design) — copy function signatures verbatim
    - .planning/phases/04-phi-storage/04-RESEARCH.md §3.3 (Optimistic lock UPDATE SQL) and §3.5 (section edit flow)
    - .planning/phases/04-phi-storage/04-RESEARCH.md §6.2 Option A (user_style_preferences overlay + findTemplateWithUserStyle)
  </read_first>
  <behavior>
    - patients DAL: user A cannot read, update, or archive user B's patient (findPatientById returns null; updatePatient/archivePatient return null/false; verified in tests by mocking scope and asserting WHERE clause contains `user_id = $N`).
    - findPatientsByScope: supports search across first_name, last_name, and full-name concat with ILIKE; search term LIKE metachars (`%` and `_`) escaped; limit clamped to max 100; returns `{ patients, total }`.
    - clinical-notes DAL: createClinicalNote accepts a PoolClient (transactional-only); updateClinicalNoteContent enforces optimistic lock via `updated_at = $N` WHERE clause and returns null when rows affected = 0; findClinicalNoteById LEFT JOINs patients to hydrate patient_first_name/last_name; scope filtering on every query.
    - note-versions DAL: createInitialVersions bulk-inserts one row per section with version=1, source='generated', all within a single INSERT...VALUES...RETURNING; createVersionForSection uses a subquery `(SELECT COALESCE(MAX(version), 0) + 1 FROM note_versions WHERE note_id = $1 AND section_id = $2)` for the version number; findVersionsByNoteId joins clinical_notes for scope enforcement + note_template_sections for section_title.
    - note-templates DAL: findBuiltinTemplates returns SOAP with sections in sort_order ASC; findTemplateWithUserStyle overlays user_style_preferences rows onto the template's sections (if user has a preference for section X, use their verbosity/styling; else use template default).
    - user-style-preferences DAL: upsertUserSectionStyle uses `INSERT ... ON CONFLICT (user_id, section_id) DO UPDATE SET verbosity=EXCLUDED.verbosity, styling=EXCLUDED.styling, updated_at=NOW()`; findUserStylePreferences returns all preferences for a user.
    - Every DAL file includes `import 'server-only'` as its first import (Rule 5 enforcement — client bundles cannot import DAL).
    - Every DAL function that returns user-owned rows requires a QueryScope or userId arg and filters on it in SQL.
    - Every `INSERT/UPDATE/DELETE ... RETURNING` handler defensively checks `result.rows.length === 0` before accessing `rows[0]` (Rule 10).
    - Barrel export `index.ts` re-exports all new DAL modules.
    - DAL unit tests cover: happy path, scope rejection (wrong user/org), empty result (returns null / empty array), defensive Rule 10 check, LIKE-metachar escaping (patients search), optimistic lock stale rejection (clinical-notes), version MAX+1 SQL generation (note-versions), UNIQUE violation handling (note-versions — surfaced as thrown pg error).
  </behavior>
  <action>
1. Create `web/src/server/dal/patients.ts` with the signatures from 04-RESEARCH.md §4.2. Pattern after `users.ts`:

```typescript
import 'server-only';
import type pg from 'pg';
import { db, getPoolClient } from '@/server/db';
import type { Patient, Pronoun, QueryScope } from '@/lib/types';
import type { PatientRow } from '@/lib/types/database';

const PATIENT_COLUMNS = `id, user_id, organization_id, first_name, last_name, date_of_birth, pronoun, phone, email, context, archived_at, created_at, updated_at`;

function rowToPatient(row: PatientRow): Patient {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    pronoun: row.pronoun as Pronoun | null,
    phone: row.phone,
    email: row.email,
    context: row.context,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function scopeWhereClause(scope: QueryScope, startIdx: number): { sql: string; params: unknown[] } {
  if (scope.type === 'user') {
    return { sql: `user_id = $${startIdx}`, params: [scope.userId] };
  }
  return { sql: `organization_id = $${startIdx}`, params: [scope.organizationId] };
}

export async function createPatient(
  scope: { userId: string; organizationId: string | null },
  input: { firstName: string; lastName: string; dateOfBirth?: Date | null; pronoun?: Pronoun | null; phone?: string | null; email?: string | null; context?: string | null; }
): Promise<Patient> {
  const result = await db.query(
    `INSERT INTO patients (user_id, organization_id, first_name, last_name, date_of_birth, pronoun, phone, email, context)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${PATIENT_COLUMNS}`,
    [scope.userId, scope.organizationId ?? null, input.firstName, input.lastName, input.dateOfBirth ?? null, input.pronoun ?? null, input.phone ?? null, input.email ?? null, input.context ?? null]
  );
  if (result.rows.length === 0) {
    throw new Error('createPatient: INSERT returned no rows');
  }
  return rowToPatient(result.rows[0] as PatientRow);
}

export async function findPatientById(scope: QueryScope, patientId: string): Promise<Patient | null> {
  const { sql, params } = scopeWhereClause(scope, 1);
  const result = await db.query(
    `SELECT ${PATIENT_COLUMNS} FROM patients WHERE id = $${params.length + 1} AND ${sql} AND archived_at IS NULL`,
    [...params, patientId]
  );
  if (result.rows.length === 0) return null;
  return rowToPatient(result.rows[0] as PatientRow);
}

export async function findPatientsByScope(
  scope: QueryScope,
  input: { search?: string; limit?: number; offset?: number } = {}
): Promise<{ patients: Patient[]; total: number }> {
  const limit = Math.min(input.limit ?? 50, 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const { sql: scopeSql, params: scopeParams } = scopeWhereClause(scope, 1);
  const paramList: unknown[] = [...scopeParams];

  let searchClause = '';
  if (input.search && input.search.trim().length > 0) {
    const safe = input.search.trim().replace(/[\\%_]/g, '\\$&');
    const pattern = `%${safe}%`;
    paramList.push(pattern);
    const idx = paramList.length;
    searchClause = ` AND (first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR (first_name || ' ' || last_name) ILIKE $${idx})`;
  }

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM patients WHERE ${scopeSql} AND archived_at IS NULL${searchClause}`,
    paramList
  );
  const total = (countResult.rows[0] as { total: number })?.total ?? 0;

  paramList.push(limit, offset);
  const listResult = await db.query(
    `SELECT ${PATIENT_COLUMNS} FROM patients WHERE ${scopeSql} AND archived_at IS NULL${searchClause}
     ORDER BY last_name, first_name LIMIT $${paramList.length - 1} OFFSET $${paramList.length}`,
    paramList
  );
  return { patients: listResult.rows.map(r => rowToPatient(r as PatientRow)), total };
}

export async function updatePatient(scope: QueryScope, patientId: string, input: Partial<{ firstName: string; lastName: string; dateOfBirth: Date | null; pronoun: Pronoun | null; phone: string | null; email: string | null; context: string | null; }>): Promise<Patient | null> {
  // Build dynamic SET clause — only include keys present in input.
  // ... (enumerate all updatable columns; if no updatable keys, return existing row via findPatientById)
  // Use RETURNING and defensive rows.length check.
}

export async function archivePatient(scope: QueryScope, patientId: string): Promise<boolean> {
  const { sql, params } = scopeWhereClause(scope, 1);
  const result = await db.query(
    `UPDATE patients SET archived_at = NOW() WHERE id = $${params.length + 1} AND ${sql} AND archived_at IS NULL RETURNING id`,
    [...params, patientId]
  );
  return result.rows.length > 0;
}
```

2. Create `web/src/server/dal/clinical-notes.ts` with signatures from §4.3. Key details:
- `createClinicalNote(client: pg.PoolClient, ...)` — accepts a transactional client only. INSERT with RETURNING all columns.
- `findClinicalNoteById` LEFT JOINs patients: `SELECT cn.*, p.first_name AS patient_first_name, p.last_name AS patient_last_name FROM clinical_notes cn LEFT JOIN patients p ON p.id = cn.patient_id WHERE cn.id = $1 AND <scope WHERE>` (scope on clinical_notes.user_id or organization_id).
- `findClinicalNotesByScope` supports `{ patientId?, noteType?, limit, offset }` filters, paginated, sorted by `created_at DESC`.
- `updateClinicalNoteContent(client, scope, noteId, content, expectedUpdatedAt)`:
  ```sql
  UPDATE clinical_notes SET content = $1, updated_at = NOW()
  WHERE id = $2 AND <scope> AND updated_at = $3 AND archived_at IS NULL
  RETURNING <columns>
  ```
  Returns null if `rows.length === 0` (ambiguous between not-found and stale — caller maps both to `conflict` error per RESEARCH.md §5.5 minor refinement).
- `archiveClinicalNote(scope, noteId)` — soft-delete.
- Implement `rowToClinicalNote(row)` that Zod-parses `row.content` via `z.array(z.object({ sectionId, title, content }))` per Rule 3 (Zod-parse JSONB on read).

3. Create `web/src/server/dal/note-versions.ts` with signatures from §4.4:
```typescript
export async function createInitialVersions(client: pg.PoolClient, noteId: string, content: NoteSection[], userId: string): Promise<NoteVersion[]> {
  // Bulk INSERT using UNNEST or multi-row VALUES
  // e.g. INSERT INTO note_versions (note_id, section_id, version, content, source, created_by)
  //      SELECT $1, UNNEST($2::uuid[]), 1, UNNEST($3::text[]), 'generated', $4
  //      RETURNING <columns>
  const sectionIds = content.map(s => s.sectionId);
  const contents = content.map(s => s.content);
  const result = await client.query(
    `INSERT INTO note_versions (note_id, section_id, version, content, source, created_by)
     SELECT $1::uuid, unnest($2::uuid[]), 1, unnest($3::text[]), 'generated', $4::uuid
     RETURNING id, note_id, section_id, version, content, source, created_by, created_at`,
    [noteId, sectionIds, contents, userId]
  );
  return result.rows.map(rowToNoteVersion);
}

export async function createVersionForSection(client: pg.PoolClient, noteId: string, sectionId: string, content: string, source: NoteVersionSource, userId: string): Promise<NoteVersion> {
  const result = await client.query(
    `INSERT INTO note_versions (note_id, section_id, version, content, source, created_by)
     VALUES ($1, $2, (SELECT COALESCE(MAX(version), 0) + 1 FROM note_versions WHERE note_id = $1 AND section_id = $2), $3, $4, $5)
     RETURNING id, note_id, section_id, version, content, source, created_by, created_at`,
    [noteId, sectionId, content, source, userId]
  );
  if (result.rows.length === 0) throw new Error('createVersionForSection: INSERT returned no rows');
  return rowToNoteVersion(result.rows[0]);
}

export async function findVersionsByNoteId(scope: QueryScope, noteId: string): Promise<NoteVersionWithSection[]> {
  // Join clinical_notes for scope enforcement, note_template_sections for title
  // SELECT nv.*, nts.title AS section_title
  // FROM note_versions nv
  // INNER JOIN clinical_notes cn ON cn.id = nv.note_id
  // INNER JOIN note_template_sections nts ON nts.id = nv.section_id
  // WHERE nv.note_id = $1 AND <scope on cn>
  // ORDER BY nv.section_id, nv.version DESC
}

export async function findLatestVersionsByNoteId(scope: QueryScope, noteId: string): Promise<NoteVersionWithSection[]> {
  // SELECT DISTINCT ON (section_id) ... ORDER BY section_id, version DESC
}
```

4. Create `web/src/server/dal/note-templates.ts` with signatures from §4.1 and §6.2:
```typescript
export async function findBuiltinTemplates(): Promise<NoteTemplateWithSections[]> {
  // Single query: LEFT JOIN note_template_sections, group rows by template_id, sort sections by sort_order.
}
export async function findTemplateById(templateId: string): Promise<NoteTemplateWithSections | null>;
export async function findTemplatesByScope(scope: QueryScope): Promise<NoteTemplate[]>;
export async function findTemplateWithUserStyle(templateId: string, userId: string): Promise<NoteTemplateWithSections | null>;
// Overlay: LEFT JOIN user_style_preferences usp ON usp.section_id = nts.id AND usp.user_id = $2
// Use COALESCE(usp.verbosity, nts.verbosity) and COALESCE(usp.styling, nts.styling) in SELECT.
```

5. Create `web/src/server/dal/user-style-preferences.ts`:
```typescript
export async function upsertUserSectionStyle(userId: string, sectionId: string, input: { verbosity?: Verbosity; styling?: Styling }): Promise<UserStylePreference> {
  // Load current (if any), merge with input, upsert.
  // INSERT ... ON CONFLICT (user_id, section_id) DO UPDATE SET
  //   verbosity = COALESCE(EXCLUDED.verbosity, user_style_preferences.verbosity),
  //   styling = COALESCE(EXCLUDED.styling, user_style_preferences.styling),
  //   updated_at = NOW()
  // RETURNING ...
  // Defensive Rule 10 check.
}

export async function findUserStylePreferences(userId: string): Promise<UserStylePreference[]>;
```

6. Update `web/src/server/dal/index.ts` barrel:
```typescript
export * from './audit-logs';
// ... existing exports ...
export * from './patients';
export * from './clinical-notes';
export * from './note-versions';
export * from './note-templates';
export * from './user-style-preferences';
```

7. Write DAL test files mirroring `web/src/server/dal/users.test.ts` pattern. Tests MUST:
- Mock `pool.query` via `mockDbQuery` (or the equivalent helper).
- Assert SQL substring contains `WHERE user_id = $N` or `WHERE organization_id = $N` (scope filter — Rule 5).
- Assert `archived_at IS NULL` filter present on all list/read queries.
- Verify Rule 10 defensive check: test the path where mock returns `{ rows: [] }` on an INSERT RETURNING — createPatient throws; updatePatient returns null; archivePatient returns false.
- patients.test.ts: verify user A scope cannot read user B's patient (mock returns empty rows for wrong-user query); verify search LIKE escape (search input `john%_test` becomes `%john\\%\\_test%` in parameter); verify limit clamping (input 999 → query uses 100).
- clinical-notes.test.ts: verify updateClinicalNoteContent returns null when `rows.length === 0` (stale updated_at); verify content is Zod-parsed via NoteContentSchema on rowToClinicalNote; verify findClinicalNoteById joins patients.
- note-versions.test.ts: verify createInitialVersions uses `unnest` pattern (SQL contains `unnest`); verify createVersionForSection SQL contains `COALESCE(MAX(version), 0) + 1`; verify immutability — asserting tests are NOT triggered because UPDATEs/DELETEs don't exist in the module (grep the file).
- note-templates.test.ts: verify findTemplateWithUserStyle uses LEFT JOIN user_style_preferences AND COALESCE() in projection; verify findBuiltinTemplates filters is_builtin = TRUE.
- user-style-preferences.test.ts: verify upsert uses ON CONFLICT (user_id, section_id); verify COALESCE preserves existing values when partial input.

8. Run `cd web && pnpm test dal` and confirm green. Run `pnpm tsc --noEmit` and confirm no errors.
  </action>
  <verify>
    <automated>cd web && pnpm test patients.test clinical-notes.test note-versions.test note-templates.test user-style-preferences.test 2>&1 | tail -40 && pnpm tsc --noEmit 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - Every new DAL file (patients.ts, clinical-notes.ts, note-versions.ts, note-templates.ts, user-style-preferences.ts) starts with `import 'server-only';` as the first import
    - **m-10 (first-line check):** `head -1 web/src/server/dal/patients.ts | grep "'server-only'"` matches (adapt same check for each DAL module)
    - `grep -l "import 'server-only'" web/src/server/dal/patients.ts web/src/server/dal/clinical-notes.ts web/src/server/dal/note-versions.ts web/src/server/dal/note-templates.ts web/src/server/dal/user-style-preferences.ts` returns all 5 files
    - `grep "WHERE.*user_id = \\\$\\|WHERE.*organization_id = \\\$" web/src/server/dal/patients.ts web/src/server/dal/clinical-notes.ts` returns at least 4 matches (each DAL filters by scope)
    - `grep "archived_at IS NULL" web/src/server/dal/patients.ts web/src/server/dal/clinical-notes.ts web/src/server/dal/note-templates.ts` returns at least 6 matches
    - `grep "result\\.rows\\.length === 0" web/src/server/dal/patients.ts web/src/server/dal/clinical-notes.ts web/src/server/dal/note-versions.ts web/src/server/dal/user-style-preferences.ts` returns at least 5 matches (Rule 10 defensive checks)
    - `grep "COALESCE(MAX(version), 0) + 1" web/src/server/dal/note-versions.ts` returns 1 match
    - `grep "unnest" web/src/server/dal/note-versions.ts` returns at least 1 match (bulk insert for createInitialVersions)
    - `grep -c "UPDATE note_versions\\|DELETE FROM note_versions" web/src/server/dal/note-versions.ts` returns 0 (append-only DAL)
    - `grep "LEFT JOIN user_style_preferences\\|user_style_preferences" web/src/server/dal/note-templates.ts` returns at least 1 match
    - `grep "ON CONFLICT.*user_id.*section_id" web/src/server/dal/user-style-preferences.ts` matches
    - `grep "updated_at = \\\$" web/src/server/dal/clinical-notes.ts` matches (optimistic lock in updateClinicalNoteContent)
    - `grep -E "replace.*\\[.*%.*_.*\\]|escape.*LIKE|\\\\\\\\%" web/src/server/dal/patients.ts` confirms LIKE metachar escaping in search
    - `grep "NoteContentSchema\\|NoteSectionSchema" web/src/server/dal/clinical-notes.ts` confirms JSONB Zod-parsing on read (Rule 3)
    - `grep "export \\* from './patients'\\|export \\* from './clinical-notes'\\|export \\* from './note-versions'\\|export \\* from './note-templates'\\|export \\* from './user-style-preferences'" web/src/server/dal/index.ts` finds all 5 barrel entries
    - `cd web && pnpm test patients.test clinical-notes.test note-versions.test note-templates.test user-style-preferences.test` all exit 0
    - `cd web && pnpm tsc --noEmit` exits 0
    - Test count increases by at least 60 (estimated per RESEARCH.md §10.1 — ~80 new tests for Plan 04-01 across DAL + schemas + hook)
  </acceptance_criteria>
  <done>
    All 5 DAL modules ship with Rule 5 scope enforcement, Rule 10 defensive checks, Rule 3 JSONB validation, and the append-only invariant for note_versions. Barrel exports updated. Unit tests cover scope rejection, Rule 10 paths, LIKE-metachar escape, optimistic-lock stale rejection, and overlay COALESCE behavior for style preferences. Tests pass, TS compiles, coverage gate maintained.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: usePhiCleanup hook + tests</name>
  <files>
    web/src/hooks/use-phi-cleanup.ts,
    web/src/hooks/use-phi-cleanup.test.tsx
  </files>
  <read_first>
    - web/src/components/auth/LogoutButton.tsx (locate the `flashnote:logout` event dispatch — confirm event name matches)
    - web/src/test/setup.ts (vitest global config — React 19 cleanup, jsdom)
    - .planning/phases/04-phi-storage/04-RESEARCH.md §8.6 (usePhiCleanup spec — copy verbatim)
    - web/src/hooks/ (confirm directory does not yet exist — may need to create)
    - next/navigation docs for usePathname (via Context7 if uncertain)
  </read_first>
  <behavior>
    - Hook subscribes to pathname changes via `usePathname()`; when pathname differs from last, calls `cleanup.current()`.
    - Hook subscribes to `flashnote:logout` custom window event; calls `cleanup.current()` on dispatch.
    - Unmount cleanly removes the event listener.
    - Accepts cleanup as a `MutableRefObject<() => void>` (ref pattern allows callers to update the cleanup fn without re-running the effect).
    - Hook is a client module — file includes `'use client'` directive at top.
  </behavior>
  <action>
1. Create `web/src/hooks/use-phi-cleanup.ts` with the exact content from 04-RESEARCH.md §8.6:
```typescript
'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import type React from 'react';

/**
 * Clears PHI-bearing state when the user navigates away from a page.
 *
 * React's useEffect cleanup is asynchronous and not guaranteed to run before
 * browser navigation (especially Back/Forward). Subscribing to pathname changes
 * gives us synchronous cleanup on route change.
 *
 * Also listens for the global 'flashnote:logout' event (fired by LogoutButton)
 * for PHI clearing on sign-out (CLAUDE.md Rule 4).
 *
 * Usage:
 *   const cleanupRef = useRef(() => {
 *     setGeneratedNote(null);
 *     setEditBuffer({});
 *     setPatientContext('');
 *     abortControllerRef.current?.abort();
 *   });
 *   usePhiCleanup(cleanupRef);
 */
export function usePhiCleanup(cleanup: React.MutableRefObject<() => void>): void {
  const pathname = usePathname();
  const lastPathname = useRef(pathname);

  useEffect(() => {
    if (lastPathname.current !== pathname) {
      cleanup.current();
      lastPathname.current = pathname;
    }
  }, [pathname, cleanup]);

  useEffect(() => {
    const handler = (): void => cleanup.current();
    window.addEventListener('flashnote:logout', handler);
    return () => {
      window.removeEventListener('flashnote:logout', handler);
    };
  }, [cleanup]);
}
```

2. Create `web/src/hooks/use-phi-cleanup.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { usePhiCleanup } from './use-phi-cleanup';

const pathnameMock = vi.hoisted(() => vi.fn(() => '/dashboard'));
vi.mock('next/navigation', () => ({ usePathname: pathnameMock }));

describe('usePhiCleanup', () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue('/dashboard');
  });

  it('calls cleanup on pathname change', () => {
    const cleanup = vi.fn();
    const { rerender } = renderHook(() => {
      const ref = useRef(cleanup);
      usePhiCleanup(ref);
    });
    expect(cleanup).not.toHaveBeenCalled();
    pathnameMock.mockReturnValue('/dashboard/patients');
    rerender();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('does not call cleanup when pathname unchanged', () => {
    const cleanup = vi.fn();
    const { rerender } = renderHook(() => {
      const ref = useRef(cleanup);
      usePhiCleanup(ref);
    });
    rerender();
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('calls cleanup on flashnote:logout event', () => {
    const cleanup = vi.fn();
    renderHook(() => {
      const ref = useRef(cleanup);
      usePhiCleanup(ref);
    });
    window.dispatchEvent(new Event('flashnote:logout'));
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('removes event listener on unmount', () => {
    const cleanup = vi.fn();
    const { unmount } = renderHook(() => {
      const ref = useRef(cleanup);
      usePhiCleanup(ref);
    });
    unmount();
    window.dispatchEvent(new Event('flashnote:logout'));
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('uses latest cleanup ref without re-subscribing', () => {
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();
    const { rerender } = renderHook(
      ({ fn }: { fn: () => void }) => {
        const ref = useRef(fn);
        ref.current = fn; // caller updates ref
        usePhiCleanup(ref);
      },
      { initialProps: { fn: cleanup1 } },
    );
    rerender({ fn: cleanup2 });
    window.dispatchEvent(new Event('flashnote:logout'));
    expect(cleanup2).toHaveBeenCalled();
    expect(cleanup1).not.toHaveBeenCalled();
  });
});
```

3. Run `cd web && pnpm test use-phi-cleanup.test` and confirm green.
  </action>
  <verify>
    <automated>cd web && pnpm test use-phi-cleanup.test 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - File `web/src/hooks/use-phi-cleanup.ts` exists
    - `head -1 web/src/hooks/use-phi-cleanup.ts` equals `'use client';`
    - `grep "usePathname" web/src/hooks/use-phi-cleanup.ts` matches
    - `grep "flashnote:logout" web/src/hooks/use-phi-cleanup.ts` matches (both addEventListener and cleanup-return removeEventListener — 2 matches)
    - `grep -c "flashnote:logout" web/src/hooks/use-phi-cleanup.ts` returns 2
    - `grep "MutableRefObject" web/src/hooks/use-phi-cleanup.ts` matches
    - File `web/src/hooks/use-phi-cleanup.test.tsx` exists with at least 4 `it(` test blocks
    - `cd web && pnpm test use-phi-cleanup.test` exits 0
    - `cd web && pnpm tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>
    usePhiCleanup hook exists and tests pass for pathname-change cleanup, logout-event cleanup, unmount listener cleanup, and ref-based cleanup update without re-subscription. Hook is a pure client module with no server dependencies.
  </done>
</task>

</tasks>

<verification>
After all tasks complete:
1. `cd web && pnpm test --coverage` exits 0 with statements >= 97.79% and branches >= 95.46%
2. `cd web && pnpm tsc --noEmit` exits 0
3. `cd web && pnpm lint` exits 0
4. `grep -r "import.*'@/server/dal/patients\\|clinical-notes\\|note-versions\\|note-templates\\|user-style-preferences'" web/src/app/ web/src/components/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v 'server/' | grep -v "'use server'" | wc -l` returns 0 (no client-side imports of DAL)
5. Existing note generation flow still works: `cd web && pnpm test note-generation` exits 0 (regression check — Plan 04-01 is strictly additive, must not break existing flow)
6. Migration file content reviewed manually to confirm SOAP seed placeholders will be replaced in Plan 04-03
</verification>

<success_criteria>
- Migration 002_phi_storage.sql exists, creates 6 tables + triggers + SOAP seed, applies cleanly against a fresh DB
- All 5 DAL modules exist, enforce Rule 5 scope filtering, Rule 10 defensive row checks, Rule 3 runtime Zod parsing of JSONB
- Append-only invariant for note_versions verified at DB level (UPDATE and DELETE trigger rejections) AND at DAL level (no UPDATE/DELETE SQL in note-versions.ts)
- Types (database.ts row types, index.ts domain types, QueryScope union) land without breaking existing code
- 10 new AuditAction enum values added without removing existing ones (m-3 regression guard enforces this)
- Zod schemas (patients + notes extensions) cover every required input path with max-length and enum constraints
- saveNoteSchema explicitly includes `patientContextSnapshot` field (B-3 — required for 04-03 saveNoteAction to persist the snapshot)
- PHI-10 code-side prerequisite (DB pool TLS enforcement) shipped with an automated test; ops verification remains deferred to deploy phase per D-10 (B-1 option a)
- Pino logger extended to redact new PHI field names while preserving Phase 2 paths (M-4 regression guard test in place)
- usePhiCleanup hook passes all 4+ behavioral tests
- Factory helpers + db-harness + phi-migration integration test in place for downstream plans
- Test count delta: ~80+ new passing tests
- Coverage gate maintained: statements >= 97.79%, branches >= 95.46%
- Runtime visibility: ZERO — no user-facing changes (existing pages + generator unchanged)
</success_criteria>

<output>
After completion, create `.planning/phases/04-phi-storage/04-01-SUMMARY.md` summarizing:
- Files created / modified
- Key DAL function signatures exported (for downstream plan reference)
- SOAP template + section UUIDs (hard-coded — downstream plans reference these)
- Pino redaction paths added (and confirmation that Phase 2 paths preserved)
- AuditAction enum values added (and confirmation existing values preserved)
- PHI-10 code-side prerequisite shipped (TLS enforcement test); ops-side deferred to deploy phase
- saveNoteSchema `patientContextSnapshot` field present (consumed by 04-03 saveNoteAction)
- Test count delta and coverage figures
- Any deviation from RESEARCH.md §2.9/§4 signatures
- Gotchas encountered (e.g., pg driver UUID array param shape, unnest parametrization edge cases)
</output>
</content>
</invoke>