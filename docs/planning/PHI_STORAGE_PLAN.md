# Phase 1: Patient Records + Note Persistence

## Context

Every competitor in the clinical note space stores patient records and notes. FlashNote's pass-through model (generate → return → forget) was a smart v1 de-risking decision, but it's now the #1 product limitation. Without persistence, there's no continuity of care, no audit trail, no switching cost, and no foundation for higher-value features (treatment plans, magic edit, AI assistant).

This plan adds the foundational data layer (patients + notes) and pivots the web app to become the primary UI. The Chrome extension stays as-is — it still works for quick pass-through generation. All new features live in the web app.

**Encryption approach:** Infrastructure-level only. Managed PostgreSQL encrypts at rest. Access control is enforced via `user_id` + `organization_id` scoping on every query + comprehensive audit logging (including PHI read access per HIPAA § 164.312(b)). No application-level encryption in Phase 1.

**Prerequisites:** Audit PRs 1-4 (critical/high security fixes) + HIPAA production infrastructure must be completed before this work begins. See `docs/ROADMAP.md` and `docs/compliance/CONSOLIDATED_AUDIT_2026_02.md`.

---

## Chunk 1: Database Migration

**New file:** `backend/src/db/migrations/012_patients_and_notes.sql`

### `note_templates` table
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id         UUID → users(id) ON DELETE RESTRICT (nullable — null for built-in templates)
organization_id UUID → organizations(id) ON DELETE RESTRICT (nullable)
name            TEXT NOT NULL
is_builtin      BOOLEAN NOT NULL DEFAULT false
archived_at     TIMESTAMPTZ (nullable, soft delete)
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```
Indexes: `(user_id, name) WHERE archived_at IS NULL AND user_id IS NOT NULL` — personal template lookup, `(is_builtin) WHERE is_builtin = true AND archived_at IS NULL` — built-in template lookup

### `note_template_sections` table
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
template_id         UUID NOT NULL → note_templates(id) ON DELETE CASCADE
title               TEXT NOT NULL
sort_order          INT NOT NULL
verbosity           TEXT NOT NULL DEFAULT 'concise' CHECK IN ('concise','detailed')
styling             TEXT NOT NULL DEFAULT 'paragraph' CHECK IN ('paragraph','bullets')
prompt_instructions TEXT NOT NULL  -- AI instructions for generating this section's content
include_in_copy_all BOOLEAN NOT NULL DEFAULT true
created_at          TIMESTAMPTZ DEFAULT NOW()
updated_at          TIMESTAMPTZ DEFAULT NOW()
```
Indexes: `(template_id, sort_order)` — ordered section retrieval

**ON DELETE CASCADE on template_id:** Template sections are owned by their template — deleting a template deletes its section definitions. This is safe because `clinical_notes.template_id` uses `ON DELETE RESTRICT`, so a template with notes can't be deleted (only archived).

### Seed data: built-in SOAP template

The migration includes an `INSERT` for the default SOAP template:
```sql
-- Built-in SOAP template (PT-focused prompt instructions)
INSERT INTO note_templates (id, user_id, name, is_builtin) VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'SOAP Note', true);

INSERT INTO note_template_sections (template_id, title, sort_order, verbosity, styling, prompt_instructions, include_in_copy_all) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Subjective', 1, 'concise', 'paragraph',
   'Patient-reported symptoms, pain levels, functional changes, HEP compliance, and relevant history.', true),
  ('00000000-0000-0000-0000-000000000001', 'Objective', 2, 'detailed', 'paragraph',
   'Measurable clinical findings: ROM, strength grades, special tests, gait analysis, palpation, and interventions performed.', true),
  ('00000000-0000-0000-0000-000000000001', 'Assessment', 3, 'concise', 'paragraph',
   'Clinical reasoning linking subjective and objective findings. Progress toward goals, barriers, and prognosis.', true),
  ('00000000-0000-0000-0000-000000000001', 'Plan', 4, 'concise', 'bullets',
   'Treatment frequency, progression plan, HEP updates, short-term goals, and referrals.', true);
```

**Note:** The actual prompt instructions will be refined during implementation by referencing the existing PT-specific prompts in the backend. The values above are illustrative.

### `patients` table
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id         UUID NOT NULL → users(id) ON DELETE RESTRICT
organization_id UUID → organizations(id) ON DELETE RESTRICT (nullable)
first_name      TEXT NOT NULL
last_name       TEXT NOT NULL
date_of_birth   DATE (nullable)
pronoun         TEXT (nullable, no CHECK — validated by Zod in application layer)
phone           TEXT (nullable)
email           TEXT (nullable)
context         TEXT (nullable)  -- persisted patient context, injected into ALL future note generation
archived_at     TIMESTAMPTZ (nullable, soft delete)
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```
Indexes:
- `(user_id, last_name, first_name) WHERE archived_at IS NULL` — personal patient lookup
- `(user_id, created_at DESC)` — personal chronological list
- `(organization_id, last_name, first_name) WHERE archived_at IS NULL AND organization_id IS NOT NULL` — org-level patient lookup

### `clinical_notes` table
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id             UUID NOT NULL → users(id) ON DELETE RESTRICT
organization_id     UUID → organizations(id) ON DELETE RESTRICT (nullable)
patient_id          UUID → patients(id) ON DELETE RESTRICT (nullable)
template_id         UUID NOT NULL → note_templates(id) ON DELETE RESTRICT
note_type           TEXT NOT NULL CHECK IN ('daily_note','initial_eval','progress_note','discharge')
content             JSONB NOT NULL  -- ordered array of sections (see Content Structure below)
quick_notes         TEXT NOT NULL   -- original user input (PHI — same protection as content)
patient_context     TEXT (nullable) -- context at generation time (PHI — same protection as content)
generation_time_ms  INT (nullable)
archived_at         TIMESTAMPTZ (nullable, soft delete)
created_at          TIMESTAMPTZ DEFAULT NOW()
updated_at          TIMESTAMPTZ DEFAULT NOW()
```

