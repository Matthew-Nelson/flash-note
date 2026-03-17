# Architecture Patterns

**Domain:** HIPAA-compliant clinical documentation SaaS with PHI storage, note versioning, and clinic multi-tenancy
**Researched:** 2026-03-16

## Recommended Architecture

The existing layered monolith (Proxy -> Pages -> Server Actions -> Services -> DAL -> PostgreSQL) is the correct foundation. PHI storage, note versioning, and clinic multi-tenancy integrate as extensions of the DAL and service layers -- not as new architectural tiers. The key insight is that the DAL pattern already enforces authorization at the data boundary. New PHI-bearing tables (patients, clinical_notes, note_versions, note_templates) follow identical patterns: `server-only` imports, explicit column lists, `rowToX()` transforms, scope-based authorization, and optional `pg.PoolClient` for transaction composition.

### System Diagram

```
Browser (Client Components)
  |
  | Server Actions (thin wrappers: validate -> auth -> service -> audit -> return)
  |
  v
Services Layer (business logic orchestration)
  |  note-generation.ts  -- LLM calls, prompt construction from template sections
  |  patient.ts          -- patient CRUD orchestration, context injection
  |  clinical-note.ts    -- note save/update with version tracking
  |  billing.ts          -- individual + org Stripe flows
  |  audit.ts            -- fire-and-forget + transactional audit
  |
  v
DAL (authorization boundary -- the HIPAA compliance gate)
  |  patients.ts         -- user_id/org_id scoped queries, PHI read audit
  |  clinical-notes.ts   -- user_id/org_id scoped queries, optimistic locking
  |  note-versions.ts    -- append-only inserts, version history reads
  |  note-templates.ts   -- template + section reads, scope-aware
  |  users.ts            -- existing (unchanged)
  |  organizations.ts    -- existing + new admin query functions
  |  org-members.ts      -- existing + role-based access helpers
  |
  v
PostgreSQL (Cloud SQL, encryption at rest, Auth Proxy tunnel)
  |  patients             -- PHI: names, DOB, context
  |  clinical_notes       -- PHI: SOAP content, quick_notes, patient_context
  |  note_versions        -- PHI: immutable section history (append-only)
  |  note_templates       -- non-PHI: template definitions + section configs
  |  note_template_sections -- non-PHI: section prompt instructions
  |  organizations        -- existing + clinic billing fields
  |  organization_members -- existing (seat tracking)
  |  users                -- existing (org_id denormalized)
  |  audit_logs           -- existing (immutable, new PHI-related actions)
```

### Component Boundaries

| Component | Responsibility | Communicates With | PHI Exposure |
|-----------|---------------|-------------------|-------------|
| **Server Actions** (`actions/`) | Input validation, auth gate, error mapping, audit orchestration | Services, DAL (via `getSession()`), rate limiter | Transient only (FormData in, ActionResult out) |
| **Patient Service** (`server/services/patient.ts`) | Patient CRUD business logic, context injection into generation | Patient DAL, audit service | Reads context for LLM prompt construction |
| **Clinical Note Service** (`server/services/clinical-note.ts`) | Note save + version creation atomicity, section merge logic | Clinical Notes DAL, Note Versions DAL, audit service | Orchestrates JSONB content writes |
| **Note Generation Service** (`server/services/note-generation.ts`) | LLM prompt construction from template sections, provider call | Template DAL (prompt instructions), LLM providers | Receives quickNotes + patientContext, sends to LLM |
| **Patient DAL** (`server/dal/patients.ts`) | SQL queries scoped by user_id or org_id, row transforms | Database pool | Direct PHI access (names, DOB, context) |
| **Clinical Notes DAL** (`server/dal/clinical-notes.ts`) | SQL queries with optimistic locking, JSONB content ops | Database pool | Direct PHI access (SOAP content, quickNotes) |
| **Note Versions DAL** (`server/dal/note-versions.ts`) | Append-only INSERT, version history reads | Database pool | Direct PHI access (section content history) |
| **Note Templates DAL** (`server/dal/note-templates.ts`) | Template + section reads (read-only Phase 1) | Database pool | No PHI (template definitions only) |
| **Organization DAL** (`server/dal/organizations.ts`) | Org CRUD, subscription checks, admin queries | Database pool | No PHI (org metadata only) |
| **Billing Service** (`server/services/billing.ts`) | Stripe checkout/portal, webhook handling, seat quantity sync | Stripe API, Users DAL, Organizations DAL | No PHI |

