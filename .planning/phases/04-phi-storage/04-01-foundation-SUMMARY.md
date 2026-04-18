---
phase: 04-phi-storage
plan: 01
subsystem: database
tags: [postgres, hipaa, dal, zod, pino, pg, react-hooks, migrations]

# Dependency graph
requires:
  - phase: 01-migration
    provides: DAL pattern, Rule 5 boundary, users/sessions schema
  - phase: 02-structured-logging
    provides: Pino logger with PHI redaction paths
  - phase: 03-pipeline-provisioning
    provides: Migration runner pattern, forward-only migration convention
provides:
  - 002_phi_storage.sql migration (5 PHI tables + user_style_preferences overlay)
  - note_versions DB-level immutability triggers (PHI-05 defense-in-depth)
  - SOAP template seed with stable UUIDs (template/sections: 00000000-...-0000000000[01/11/12/13/14])
  - 5 DAL modules with Rule 5 scope enforcement (patients, clinical-notes, note-versions, note-templates, user-style-preferences)
  - Domain types (Patient, ClinicalNote, NoteVersion, NoteTemplate, NoteSection, UserStylePreference, QueryScope)
  - Row types (PatientRow, ClinicalNoteRow, NoteVersionRow, NoteTemplateRow, NoteTemplateSectionRow, UserStylePreferenceRow)
  - Zod schemas (createPatientSchema, updatePatientSchema, updatePatientContextSchema, patientSearchSchema, saveNoteSchema with explicit patientContextSnapshot per B-3, updateNoteSectionsSchema, updateSectionStyleSchema)
  - AuditAction enum +10 values (PATIENT_CREATED/UPDATED/ARCHIVED/VIEWED, NOTE_SAVED/UPDATED/ARCHIVED/VIEWED/HISTORY_VIEWED, USER_PREFERENCES_UPDATED)
  - usePhiCleanup React hook (Rule 4 — route-change + logout PHI clearing)
  - Pino PHI redaction paths extended (firstName, lastName, phone, context, content + *.wildcards)
  - buildPoolConfig TLS enforcement (PHI-10 code-side per D-10)
  - Real-DB integration harness (db-harness.ts) + phi-migration integration test
  - Test factories for every new domain type
affects: [04-02-patients, 04-03-notes-versioning]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — verified vs web/package.json
  patterns:
    - "QueryScope discriminated union for DAL Rule 5 boundary"
    - "Overlay table (user_style_preferences) + LEFT JOIN + COALESCE for per-user preferences on shared built-in templates"
    - "DB-level immutability triggers for append-only tables (mirrors audit_logs pattern from 001)"
    - "JSONB content validated via exported Zod schema on read (Rule 3)"
    - "LIKE metachar escape + 100-item limit clamp for user-supplied search"
    - "Optimistic lock via updated_at = $N in UPDATE WHERE (returns null on conflict)"
    - "unnest() for bulk INSERT of one row per section (createInitialVersions)"
    - "COALESCE(MAX(version), 0) + 1 subquery for concurrency-safe version number assignment"
    - "usePhiCleanup ref-pattern: MutableRefObject<() => void> so callers can update cleanup without re-subscribing effect"

key-files:
  created:
    - "web/src/server/db/migrations/002_phi_storage.sql"
    - "web/src/server/dal/patients.ts"
    - "web/src/server/dal/clinical-notes.ts"
    - "web/src/server/dal/note-versions.ts"
    - "web/src/server/dal/note-templates.ts"
    - "web/src/server/dal/user-style-preferences.ts"
    - "web/src/lib/schemas/patients.ts"
    - "web/src/hooks/use-phi-cleanup.ts"
    - "web/src/test/db-harness.ts"
    - "web/src/test/integration/phi-migration.test.ts"
    - "web/src/test/integration/phi-lifecycle.test.ts (scaffold for 04-02/03)"
    - "web/src/test/integration/db-config.test.ts (PHI-10 code-side)"
    - "web/src/test/factories/{patient,clinical-note,note-version,note-template,user-style-preference}-factory.ts"
  modified:
    - "web/src/server/lib/logger.ts (appended 13 Phase 4 redaction paths)"
    - "web/src/server/db/index.ts (exported buildPoolConfig with production TLS enforcement)"
    - "web/src/server/types.ts (extended AuditAction with 10 values)"
    - "web/src/lib/types/database.ts (added 6 row types)"
    - "web/src/lib/types/index.ts (added 12+ domain types + QueryScope)"
    - "web/src/lib/schemas/notes.ts (extended generateNoteSchema + 4 new schemas)"
    - "web/src/lib/schemas/index.ts (barrel re-exports)"
    - "web/src/server/dal/index.ts (barrel re-exports)"

