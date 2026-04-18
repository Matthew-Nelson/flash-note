---
phase: 04-phi-storage
plan: 02
type: execute
wave: 2
depends_on:
  - 04-01
files_modified:
  - web/src/actions/patients.ts
  - web/src/actions/patients.test.ts
  - web/src/app/dashboard/patients/page.tsx
  - web/src/app/dashboard/patients/page.test.tsx
  - web/src/app/dashboard/patients/new/page.tsx
  - web/src/app/dashboard/patients/new/page.test.tsx
  - web/src/app/dashboard/patients/[id]/page.tsx
  - web/src/app/dashboard/patients/[id]/page.test.tsx
  - web/src/app/dashboard/patients/loading.tsx
  - web/src/components/patients/PatientTypeahead.tsx
  - web/src/components/patients/PatientTypeahead.test.tsx
  - web/src/components/patients/PatientInfoCard.tsx
  - web/src/components/patients/PatientInfoCard.test.tsx
  - web/src/components/patients/PatientContextField.tsx
  - web/src/components/patients/PatientContextField.test.tsx
  - web/src/components/patients/PatientNotesTable.tsx
  - web/src/components/patients/PatientNotesTable.test.tsx
  - web/src/components/patients/PatientRow.tsx
  - web/src/components/patients/PatientRow.test.tsx
  - web/src/components/patients/PatientCreateForm.tsx
  - web/src/components/patients/PatientCreateForm.test.tsx
  - web/src/components/patients/ClientPatientDetail.tsx
  - web/src/components/patients/ClientPatientDetail.test.tsx
  - web/src/components/patients/error-messages.ts
  - web/src/components/patients/index.ts
  - web/src/components/patients/SearchPatients.tsx
  - web/src/components/patients/SearchPatients.test.tsx
  - web/src/components/ui/ConfirmDialog.tsx
  - web/src/components/ui/ConfirmDialog.test.tsx
  - web/src/components/ui/Button.tsx
  - web/src/components/ui/Button.test.tsx
  - web/src/components/Sidebar.tsx
  - web/src/components/Sidebar.test.tsx
  - web/src/test/integration/phi-lifecycle.test.ts
autonomous: false
requirements:
  - PHI-01
  - PHI-04
  - PHI-09
must_haves:
  truths:
    - "Authenticated user can create a patient record with first/last name (minimum) + DOB + pronoun + phone + email + context via /dashboard/patients/new"
    - "Authenticated user can view the patient list at /dashboard/patients with debounced name search"
    - "Authenticated user can view a patient detail page at /dashboard/patients/[id] showing profile fields and a persistent context field"
    - "Authenticated user can edit patient profile and persistent context"
    - "Authenticated user can archive a patient via confirmation modal"
    - "PATIENT_CREATED / PATIENT_UPDATED / PATIENT_ARCHIVED / PATIENT_VIEWED audit events fire when their actions occur"
    - "PATIENT_CREATED / PATIENT_UPDATED / PATIENT_ARCHIVED audit writes run inside the same transaction as their mutation (Rule 9) via auditService.logWithClient"
    - "Unauthenticated users are redirected to /login when hitting any /dashboard/patients/* route"
    - "User A cannot view/edit/archive user B's patient (Rule 5 + Rule 8 enforcement)"
    - "Sidebar `Patients` nav item no longer shows `Coming Soon` badge"
  artifacts:
    - path: web/src/actions/patients.ts
      provides: "createPatientAction, updatePatientAction, archivePatientAction, updatePatientContextAction"
      exports: ["createPatientAction", "updatePatientAction", "archivePatientAction", "updatePatientContextAction"]
    - path: web/src/app/dashboard/patients/page.tsx
      provides: "Patient list + search + pagination (Server Component)"
    - path: web/src/app/dashboard/patients/new/page.tsx
      provides: "Patient create form page"
    - path: web/src/app/dashboard/patients/[id]/page.tsx
      provides: "Patient detail page with info card, context field, notes table, archive action (Server Component + audit)"
    - path: web/src/components/patients/PatientTypeahead.tsx
      provides: "Debounced combobox (WAI-ARIA 1.2) backed by findPatientsByScope"
      exports: ["PatientTypeahead"]
    - path: web/src/components/ui/ConfirmDialog.tsx
      provides: "Shared destructive-action confirmation modal (first used for archive patient; reused in 04-03 for archive note)"
      exports: ["ConfirmDialog"]
  key_links:
    - from: web/src/app/dashboard/patients/page.tsx
      to: web/src/server/dal/patients.ts
      via: "findPatientsByScope"
      pattern: "findPatientsByScope"
    - from: web/src/app/dashboard/patients/[id]/page.tsx
      to: web/src/server/services/audit.ts
      via: "auditService.log — PATIENT_VIEWED after load"
      pattern: "PATIENT_VIEWED"
    - from: web/src/actions/patients.ts
      to: web/src/server/dal/patients.ts
      via: "createPatient/updatePatient/archivePatient DAL calls inside PoolClient transaction"
      pattern: "from '@/server/dal'"
    - from: web/src/actions/patients.ts
      to: web/src/server/services/audit.ts
      via: "auditService.logWithClient for PATIENT_CREATED / PATIENT_UPDATED / PATIENT_ARCHIVED (Rule 9)"
      pattern: "logWithClient"
    - from: web/src/components/patients/PatientCreateForm.tsx
      to: web/src/actions/patients.ts
      via: "createPatientAction Server Action"
      pattern: "createPatientAction"
    - from: web/src/components/patients/ClientPatientDetail.tsx
      to: web/src/hooks/use-phi-cleanup.ts
      via: "usePhiCleanup clears patient state on route-change/logout"
      pattern: "usePhiCleanup"
---

<objective>
Plan 04-02 ships the patients feature end-to-end: Server Actions for create/update/archive + context-specific save, the three patients pages (list / new / detail), shared UI primitives (`ConfirmDialog`, `Button variant="destructive"`, `PatientTypeahead` reusable combobox), and integration of `usePhiCleanup` on the detail page. This plan delivers PHI-01 (create + detail), PHI-04 (persistent patient context field in the UI + DAL — note that the prompt-injection wire-up for PHI-04 completes in Plan 04-03), and PHI-09 (PATIENT_VIEWED audit on detail loads).

Purpose: ship the patient-management half of the clinical documentation platform in a focused, shippable plan that depends only on 04-01 foundation. User-visible outcome: clinician can create, search, view, edit, and archive patients and set a persistent per-patient context. Notes features land in Plan 04-03.

This plan is non-autonomous — it ships a new clinician-facing UI and requires a UAT checkpoint after implementation (visual/keyboard/a11y confirmation against 04-UI-SPEC.md before Plan 04-03 consumes the PatientTypeahead and patients listing).

**M-6 resolution:** Patient write paths (createPatientAction, updatePatientAction, archivePatientAction, updatePatientContextAction) wrap DAL + audit in a single `getPoolClient()` transaction using `auditService.logWithClient` — same pattern Plan 04-03 uses for saveNoteAction/updateNoteSectionsAction. This matches Rule 9 intent for HIPAA-critical audit events. Detail-page PATIENT_VIEWED audit remains fire-and-forget (read path) but the audit-service catch branch now logs failures at `error` level with `source: 'audit_service'` for visibility.