## Data Flow

### PHI Storage: Save a Generated Note

This is the most complex new data flow. It involves creating a clinical note + initial version rows in a single transaction.

```
1. User generates note (existing flow) -> result in client state
2. User clicks "Save" -> saveNoteAction Server Action
3. Action validates: Zod schema (templateId, content as NoteSection[], generationTimeMs)
4. Action calls getSession() -> validates auth
5. Action calls checkSubscriptionAccess(session) -> validates billing
6. Action resolves scope: { type: 'user', userId } (or org scope for clinic admin)
7. Action calls clinicalNoteService.saveNote(scope, data):
   a. BEGIN transaction (getPoolClient)
   b. Validate templateId exists and user has access (template DAL)
   c. Validate patient ownership if patientId provided (patient DAL)
   d. INSERT clinical_notes row with JSONB content (clinical notes DAL)
   e. INSERT note_versions rows (one per section, version=1, source='generated') (versions DAL)
   f. INSERT audit_log with NOTE_SAVED action (audit DAL, transactional via client)
   g. COMMIT
8. Action returns { success: true, data: { noteId } }
9. Client navigates to /dashboard/notes/[noteId]
```

**Why transactional:** If the note saves but version rows fail to insert, we have clinical content with no audit trail -- a HIPAA compliance gap. Rule 1 (multi-step security operations use transactions) and Rule 9 (audit in same transaction) both apply.

### PHI Storage: Edit a Note Section

```
1. User edits section content in note detail view
2. User clicks "Save" -> updateNoteSectionAction Server Action
3. Action validates: Zod (sectionId -> content map, expectedUpdatedAt for optimistic lock)
4. Action calls getSession(), checkSubscriptionAccess()
5. Action calls clinicalNoteService.updateSections(scope, noteId, sections, expectedUpdatedAt):
   a. BEGIN transaction
   b. SELECT clinical_notes FOR UPDATE WHERE id AND user_id/org_id AND updated_at = expectedUpdatedAt
   c. If 0 rows -> ROLLBACK, return conflict (409)
   d. Merge: replace specified sections in JSONB content array, keep others unchanged
   e. UPDATE clinical_notes SET content = merged
   f. For each changed section: INSERT note_versions (version=N+1, source='manual')
   g. INSERT audit_log with NOTE_UPDATED
   h. COMMIT
6. Action returns updated note (or 'conflict' error code)
7. Client either refreshes or shows conflict message
```

**Optimistic locking:** The `WHERE updated_at = $expectedUpdatedAt` check prevents silent overwrites when two users edit concurrently (relevant in clinic context where multiple PTs might access the same note).

### Clinic Multi-Tenancy: Scope Resolution

The dual-scoping pattern is the core multi-tenancy mechanism. Every PHI query accepts a `QueryScope` that determines the WHERE clause:

```typescript
type QueryScope =
  | { type: 'user'; userId: string }
  | { type: 'organization'; organizationId: string; userId: string };
```

Resolution flow:
```
1. Server Action/Page calls resolveScope(session, requestedScope?)
2. If no org scope requested -> { type: 'user', userId: session.userId }
   (default: user sees only their own records)
3. If org scope requested:
   a. Verify session.organizationId exists
   b. Verify active membership via findActiveMemberByOrgAndUser()
   c. Verify role is 'owner' or 'admin'
   d. Return { type: 'organization', organizationId, userId }
4. DAL functions use scope to build WHERE clause:
   - user scope:  WHERE user_id = $userId
   - org scope:   WHERE organization_id = $orgId
```

**Key security property:** Even in org scope, the userId is preserved for audit trail attribution. An admin viewing a note they didn't author creates a `NOTE_VIEWED` audit entry with their userId, not the author's.

### Clinic Billing: Seat-Based Stripe Integration

```
1. Clinic admin invites a new member
2. inviteService.createInvite() creates invite_code with type='clinic'
3. New user redeems invite -> registration flow (existing) + org join (existing)
4. Post-join: countBillableSeats() returns new count
5. billingService.updateSeatQuantity(orgId, newCount):
   a. Retrieve org's Stripe subscription_id
   b. stripe.subscriptions.update(subId, { items: [{ id: itemId, quantity: newCount }] })
   c. Stripe prorates the charge automatically
6. Reverse flow on member removal: countBillableSeats() -> updateSeatQuantity() with decreased count
```