key-decisions:
  - "Option A for style preferences: separate user_style_preferences overlay table, LEFT JOIN + COALESCE in findTemplateWithUserStyle (Research §6.2) — built-in template rows never mutated"
  - "DB-level immutability triggers on note_versions (mirrors audit_logs pattern from 001) — defense-in-depth over DAL-level no-UPDATE convention"
  - "Hard-coded stable UUIDs for SOAP template + sections (00000000-0000-0000-0000-000000000001/11/12/13/14) — referenced by clinical_notes.content[].sectionId, must not drift across environments"
  - "SOAP seed uses placeholder $PROMPT$...$PROMPT$ strings (valid SQL) — Plan 04-03 replaces with ported PT prompt content during clean cutover (D-06)"
  - "saveNoteSchema explicitly declares patientContextSnapshot (B-3) so Zod doesn't strip it — saveNoteAction in 04-03 persists the generation-time context snapshot"
  - "buildPoolConfig exported from @/server/db with production TLS enforcement: ssl.rejectUnauthorized=true unless DATABASE_URL already signals sslmode or Cloud SQL proxy tunnel (PHI-10 code-side per D-10)"
  - "clinical_notes.modality and duration_minutes promoted to first-class columns (not JSONB metadata) — enables CHECK constraints and future index-by-duration"
  - "updateClinicalNoteContent returns null for both not-found and stale-updated_at — caller maps both to 'conflict' (Research §5.5 minor refinement; simpler UX)"
  - "LIKE metachar escape applied DAL-side even though Zod caps search at 100 chars — defense-in-depth"

patterns-established:
  - "Every new DAL file starts with `import 'server-only'` as first import (Rule 5)"
  - "Every RETURNING path defensively checks rows.length === 0 (Rule 10)"
  - "Scope whereClause helper builds parameterized scope filter fragment for user/org discrimination"
  - "Test factories live at web/src/test/factories/*-factory.ts; export create{Row,Mock}<Type>() with sensible non-PHI-looking defaults"

requirements-completed:
  - PHI-05  # Append-only versioning (DB triggers + DAL invariant)
  - PHI-09  # Audit logging for PHI read access (enum values landed; wired in 04-02/03)
  - PHI-10  # TLS enforcement code-side (ops-side deferred per D-10)
  - PROMPT-03  # Template-level style preferences (schema + DAL; UI in 04-03)

# Metrics
duration: 26min
completed: 2026-04-18
---

# Phase 04 Plan 01: Foundation Summary

**Structural foundation for PHI Storage: 6-table migration (patients, clinical_notes, note_versions append-only, note_templates, note_template_sections, user_style_preferences), 5 scope-enforced DAL modules, Zod schemas with explicit patientContextSnapshot for B-3, usePhiCleanup hook, and PHI-10 code-side TLS enforcement — no user-facing behavior, all contracts ready for 04-02/03**

## Performance

- **Duration:** ~26 min
- **Started:** 2026-04-18T20:32:34Z
- **Completed:** 2026-04-18T20:58:57Z
- **Tasks:** 4 (all TDD: red test → green code → refactor)
- **Commits:** 5 task commits + metadata commit to follow
- **Files created:** 24
- **Files modified:** 8
- **Tests added:** ~220 (1493 → 1713 pnpm test count)
- **New DAL tests:** 144 (patients 35, clinical-notes 30, note-versions 19, note-templates 16, user-style-preferences 10, plus 9 integration for migration + 8 for TLS config)