**Content structure (dynamic sections):**
```json
[
  { "sectionId": "<template_section UUID>", "title": "Subjective", "content": "Patient reports..." },
  { "sectionId": "<template_section UUID>", "title": "Objective", "content": "ROM findings..." },
  { "sectionId": "<template_section UUID>", "title": "Assessment", "content": "..." },
  { "sectionId": "<template_section UUID>", "title": "Plan", "content": "..." }
]
```
- `sectionId` references `note_template_sections.id` — links each section to its template definition
- `title` is denormalized from the template section at generation time (snapshot — if the template section title changes later, existing notes keep their original title)
- Ordered array preserves section display order
- For Phase 1, all notes use the built-in SOAP template, so this array always has 4 entries. When custom templates ship, the array length varies per template.
Indexes:
- `(user_id, created_at DESC) WHERE archived_at IS NULL` — personal note list
- `(user_id, patient_id, created_at DESC) WHERE archived_at IS NULL AND patient_id IS NOT NULL` — personal notes per patient
- `(organization_id, created_at DESC) WHERE archived_at IS NULL AND organization_id IS NOT NULL` — org-level note list
- `(organization_id, patient_id, created_at DESC) WHERE archived_at IS NULL AND organization_id IS NOT NULL AND patient_id IS NOT NULL` — org-level notes per patient

### `note_versions` table
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
note_id         UUID NOT NULL → clinical_notes(id) ON DELETE RESTRICT
section_id      UUID NOT NULL → note_template_sections(id) ON DELETE RESTRICT
version         INT NOT NULL
content         TEXT NOT NULL
source          TEXT NOT NULL CHECK IN ('generated','manual','magic_edit')
created_by      UUID NOT NULL → users(id) ON DELETE RESTRICT
created_at      TIMESTAMPTZ DEFAULT NOW()
```
Indexes: `(note_id, section_id, version DESC)` — fetch latest or full history per section

**`section_id` references template sections, not hardcoded names.** This means version history works for any template — a SOAP note's "Subjective" section and a custom template's "Home Exercise Program" section are tracked identically. The section title is resolved by joining through `note_template_sections` when displaying history.

**Immutable append-only table.** No `updated_at`, no soft delete. Once a version row is written, it is never modified or deleted. This is critical for HIPAA — clinical documentation amendments must preserve the original.

**Row lifecycle:** When a note is first saved (via `POST /notes`), one row per template section is inserted (version 1, source `generated`). For the built-in SOAP template, that's 4 rows. For a custom template with 7 sections, that's 7 rows. When a section is edited (via `PATCH /notes/:id`), a new row is inserted with version N+1 and source `manual`. When magic edit lands in Phase 2, re-generated sections get source `magic_edit`.

### `updated_at` trigger
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER note_templates_updated_at BEFORE UPDATE ON note_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER note_template_sections_updated_at BEFORE UPDATE ON note_template_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER patients_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER clinical_notes_updated_at BEFORE UPDATE ON clinical_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- note_versions is append-only, no updated_at trigger needed
```

### Design decisions

**Template-driven content structure from day 1:**
- Note content is an ordered array of sections, not a fixed `{ subjective, objective, assessment, plan }` object. This avoids a painful data migration when custom templates ship — every stored note would need its JSONB rewritten.
- Phase 1 ships with a single built-in SOAP template (4 sections). The UI hardcodes nothing — sections are rendered dynamically from the content array. When custom templates arrive, the UI already works.
- `template_id` on `clinical_notes` is NOT NULL — every note belongs to a template. This enables filtering notes by template type and ensures the content structure is always validatable.
- Template sections define `verbosity`, `styling`, and `prompt_instructions` — these feed directly into the LLM prompt. When the template builder UI ships (Phase 2), users can customize how each section is generated without code changes.
- `ON DELETE CASCADE` on `note_template_sections.template_id` is safe because `clinical_notes.template_id` uses `ON DELETE RESTRICT`. A template with notes can't be deleted, only archived. If a template is archived, its section definitions persist for existing notes.

**Organization scoping from day 1:**
- Both tables include `organization_id`, denormalized from `users.organization_id` at insert time. This avoids expensive joins when filtering by org and enables clinic admin oversight without schema changes later.
- Solo PTs: `organization_id IS NULL`. Queries scoped by `user_id` only.
- Org members: `organization_id` set at creation. Default view scoped by `user_id` (see their own). Admin/owner view scoped by `organization_id` (see all clinic records).
- The `organization_id` is set once at record creation and does not update if a user later changes orgs (records belong to the org they were created in).