**Stripe's per-seat model:** Use `quantity` on the subscription item. One Price object with `per_unit` pricing. Stripe handles proration on quantity changes. No custom metering needed -- the seat count is deterministic from `organization_members WHERE removed_at IS NULL AND is_billable = TRUE`.

## Patterns to Follow

### Pattern 1: Dual-Scope DAL Functions

Every DAL module that handles user-owned or org-owned data implements the same scope pattern.

**What:** Each query function accepts a `QueryScope` discriminated union. The WHERE clause branches based on scope type. This is the multi-tenancy authorization layer.

**When:** Any DAL function that returns PHI or user-specific data.

```typescript
// In server/dal/patients.ts
export async function findPatientsByScope(
  scope: QueryScope,
  options: { search?: string; limit?: number; offset?: number }
): Promise<{ patients: Patient[]; total: number }> {
  const limit = Math.min(options.limit ?? 50, 100);
  const offset = options.offset ?? 0;

  // Scope determines WHERE clause
  const scopeClause = scope.type === 'user'
    ? 'user_id = $1'
    : 'organization_id = $1';
  const scopeValue = scope.type === 'user'
    ? scope.userId
    : scope.organizationId;

  const result = await db.query<PatientRow>(
    `SELECT ${PATIENT_COLUMNS} FROM patients
     WHERE ${scopeClause} AND archived_at IS NULL
     ORDER BY last_name, first_name
     LIMIT $2 OFFSET $3`,
    [scopeValue, limit, offset]
  );

  return {
    patients: result.rows.map(rowToPatient),
    total: /* count query */,
  };
}
```

### Pattern 2: Transactional Note Operations

**What:** Note save and note update both involve multiple tables (clinical_notes + note_versions + audit_logs). These use `getPoolClient()` with BEGIN/COMMIT/ROLLBACK.

**When:** Any operation that writes to clinical_notes AND note_versions.

```typescript
// In server/services/clinical-note.ts
export async function saveNote(
  scope: QueryScope,
  data: SaveNoteInput
): Promise<ClinicalNote> {
  const client = await getPoolClient();
  try {
    await client.query('BEGIN');

    const note = await createClinicalNote(client, scope, data);
    await createInitialVersions(client, note.id, data.content, scope.userId);
    await insertAuditLogWithClient(client, {
      userId: scope.userId,
      action: AuditAction.NOTE_SAVED,
      status: 'SUCCESS',
      metadata: { noteId: note.id, templateId: data.templateId },
    });

    await client.query('COMMIT');
    return note;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

### Pattern 3: Append-Only Version Table with Immutability Triggers

**What:** `note_versions` is a write-once table. Database triggers prevent UPDATE and DELETE, matching the pattern already established by `audit_logs`.

**When:** Any table that must preserve a complete, tamper-evident history for HIPAA compliance.

```sql
-- Same immutability pattern as audit_logs (001_initial_schema.sql:96-127)
CREATE OR REPLACE FUNCTION prevent_note_version_update()
RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'note_versions rows cannot be modified'; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER note_versions_no_update
BEFORE UPDATE ON note_versions
FOR EACH ROW EXECUTE FUNCTION prevent_note_version_update();

CREATE OR REPLACE FUNCTION prevent_note_version_delete()
RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'note_versions rows cannot be deleted'; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER note_versions_no_delete
BEFORE DELETE ON note_versions
FOR EACH ROW EXECUTE FUNCTION prevent_note_version_delete();
```

### Pattern 4: JSONB Content with Relational Version History

**What:** `clinical_notes.content` stores the current state as a JSONB array of `NoteSection` objects for fast reads. `note_versions` stores the full per-section history in a relational table for audit and diff purposes.

**When:** Any entity where you need both fast current-state reads and complete change history.

**Why this split:** Reading a note should be a single-row SELECT with no joins. Reviewing edit history is an infrequent operation that can afford the JOIN through note_template_sections. Keeping these separate avoids bloating the hot path.

```
clinical_notes.content (hot path - every note view):
[
  { "sectionId": "uuid", "title": "Subjective", "content": "Patient reports..." },
  { "sectionId": "uuid", "title": "Objective", "content": "ROM findings..." },
  ...
]