Output:
- 4 Server Actions (create/update/archive/updateContext) with Rule 1 transactional DAL+audit via `logWithClient` (new M-6 requirement), session guard, rate limiting, curated error codes
- 3 Patients pages following 04-UI-SPEC.md
- Reusable `PatientTypeahead` combobox (consumed by Plan 04-03 NoteGenerationForm)
- Shared `ConfirmDialog` + `Button variant="destructive"` (consumed by Plan 04-03 archive note)
- `PATIENT_*` audit events firing on every relevant action (in-transaction for writes, fire-and-forget with error logging for reads)
- Sidebar `Coming Soon` badge removed from Patients link
- Phi-lifecycle integration scenarios for "create patient + update + archive" filled in
- ~80 new tests, coverage guardrails maintained
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/phases/04-phi-storage/04-CONTEXT.md
@.planning/phases/04-phi-storage/04-RESEARCH.md
@.planning/phases/04-phi-storage/04-UI-SPEC.md
@.planning/phases/04-phi-storage/04-01-SUMMARY.md
@web/src/actions/auth.ts
@web/src/actions/notes.ts
@web/src/server/lib/get-session.ts
@web/src/server/lib/rate-limit.ts
@web/src/server/lib/request-context.ts
@web/src/server/services/audit.ts
@web/src/components/ui/Button.tsx
@web/src/components/ui/Input.tsx
@web/src/components/ui/Card.tsx
@web/src/components/ui/Alert.tsx
@web/src/components/DashboardShell.tsx
@web/src/components/Sidebar.tsx
@web/src/components/auth/AuthLayout.tsx
@web/src/app/dashboard/patients/page.tsx
@web/src/app/dashboard/settings/page.tsx
@web/src/lib/types/actions.ts
@web/src/lib/schemas/patients.ts
@web/src/server/dal/patients.ts

<interfaces>
<!-- Contracts the executor consumes. Use these — do not re-explore. -->

From web/src/lib/types/actions.ts (existing):
```typescript
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };
```

From web/src/server/dal/patients.ts (created in 04-01):
```typescript
export async function createPatient(scope, input): Promise<Patient>;  // ALSO accepts optional client: pg.PoolClient (check signature — if not present, extend in this plan)
export async function findPatientById(scope: QueryScope, patientId: string): Promise<Patient | null>;
export async function findPatientsByScope(scope, input?): Promise<{ patients: Patient[]; total: number }>;
export async function updatePatient(scope, patientId, input, client?): Promise<Patient | null>;
export async function archivePatient(scope, patientId, client?): Promise<boolean>;
```

**M-6 note:** If the 04-01 DAL signatures for createPatient/updatePatient/archivePatient do NOT accept an optional `client: pg.PoolClient` parameter, this plan (Task 1) extends those signatures — every DAL function used inside a transaction must accept a client so the audit insert and the business write share one transaction. The existing no-client callers in other code paths (if any) keep working because the parameter is optional and the implementation falls back to `db.query` when omitted.

From web/src/server/lib/get-session.ts (existing):
```typescript
export const getSession: () => Promise<SessionData | null>;  // React.cache wrapped
```

From web/src/server/lib/rate-limit.ts (existing):
```typescript
export const apiRateLimit: (key: string) => Promise<{ success: boolean; limit: number; remaining: number; reset: number }>;
// Phase 4: reuse apiRateLimit for patient Server Actions — DO NOT add a new limiter.
```

From web/src/server/services/audit.ts (existing):
```typescript
export const auditService: {
  log(entry: AuditLogEntry): void;               // fire-and-forget — used for PATIENT_VIEWED (read path). M-6: catch branch now logs at error level with source='audit_service' when audit write throws.
  logWithClient(client: pg.PoolClient, entry: AuditLogEntry): Promise<void>;  // transactional — used for PATIENT_CREATED/UPDATED/ARCHIVED (write paths) per Rule 9 + M-6.
};
```

From web/src/server/db/index.ts:
```typescript
export async function getPoolClient(): Promise<pg.PoolClient>;  // required for Rule 1 transactions in patient write actions (M-6)
```

From web/src/lib/types/index.ts (added in 04-01):
```typescript
export type QueryScope = { type: 'user'; userId: string } | { type: 'organization'; organizationId: string };
export interface Patient { id, userId, organizationId, firstName, lastName, dateOfBirth, pronoun, phone, email, context, archivedAt, createdAt, updatedAt }
```

From web/src/components/ui/Button.tsx (existing — Phase 4 adds variant="destructive"):
```typescript
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link';  // add 'destructive'
export interface ButtonProps { variant?: ButtonVariant; loading?: boolean; /* ... */ }
```

From web/src/actions/notes.ts (existing shape pattern — mirror for patients.ts):
```typescript
'use server';
// 1. Zod parse FormData
// 2. getSession() — redirect if null or unverified (use existing `session_expired` / `unauthenticated` codes)
// 3. apiRateLimit — return rate_limit_exceeded
// 4. getPoolClient + BEGIN (M-6: transactional write path)
// 5. Call DAL (with client)
// 6. auditService.logWithClient (Rule 9 — audit in same transaction)
// 7. COMMIT / ROLLBACK + client.release()
// 8. Return ActionResult<T>
```