## Accomplishments

- **Migration 002_phi_storage.sql applies cleanly** to a fresh DB, creates 6 tables + 6 indexes + 3 shared triggers + 2 immutability triggers + SOAP seed with 4 sections; `ON CONFLICT DO NOTHING` on seed for idempotency
- **All 5 DAL modules** ship with `import 'server-only'` as first line, parameterized queries only, scope filtering on every read/write/archive, Rule 10 defensive row checks on every RETURNING path, and `archived_at IS NULL` on list/detail queries
- **note_versions append-only invariant** enforced at two levels: (1) DAL module contains zero UPDATE/DELETE SQL against note_versions (grep-verified by test), (2) DB triggers raise 'note_versions rows cannot be modified/deleted' exceptions
- **Optimistic lock + UNIQUE INDEX** combination on clinical_notes/note_versions handles concurrent per-section edits without SELECT FOR UPDATE lock contention
- **usePhiCleanup hook** (Rule 4) clears PHI on pathname change AND flashnote:logout event; ref-based API lets consumers update cleanup logic without re-subscribing the effect
- **Pino PHI redaction** extended with 13 new paths (firstName, lastName, phone, context, content + 8 `*.wildcard` variants) while preserving all 14 Phase 2 paths; explicit regression guard tests added
- **PHI-10 code-side prerequisite** (per D-10) shipped: `buildPoolConfig()` enforces `ssl.rejectUnauthorized=true` in production unless DATABASE_URL already signals `sslmode=` or a Cloud-SQL-proxy tunnel; 8 unit tests covering the matrix
- **saveNoteSchema explicitly declares patientContextSnapshot** (B-3) so Zod's strict mode doesn't strip the field; consumed by saveNoteAction in Plan 04-03

## Task Commits

1. **Task 1a: Migration + Pino redaction + db-harness + phi-migration integration + TLS config test** — `0f60fff` (feat)
2. **Task 1b: Types + Zod schemas + AuditAction extension + test factories + phi-lifecycle scaffold** — `ebd9cc1` (feat)
3. **Task 3: DAL modules + barrel export + DAL unit tests** — `6aa10ef` (feat)
4. **Task 4: usePhiCleanup hook + tests** — `03d1b3a` (feat)
5. **Coverage hardening: nullable coalesce + modality parse branches** — `73e602e` (test)

**Plan metadata commit:** to follow (SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md)

## Files Created/Modified

### Created

- `web/src/server/db/migrations/002_phi_storage.sql` — 6-table migration + SOAP seed
- `web/src/server/dal/patients.ts` — create/find/update/archive; scope filter; LIKE escape; limit clamp
- `web/src/server/dal/clinical-notes.ts` — transactional create, LEFT JOIN patients on read, optimistic-lock update, JSONB Zod-parse on read (exports NoteContentSchema)
- `web/src/server/dal/note-versions.ts` — append-only; createInitialVersions (unnest bulk insert), createVersionForSection (MAX+1 subquery), findVersionsByNoteId + findLatestVersionsByNoteId (DISTINCT ON) with scope via INNER JOIN clinical_notes
- `web/src/server/dal/note-templates.ts` — findBuiltinTemplates, findTemplateById, findTemplatesByScope, findTemplateWithUserStyle (LEFT JOIN + COALESCE overlay)
- `web/src/server/dal/user-style-preferences.ts` — upsertUserSectionStyle (ON CONFLICT user_id+section_id DO UPDATE with COALESCE), findUserStylePreferences
- `web/src/lib/schemas/patients.ts` — pronounSchema, patientIdSchema, createPatientSchema, updatePatientSchema, updatePatientContextSchema, patientSearchSchema
- `web/src/hooks/use-phi-cleanup.ts` — Rule 4 PHI clearing hook
- `web/src/test/db-harness.ts` — real-DB integration test harness (DATABASE_URL_TEST gated)
- `web/src/test/integration/phi-migration.test.ts` — SOAP seed + trigger + UNIQUE/CHECK assertions
- `web/src/test/integration/phi-lifecycle.test.ts` — scaffold (it.todo for 04-02/03)
- `web/src/test/integration/db-config.test.ts` — PHI-10 TLS matrix (8 tests)
- `web/src/test/factories/{patient,clinical-note,note-version,note-template,user-style-preference}-factory.ts`
- `web/src/server/dal/*.test.ts` (5 new DAL test files, 110 tests total)
- `web/src/lib/schemas/patients.test.ts` (40 tests)
- `web/src/hooks/use-phi-cleanup.test.tsx` (8 tests)
- `.planning/phases/04-phi-storage/deferred-items.md` (baseline coverage gap log)