**ON DELETE RESTRICT on all FKs:**
- `users.id → ON DELETE RESTRICT` on both tables. If a user account needs to be deleted, records must be explicitly archived first. Prevents accidental cascade-deletion of clinical records (HIPAA data retention).
- `organizations.id → ON DELETE RESTRICT` on both tables. Same rationale.
- `patients.id → ON DELETE RESTRICT` on `clinical_notes.patient_id`. Safety net — prevents hard-deleting a patient with notes attached. Since we soft-delete only, this catches future code errors.

**No CHECK constraint on pronoun:**
- Drives note generation language ("He reports..." / "They demonstrated..."), not demographic data. Validated by Zod so new options don't require a migration.

**Persisted patient context (`patients.context`):**
- Free-text field stored per-patient, injected into the generation prompt for every note for that patient. Twofold's equivalent is their "Patient Context" tab — a manually entered field that feeds into ALL future note generation. This replaces the per-session-only context approach.
- `clinical_notes.patient_context` still stores a snapshot of the context at generation time (for audit trail / reproducibility). When generating a note for a patient with stored context, the backend reads `patients.context` and passes it to the LLM, then saves the value used into `clinical_notes.patient_context`.
- PHI — same protection as all other patient data.

**`note_versions` table (immutable edit history):**
- Clinical documentation standards require amendments to preserve the original. Silently overwriting a section is a liability risk.
- Append-only: version rows are never modified or deleted. Each edit inserts a new row with an incremented version number.
- Per-section granularity: each section has independent version history, keyed by `section_id` (references `note_template_sections.id`). Editing one section doesn't create noise in another's history. Works for any template — SOAP, DAP, or custom.
- `source` column tracks provenance: `generated` (initial LLM output), `manual` (user edit), `magic_edit` (Phase 2 AI re-edit).
- `clinical_notes.content` JSONB remains the "current state" for fast reads. `note_versions` is the full history, queried only when viewing edit history or for audit purposes.
- This design cleanly separates current state (fast) from history (append-only, immutable, HIPAA-friendly).

**`quick_notes` and `patient_context` are PHI:**
- Both columns store raw therapist input routinely containing patient names, ages, diagnoses, and treatment details. Same PHI protection as `content`: audit logging on access, Sentry sanitization, client-side cleanup on logout.

**`updated_at` auto-update trigger:**
- Prevents stale timestamps from missed manual updates. Enables optimistic locking on note edits (Chunk 3).

---

## Chunk 2: Backend Types + Query Modules

### Modify: `backend/src/types/database.ts`
- Add `NoteTemplateRow`, `NoteTemplateSectionRow`, `PatientRow`, `ClinicalNoteRow`, `ClinicalNoteWithPatientRow`, `NoteVersionRow` (snake_case, matches DB)
- Both patient/note row types include `organization_id: string | null`
- `ClinicalNoteRow` includes `template_id: string`
- `PatientRow` includes `context: string | null`

### Modify: `backend/src/types/index.ts`
- Add `NoteTemplate`, `NoteTemplateSection`, `NoteTemplateWithSections` types (camelCase)
- `NoteTemplateSection`: `{ id, templateId, title, sortOrder, verbosity, styling, promptInstructions, includeInCopyAll }`
- Add `Patient`, `ClinicalNote`, `ClinicalNoteWithPatient`, `NoteSection`, `NoteVersion`, `NoteVersionSource` types (camelCase)
- `NoteSection`: `{ sectionId: string, title: string, content: string }` — single element of the content array
- `ClinicalNote` includes `templateId: string` and `content: NoteSection[]`
- `Patient` includes `context: string | null`
- `NoteVersion`: `{ id, noteId, sectionId, version, content, source, createdBy, createdAt }`
- `NoteVersionSource`: `'generated' | 'manual' | 'magic_edit'`
- Add `AuditAction` entries: `PATIENT_CREATED`, `PATIENT_UPDATED`, `PATIENT_ARCHIVED`, `PATIENT_VIEWED`, `NOTE_SAVED`, `NOTE_UPDATED`, `NOTE_ARCHIVED`, `NOTE_VIEWED`

### New: `backend/src/db/queries/note-templates.ts`
Read-only in Phase 1 (no create/update/delete — only built-in templates exist). Template builder CRUD added in Phase 2.

Functions:
- `findBuiltinTemplates()` → `NoteTemplateWithSections[]` — returns all built-in templates with their sections ordered by `sort_order`. Phase 1 returns exactly one (SOAP).
- `findTemplateById(templateId)` → `NoteTemplateWithSections | null` — returns a template with its sections. Used by the generation endpoint to load section prompt instructions.
- `findTemplatesByScope(scope)` → `NoteTemplate[]` — returns built-in templates + user's custom templates (Phase 2). Phase 1 returns only built-ins.

### New: `backend/src/db/queries/patients.ts`
Follow pattern from `organizations.ts` — explicit column list, `rowToPatient()` mapper.

**Dual scoping pattern:** Every query function accepts a `scope` parameter:
```typescript
type QueryScope =
  | { type: 'user'; userId: string }
  | { type: 'organization'; organizationId: string };
```
- `user` scope: `WHERE user_id = $1` — personal view (all users)
- `organization` scope: `WHERE organization_id = $1` — clinic view (admin/owner only, enforced at route level)