note_versions (cold path - edit history view):
| note_id | section_id | version | content       | source    | created_by | created_at |
|---------|------------|---------|---------------|-----------|------------|------------|
| uuid    | uuid       | 1       | "Original..." | generated | uuid       | 2026-03-16 |
| uuid    | uuid       | 2       | "Edited..."   | manual    | uuid       | 2026-03-17 |
```

### Pattern 5: Template-Driven Generation

**What:** Note generation is driven by template section definitions, not hardcoded SOAP sections. Each section's `promptInstructions`, `verbosity`, and `styling` are read from `note_template_sections` and fed into the LLM prompt.

**When:** Note generation always -- even in Phase 1 with only the built-in SOAP template.

**Why now:** Building against the template abstraction from day 1 means zero migration cost when custom templates ship. The existing hardcoded PT prompts in `server/prompts/pt-prompts.ts` migrate to seed data in `note_template_sections.prompt_instructions`.

```typescript
// Current (hardcoded):
const systemPrompt = getSystemPrompt();  // static string
const userPrompt = buildUserPrompt(quickNotes, noteType, patientContext);  // fixed SOAP structure

// Target (template-driven):
const template = await findTemplateWithSections(templateId);
const systemPrompt = buildSystemPromptFromTemplate(template);  // dynamic from sections
const userPrompt = buildUserPromptFromSections(
  template.sections,  // ordered array with promptInstructions, verbosity, styling
  quickNotes,
  noteType,
  patientContext
);
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Row-Level Security (RLS) for Multi-Tenancy

**What:** Using PostgreSQL RLS policies with `SET app.tenant_id` at connection level to enforce data isolation.

**Why bad for FlashNote:** The existing DAL pattern already enforces authorization in application code with explicit WHERE clauses. Adding RLS would create two authorization layers that must stay in sync. RLS also complicates connection pooling (`pg.Pool` reuses connections -- `SET` on one checkout leaks to the next). The existing pattern is more debuggable, more testable, and already passes the "single codebase to audit" criterion.

**Instead:** Keep authorization in DAL WHERE clauses with the `QueryScope` pattern. This is explicit, testable, and auditable.

### Anti-Pattern 2: Separate Databases or Schemas per Organization

**What:** Creating a separate PostgreSQL schema or database per clinic for data isolation.

**Why bad for FlashNote:** Solo PTs and clinic members coexist in the same tables. The `organization_id` column + WHERE clause approach handles this cleanly. Separate schemas would require dynamic schema switching, complicate migrations (run against N schemas), and are overkill for the scale target (10K users, not 1M).

**Instead:** Shared schema with `organization_id` column on all PHI tables (already designed in PHI_STORAGE_PLAN.md).

### Anti-Pattern 3: Storing Version History Inside JSONB

**What:** Keeping an array of previous versions inside `clinical_notes.content` JSONB.

**Why bad:** JSONB updates rewrite the entire column value. Appending version history into JSONB means every read of current content also fetches all history. The document grows unboundedly. Cannot enforce immutability on JSONB array elements.

**Instead:** Separate `note_versions` relational table with database-level immutability triggers.

### Anti-Pattern 4: Template Sections as Enum/Fixed Set

**What:** Hardcoding note sections as `{ subjective, objective, assessment, plan }` in types and JSONB structure.

**Why bad:** Forces a schema migration and data migration for every clinical_notes row when custom templates ship. The JSONB would need rewriting from `{ subjective: "..." }` to `[{ sectionId: "...", title: "Subjective", content: "..." }]`.

**Instead:** Use ordered array of `NoteSection` objects from day 1 (already planned in PHI_STORAGE_PLAN.md). This is a forward-compatible structure that works for SOAP, DAP, or arbitrary custom templates.

### Anti-Pattern 5: PHI in Stripe Metadata

**What:** Storing patient names, note content, or any PHI in Stripe subscription or checkout metadata.

**Why bad:** Stripe is not covered under the Google Cloud BAA. PHI in Stripe metadata would constitute a HIPAA violation. Stripe metadata should contain only opaque identifiers (userId, organizationId).

**Instead:** Only store `userId` and `organizationId` in Stripe metadata. All PHI stays in Cloud SQL.

## Scalability Considerations