### Modified

- `web/src/server/lib/logger.ts` — appended Phase 4 PHI redaction paths
- `web/src/server/lib/logger.test.ts` — added Phase 4 redaction tests + regression guard
- `web/src/server/db/index.ts` — exported `buildPoolConfig()` with TLS enforcement
- `web/src/server/types.ts` — AuditAction enum +10 values (Phase 4)
- `web/src/lib/types/database.ts` — added 6 row types
- `web/src/lib/types/index.ts` — added 12 domain types + QueryScope
- `web/src/lib/schemas/notes.ts` — extended generateNoteSchema; added saveNoteSchema (B-3), updateNoteSectionsSchema, updateSectionStyleSchema, noteIdSchema
- `web/src/lib/schemas/notes.test.ts` — 27 new tests for new schemas
- `web/src/lib/schemas/index.ts` — barrel re-exports
- `web/src/server/dal/index.ts` — barrel re-exports for 5 new DAL modules

## Key DAL Function Signatures Exported

**For downstream plan reference (Plans 04-02 and 04-03 consume these):**

```typescript
// patients.ts
createPatient(scope: { userId; organizationId }, input): Promise<Patient>
findPatientById(scope: QueryScope, id): Promise<Patient | null>
findPatientsByScope(scope, { search, limit, offset }): Promise<{ patients, total }>
updatePatient(scope, id, partial): Promise<Patient | null>
archivePatient(scope, id): Promise<boolean>

// clinical-notes.ts
createClinicalNote(client: PoolClient, scope, input): Promise<ClinicalNote>  // transactional
findClinicalNoteById(scope, id): Promise<ClinicalNoteWithPatient | null>  // LEFT JOIN patients
findClinicalNotesByScope(scope, { patientId, noteType, limit, offset }): Promise<{ notes, total }>
updateClinicalNoteContent(client, scope, id, content, expectedUpdatedAt): Promise<ClinicalNote | null>  // optimistic lock
archiveClinicalNote(scope, id): Promise<boolean>
export const NoteContentSchema  // Rule 3 JSONB validator

// note-versions.ts — APPEND-ONLY, no UPDATE/DELETE
createInitialVersions(client, noteId, content, userId): Promise<NoteVersion[]>  // version=1, source=generated
createVersionForSection(client, noteId, sectionId, content, source, userId): Promise<NoteVersion>  // MAX+1
findVersionsByNoteId(scope, noteId): Promise<NoteVersionWithSection[]>
findLatestVersionsByNoteId(scope, noteId): Promise<NoteVersionWithSection[]>

// note-templates.ts
findBuiltinTemplates(): Promise<NoteTemplateWithSections[]>
findTemplateById(id): Promise<NoteTemplateWithSections | null>
findTemplatesByScope(scope): Promise<NoteTemplate[]>
findTemplateWithUserStyle(templateId, userId): Promise<NoteTemplateWithSections | null>  // user overlay

// user-style-preferences.ts
upsertUserSectionStyle(userId, sectionId, { verbosity?, styling? }): Promise<UserStylePreference>
findUserStylePreferences(userId): Promise<UserStylePreference[]>
```

## SOAP Template UUIDs (stable across environments)