Functions:
- `createPatient(userId, organizationId, data)` → `Patient` — `data` includes optional `context`
- `findPatientById(scope, patientId)` → `Patient | null` — returns `context` field
- `findPatientsByScope(scope, { search?, limit?, offset? })` → `{ patients, total }`
- `updatePatient(scope, patientId, data)` → `Patient | null` — `data` can update `context`
- `archivePatient(scope, patientId)` → `boolean`

**Patient search (per-field matching):**
```sql
WHERE (scope conditions)
  AND archived_at IS NULL
  AND (first_name ILIKE $2 OR last_name ILIKE $2 OR (first_name || ' ' || last_name) ILIKE $2)
```
Matches "Smith", "John", or "John Smith". All search terms parameterized via `$N`.

**Pagination limits:** All list functions cap `limit` at 100 via `Math.min(limit, 100)`. Default 50.

### New: `backend/src/db/queries/clinical-notes.ts`
Same dual scoping pattern. List query joins patients for display names.

Functions:
- `createClinicalNote(userId, organizationId, data)` → `ClinicalNote` — `data` includes `templateId` and `content` (as `NoteSection[]`)
- `findClinicalNoteById(scope, noteId)` → `ClinicalNoteWithPatient | null`
- `findClinicalNotesByScope(scope, { patientId?, noteType?, limit?, offset? })` → `{ notes, total }`
- `updateClinicalNoteContent(scope, noteId, content, expectedUpdatedAt)` → `ClinicalNote | null` (optimistic lock)
- `archiveClinicalNote(scope, noteId)` → `boolean`

**Optimistic locking:**
```sql
UPDATE clinical_notes
SET content = $3
WHERE id = $1 AND user_id = $2 AND updated_at = $4
RETURNING ...
```
Returns null (0 rows) if `updated_at` doesn't match → caller returns 409 Conflict.

### New: `backend/src/db/queries/note-versions.ts`

Functions:
- `createInitialVersions(noteId, content: NoteSection[], userId)` → `NoteVersion[]` — inserts one row per section in the content array (version 1, source `generated`). For built-in SOAP, that's 4 rows. For a custom template with N sections, that's N rows. Called by `POST /notes` route after saving the note.
- `createVersionForSection(noteId, sectionId, content, source, userId)` → `NoteVersion` — inserts a new version row with version = max(version for that section_id) + 1. Called by `PATCH /notes/:id` route for each updated section.
- `findVersionsByNoteId(noteId, userId)` → `NoteVersion[]` — returns all versions for a note, ordered by section_id then version DESC. Scoped by joining through `clinical_notes.user_id`. Joins `note_template_sections` to include section title in results.
- `findLatestVersionsByNoteId(noteId, userId)` → `NoteVersion[]` — returns only the latest version per section. Useful for display without loading full history.

### Tests
- `backend/src/db/queries/note-templates.test.ts`
- `backend/src/db/queries/patients.test.ts`
- `backend/src/db/queries/clinical-notes.test.ts`
- `backend/src/db/queries/note-versions.test.ts`
- Verify built-in SOAP template is returned with 4 sections in correct sort order
- Verify `findTemplateById` returns sections with prompt instructions
- Verify both `user` and `organization` scope paths
- Verify user_id scoping cannot access another user's records
- Verify org scoping returns all org records
- Verify search matches first name, last name, and full name independently
- Verify pagination cap at 100
- Verify optimistic lock returns null on stale `updated_at`
- Verify `createClinicalNote` stores content as ordered section array with `sectionId`, `title`, `content`
- Verify `createInitialVersions` inserts one row per content section (4 for SOAP)
- Verify `createVersionForSection` increments version number correctly per `section_id`
- Verify version rows are scoped by user (can't read another user's note versions)
- Verify patient context is returned and updatable

---

## Chunk 3: Backend Routes

### Rate limiting

