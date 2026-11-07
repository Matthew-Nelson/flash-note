# HIPAA Audit Logging Requirements

**Created:** January 2026
**Last Updated:** 2026-11-07
**Deployment status:** Not deployed; no real PHI (see the "Not for clinical use" notice in `README.md`).
**Purpose:** Document HIPAA audit logging requirements and FlashNote's compliance status
**Regulatory Reference:** 45 CFR § 164.312 (Technical Safeguards), 45 CFR § 164.308 (Administrative Safeguards)

---

## Overview

HIPAA's Security Rule mandates audit controls as part of the Technical Safeguards. This document outlines the specific requirements and FlashNote's current compliance status.

---

## Retention Requirements

### Requirement: 6-Year Minimum Retention

**Regulatory Basis:** 45 CFR § 164.530(j) requires all documentation related to security policies, including audit logs, to be retained for **6 years from the date of creation or the date when it was last in effect**.

**Current Status:** Not Enforced

**Cloud Logging sink:** The 6-year Cloud Logging log sink / locked-retention bucket is not configured. `infra/*.tf` contains no log sink or log bucket resource (`grep -rniE "sink" infra/*.tf` returns nothing), and the only retention settings in `infra/database.tf` are Cloud SQL transaction-log and backup retention. Retention of the `audit_logs` table itself is not enforced by any job or policy.

**Gap:** No retention enforcement mechanism exists. We need:
- Documented retention policy
- Automated archival process (optional but recommended)
- Backup strategy for audit logs
- Optional cleanup job for logs exceeding retention period

---

## Required Events to Log

| Event Type | HIPAA Basis | FlashNote Status | Implementation |
|------------|-------------|------------------|----------------|
| Login/logout | § 164.312(b) | Implemented | `LOGIN`, `LOGOUT` |
| Failed authentication | § 164.312(b) | Implemented | `LOGIN_FAILED` (`AUTH_FAILED` is defined but not emitted) |
| Access to PHI | § 164.312(b) | Implemented | `NOTE_GENERATED`, `PATIENT_*`, `NOTE_*` (see PHI audit pattern below) |
| Authorization failures | § 164.312(b) | Implemented | `ACCESS_DENIED` |
| User/account changes | § 164.308(a)(4) | Implemented | `REGISTER`, `SUBSCRIPTION_*`, `LEGAL_CONSENT_ACCEPTED`, `USER_PREFERENCES_UPDATED` |
| Security incidents | § 164.308(a)(6) | Partial | `CSRF_FAILED` is defined but never emitted (see "Defined but not emitted") |
| Account lockout | § 164.312(b) | Partial | `ACCOUNT_LOCKED`, `ACCOUNT_UNLOCKED` emitted; `LOGIN_BLOCKED_LOCKED` defined but not emitted |
| Email verification | § 164.308(a)(4) | Partial | `EMAIL_VERIFICATION_SUCCESS/FAILED/RESENT` emitted; `EMAIL_VERIFICATION_SENT` not emitted |
| Password reset | § 164.308(a)(4) | Implemented | `PASSWORD_RESET_*` |
| Session management | § 164.312(d) | Implemented | `SESSION_DEVICE_CHANGE`, `SESSION_LIMIT_EXCEEDED` |
| Webhook failures | § 164.308(a)(6) | Implemented | `WEBHOOK_PROCESSING_FAILED` |

### Full AuditAction Enum Reference

All audit actions are defined in the `AuditAction` enum in `web/src/server/types.ts:48` (49 values, counted from the enum body). The string values must not be changed or removed; a comment in the enum notes external audit log queries depend on them.

| Group | Actions |
|-------|---------|
| Authentication | `LOGIN`, `LOGIN_FAILED`, `LOGOUT`, `AUTH_FAILED` |
| Account / access | `REGISTER`, `ACCESS_DENIED`, `LEGAL_CONSENT_ACCEPTED`, `USER_PREFERENCES_UPDATED` |
| Account lockout | `ACCOUNT_LOCKED`, `ACCOUNT_UNLOCKED`, `LOGIN_BLOCKED_LOCKED` |
| Email verification | `EMAIL_VERIFICATION_SENT`, `EMAIL_VERIFICATION_SUCCESS`, `EMAIL_VERIFICATION_FAILED`, `EMAIL_VERIFICATION_RESENT` |
| Password reset | `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_SUCCESS`, `PASSWORD_RESET_FAILED`, `PASSWORD_RESET_TOKEN_INVALID` |
| Session management | `SESSION_DEVICE_CHANGE`, `SESSION_LIMIT_EXCEEDED` |
| Note generation | `NOTE_GENERATED` |
| Patients (PHI) | `PATIENT_CREATED`, `PATIENT_UPDATED`, `PATIENT_ARCHIVED`, `PATIENT_VIEWED` |
| Clinical notes (PHI) | `NOTE_SAVED`, `NOTE_UPDATED`, `NOTE_ARCHIVED`, `NOTE_VIEWED`, `NOTE_HISTORY_VIEWED` |
| Subscription / billing | `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_CANCELLED`, `SUBSCRIPTION_RENEWED`, `PAYMENT_FAILED` |
| Organizations | `ORG_CREATED`, `ORG_SUBSCRIPTION_CHANGED`, `ORG_MEMBER_JOINED`, `ORG_MEMBER_REMOVED`, `ORG_MEMBER_LEFT`, `ORG_MEMBER_ROLE_CHANGED`, `ORG_OWNERSHIP_TRANSFERRED` |
| Invite codes | `INVITE_CODE_REDEEMED`, `INVITE_CODE_VALIDATED`, `INVITE_CODE_VALIDATION_FAILED`, `INVITE_CODE_GENERATED`, `INVITE_CODE_REVOKED` |
| Security events | `CSRF_FAILED`, `WEBHOOK_PROCESSING_FAILED` |