Curated error code map (from 04-UI-SPEC.md):
- unauthenticated, session_expired, validation_error, patient_not_found, archive_failed, context_save_failed, internal_error, rate_limit_exceeded
</interfaces>

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Patient Server Actions (transactional with logWithClient per M-6) + audit-service error logging + error-messages + Button destructive variant + ConfirmDialog</name>
  <files>
    web/src/actions/patients.ts,
    web/src/actions/patients.test.ts,
    web/src/server/services/audit.ts,
    web/src/server/services/audit.test.ts,
    web/src/components/patients/error-messages.ts,
    web/src/components/patients/index.ts,
    web/src/components/ui/Button.tsx,
    web/src/components/ui/Button.test.tsx,
    web/src/components/ui/ConfirmDialog.tsx,
    web/src/components/ui/ConfirmDialog.test.tsx,
    web/src/test/integration/phi-lifecycle.test.ts
  </files>
  <read_first>
    - web/src/actions/auth.ts (Server Action shape — cookie IO, getSession guard, ActionResult return, sanitizeFieldErrors usage)
    - web/src/actions/notes.ts (generateNoteAction — closest analog for rate-limit; existing fire-and-forget audit pattern)
    - web/src/server/lib/validation.ts (sanitizeFieldErrors helper — used to strip sensitive values from Zod field errors per Rule 2)
    - web/src/server/services/audit.ts (audit service — auditService.log and auditService.logWithClient signatures + AuditLogEntry shape; M-6 adds error-level logging to the fire-and-forget catch branch)
    - web/src/server/services/audit.test.ts (existing audit service tests — extend with M-6 error-logging test)
    - web/src/server/lib/request-context.ts (`getRequestContext()` returns `{ ipAddress, userAgent }` for audit metadata)
    - web/src/server/lib/get-session.ts (getSession return shape)
    - web/src/server/lib/rate-limit.ts (apiRateLimit signature + usage — per-user key convention `patient:${userId}` or existing pattern)
    - web/src/server/db/index.ts (getPoolClient export — required for M-6 transactional patient writes)
    - web/src/components/ui/Button.tsx (existing variants + classNames — extend with destructive without breaking existing)
    - web/src/components/ui/Button.test.tsx (existing variant tests — add destructive variant tests in same pattern)
    - web/src/components/ui/Alert.tsx (Alert variants — reference for destructive styling token usage)
    - web/src/lib/schemas/patients.ts (schemas created in 04-01 — consumed here)
    - web/src/server/dal/patients.ts (DAL functions created in 04-01 — consumed here; extend signatures to accept optional `client: pg.PoolClient` if not already present)
    - web/src/server/types.ts (AuditAction enum — PATIENT_CREATED / PATIENT_UPDATED / PATIENT_ARCHIVED added in 04-01)
    - .planning/phases/04-phi-storage/04-UI-SPEC.md §Copywriting / Destructive Confirmations (ConfirmDialog spec — focus trap, aria-modal, backdrop close, Cancel-first focus)
    - .planning/phases/04-phi-storage/04-RESEARCH.md §5.1 (Server Action table + Zod schemas + rationale for separate updatePatientContextAction)
  </read_first>
  <behavior>
    - **M-6:** `createPatientAction(formData)` opens a PoolClient transaction (`BEGIN`), parses createPatientSchema, gets session, enforces rate limit, calls `createPatient(scope, input, client)` inside the transaction, audits `PATIENT_CREATED` via `auditService.logWithClient(client, ...)` with metadata `{ patientId: id }`, `COMMIT`s, returns `{ success: true, data: { id } }`. On any error: `ROLLBACK`, logger.error (no PHI), `return { success: false, error: 'internal_error' }`. `finally { client.release() }`.
    - **M-6:** `updatePatientAction(patientId, formData)` uses the same transactional shape. Parses updatePatientSchema, session guard + rate limit. Inside transaction: `updatePatient(scope, patientId, input, client)`. If DAL returns null → `ROLLBACK` + `{ success: false, error: 'patient_not_found' }`. On success: `auditService.logWithClient(client, { action: PATIENT_UPDATED, metadata: { patientId, fields: Object.keys(input) } })` (field names only, no values — Rule 7), `COMMIT`.
    - **M-6:** `archivePatientAction(patientId)` validates UUID, session guard + rate limit, opens transaction, calls `archivePatient(scope, patientId, client)`. If returns false → `ROLLBACK` + `{ success: false, error: 'archive_failed' }`. On success: `auditService.logWithClient(client, { action: PATIENT_ARCHIVED, metadata: { patientId } })`, `COMMIT`.
    - **M-6:** `updatePatientContextAction(patientId, context)` uses the same transactional shape. Parses updatePatientContextSchema, session guard, rate limit, inside transaction calls `updatePatient(scope, patientId, { context }, client)`. On success `auditService.logWithClient(client, { action: PATIENT_UPDATED, metadata: { patientId, fields: ['context'] } })`, `COMMIT`. DAL failure → `{ success: false, error: 'context_save_failed' }`.
    - **M-6:** Update the `auditService.log(...)` fire-and-forget implementation — in its internal catch branch, add `logger.error({ err, source: 'audit_service', errorType: 'audit_write_failed', userId: entry.userId, action: entry.action }, 'Audit write failed')` so PATIENT_VIEWED (and other fire-and-forget audit paths) surface to Cloud Error Reporting when the DB insert fails. Do not change the public signature.
    - Every action never throws for expected errors (validation, not found, auth) — returns `ActionResult` with curated code. Only unexpected internal errors are caught and logged at error level via Pino (source: 'action_patient_*', userId, errorType) with `return { success: false, error: 'internal_error' }`.
    - Never log PHI (no firstName, lastName, DOB, phone, email, context values — only IDs and field-name lists).
    - Button `destructive` variant uses `bg-fn-error text-white hover:bg-fn-error-dark`, `min-h-[44px]`, same focus-ring rules as other variants.
    - ConfirmDialog: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus-trap (Tab cycles within modal), Escape closes, backdrop click closes, initial focus lands on Cancel button (the safer default per UI-SPEC), body scroll locked while open, includes an internal `aria-live="polite"` region for loading/error announcements, renders children via a render-prop for custom body copy.
    - error-messages.ts exports `PATIENT_ERROR_MESSAGES: Record<string, string>` + `PATIENT_ERROR_FALLBACK` per 04-UI-SPEC.md (all 7 codes mapped).
    - phi-lifecycle integration test gets 2 filled-in scenarios: "create patient + audit fires IN SAME TRANSACTION", "update patient context then archive".
  </behavior>
  <action>
1. Extend `web/src/components/ui/Button.tsx`:
- Add `'destructive'` to the `variant` union.
- Add a new className branch for destructive — exactly the tokens from 04-UI-SPEC.md §Color §Destructive: background `bg-fn-error`, text `text-white`, hover `hover:bg-fn-error-dark`, focus-visible outline uses existing focus rule (inherits). Preserve existing min-h-[44px], cursor-pointer, disabled, and loading props.
- Add matching test in `Button.test.tsx`: renders with destructive className, applies aria-disabled when disabled, loading spinner centered, class includes `bg-fn-error`.