| Concern | At 100 users (beta) | At 10K users (growth) | At 100K users (scale) |
|---------|--------------------|-----------------------|----------------------|
| **Note storage** | ~10K notes, single index scan | ~1M notes, partition by created_at (RANGE) | ~10M notes, partition + read replicas |
| **Version history** | ~40K rows (4 per note), trivial | ~4M rows, index on (note_id, section_id, version DESC) sufficient | ~40M rows, consider archiving versions older than 7 years |
| **Patient search** | ILIKE is fine | Add pg_trgm GIN index for fuzzy search | Full-text search or external search service |
| **Connection pool** | 20 connections, single Cloud Run instance | 20 per instance, 2-5 instances | Cloud SQL connection limits; add PgBouncer or Cloud SQL Auth Proxy pooling |
| **Org data isolation** | WHERE clause sufficient | WHERE clause sufficient, indexes cover it | Still fine -- shared-table multi-tenancy scales to millions of tenants on PostgreSQL |
| **Stripe seat sync** | Webhook-only, instant | Webhook-only, instant | Webhook-only (Stripe handles scaling) |
| **Audit log volume** | ~50K rows/year | ~5M rows/year, Cloud Logging sink for long-term | Partition audit_logs by created_at, archive to Cloud Storage after 6 years |

## Build Order and Dependencies

The following build order reflects hard dependencies between components. Each step produces a testable, committable unit.

### Step 1: Database Migration + Types (Foundation)

**Creates:** 5 new tables (note_templates, note_template_sections, patients, clinical_notes, note_versions), triggers, indexes, SOAP seed data.

**Dependencies:** None (pure SQL migration + TypeScript types).

**Enables:** Everything else -- all subsequent steps read/write these tables.

**Key decisions embedded:**
- Template-driven content structure (ordered NoteSection[] array in JSONB)
- Organization scoping from day 1 (org_id on patients + clinical_notes)
- Append-only note_versions with immutability triggers
- ON DELETE RESTRICT on all FK relationships (HIPAA data retention)

### Step 2: Patient DAL + Service + Actions (Vertical Slice)

**Creates:** patients.ts DAL, patient service, patient Server Actions (CRUD), patient pages (list, detail, new).

**Dependencies:** Step 1 (tables + types must exist).

**Enables:** Patient selection in note generation form. Patient context injection into LLM prompts.

**Authorization model:** QueryScope-based. User scope by default. Org scope requires admin/owner role check.

**Audit actions added:** PATIENT_CREATED, PATIENT_UPDATED, PATIENT_ARCHIVED, PATIENT_VIEWED.

### Step 3: Note Templates DAL (Read-Only)

**Creates:** note-templates.ts DAL (findBuiltinTemplates, findTemplateById, findTemplateWithSections).

**Dependencies:** Step 1 (tables + seed data).

**Enables:** Template-driven generation in Step 4. Template selector in note generation form.

**Phase 1 scope:** Read-only. No CRUD -- only the built-in SOAP template exists. Template builder UI deferred to Phase 2.

### Step 4: Note Generation Refactor (Template-Driven)

**Creates:** Refactored note-generation.ts that builds prompts from template sections instead of hardcoded PT prompts.

**Dependencies:** Step 3 (template DAL for reading section definitions). Step 2 (patient DAL for context loading).

**Key change:** `generateNote()` signature changes from `(quickNotes, noteType, patientContext?)` to `(quickNotes, noteType, templateId, patientId?, patientContext?)`. The function loads template sections, builds dynamic prompts, and optionally loads patient context from DB.

**Backward compatibility:** The existing `generateNoteAction` continues to work -- it passes the built-in SOAP template ID. The LLM output format changes from `{ subjective, objective, assessment, plan }` to `NoteSection[]`.

### Step 5: Clinical Notes DAL + Versions DAL + Service (Persistence)

**Creates:** clinical-notes.ts DAL (CRUD with optimistic locking), note-versions.ts DAL (append-only inserts + reads), clinical-note service (transactional save/update).

**Dependencies:** Step 1 (tables), Step 3 (template validation on save), Step 4 (generation produces NoteSection[] format).

**Enables:** Note persistence, edit history, version timeline UI.

**Transaction boundaries:** Save = INSERT note + INSERT versions + INSERT audit (one transaction). Update = UPDATE note content + INSERT version rows + INSERT audit (one transaction).

### Step 6: Note UI (Pages + Components)

**Creates:** Note generation form redesign (template selector, patient search/typeahead), note list page, note detail page (dynamic section rendering, inline editing, version history view).

**Dependencies:** Step 2 (patient data for selector), Step 4 (generation returns NoteSection[]), Step 5 (save/update/list/detail operations).

**PHI cleanup:** All pages holding PHI in client state use `usePhiCleanup` hook for route-change cleanup.

### Step 7: Clinic Admin Features

**Creates:** Org read DAL extensions, admin dashboard page, team management page, org leave/transfer actions.

**Dependencies:** Steps 1-6 (all PHI infrastructure in place), existing org/member DAL.