### Defined but not emitted

These enum values have no reference of the form `AuditAction.<NAME>` in non-test code under `web/src` (checked with grep, excluding `*.test.*` and `web/src/test/`). Any claim above that depends on them is a gap, not an implemented control.

- `AUTH_FAILED`, `CSRF_FAILED`, `LOGIN_BLOCKED_LOCKED`, `EMAIL_VERIFICATION_SENT`
- `ORG_CREATED`, `ORG_SUBSCRIPTION_CHANGED`, `ORG_MEMBER_REMOVED`, `ORG_MEMBER_LEFT`, `ORG_MEMBER_ROLE_CHANGED`, `ORG_OWNERSHIP_TRANSFERRED`
- `INVITE_CODE_GENERATED`, `INVITE_CODE_REVOKED`

Of the `ORG_*` actions only `ORG_MEMBER_JOINED` is emitted (`web/src/server/services/auth.ts:258`).

### Audit write paths

`auditService` (`web/src/server/services/audit.ts`) exposes two methods:

- `log(entry)`: fire-and-forget. A failed insert is caught and logged at `error` level (`errorType: 'audit_write_failed'`) and does not fail the caller.
- `logWithClient(client, entry)`: writes through a caller-supplied `PoolClient` and lets errors propagate, so the audit row commits or rolls back with the action it documents (Rule 9).

**PHI write pattern.** The PHI-writing Server Actions call `auditService.logWithClient` inside the same transaction as the write:

- `web/src/actions/patients.ts`: `PATIENT_CREATED` (line 118), `PATIENT_UPDATED` (lines 196 and 354), `PATIENT_ARCHIVED` (line 269)
- `web/src/actions/notes.ts`: `NOTE_SAVED` (line 421), `NOTE_UPDATED` (line 552)

Not transactional (fire-and-forget `auditService.log`):

- `NOTE_GENERATED` success and failure (`web/src/actions/notes.ts:198`, `:249`)
- `NOTE_ARCHIVED` (`web/src/actions/notes.ts:624`, a single UPDATE)
- Read events: `PATIENT_VIEWED` (`web/src/app/dashboard/patients/[id]/page.tsx:40`), `NOTE_VIEWED` and `NOTE_HISTORY_VIEWED` (`web/src/app/dashboard/notes/[id]/page.tsx`)

---

## Required Data Elements Per Event

| Data Element | HIPAA Guidance | FlashNote Status | Column |
|--------------|----------------|------------------|--------|
| User ID | Required | Implemented | `user_id` |
| Timestamp | Required | Implemented | `created_at` |
| Action performed | Required | Implemented | `action` |
| Success/failure | Required | Implemented | `status` |
| Source (IP/location) | Recommended | Implemented | `ip_address` |
| Additional context | Recommended | Implemented | `metadata` (JSONB) |

---

## Audit Log Review Capability

### Requirement: Ability to Review Audit Logs

**Regulatory Basis:** § 164.308(a)(1)(ii)(D) requires "procedures to regularly review records of information system activity, such as audit logs, access reports, and security incident tracking reports."

**Current Status:** Not Implemented

**Gap:** No audit-log viewing or export capability exists in the application. The only code touching `audit_logs` is the insert-only DAL (`web/src/server/dal/audit-logs.ts`), and there is no admin route or page. The only way to view logs is direct database access.

**Required Implementation:**
- A paginated, filterable (date range, user, action, status) audit-log view restricted to authorized administrators
- Alerting for suspicious patterns (optional)

---

## Audit Log Export Capability

### Requirement: Ability to Export Logs

**Regulatory Basis:** While not explicitly mandated, export capability is necessary to:
- Provide logs to auditors during compliance reviews
- Respond to breach investigations (internal or HHS OCR)
- Fulfill legal discovery requests
- Support incident response procedures

**Current Status:** Not Implemented

**Gap:** No export functionality exists.