2. Create `web/src/components/ui/ConfirmDialog.tsx`:
```tsx
'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: 'primary' | 'destructive';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  errorMessage?: string | null;
}

export function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel, confirmVariant = 'primary', onConfirm, onCancel, loading = false, errorMessage = null }: ConfirmDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Focus trap + initial focus on Cancel + Escape close + body scroll lock
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelButtonRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
      if (e.key === 'Tab') {
        // Focus trap: cycle within the dialog
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onCancel, loading]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={loading ? undefined : onCancel}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-fn-lg font-semibold text-fn-text-primary">{title}</h2>
        <div id={bodyId} className="mt-4 text-fn-base text-fn-text-secondary">{body}</div>
        <div aria-live="polite" aria-atomic="true" className="sr-only">{loading ? 'Working...' : errorMessage ?? ''}</div>
        {errorMessage && <p role="alert" className="mt-4 text-fn-base text-fn-error">{errorMessage}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button ref={cancelButtonRef} variant="secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={confirmVariant} loading={loading} onClick={() => void onConfirm()}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
```
(Note: the Button `ref` forwarding may require `React.forwardRef` — if Button doesn't yet forward refs, add forwardRef to Button.tsx in this task.)

Add tests in `ConfirmDialog.test.tsx`: renders with role=dialog + aria-modal=true + aria-labelledby, initial focus on Cancel button (not confirm), Escape key closes when not loading, Escape ignored when loading, backdrop click closes, Tab wraps focus, body overflow hidden while open then restored on close, errorMessage renders with role=alert.

3. Create `web/src/components/patients/error-messages.ts` per 04-UI-SPEC.md:
```typescript
export const PATIENT_ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: 'Please sign in to continue.',
  session_expired: 'Your session has expired. Please sign in again.',
  validation_error: 'Please check the highlighted fields and try again.',
  patient_not_found: "This patient no longer exists or you don't have access to it.",
  archive_failed: "We couldn't archive this patient. Please try again.",
  context_save_failed: "We couldn't save the patient context. Please try again.",
  rate_limit_exceeded: 'Too many requests. Please wait a moment and try again.',
  internal_error: 'Something went wrong. Please try again.',
};
export const PATIENT_ERROR_FALLBACK = 'Something went wrong. Please try again.';
export function mapPatientError(code: string | undefined): string {
  if (!code) return PATIENT_ERROR_FALLBACK;
  return PATIENT_ERROR_MESSAGES[code] ?? PATIENT_ERROR_FALLBACK;
}
```

4. Create `web/src/components/patients/index.ts` barrel (initially just re-exports error-messages; fleshed out in Task 2).

5. **M-6:** Update `web/src/server/services/audit.ts`. In the existing `auditService.log` fire-and-forget implementation, locate the internal catch branch (where the async insert's `.catch(...)` currently silently swallows errors or logs at a low level). Replace that catch branch so it logs at error level:
```typescript
// inside audit.ts — the async insert path
insertAuditLog(entry).catch((err) => {
  logger.error(
    { err, source: 'audit_service', errorType: 'audit_write_failed', userId: entry.userId, action: entry.action },
    'Audit write failed (fire-and-forget)',
  );
});
```
Do not change the public signature — existing callers work unchanged. Add a test in `audit.test.ts` that mocks the DB insert to throw, calls `auditService.log(...)`, and asserts logger.error was called with `source: 'audit_service'` and `errorType: 'audit_write_failed'`.

6. **M-6:** Verify/extend the DAL signatures in `web/src/server/dal/patients.ts` (created in 04-01) to accept an optional `client: pg.PoolClient` parameter on createPatient/updatePatient/archivePatient. If the 04-01 implementation didn't include it, extend in this plan: every function takes `(scope, ...args, client?: pg.PoolClient)`. When `client` is provided, use `client.query(...)`; when absent, fall back to `db.query(...)` for non-transactional callers. Update DAL tests in 04-01 if needed (regression guard).

7. Create `web/src/actions/patients.ts`:
```typescript
'use server';
import { cookies, headers } from 'next/headers';
import { z } from 'zod';
import { createPatient, updatePatient, archivePatient } from '@/server/dal';
import { createPatientSchema, updatePatientSchema, updatePatientContextSchema } from '@/lib/schemas/patients';
import { getSession } from '@/server/lib/get-session';
import { apiRateLimit } from '@/server/lib/rate-limit';
import { getRequestContext } from '@/server/lib/request-context';
import { auditService } from '@/server/services/audit';
import { AuditAction } from '@/server/types';
import { logger } from '@/server/lib/logger';
import { sanitizeFieldErrors } from '@/server/lib/validation';
import { getPoolClient } from '@/server/db';
import type { ActionResult } from '@/lib/types/actions';
import type { Patient, QueryScope } from '@/lib/types';

const uuidSchema = z.string().uuid();

export async function createPatientAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: 'unauthenticated' };
  if (!session.emailVerified) return { success: false, error: 'unauthenticated' };

  const rate = await apiRateLimit(`patient:${session.userId}`);
  if (!rate.success) return { success: false, error: 'rate_limit_exceeded' };

  const parsed = createPatientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: 'validation_error', fieldErrors: sanitizeFieldErrors(parsed.error.flatten().fieldErrors) };
  }

  const ctx = await getRequestContext();
  const client = await getPoolClient();  // M-6: transactional write
  try {
    await client.query('BEGIN');
    const patient = await createPatient(
      { userId: session.userId, organizationId: session.organizationId },
      {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null,
        pronoun: parsed.data.pronoun ?? null,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
        context: parsed.data.context ?? null,
      },
      client,  // M-6: share the transaction
    );
    await auditService.logWithClient(client, {
      userId: session.userId,
      action: AuditAction.PATIENT_CREATED,
      status: 'SUCCESS',
      metadata: { patientId: patient.id },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    await client.query('COMMIT');
    return { success: true, data: { id: patient.id } };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* connection may be unusable */ }
    logger.error({ err, source: 'action_create_patient', userId: session.userId }, 'Create patient failed');
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// updatePatientAction, archivePatientAction, updatePatientContextAction follow the same transactional shape:
// getPoolClient → BEGIN → DAL call with client → auditService.logWithClient → COMMIT / ROLLBACK / release.
```

Implement the remaining 3 actions in the same file following the same transactional shell. For `archivePatientAction`: if `archivePatient` returns false, ROLLBACK and return `{ success: false, error: 'archive_failed' }`. For `updatePatientAction`: if DAL returns null, ROLLBACK and return `{ success: false, error: 'patient_not_found' }`. For `updatePatientContextAction`: on DAL error, return `context_save_failed`.

8. Write `web/src/actions/patients.test.ts`:
- Mock `@/server/dal`, `@/server/lib/get-session`, `@/server/lib/rate-limit`, `@/server/services/audit`, `@/server/lib/logger`, `@/server/lib/request-context`, `@/server/lib/validation`, `@/server/db` (getPoolClient returning a mock PoolClient with query/release spies).
- createPatientAction: (1) returns `unauthenticated` when session is null, (2) returns `unauthenticated` when emailVerified=false, (3) returns `rate_limit_exceeded` when rate limit hit, (4) returns `validation_error` with fieldErrors when schema fails, (5) success path returns { id } AND asserts call order: `BEGIN` → createPatient(client) → logWithClient(client, PATIENT_CREATED) → `COMMIT` → release, (6) when createPatient throws → `ROLLBACK` called, logger.error called, logWithClient NOT called, release called, (7) when logWithClient throws → `ROLLBACK`, return internal_error.
- updatePatientAction: auth/rate-limit/validation paths + patient_not_found when DAL returns null (ROLLBACK called before return) + PATIENT_UPDATED audit with metadata.fields = ['firstName', 'lastName'] (only the fields present in input — verify no values in metadata) + transactional order asserted.
- archivePatientAction: auth + rate + UUID validation + archive_failed when DAL returns false (ROLLBACK called) + PATIENT_ARCHIVED audit inside transaction.
- updatePatientContextAction: auth + validation + success returns Patient + PATIENT_UPDATED audit with metadata.fields = ['context'] + error returns context_save_failed on DAL failure (ROLLBACK called).
- **M-6 regression guard:** test asserts `logWithClient` is called with the same client instance passed to the DAL (i.e. same transaction).

9. Extend `web/src/server/services/audit.test.ts` (M-6 error-logging test):
- Mock logger; mock the DB insert to throw; call `auditService.log(entry)`; await a microtask; assert `logger.error` was called with object containing `source: 'audit_service'` and `errorType: 'audit_write_failed'` and `action: entry.action`.

10. Extend `web/src/test/integration/phi-lifecycle.test.ts`:
Convert 2 of the `it.todo` calls into real tests:
- `it('create patient + audit fires inside same transaction')`: uses `setupTestDb()` (skip if no DATABASE_URL_TEST), creates a user row + session directly via SQL fixture, runs createPatientAction (wrap in a request-context mock), asserts 1 row in patients AND 1 audit_logs row with PATIENT_CREATED, and asserts both rows share the same `xmin` / committed together (or use a transaction probe — simplest: stub `createPatient` to throw on a second test and verify 0 patients AND 0 audit rows committed).
- `it('update patient context then archive')`: runs updatePatientContextAction, asserts context updated + audit row present, runs archivePatientAction, asserts archived_at set + audit row present (all in-transaction).

11. Run `cd web && pnpm test patients Button ConfirmDialog audit` and confirm green.
  </action>
  <verify>
    <automated>cd web && pnpm test patients.test Button.test ConfirmDialog.test audit.test 2>&1 | tail -40 && pnpm tsc --noEmit 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - File `web/src/actions/patients.ts` begins with `'use server';` on line 1
    - `grep "export async function createPatientAction\\|export async function updatePatientAction\\|export async function archivePatientAction\\|export async function updatePatientContextAction" web/src/actions/patients.ts` finds all 4 exports
    - `grep "getSession()" web/src/actions/patients.ts` finds at least 4 matches (one per action — Rule 8)
    - `grep "apiRateLimit" web/src/actions/patients.ts` finds at least 4 matches
    - **M-6 (transactional patient writes):** `grep "getPoolClient" web/src/actions/patients.ts` finds at least 4 matches (one per action)
    - **M-6:** `grep "client\\.query\\('BEGIN'\\)\\|client\\.query\\('COMMIT'\\)\\|client\\.query\\('ROLLBACK'\\)" web/src/actions/patients.ts` finds at least 12 matches (4 actions × 3 keywords each)
    - **M-6:** `grep "auditService\\.logWithClient" web/src/actions/patients.ts` finds at least 4 matches (Rule 9 — one per write action)
    - **M-6:** `grep "client\\.release" web/src/actions/patients.ts` finds at least 4 matches (finally block per action)
    - `grep "AuditAction\\.PATIENT_CREATED\\|AuditAction\\.PATIENT_UPDATED\\|AuditAction\\.PATIENT_ARCHIVED" web/src/actions/patients.ts` finds at least 3 unique values
    - `grep "sanitizeFieldErrors" web/src/actions/patients.ts` finds at least 1 match (Rule 2 — sanitize field errors)
    - `grep -c "throw " web/src/actions/patients.ts` returns 0 (Server Actions never throw for expected errors per Rule 2)
    - `grep "firstName\\|lastName\\|dateOfBirth\\|phone\\|email\\|context" web/src/actions/patients.ts | grep -E "logger\\.error|logger\\.info" | wc -l` returns 0 (PHI never logged)
    - **M-6 (audit-service error logging):** `grep "source: 'audit_service'" web/src/server/services/audit.ts` returns >= 1 match
    - **M-6:** `grep "audit_write_failed" web/src/server/services/audit.ts` returns >= 1 match
    - `grep "'destructive'" web/src/components/ui/Button.tsx` finds at least 1 match (new variant)
    - `grep "bg-fn-error\\|error-dark" web/src/components/ui/Button.tsx` finds at least 2 matches (destructive styling)
    - `grep "role=\"dialog\"\\|aria-modal=\"true\"\\|aria-labelledby" web/src/components/ui/ConfirmDialog.tsx` finds all 3 a11y attributes
    - `grep "Escape\\|focusables\\|tabindex" web/src/components/ui/ConfirmDialog.tsx` finds focus-trap + Escape handling
    - `grep "aria-live" web/src/components/ui/ConfirmDialog.tsx` finds at least 1 match (Rule 13)
    - `grep -c "error:" web/src/components/patients/error-messages.ts || grep -E "unauthenticated|session_expired|validation_error|patient_not_found|archive_failed|context_save_failed|rate_limit_exceeded|internal_error" web/src/components/patients/error-messages.ts | wc -l` confirms all 8 error codes mapped
    - `cd web && pnpm test patients.test Button.test ConfirmDialog.test audit.test` exits 0
    - `cd web && pnpm tsc --noEmit` exits 0
    - Test coverage for web/src/actions/patients.ts >= 95% branches (verify via `pnpm test --coverage` spot check, or ensure test suite covers all early-return branches explicitly)
  </acceptance_criteria>
  <done>
    All 4 patient Server Actions exist with session guards, rate limiting, Zod validation, curated error codes, **transactional DAL+audit via auditService.logWithClient (M-6 — matches Rule 9 pattern used by 04-03 note actions)**, Pino error logging (no PHI). Audit service fire-and-forget path now logs failures at error level with `source: 'audit_service'` (M-6). Button gains destructive variant. ConfirmDialog is fully a11y-compliant. Error-code → curated-string map is in place. Integration test scenarios exercise create + update + archive round-trip with audit rows committed in the same transaction.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Patients pages + patient components + sidebar update + PHI cleanup integration</name>
  <files>
    web/src/app/dashboard/patients/page.tsx,
    web/src/app/dashboard/patients/page.test.tsx,
    web/src/app/dashboard/patients/loading.tsx,
    web/src/app/dashboard/patients/new/page.tsx,
    web/src/app/dashboard/patients/new/page.test.tsx,
    web/src/app/dashboard/patients/[id]/page.tsx,
    web/src/app/dashboard/patients/[id]/page.test.tsx,
    web/src/components/patients/PatientTypeahead.tsx,
    web/src/components/patients/PatientTypeahead.test.tsx,
    web/src/components/patients/PatientInfoCard.tsx,
    web/src/components/patients/PatientInfoCard.test.tsx,
    web/src/components/patients/PatientContextField.tsx,
    web/src/components/patients/PatientContextField.test.tsx,
    web/src/components/patients/PatientNotesTable.tsx,
    web/src/components/patients/PatientNotesTable.test.tsx,
    web/src/components/patients/PatientRow.tsx,
    web/src/components/patients/PatientRow.test.tsx,
    web/src/components/patients/PatientCreateForm.tsx,
    web/src/components/patients/PatientCreateForm.test.tsx,
    web/src/components/patients/ClientPatientDetail.tsx,
    web/src/components/patients/ClientPatientDetail.test.tsx,
    web/src/components/patients/SearchPatients.tsx,
    web/src/components/patients/SearchPatients.test.tsx,
    web/src/components/patients/index.ts,
    web/src/components/Sidebar.tsx,
    web/src/components/Sidebar.test.tsx
  </files>
  <read_first>
    - .planning/phases/04-phi-storage/04-UI-SPEC.md (ENTIRE file — copy applies to every component here: copywriting, spacing tokens, typography sizes, aria-labels, skeleton shapes, empty states, destructive confirm body copy)
    - .planning/phases/04-phi-storage/04-RESEARCH.md §8.2 (Patients pages spec), §8.5 (PatientTypeahead props), §10 (search implementation details including 250ms debounce + AbortController + min 2 chars + max 10 results)
    - web/src/app/dashboard/patients/page.tsx (existing STUB — replace, but mirror layout conventions like `<main id="main-content">` and `p-4 sm:p-6` from existing dashboard pages)
    - web/src/app/dashboard/settings/page.tsx (Server Component pattern: getSession → DAL call → render; `<main id="main-content">` landmark)
    - web/src/app/dashboard/page.tsx (dashboard root — shows existing TopBar integration pattern)
    - web/src/components/DashboardShell.tsx (understand SidebarContext and how Server/Client boundaries interact)
    - web/src/components/Sidebar.tsx (find the `Patients` nav item with `Coming Soon` badge — this task removes it; line near 127 per RESEARCH.md)
    - web/src/components/notes/NoteGenerationForm.tsx (Client Component form pattern using FormData + Server Action — mirror for PatientCreateForm)
    - web/src/components/auth/* (login/signup forms — reference for client-side Zod validation pattern + ActionResult handling)
    - web/src/server/lib/get-session.ts (usage in Server Components — cookies() invocation + React.cache behavior)
    - web/src/server/services/audit.ts + web/src/server/lib/request-context.ts (for PATIENT_VIEWED audit in the detail page)
    - web/src/components/ui/Button.tsx + Card.tsx + Input.tsx + Alert.tsx (primitives — reuse, do not duplicate)
    - web/src/hooks/use-phi-cleanup.ts (created in 04-01 — wired into ClientPatientDetail)
    - web/src/actions/patients.ts (created in Task 1 — consumed by PatientCreateForm + PatientInfoCard + PatientContextField + archive flow)
  </read_first>
  <behavior>
    - `/dashboard/patients` lists patients with debounced search (`?q=...` query param, client-side debounce 250ms, triggers Server Component re-render via router.replace in SearchPatients). Empty state per UI-SPEC. "Add patient" CTA top-right. Paginated (50 per page, URL-param `?page=2`).
    - `/dashboard/patients/new` renders PatientCreateForm (client component). Zod-validates client-side, submits createPatientAction, redirects to `/dashboard/patients/[id]` on success. Curated error via PATIENT_ERROR_MESSAGES.
    - `/dashboard/patients/[id]` Server Component: gets session → findPatientById → 404 if null → auditService.log PATIENT_VIEWED (fire-and-forget, read path — audit-service catch branch now error-logs per M-6) with metadata `{ patientId }` → renders ClientPatientDetail wrapper with patient info card + context field + notes table (empty until 04-03 adds read).
    - ClientPatientDetail uses usePhiCleanup hook to clear PHI state on route-change and logout.
    - PatientTypeahead: WAI-ARIA combobox, 250ms debounce, 2-char min query, 10-item max, AbortController per keystroke, Arrow/Enter/Escape/Home/End keyboard contract, clear button renders when selected, "{N} patients found" aria-live. **M-7:** listbox `<li role="option">`, clear button, and arrow toggle each expose a `min-h-[44px]` (or equivalent padded hit area) per UI-SPEC §Interaction.
    - PatientInfoCard: inline-edit fields (click to edit; save calls updatePatientAction with FormData; revert on cancel).
    - PatientContextField: textarea with explicit Save button that appears only when dirty. Saves via updatePatientContextAction. aria-live announces "Context saved."
    - PatientRow: table row with name, DOB, pronoun, date added, archive icon-button (aria-label="Archive patient {firstName} {lastName}"). Clicking archive opens ConfirmDialog with UI-SPEC copy.
    - PatientNotesTable: placeholder Server Component that renders empty-state copy for Plan 04-02; Plan 04-03 replaces its body with real notes list. Uses `<p>` placeholder so it's not a test burden.
    - SearchPatients: client component with debounced input, syncs `?q=` query param via `router.replace` — no local state for search results (server owns list rendering).
    - Sidebar: remove `Coming Soon` badge markup from the Patients `<NavItem>` (keep structure; just remove badge element and related classes). Add aria-current="page" to active item if not already present.
    - Every page has `<main id="main-content">` (Rule 14), single `<h1>`, sequential heading levels.
    - Every icon-only button has aria-label (Rule 11).
    - aria-live regions unconditionally rendered (Rule 13).
    - No `err.message` displayed to user anywhere (Rule 2).
  </behavior>
  <action>
1. Update `web/src/components/Sidebar.tsx`:
- Find the Patients `<NavItem>` (near line 127 per RESEARCH.md) — remove the `Coming Soon` badge element and any sibling class modifications. Keep the href, icon, label. Add aria-current="page" when pathname matches `/dashboard/patients`.
- Update `Sidebar.test.tsx` to assert Patients nav item renders without "Coming Soon" text AND that it sets aria-current when on patients route.

2. Create `web/src/components/patients/PatientTypeahead.tsx` per 04-UI-SPEC.md §Interaction §Patient typeahead:
```tsx
'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { Patient, QueryScope } from '@/lib/types';

interface PatientTypeaheadProps {
  selectedPatient: Patient | null;
  onSelect: (patient: Patient | null) => void;
  fetchPatients: (query: string, signal: AbortSignal) => Promise<Patient[]>;  // injected — Server Action wrapper
  placeholder?: string;
}

export function PatientTypeahead({ selectedPatient, onSelect, fetchPatients, placeholder = 'Search patients by name' }: PatientTypeaheadProps) {
  // State: query, open, activeIdx, results, loading, error
  // Debounce: 250ms on query change, min 2 chars, AbortController cancels previous
  // Keyboard: ArrowDown, ArrowUp, Enter, Escape, Home, End (WAI-ARIA 1.2 combobox)
  // aria-live: "<N> patients found" after results update, debounced match
  // Selection: displays "{firstName} {lastName}" in input with Clear (X) icon-button aria-label="Clear selected patient"
  // Arrow icon toggle aria-label="Show patient suggestions"
  // M-7: Listbox options (<li role="option">), Clear button, Arrow button ALL render with min-h-[44px] (padded via className) — 3 touch targets minimum.
}
```
Test: keyboard navigation, debounce (use vi.useFakeTimers + advanceTimersByTime(250)), min-query-length gate, AbortController called on rapid-fire typing, selection fires onSelect, Clear button unsets selection, Escape closes listbox retaining input text.

3. Create the remaining patient components (`PatientInfoCard`, `PatientContextField`, `PatientNotesTable`, `PatientRow`, `PatientCreateForm`, `ClientPatientDetail`, `SearchPatients`) per 04-UI-SPEC.md spec details. Highlights:

- `PatientCreateForm.tsx` (client): form with firstName/lastName/DOB/pronoun select (4-item enum)/phone/email/context textarea. Client-side createPatientSchema.safeParse before submission (reveal fieldErrors). On submit dispatches createPatientAction via `startTransition` + `router.push(\`/dashboard/patients/${data.id}\`)` on success. aria-live region for form errors.

- `PatientInfoCard.tsx` (client): displays name/DOB/pronoun/phone/email read-only. Click an "Edit" button flips into inline-edit mode rendering Inputs for each. Save calls updatePatientAction with FormData. Discard reverts. aria-live announces "Saved."

- `PatientContextField.tsx` (client): textarea with 2000-char max. Save button appears only when dirty. Submits via updatePatientContextAction. On success fires aria-live "Context saved." (polite).

- `PatientRow.tsx` (client): displays patient row, archive icon-button opens ConfirmDialog. On confirm dispatches archivePatientAction + router.refresh on success. aria-label per UI-SPEC.

- `PatientNotesTable.tsx` (server): accepts `patient: Patient`, renders empty-state "No notes for this patient yet" per UI-SPEC. Plan 04-03 will replace this with real notes list.

- `ClientPatientDetail.tsx` (client): wraps the detail page's client-side children. Uses `usePhiCleanup` hook with a cleanup ref that clears any local state. Also handles the archive confirm dialog state (open/closed/loading/error).

- `SearchPatients.tsx` (client): debounced input (250ms) that updates `?q=` via `router.replace` — no result-rendering (server does that). aria-label="Search patients by name".

4. Create `web/src/app/dashboard/patients/page.tsx` (replace stub):
```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/server/lib/get-session';
import { findPatientsByScope } from '@/server/dal';
import { SearchPatients } from '@/components/patients/SearchPatients';
import { PatientRow } from '@/components/patients/PatientRow';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface PatientsPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function PatientsPage({ searchParams }: PatientsPageProps) {
  const session = await getSession();
  if (!session) redirect('/login');
  const sp = await searchParams;
  const page = Math.max(parseInt(sp.page ?? '1', 10), 1);
  const limit = 50;
  const offset = (page - 1) * limit;
  const { patients, total } = await findPatientsByScope(
    { type: 'user', userId: session.userId },
    { search: sp.q, limit, offset }
  );
  return (
    <main id="main-content" tabIndex={-1} className="p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-fn-2xl font-semibold tracking-fn-tight">Patients</h1>
        <Link href="/dashboard/patients/new"><Button variant="primary">Add patient</Button></Link>
      </div>
      <SearchPatients initialQuery={sp.q ?? ''} />
      {patients.length === 0 ? (
        <div className="py-16 text-center">
          <h2 className="text-fn-lg font-semibold">{sp.q ? `No patients match "${sp.q}"` : 'No patients yet'}</h2>
          <p className="mt-2 text-fn-base text-fn-text-secondary">
            {sp.q ? 'Try a different name or clear the search.' : 'Create your first patient to start saving notes and building a patient history.'}
          </p>
        </div>
      ) : (
        <table className="w-full">
          {/* Table rendering — name, DOB, pronoun, date added, archive action. Use PatientRow. */}
        </table>
      )}
      {/* Pagination controls — prev/next with URL ?page=N, disabled at boundaries */}
    </main>
  );
}
```

5. Create `web/src/app/dashboard/patients/loading.tsx` — skeleton per UI-SPEC §Loading-state §Patients:
- Header (static) + table with 5 ghost rows, each row has 3-4 grey bars matching column widths
- Use `animate-fn-shimmer` Tailwind class (already defined in preset per UI-SPEC)

6. Create `web/src/app/dashboard/patients/new/page.tsx` as a Server Component that wraps `<PatientCreateForm />` (client). Include `<main id="main-content">`, `<h1>Add patient</h1>`.

7. Create `web/src/app/dashboard/patients/[id]/page.tsx`:
```tsx
import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/server/lib/get-session';
import { findPatientById, findClinicalNotesByScope } from '@/server/dal';
import { auditService } from '@/server/services/audit';
import { AuditAction } from '@/server/types';
import { getRequestContext } from '@/server/lib/request-context';
import { ClientPatientDetail } from '@/components/patients/ClientPatientDetail';
import { PatientInfoCard } from '@/components/patients/PatientInfoCard';
import { PatientContextField } from '@/components/patients/PatientContextField';
import { PatientNotesTable } from '@/components/patients/PatientNotesTable';