- **Template:** `00000000-0000-0000-0000-000000000001`
- **Subjective:** `00000000-0000-0000-0000-000000000011`
- **Objective:** `00000000-0000-0000-0000-000000000012`
- **Assessment:** `00000000-0000-0000-0000-000000000013`
- **Plan:** `00000000-0000-0000-0000-000000000014`

## Pino Redaction Paths (Phase 4 additions)

**Preserved from Phase 2:** `patient`, `patientName`, `patientData`, `patientContext`, `diagnosis`, `treatment`, `noteContent`, `soapNote`, `quickNotes`, `shorthand`, `dateOfBirth`, `medicalRecordNumber`, `req.body`, `res.body` (14 paths).

**Added in Plan 04-01:** `firstName`, `lastName`, `phone`, `context`, `content`, `*.firstName`, `*.lastName`, `*.dateOfBirth`, `*.phone`, `*.context`, `*.patientContext`, `*.quickNotes`, `*.content` (13 paths).

Regression guard tests explicitly assert at least 3 Phase 2 paths still redact after the append.

## AuditAction Enum Values (Phase 4 additions)

All 37 existing values preserved (LOGIN, LOGOUT, REGISTER, NOTE_GENERATED, SUBSCRIPTION_*, ACCESS_DENIED, ORG_*, INVITE_CODE_* etc.). Added 10:

`PATIENT_CREATED`, `PATIENT_UPDATED`, `PATIENT_ARCHIVED`, `PATIENT_VIEWED`, `NOTE_SAVED`, `NOTE_UPDATED`, `NOTE_ARCHIVED`, `NOTE_VIEWED`, `NOTE_HISTORY_VIEWED`, `USER_PREFERENCES_UPDATED`.

## PHI-10 Code-Side Prerequisite

`buildPoolConfig()` exported from `@/server/db` enforces TLS in production:

- **Default:** `ssl: { rejectUnauthorized: true }` when `NODE_ENV=production` and DATABASE_URL has no sslmode and is not a Cloud SQL proxy tunnel
- **Skipped:** when DATABASE_URL contains `sslmode=require`/`verify-ca`/`verify-full`, or the connection is via Cloud SQL Auth Proxy (`@127.0.0.1`, `@localhost`, or `host=/cloudsql/`)
- **Skipped:** in development and test mode

**Ops-side verification** (Cloud Logging sink for audit retention + Cloud SQL TLS flag audit) **remains deferred to the deploy phase per D-10**. ROADMAP marks PHI-10 as "code complete, ops deferred".

## saveNoteSchema B-3 Compliance

`saveNoteSchema` explicitly includes `patientContextSnapshot: z.string().max(2000).nullable().optional()`. Zod strict-mode would strip an undeclared field on parse — this declaration ensures Plan 04-03's `saveNoteAction` can persist the generation-time context snapshot that the LLM ran against.

## Decisions Made

See `key-decisions` in frontmatter. Highlights:

- **Option A overlay table** (`user_style_preferences`) for per-user style prefs — avoids mutating built-in template seed; clean LEFT JOIN + COALESCE overlay in `findTemplateWithUserStyle`
- **DB-level immutability triggers** on `note_versions` (mirrors `audit_logs` from 001) — defense-in-depth over DAL no-UPDATE convention
- **Stable hard-coded UUIDs** for SOAP template + sections — `clinical_notes.content[].sectionId` FKs these; UUIDs must not drift across environments
- **Placeholder prompt_instructions** in migration seed — Plan 04-03 replaces them during prompt cutover; placeholders are valid SQL so migration applies cleanly pre-cutover
- **updateClinicalNoteContent returns null for both not-found and stale** — caller maps both to `conflict`; simpler UX than distinguishing
- **modality + duration_minutes promoted** to first-class columns (not JSONB metadata) — enables CHECK constraints + future filter/sort

## Deviations from Plan

None material. Minor adaptations:

1. **db-config.test.ts mock strategy** — the plan suggested inspecting `pool.options` directly, but pg.Pool internals vary. Refactored to export `buildPoolConfig()` from `@/server/db` so the test asserts on the config builder directly instead of pool internals. Still satisfies the intent: automated + grep-verifiable TLS enforcement check.