**Required Implementation:**
- Export to CSV/JSON format, restricted to authorized administrators
- Support for date range filtering
- Support for filtering by user, action, status

---

## Log Integrity and Immutability

### Requirement: Protection from Unauthorized Modification

**Regulatory Basis:** § 164.312(c)(1) requires mechanisms to protect electronic PHI from improper alteration or destruction. While audit logs don't contain PHI, their integrity is essential for compliance evidence.

**Current Status:** Complete

**What's Implemented:**
- Application code only writes (never updates/deletes)
- Separate `audit_logs` table with no application-level modification
- Database triggers prevent UPDATE, DELETE, and TRUNCATE (defined in `web/src/server/db/migrations/001_initial_schema.sql`; the migration directory currently holds 001 to 003 only)
  - `audit_logs_no_update` — raises exception on UPDATE
  - `audit_logs_no_delete` — raises exception on DELETE
  - `audit_logs_no_truncate` — raises exception on TRUNCATE (statement-level trigger)
- No test was found that exercises the `audit_logs` triggers (`web/src/test/integration/phi-migration.test.ts` tests the `note_versions` triggers only). The previously documented `pnpm db:verify:audit` script does not exist (no matching script in `web/package.json`)

**Remaining considerations:**
- No checksums or tamper-detection mechanisms (superusers can disable triggers — acceptable risk for current scale)
- Future: consider Cloud SQL audit logging for additional tamper evidence

---

## Regular Review Process

### Requirement: Periodic Audit Log Review

**Regulatory Basis:** § 164.308(a)(1)(ii)(D) requires "regular review" of audit logs. HHS does not define specific frequency, but industry standard is weekly to monthly.

**Current Status:** Partial

**What's Documented:**
- Nothing. No review procedure is documented in the repository.

**Gap:**
- Without viewing tools, regular review is impractical
- No alerting for anomalies
- No documented review procedure

---

## Compliance Gap Summary

### Implemented

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **Event logging** | Partial | 49 audit action types defined; 12 are never emitted (see "Defined but not emitted") |
| **Data elements** | ✅ Complete | user_id, action, status, ip_address, user_agent, metadata, created_at |
| **Audit service tests** | ✅ Complete | `web/src/server/services/audit.test.ts` |
| **Application-level immutability** | ✅ Complete | Code only performs INSERT operations |

### Not Implemented (Critical)

| Requirement | Priority | What's Needed |
|-------------|----------|---------------|
| **Log viewing capability** | Critical | Does not exist; needs an admin-restricted view with pagination and filters |
| **Log export capability** | Critical | Does not exist; needs an admin-restricted CSV/JSON export |

### Partial / Needs Enhancement (High Priority)

| Requirement | Priority | Current State | What's Needed |
|-------------|----------|---------------|---------------|
| **Retention enforcement** | High | No policy enforced; no Cloud Logging sink configured in `infra/` | Documented 6-year policy + sink/archival job |
| **Log integrity protection** | ✅ Complete | Database triggers in `001_initial_schema.sql` prevent UPDATE/DELETE/TRUNCATE | — |
| **Regular review process** | High | Not documented | Review procedure + tooling to make reviews practical |

---

## Implementation Status

Core audit logging is implemented (`web/src/server/services/audit.ts`, tests in `web/src/server/services/audit.test.ts`). Immutability protections are in place (database triggers in `001_initial_schema.sql`). Remaining work (retention, log viewing and export) is not implemented; see [ROADMAP.md](../ROADMAP.md) for tracking.

---

## Regulatory References

- **45 CFR § 164.312(b)** - Audit Controls: "Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use electronic protected health information."

- **45 CFR § 164.308(a)(1)(ii)(D)** - Information System Activity Review: "Implement procedures to regularly review records of information system activity, such as audit logs, access reports, and security incident tracking reports."

- **45 CFR § 164.530(j)** - Retention Period: "A covered entity must retain the documentation required by paragraph (j)(1) of this section for 6 years from the date of its creation or the date when it last was in effect, whichever is later."

- **45 CFR § 164.312(c)(1)** - Integrity Controls: "Implement policies and procedures to protect electronic protected health information from improper alteration or destruction."

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-28 | Initial document |
| 1.1 | 2026-02-01 | Audit update: Added full AuditAction enum (29 types), reorganized gap summary, corrected test coverage status |
| 1.2 | 2026-02-01 | Updated OPERATIONS.md references to MONITORING_SETUP.md (moved to planning folder) |
| 1.3 | 2026-02-22 | Log integrity protection complete — database triggers implemented via migration 012 |
| 1.4 | 2026-11-07 | Updated to current code: enum catalog now matches `AuditAction` (49 values) with a defined-but-not-emitted list; PHI audit write pattern (Rule 9); Cloud Logging sink noted as not configured; removed Express endpoint wording, deleted-doc references, test counts and the nonexistent `db:verify:audit` script; triggers now live in `001_initial_schema.sql` |

---

**End of Document**