interface Props { params: Promise<{ id: string }>; }

export default async function PatientDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { id } = await params;
  const patient = await findPatientById({ type: 'user', userId: session.userId }, id);
  if (!patient) notFound();

  // PHI_VIEWED audit (per D-08) — fire-and-forget, captured after successful load
  // M-6: audit-service catch branch logs at error level if this insert fails
  const ctx = await getRequestContext();
  auditService.log({ userId: session.userId, action: AuditAction.PATIENT_VIEWED, status: 'SUCCESS', metadata: { patientId: patient.id }, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent });

  // Plan 04-03 fills in notes list — 04-02 passes empty array to keep the UI intact.
  // const { notes } = await findClinicalNotesByScope({ type: 'user', userId: session.userId }, { patientId: id });
  const notes: never[] = [];

  return (
    <main id="main-content" tabIndex={-1} className="p-4 sm:p-6">
      <ClientPatientDetail patient={patient}>
        <h1 className="text-fn-2xl font-semibold tracking-fn-tight">{patient.firstName} {patient.lastName}</h1>
        <section aria-labelledby="patient-info-heading" className="mt-6">
          <h2 id="patient-info-heading" className="text-fn-lg font-semibold">Patient info</h2>
          <PatientInfoCard patient={patient} />
        </section>
        <section aria-labelledby="patient-context-heading" className="mt-8">
          <h2 id="patient-context-heading" className="text-fn-lg font-semibold">Patient context</h2>
          <PatientContextField patient={patient} />
        </section>
        <section aria-labelledby="patient-notes-heading" className="mt-8">
          <h2 id="patient-notes-heading" className="text-fn-lg font-semibold">Notes</h2>
          <PatientNotesTable patient={patient} notes={notes} />
        </section>
      </ClientPatientDetail>
    </main>
  );
}
```

8. Write `*.test.tsx` files for every component + page mirroring existing conventions:
- Page tests: unauthenticated → redirect('/login'), findPatientById returns null → notFound(), PATIENT_VIEWED audit fires (mock audit.log + assert called with action=PATIENT_VIEWED + patientId), renders h1 with patient name, render <main id="main-content">.
- PatientCreateForm test: client-side Zod rejects invalid email, Server Action mock called on valid submit, router.push fires on success, curated error displayed on failure.
- PatientTypeahead test: debounce (fake timers), keyboard nav (fireEvent.keyDown), AbortController called, min-query-length gate, "{N} patients found" aria-live text.
- PatientInfoCard test: read-mode → edit-mode toggle, save invokes updatePatientAction, curated error on failure.
- PatientContextField test: Save button appears only when dirty, calls updatePatientContextAction, aria-live "Context saved" announced.
- ClientPatientDetail test: usePhiCleanup is invoked (mock the hook), archive dialog opens on archive click, confirming calls archivePatientAction and navigates.
- Sidebar test: Patients nav has no "Coming Soon" string; aria-current set when on patients route.

9. Run `cd web && pnpm test patients Sidebar ConfirmDialog` and confirm green. Run `pnpm tsc --noEmit` + `pnpm lint`.
  </action>
  <verify>
    <automated>cd web && pnpm test patients Sidebar 2>&1 | tail -50 && pnpm tsc --noEmit 2>&1 | tail -10 && pnpm lint 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - Every new page file contains `<main id="main-content"` (Rule 14): grep `web/src/app/dashboard/patients/page.tsx web/src/app/dashboard/patients/new/page.tsx web/src/app/dashboard/patients/[id]/page.tsx` for `<main id="main-content"` returns 3 matches
    - Every new page file contains exactly one `<h1`: `grep -c "<h1" web/src/app/dashboard/patients/page.tsx` returns 1 (same for new and [id])
    - `grep "getSession()" web/src/app/dashboard/patients/page.tsx web/src/app/dashboard/patients/new/page.tsx web/src/app/dashboard/patients/[id]/page.tsx` returns 3 matches (Rule 8)
    - `grep "redirect('/login')" web/src/app/dashboard/patients/page.tsx web/src/app/dashboard/patients/new/page.tsx web/src/app/dashboard/patients/[id]/page.tsx` returns 3 matches
    - `grep "PATIENT_VIEWED" web/src/app/dashboard/patients/[id]/page.tsx` finds the audit event
    - `grep "findPatientById\\|findPatientsByScope" web/src/app/dashboard/patients/page.tsx web/src/app/dashboard/patients/[id]/page.tsx` finds at least 2 matches (pages go through DAL — Rule 5)
    - `grep -c "db\\.query\\|pool\\.query" web/src/app/dashboard/patients/` returns 0 (no direct DB access from pages)
    - `grep "usePhiCleanup" web/src/components/patients/ClientPatientDetail.tsx` finds the hook integration (Rule 4)
    - `grep "aria-label=" web/src/components/patients/PatientRow.tsx web/src/components/patients/PatientTypeahead.tsx` finds at least 3 matches (Rule 11 — archive, clear, arrow)
    - `grep "aria-live" web/src/components/patients/PatientTypeahead.tsx web/src/components/patients/PatientContextField.tsx web/src/components/patients/PatientCreateForm.tsx` finds at least 3 matches (Rule 13)
    - `grep "role=\"combobox\"\\|role=\"listbox\"\\|aria-expanded\\|aria-activedescendant" web/src/components/patients/PatientTypeahead.tsx` finds all 4 ARIA attributes
    - `grep "Coming Soon" web/src/components/Sidebar.tsx | wc -l` returns at most 1 (only the Templates link keeps the badge — removed from Patients)
    - `grep "PATIENT_ERROR_MESSAGES\\|mapPatientError" web/src/components/patients/PatientCreateForm.tsx web/src/components/patients/PatientInfoCard.tsx web/src/components/patients/PatientContextField.tsx web/src/components/patients/ClientPatientDetail.tsx` finds at least 4 matches (Rule 2 — curated error strings)
    - `grep "err\\.message\\|error\\.message" web/src/components/patients/ web/src/app/dashboard/patients/` (recursive) returns 0 matches (Rule 2)
    - `grep "tracking-fn-tight" web/src/app/dashboard/patients/page.tsx` confirms h1 uses the UI-SPEC letter-spacing token
    - `grep "animate-fn-shimmer" web/src/app/dashboard/patients/loading.tsx` finds at least 1 match
    - **M-7 (PatientTypeahead touch targets):** `grep -c "min-h-\\[44px\\]" web/src/components/patients/PatientTypeahead.tsx` returns >= 3 (listbox row `<li role="option">`, clear button, arrow button — per UI-SPEC §Interaction)
    - `grep "min-h-\\[44px\\]\\|min-w-\\[44px\\]" web/src/components/patients/PatientRow.tsx` finds at least 1 match (Rule 11 — archive icon-button)
    - `cd web && pnpm test patients Sidebar` exits 0
    - `cd web && pnpm tsc --noEmit` exits 0
    - `cd web && pnpm lint` exits 0
    - Test count increases by at least 60
  </acceptance_criteria>
  <done>
    All 3 patients pages ship with session guards, DAL access, PATIENT_VIEWED audit on detail, `<main id="main-content">` landmarks, single h1 per page. PatientTypeahead is a WAI-ARIA 1.2 combobox with debounce + AbortController AND all 3 interactive surfaces (listbox row, clear button, arrow button) expose 44px touch targets per M-7. PatientInfoCard / PatientContextField / PatientCreateForm / PatientRow follow UI-SPEC copy + a11y. ClientPatientDetail wires usePhiCleanup. Sidebar drops the "Coming Soon" badge for Patients. Tests cover keyboard nav, scope enforcement, curated errors, aria-live, Rule 11/13/14 compliance.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: UAT checkpoint — patient UI behavior + a11y walk</name>
  <files>N/A — manual verification, no files modified</files>
  <action>Execute the 17-step UAT walk described in `<how-to-verify>`. Pause execution and wait for human "approved" before proceeding to Plan 04-03.</action>
  <verify>Human tester reports "approved" after completing all 17 steps. If any step fails, executor fixes issues in prior tasks before re-running the checkpoint.</verify>
  <done>Human tester has replied "approved" and no regressions surfaced.</done>
  <what-built>
    Plan 04-02 ships a clinician-facing UI that renders PHI. Before Plan 04-03 begins, a manual UAT must confirm:
    - Create/read/update/archive patient flow works end-to-end in a fresh local environment
    - PatientTypeahead keyboard navigation matches WAI-ARIA 1.2 spec (Arrow/Enter/Escape/Home/End)
    - Archive ConfirmDialog focus-traps (Tab cycles), initial focus is on Cancel, Escape closes
    - Route-change PHI cleanup runs (navigate away from /dashboard/patients/[id] → inputs clear)
    - Screen reader (VoiceOver on macOS — user's platform) announces aria-live regions on context save
    - Color contrast passes WCAG AA at 4.5:1 (UI-SPEC already verified — but check gradient text regression did not sneak in)
    - Responsive at 375px width (iPhone SE) with no horizontal scroll
    - /baa placeholder, landing page teal palette, existing sidebar navigation all still function (no regressions from Sidebar edit)
  </what-built>
  <how-to-verify>
1. In `web/`, run `pnpm db:migrate` against local DB (ensure migration 002 applied).
2. Run `pnpm dev`. Open `http://localhost:3000`.
3. Log in as `test2@example.com` / `Test1234!`.
4. Navigate to `/dashboard/patients`. Confirm empty state ("No patients yet. Create your first patient...") with "Add patient" CTA.
5. Click "Add patient". Fill out form: first name `Test`, last name `Patient`, DOB `1980-01-15`, pronoun `they/them`, phone `555-0100`, email `test@example.com`, context `Chronic L knee pain. Hx TKA 2024.`. Submit.
6. Confirm redirect to `/dashboard/patients/[id]` with the patient's info rendered.
7. Confirm `<h1>Test Patient</h1>`, Patient info card, Patient context card (shows the context), Notes section (empty state).
8. Click "Edit" on Patient info. Change phone to `555-0199`. Save. Confirm aria-live announces "Saved." (use VoiceOver if available).
9. Modify patient context to `Updated context`. Click Save context. Confirm aria-live announces "Context saved."
10. Navigate back to `/dashboard/patients`. Confirm the patient row appears. Search for "test" — confirm match appears (debounce ~250ms).
11. Keyboard test on PatientTypeahead (if exposed on this page; else test via Notes generator in 04-03). Ignore if not yet exposed.
12. On patient detail, click the archive icon-button. ConfirmDialog opens. Confirm:
    - Focus lands on "Keep patient" button (not "Archive patient").
    - Tab cycles within dialog.
    - Escape closes dialog.
    - Clicking "Archive patient" archives and redirects to `/dashboard/patients`. Patient no longer appears in list.