**Fix (issue #1):** Move `generateRateLimit` from router-level `use()` on notes router to the `POST /generate` endpoint only.

**New CRUD rate limiting:** Apply `apiRateLimit` (100/min, already exists in `rate-limit.ts`) at the router level for both `/patients` and the new `/notes` CRUD endpoints. This prevents unlimited create/list/archive from a compromised token.

### Scope resolution helper

Routes need to determine the query scope from the authenticated user:
```typescript
function resolveScope(user: TokenPayload, requestedScope?: 'organization'): QueryScope {
  if (requestedScope === 'organization') {
    // Verify user is admin/owner in their org
    if (!user.organizationId) throw new AppError(403, 'no_organization', '...');
    // Check role via organization-members query
    const member = await findActiveMember(user.organizationId, user.userId);
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new AppError(403, 'insufficient_permissions', '...');
    }
    return { type: 'organization', organizationId: user.organizationId };
  }
  return { type: 'user', userId: user.userId };
}
```

List endpoints accept `?scope=organization` query param. Detail/mutation endpoints resolve scope based on the record's ownership (user_id match or org membership).

### New: `backend/src/routes/patients.ts`
Middleware chain: `requireAuth → requireCsrf → requireEmailVerification → requireActiveSubscription → apiRateLimit`

| Method | Path | Purpose | Audit |
|--------|------|---------|-------|
| POST | `/patients` | Create patient | PATIENT_CREATED |
| GET | `/patients` | List patients (search, pagination, optional org scope) | — |
| GET | `/patients/:id` | Get patient | PATIENT_VIEWED |
| PUT | `/patients/:id` | Update patient | PATIENT_UPDATED |
| DELETE | `/patients/:id` | Archive patient | PATIENT_ARCHIVED |

All mutations have Zod input validation. Audit metadata includes only IDs (no PHI). `organization_id` denormalized from `users.organization_id` at creation time.

**Pagination:** `limit` validated by Zod: `z.coerce.number().int().min(1).max(100).default(50)`. `offset` validated: `z.coerce.number().int().min(0).default(0)`.

**PHI read audit:** `GET /patients/:id` logs `PATIENT_VIEWED`. `GET /patients` (list) does not log per-row (excessive noise). Documented rationale — revisit if compliance review requires list-level logging.

### Modify: `backend/src/routes/notes.ts`

**Generation stays clean:** No `save` flag. Generate returns data; client saves via `POST /notes` if user chooses. Separate concerns, separate endpoints.

Add `patientId` (optional UUID) and `templateId` (required UUID) to `generateNoteSchema`. The generation endpoint:
1. Loads the template and its sections via `findTemplateById(templateId)` — validates template exists and user has access
2. If `patientId` provided, verifies it belongs to the user and loads `patients.context`
3. Constructs the LLM prompt using each template section's `promptInstructions`, `verbosity`, and `styling` settings
4. Returns the generated content as a `NoteSection[]` array (matching the template's sections) + `templateId`
5. The context value used is saved into `clinical_notes.patient_context` when the note is persisted

**Phase 1:** The web UI always sends the built-in SOAP template ID. The generation prompt is constructed dynamically from the template sections' `promptInstructions` instead of hardcoded prompts. This means the existing hardcoded PT prompts in the backend get migrated into the seed data's `prompt_instructions` values.

**Generation retries: do NOT retry.** Note generation is not idempotent — a retry after a network timeout would generate a duplicate note and burn LLM tokens. The web API client should not use `requestWithRetry` for `generateNote()`. Display a clear error with a manual "Try Again" button instead.

Move `generateRateLimit` to the endpoint:
```typescript
notesRouter.post('/generate', generateRateLimit, async (req, res, next) => { ... });
```

Apply `apiRateLimit` at router level for CRUD endpoints.

New endpoints:

| Method | Path | Purpose | Audit |
|--------|------|---------|-------|
| POST | `/notes` | Save a note (post-generation) + create initial version rows | NOTE_SAVED |
| GET | `/notes` | List notes (patient/type filter, pagination, optional org scope) | — |
| GET | `/notes/:id` | Get single note | NOTE_VIEWED |
| PATCH | `/notes/:id` | Update note content (per-section) | NOTE_UPDATED |
| GET | `/notes/:id/versions` | Get edit history for a note (all sections) | — |
| DELETE | `/notes/:id` | Archive note | NOTE_ARCHIVED |

`POST /notes` schema accepts `templateId` (required), `content` (as `NoteSection[]`), and `generationTimeMs` (all passed through from generate response). The route validates `templateId` exists and content section IDs match the template's sections.

**PHI read audit:** `GET /notes/:id` logs `NOTE_VIEWED`. List endpoint returns only preview text (~100 chars of the first section's content) — no detail-level audit.

**PATCH semantics: full section replacement.** Client sends a map of `sectionId → new content` for sections it wants to update. Unspecified sections remain unchanged. The route validates each `sectionId` exists in the note's content array — rejects unknown section IDs with 400.

```typescript
const updateNoteContentSchema = z.object({
  sections: z.record(
    z.string().uuid(),   // sectionId
    z.string()           // new content for that section
  ).refine(obj => Object.keys(obj).length > 0, 'At least one section required'),
  expectedUpdatedAt: z.string().datetime(),  // Optimistic lock
});
```

Update logic:
```typescript
// Validate all sectionIds exist in the note's content array
const existingSectionIds = new Set(existingNote.content.map(s => s.sectionId));
for (const sectionId of Object.keys(validatedSections)) {
  if (!existingSectionIds.has(sectionId)) {
    return res.status(400).json({ success: false, error: { code: 'invalid_section', message: 'Unknown section ID' } });
  }
}

// Merge: replace content for specified sections, keep others unchanged
const mergedContent = existingNote.content.map(section =>
  validatedSections[section.sectionId]
    ? { ...section, content: validatedSections[section.sectionId] }
    : section
);

const updated = await updateClinicalNoteContent(scope, noteId, mergedContent, expectedUpdatedAt);
if (!updated) return res.status(409).json({
  success: false,
  error: { code: 'conflict', message: 'Note was modified. Please refresh and try again.' }
});

// Append version rows for each edited section (immutable history)
for (const [sectionId, content] of Object.entries(validatedSections)) {
  await createVersionForSection(noteId, sectionId, content, 'manual', userId);
}
```

**Version creation on save:** When a note is first saved via `POST /notes`, the route calls `createInitialVersions(noteId, content, userId)` to insert the initial version rows (version 1, source `generated` for each section in the content array).

**Transaction scope:** The `PATCH` content update + version row inserts should be in the same transaction. If the content update succeeds but a version insert fails, we'd have edited content with no audit trail — unacceptable for clinical documentation.

### New: `backend/src/routes/templates.ts`
Read-only in Phase 1. Middleware chain: `requireAuth → requireActiveSubscription`

| Method | Path | Purpose | Audit |
|--------|------|---------|-------|
| GET | `/templates` | List available templates (built-in + user's custom in Phase 2) | — |
| GET | `/templates/:id` | Get template with sections | — |

No CSRF needed (read-only). No PHI involved.

### Modify: `backend/src/index.ts`
Register `patientsRouter` at `/patients` and `templatesRouter` at `/templates`.

---

## Chunk 4: Web App API Client + Types

### Modify: `web/src/lib/types.ts`
Add `NoteTemplate`, `NoteTemplateSection`, `NoteTemplateWithSections`, `NoteSection`, `Patient`, `NoteType`, `ClinicalNote`, `GeneratedNote`, `NoteVersion`, `NoteVersionSource` types. Patient includes `context: string | null` and `organizationId: string | null`. ClinicalNote includes `templateId: string`, `content: NoteSection[]`, and `organizationId: string | null`.

### Modify: `web/src/lib/schemas.ts`
Add `patientSchema` (includes optional `context` field), `generateNoteSchema` (includes `templateId`) Zod schemas for form validation. Pronoun validated as `z.enum(['he/him', 'she/her', 'they/them', 'other'])`. Pagination `limit` capped at `z.number().max(100)`.

### Modify: `web/src/lib/api.ts`
Add methods following existing patterns (`getUsage`, `createCheckoutSession`, etc.):
- Templates: `getTemplates`, `getTemplate`
- Patient: `createPatient`, `getPatients` (accepts `scope` param), `getPatient`, `updatePatient`, `archivePatient`
- Notes: `generateNote` (**no retry** — not idempotent; includes `templateId`), `saveNote` (with retry; includes `templateId` + `content` as `NoteSection[]`), `getNotes` (accepts `scope` param), `getNote`, `getNoteVersions`, `updateNoteContent` (sends `sectionId → content` map), `archiveNote`

### Sentry sanitization verification (explicit checklist item)
During implementation of this chunk, verify that existing Sentry patterns in `backend/src/utils/sentry-sanitization.ts` match the camelCase field names `quickNotes` and `patientContext`. The regex `/note/i` and `/patient/i` should match both, but confirm by adding a test case to `sentry-sanitization.test.ts` (if it exists) or manually verifying.

---

## Chunk 5: Web App Sidebar Layout

### New: `web/src/app/dashboard/layout.tsx`
Next.js layout wrapping all `/dashboard/*` routes. Contains `ProtectedRoute` + sidebar + main content area.

### New: `web/src/components/dashboard/Sidebar.tsx`
Navigation items: Dashboard, New Note, Notes, Patients, Settings. Active state via `usePathname()`. Collapsible on mobile (hamburger → slide-out drawer), always visible at 256px on desktop (md+). User email + sign out at bottom.

### New: `web/src/hooks/usePhiCleanup.ts`
Dedicated hook for PHI cleanup on route changes. React `useEffect` cleanup is asynchronous and not guaranteed before navigation completes (especially browser back/forward). This hook:
- Subscribes to `pathname` changes via `usePathname()`
- Calls a provided cleanup callback synchronously when the path changes
- Used by every page that holds PHI in state (note detail, patient detail, note generator result)

### Modify: `web/src/app/dashboard/page.tsx`
Remove inline navbar and `ProtectedRoute` wrapper (both now in layout).

### Modify: `web/src/app/dashboard/settings/page.tsx`
Same — remove inline navbar and `ProtectedRoute` wrapper.

### Modify existing dashboard tests
Update to account for nav being in layout, not in page components.

---

## Chunk 6: Web App Feature Pages

### New Note page: `web/src/app/dashboard/notes/new/page.tsx`

**This is a new build, not a port.** The extension's NoteGenerator is a UX reference, but the web implementation is built from scratch against the web API client, auth context, component library, and Next.js patterns. Specifically requires:
- Building the `api.generateNote()` integration (the web app has never called `/notes/generate`)
- **No automatic retry on generation failure** — display error with manual "Try Again" button
- Loading state management (stage cycling, progress animation)
- Error handling with web-specific error mapping
- Form validation with web Zod schemas
- Dynamic section rendering from template-driven content array

Features:
- Full-width layout
- **Template selector** — loads available templates via `api.getTemplates()`. Phase 1 shows only the built-in SOAP template (pre-selected). When custom templates ship, the dropdown populates with the user's templates.
- **Patient selector as search/typeahead** (not a full-list dropdown — PTs may have hundreds of patients). Reuse the debounced search pattern from the patient list page, backed by `api.getPatients({ search })`.
- After generation: inline result view with sections rendered dynamically from the `NoteSection[]` array — Save, Copy All, Copy Section (per section), Edit Section (per section), Generate Another
- Save calls `api.saveNote()` (passes `templateId`, content as `NoteSection[]`, `generationTimeMs`), navigates to note detail on success
- Generate Another clears result (via `usePhiCleanup`) and returns to form

### Note List page: `web/src/app/dashboard/notes/page.tsx`
Paginated table of saved notes. Columns: date, note type badge, template name, patient name (or "Unassigned"), author (for org view), first section preview (~100 chars). Filters: note type dropdown, patient dropdown. **Org scope toggle** for admin/owner users (show "My Notes" vs "All Clinic Notes"). Click → note detail. Archive per row with confirmation.

### Note Detail page: `web/src/app/dashboard/notes/[id]/page.tsx`
Full note view. **Sections rendered dynamically** from the `content` array — iterates over `NoteSection[]` and renders each section with its `title` as heading and `content` as body. Not hardcoded to S/O/A/P. Per-section edit: click Edit → textarea → Save via `api.updateNoteContent()` (sends `{ sectionId: newContent }` map + `expectedUpdatedAt` for optimistic lock — on 409, shows "This note was modified elsewhere. Refresh to see latest version." with a Refresh button). Copy All. Metadata header (note type, template name, patient name linked, date, generation time, author). Archive button. Uses `usePhiCleanup` to clear note content from state on navigation.

**Edit history:** "View History" link per section (or a global "Edit History" tab). Loads via `api.getNoteVersions(noteId)`. Displays version list per section with timestamp, source badge (Generated / Manual Edit / Magic Edit), and content diff or full text. Read-only — history cannot be modified. This is both a user feature (see what changed) and a compliance feature (immutable audit trail of clinical documentation amendments).

### Patient List page: `web/src/app/dashboard/patients/page.tsx`
Searchable table. Debounced search input (matches first name, last name, or full name independently). Columns: name, DOB, pronoun, date added, created by (for org view). **Org scope toggle** for admin/owner users. Add Patient button. Archive per row with confirmation. Pagination (max 100 per page).

### Patient Detail page: `web/src/app/dashboard/patients/[id]/page.tsx`
Patient info card (editable inline, includes `context` as a free-text field with save button — "Context used for all future note generation"). Notes section showing this patient's notes (filtered list via `api.getNotes({ patientId })`). "Generate Note" button → `/dashboard/notes/new?patientId=xxx`. Archive patient button. Uses `usePhiCleanup` to clear patient data from state on navigation.

### New Patient page: `web/src/app/dashboard/patients/new/page.tsx`
Form: first name, last name, DOB, pronoun (select), phone, email, context (optional textarea — "Add any standing context for note generation: known conditions, goals, or details not typically in session notes"). Zod validation. On success → patient detail page.

---

## Extension

No changes. The extension continues to work for pass-through note generation (no persistence, no patient records). Decision on extension future (update, deprecate, or keep as companion) deferred to Phase 2.

---

## Build Order (Vertical Slicing)

For a solo engineer, vertical slicing catches API/UI mismatches earlier and produces demoable results sooner.

| PR | Scope | What's included |
|----|-------|-----------------|
| **PR 1** | Infrastructure | Migration (Chunk 1 — includes `note_templates`, `note_template_sections`, `patients`, `clinical_notes`, `note_versions` tables + SOAP seed data), types (Chunk 2 types only), sidebar layout (Chunk 5), `usePhiCleanup` hook |
| **PR 2** | Patients end-to-end | Patient queries + routes (including context CRUD) + web API methods + patient list/detail/new pages (including context field) |
| **PR 3** | Notes end-to-end | Template queries + note queries + note-versions queries + routes (including template + version history endpoints) + web API methods + note generator (with template selection + patient context injection)/list/detail pages (dynamic section rendering + edit history view) |

Each PR is independently shippable. PR 1 is structural with no user-facing features. PR 2 gives you a working patient management system. PR 3 adds note generation + persistence on top.

---

## Key Patterns to Follow

| Pattern | Reference file |
|---------|---------------|
| Migration + seed data | `backend/src/db/migrations/011_organizations.sql` |
| Query module | `backend/src/db/queries/organizations.ts` |
| Row → entity mapper | `backend/src/db/queries/users.ts:17-36` |
| Route + middleware | `backend/src/routes/notes.ts:14-21` |
| Audit logging | `backend/src/routes/notes.ts:47-65` |
| Org member role check | `backend/src/db/queries/organization-members.ts` |
| Web API methods | `web/src/lib/api.ts:376-399` (getUsage pattern) |
| Web page component | `web/src/app/dashboard/page.tsx` |
| UI components | `web/src/components/ui/` (Button, Input, Card, Alert) |
| Design tokens | `shared/design-tokens-warm.css` |

---

## Issues Addressed

| # | Issue | Resolution |
|---|-------|------------|
| 1 | Rate limit on CRUD endpoints | Move `generateRateLimit` to generate endpoint only; apply `apiRateLimit` to CRUD routers |
| 2 | `save: true` flag redundant | Removed — generate and save are separate endpoints |
| 3 | CASCADE deletes clinical records | Changed to `ON DELETE RESTRICT` on all FKs |
| 4 | SET NULL is dead logic | Changed to `ON DELETE RESTRICT` on patient_id |
| 5 | No audit on PHI reads | Added `NOTE_VIEWED` and `PATIENT_VIEWED` audit actions |
| 6 | PATCH merge undefined | Full section replacement, not deep merge |
| 7 | Pronoun CHECK too rigid | Removed CHECK, validated in Zod only |
| 8 | No `updated_at` trigger | Added trigger function in migration |
| 9 | No optimistic locking | `updated_at` check in UPDATE WHERE clause, 409 on conflict |
| 10 | `quick_notes`/`patient_context` are PHI | Explicitly acknowledged, same protection as `content` |
| 11 | Sentry sanitization | Explicit verification checklist item during Chunk 4 implementation |
| 12 | Web generation is new, not a port | Clarified as new build with explicit scope |
| 13 | Organization scoping | `organization_id` on both tables from day 1, dual query scoping, admin/owner org visibility |
| 14 | No rate limiting on CRUD | `apiRateLimit` applied to patient and note CRUD routers |
| 15 | Patient search per-field | Match first name, last name, and full name independently via OR clause |
| 16 | Pagination limits | Max 100 enforced by Zod, default 50 |
| 17 | generateNote retry is unsafe | No retry on generation (not idempotent), manual "Try Again" button |
| 18 | PATCH billing/goals exclusion | Resolved by dynamic sections — all template-defined sections are editable. Non-template metadata (generation_time_ms, etc.) remains immutable. |
| 19 | generation_time_ms passthrough | Save schema accepts it, New Note page passes from generate response |
| 20 | Patient selector as typeahead | Search-backed typeahead, not full-list dropdown |
| 21 | PHI cleanup via useEffect unreliable | Dedicated `usePhiCleanup` hook using `usePathname()` for synchronous cleanup |
| 22 | No persisted patient context | `context` column on `patients` table, injected into all note generation, snapshot saved to `clinical_notes.patient_context` |
| 23 | Note edits overwrite without history | `note_versions` table: immutable, append-only, per-section versioning with source tracking |
| 24 | Clinical amendment audit trail | `note_versions` rows are never modified or deleted — HIPAA-compliant documentation amendment history |
| 25 | Content structure hardcoded to SOAP | Dynamic `NoteSection[]` array driven by template sections — supports SOAP, DAP, BIRP, custom formats without schema changes |
| 26 | No template foundation | `note_templates` + `note_template_sections` tables from day 1 with built-in SOAP seed data. Template builder UI deferred to Phase 2. |
| 27 | Prompt instructions hardcoded | Generation prompts constructed from template section `prompt_instructions` instead of hardcoded backend logic |

---

## Known Phase 1 Limitations

These are intentional scope boundaries, not oversights:

1. **Single template (SOAP)** — The template schema and dynamic section rendering are in place, but Phase 1 ships with only the built-in SOAP template. Template builder UI (create/edit/share custom templates) is Phase 2.
2. **No magic edit** — Can't re-generate with instructions. Phase 2. When implemented, `note_versions` rows with source `magic_edit` will capture the re-generated content.
3. **No treatment plans** — Standalone per-patient documents, not linked to individual notes. Phase 2.
4. **No PDF export** — Phase 2.
5. **No voice-to-note** — Phase 2+.
6. **Extension unchanged** — Stays pass-through. Phase 2 decision on its future.

---

## Verification

After all PRs merged:
1. **Backend**: `pnpm test` in `/backend` — all existing + new tests pass
2. **Web**: `pnpm test` in `/web` — all existing + new tests pass
3. **Manual E2E flow**: Sign in → Create patient (with context) → Generate note (SOAP template auto-selected) → Save note for patient → View in note list → Edit a section (verify optimistic lock) → Verify in patient detail → Archive note → Archive patient
4. **Org scoping**: Create two users in same org (one admin, one member). Admin sees all clinic records via scope toggle. Member sees only their own.
5. **Security check**: Attempt to access another user's patient/note via direct URL → 404. Member attempts `?scope=organization` → 403.
6. **Audit check**: Verify audit_logs has entries for CRUD ops AND read access (NOTE_VIEWED, PATIENT_VIEWED) — no PHI in metadata
7. **Conflict check**: Open note in two tabs, edit in both, verify second save returns 409 with user-friendly message
8. **PHI cleanup**: Navigate away from note detail, verify note content cleared from component state via `usePhiCleanup`
9. **Extension**: Verify extension still works for pass-through generation (no regressions)
10. **Rate limit**: Verify listing/viewing notes does NOT consume generation rate limit quota
11. **Pagination**: Verify `?limit=999` is capped to 100 results
12. **Sentry**: Verify `quickNotes` and `patientContext` field names are caught by existing sanitization regex
13. **Patient context**: Set context on patient → generate note → verify context appears in generated note content AND is saved in `clinical_notes.patient_context`
14. **Version history**: Save note → verify 4 initial version rows (one per SOAP template section, version 1, source `generated`). Edit a section → verify new version row (version 2, source `manual`). Original version row unchanged.
15. **Version immutability**: Verify no UPDATE or DELETE operations exist on `note_versions` table in the codebase
16. **Template seed data**: Verify built-in SOAP template exists after migration with 4 sections in correct order (Subjective, Objective, Assessment, Plan)
17. **Dynamic section rendering**: Note detail and note generator render sections from the content array, not hardcoded S/O/A/P. If seed data section titles were changed, the UI would reflect the new titles without code changes.
18. **Template in generation**: Verify generate endpoint loads template sections and uses `prompt_instructions` in LLM prompt construction