**Scope:** Admin/owner can view all clinic patients and notes (org scope). Member management (invite, remove, role change). Seat count display.

### Step 8: Clinic Billing (Stripe Seat-Based)

**Creates:** Stripe clinic plan (per-seat Price), seat quantity sync on member join/leave, org billing management.

**Dependencies:** Step 7 (admin features), existing billing service.

**Stripe integration:** Use `subscription.items[0].quantity` for seat count. Update via `stripe.subscriptions.update()` on member count changes. Stripe handles proration automatically.

### Dependency Graph

```
Step 1 (DB Migration + Types)
  |
  +---> Step 2 (Patient DAL/Service/UI)
  |       |
  |       +---> Step 4 (Template-Driven Generation) <--- Step 3 (Template DAL)
  |                |
  |                +---> Step 5 (Clinical Notes DAL/Versions/Service)
  |                        |
  |                        +---> Step 6 (Note UI Pages)
  |
  +---> Step 3 (Template DAL) [parallel with Step 2]
  |
  +---> Step 7 (Clinic Admin) [parallel after Steps 1-6]
           |
           +---> Step 8 (Clinic Billing)
```

**Parallelization opportunities:**
- Steps 2 and 3 can run in parallel (no interdependency)
- Steps 7 and 8 are post-PHI-storage and depend on the full stack being in place
- Step 6 UI work can begin in parallel with Step 5 if mocked data is acceptable for initial development

## Cross-Cutting Concerns for New Components

### Audit Logging for PHI Access

New audit actions to add to `AuditAction` enum:
- `PATIENT_CREATED`, `PATIENT_UPDATED`, `PATIENT_ARCHIVED`, `PATIENT_VIEWED`
- `NOTE_SAVED`, `NOTE_UPDATED`, `NOTE_ARCHIVED`, `NOTE_VIEWED`

**PHI read audit policy:** Individual record access (GET /patients/:id, GET /notes/:id) logs an audit entry. List endpoints do not log per-row access (excessive noise). This matches the pattern in PHI_STORAGE_PLAN.md and is a documented compliance decision.

### PHI Cleanup on Navigation

The `usePhiCleanup` hook (from PHI_STORAGE_PLAN.md) subscribes to `usePathname()` changes and calls a cleanup callback. Required on:
- Note detail page (clears SOAP content from state)
- Note generation result view (clears generated content)
- Patient detail page (clears patient data from state)

### Sentry/Logging Sanitization

Existing Sentry sanitization patterns must cover new PHI field names: `quickNotes`, `patientContext`, `content` (JSONB), `firstName`, `lastName`, `dateOfBirth`, `context`. The regex patterns `/note/i` and `/patient/i` in the sanitization module should catch these, but explicit verification is needed during implementation.

## Sources

- FlashNote PHI Storage Plan: `docs/planning/PHI_STORAGE_PLAN.md` (HIGH confidence -- first-party design doc)
- FlashNote existing DAL: `web/src/server/dal/*.ts` (HIGH confidence -- codebase analysis)
- FlashNote existing schema: `web/src/server/db/migrations/001_initial_schema.sql` (HIGH confidence -- codebase analysis)
- [Crunchy Data: Designing Postgres for Multi-tenancy](https://www.crunchydata.com/blog/designing-your-postgres-database-for-multi-tenancy) (MEDIUM confidence -- industry patterns)
- [Stripe: Per-Seat Pricing](https://docs.stripe.com/subscriptions/pricing-models/per-seat-pricing) (HIGH confidence -- official docs)
- [Stripe: Subscription Quantities](https://docs.stripe.com/billing/subscriptions/quantities) (HIGH confidence -- official docs)
- [Design Gurus: Enforcing Immutability and Append-Only Audit Trails](https://www.designgurus.io/answers/detail/how-do-you-enforce-immutability-and-appendonly-audit-trails) (MEDIUM confidence -- pattern reference)
- [pgMemento: Audit Trail with Schema Versioning](https://github.com/pgMemento/pgMemento) (LOW confidence -- reference only, not recommending adoption)
- [Bytebase: Multi-Tenant Database Architecture Patterns](https://www.bytebase.com/blog/multi-tenant-database-architecture-patterns-explained/) (MEDIUM confidence -- pattern comparison)
- [HIPAA Audit Log Requirements](https://www.cayosoft.com/blog/hipaa-audit-log-requirements/) (MEDIUM confidence -- compliance reference)

---

*Architecture research: 2026-03-16*