13. Log out. Confirm cleanup fired (`flashnote:logout` event dispatched).
14. Resize window to 375px (DevTools). Walk the 3 patient pages — confirm no horizontal scroll, tables collapse or scroll-x as spec'd.
15. Run axe-core in DevTools on each of the 3 pages — confirm 0 violations (or document any pre-existing violations that are out of scope).
16. Smoke: Inspect Network tab on /dashboard/patients/[id] load. Verify Pino log "PATIENT_VIEWED" appears in server console (check `pnpm dev` stdout) with metadata.patientId but no PHI (no firstName/lastName/context value).
17. Run `cd web && pnpm test` — full suite green (>1570 tests passing, coverage ≥ 97.79% / ≥ 95.46%).
  </how-to-verify>
  <resume-signal>Type "approved" if all 17 steps pass. If any step fails, describe which and the executor will fix before continuing to Plan 04-03.</resume-signal>
</task>

</tasks>

<verification>
After all tasks complete:
1. `cd web && pnpm test --coverage` passes with statements >= 97.79% and branches >= 95.46%
2. `cd web && pnpm tsc --noEmit` exits 0
3. `cd web && pnpm lint` exits 0
4. `grep -r "'use server'" web/src/actions/patients.ts` finds the directive (line 1)
5. `grep -rE "err\\.message|error\\.message" web/src/components/patients/ web/src/app/dashboard/patients/` returns 0 matches (Rule 2)
6. `grep -r "import.*from '@/server/db'" web/src/components/ web/src/app/dashboard/` returns 0 matches (Rule 5 — no direct DB from pages/components)
7. Full suite sampling continuity: every task commit was followed by `pnpm test <affected pattern>` succeeding per VALIDATION.md policy
8. UAT checkpoint approved
</verification>