2. **Production DB pool now has TLS-enforcement logic** — the existing `db/index.ts` had a commented note about TLS being the caller's responsibility via DATABASE_URL. Plan required "the DB pool is configured with `ssl.rejectUnauthorized: true` when NODE_ENV=production". Added a real `buildPoolConfig` helper so production deployment doesn't silently ship without TLS. (Rule 2: missing critical functionality — PHI-10 mandate.)

## Issues Encountered

- **TypeScript readonly `NODE_ENV`** — Next.js type defs declare `process.env.NODE_ENV` as readonly. Fixed by casting to `Record<string, string | undefined>` in the test only.
- **Initial clinical-notes test typo** — one test had an unintended `? false :` conditional that made the assertion a no-op. Fixed to a plain `expect(sql).toContain('$6::jsonb')`.
- **Factory default mismatch** — one user-style-preferences test used the factory's default `user_id` but asserted the test's `USER_A`. Fixed by overriding `user_id` in the factory call.

None required material plan deviations.

## Deferred Issues

**Pre-existing baseline branch coverage gap** — `pnpm test --coverage` reports 93.62% branches at HEAD, below the 95% configured threshold. The gap predates this plan and is driven by unrelated files (`lib/telemetry.ts` 54.54%, `server/services/audit.ts` 50%, etc.). All new 04-01 files individually ship at ≥95% branch coverage. Documented in `.planning/phases/04-phi-storage/deferred-items.md`. Out-of-scope per the GSD scope boundary rule — recommended follow-up is a dedicated coverage-hardening micro-plan.

## Self-Check: PASSED

- All 24 files listed in `key-files.created` exist
- All 8 files listed in `key-files.modified` exist on disk
- All 5 task commits verified via `git log` (`0f60fff`, `ebd9cc1`, `6aa10ef`, `03d1b3a`, `73e602e`)
- `pnpm test` passes: 1713 tests, 10 skipped (db-harness integration), 4 todo (phi-lifecycle scaffold)
- `pnpm tsc --noEmit` clean
- `pnpm lint` clean

## User Setup Required

None — Plan 04-01 ships no user-facing code and requires no external configuration. The `DATABASE_URL_TEST` env var is optional; integration tests skip cleanly when it's unset.

## Next Phase Readiness

**Ready for Plan 04-02 (patients end-to-end):**

- `patients` table + indexes + `patients_updated_at` trigger in place
- `createPatient`, `findPatientById`, `findPatientsByScope`, `updatePatient`, `archivePatient` DAL functions landed
- `createPatientSchema`, `updatePatientSchema`, `updatePatientContextSchema`, `patientSearchSchema` Zod schemas in place
- `AuditAction.PATIENT_CREATED/UPDATED/ARCHIVED/VIEWED` enum values available
- `usePhiCleanup` hook available for patient detail Client Components
- `createMockPatient`/`createMockPatientRow` factories ready for action/component tests

**Ready for Plan 04-03 (notes + templates + versioning):**

- `clinical_notes` + `note_versions` + `note_templates` + `note_template_sections` + `user_style_preferences` tables in place
- SOAP template seeded with stable UUIDs (references in prompt cutover + frontend)
- Immutability triggers active on `note_versions` (DB-level defense against accidental UPDATE/DELETE)
- All DAL modules (`createClinicalNote`, `createInitialVersions`, `createVersionForSection`, `updateClinicalNoteContent` with optimistic lock, `findTemplateWithUserStyle` with overlay, `upsertUserSectionStyle`) landed with transactional signatures
- `saveNoteSchema` has explicit `patientContextSnapshot` field (B-3)
- `updateNoteSectionsSchema` has `expectedUpdatedAt: z.string().datetime()` for optimistic-lock token
- Pino redaction catches `content`, `firstName/lastName`, `phone`, `context` accidental leaks

**No blockers.** Both dependent plans can execute against this foundation.

---
*Phase: 04-phi-storage*
*Plan: 01-foundation*
*Completed: 2026-04-18*