<success_criteria>
- 4 patient Server Actions ship with session + rate limit + validation + **transactional DAL+audit via logWithClient (M-6 — Rule 9)** + curated error codes (never displays err.message, Rule 2)
- 3 patients pages exist and enforce Rule 5/Rule 8 (all DB via DAL, all protected pages use getSession + redirect)
- PATIENT_VIEWED audit fires on detail load (fire-and-forget, read path — audit-service catch branch error-logs on failure per M-6)
- PatientTypeahead WAI-ARIA 1.2 combobox with 250ms debounce + AbortController AND 3+ distinct 44px touch targets (M-7)
- ConfirmDialog focus-traps with Cancel-first initial focus + Escape/backdrop close
- Button gains destructive variant
- PHI cleanup wired on patient detail via usePhiCleanup (Rule 4)
- Sidebar "Coming Soon" removed from Patients nav
- phi-lifecycle integration test has 2 filled scenarios (create + update context + archive) verifying audit writes share the transaction with the mutation
- Test count increases ~80; coverage gate preserved
- UAT checkpoint signed off
</success_criteria>

<output>
After completion, create `.planning/phases/04-phi-storage/04-02-SUMMARY.md` summarizing:
- Routes added (/dashboard/patients, /new, /[id])
- New components (PatientTypeahead, PatientInfoCard, PatientContextField, PatientNotesTable, PatientRow, PatientCreateForm, ClientPatientDetail, SearchPatients, ConfirmDialog)
- Server Action signatures + error codes returned (confirm M-6 transactional shape)
- Audit events emitted (in-transaction writes vs fire-and-forget reads)
- audit-service fire-and-forget catch branch update (M-6)
- Sidebar diff (removed Coming Soon from Patients)
- Files Plan 04-03 will consume (PatientTypeahead, ConfirmDialog, Button.destructive, PATIENT_ERROR_MESSAGES)
- Test count delta and coverage after
- UAT findings and any deviations from UI-SPEC
</output>
</content>
</invoke>