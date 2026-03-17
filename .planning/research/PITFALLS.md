# Domain Pitfalls

**Domain:** HIPAA-regulated healthcare SaaS (AI-powered PT clinical documentation)
**Scope:** Production deployment with PHI storage on GCP (Cloud Run + Cloud SQL), Stripe live mode, clinic features
**Researched:** 2026-03-16

---

## Critical Pitfalls

Mistakes that cause regulatory liability, data breaches, or require fundamental rework.

### Pitfall 1: Incident Response Plan Not Updated Before PHI Storage

**What goes wrong:** The existing incident response plan (`docs/compliance/INCIDENT_RESPONSE_PLAN.md`) explicitly documents a "pass-through processing only" PHI posture. Section 3 states: "No PHI is persisted in FlashNote's database, file systems, or logs." Once PHI Storage ships, this is false. If a breach occurs before the plan is updated, FlashNote's notification to covered entities will reference an outdated posture, and OCR investigators will see a gap between actual data handling and documented procedures. Under HIPAA, failure to maintain accurate documentation is itself a violation (45 CFR 164.530(j)).

**Why it happens:** PHI storage is treated as a feature (schema + DAL + UI) and the compliance documentation update is forgotten or deferred as a "cleanup" task. The plan's own text warns "This section must be updated when PHI Storage (Phase 2) is implemented" but there is no roadmap item tracking this.

**Consequences:** Regulatory exposure during any breach investigation. OCR penalizes organizations that cannot produce accurate, current security documentation. The 72-hour breach notification clock still starts at discovery, and scrambling to reconcile actual vs. documented PHI handling wastes critical investigation time.

**Prevention:**
- Add incident response plan update as a gating item in PHI-1 (before the migration that adds patients/notes tables goes live)
- Update Section 3 to enumerate exactly what PHI is stored: patient names, DOB, clinical note content, quick notes, patient context
- Update the breach risk assessment template to include persistent PHI factors (number of records, data types)
- Update notification templates to reference persistent storage

**Detection:** Review `INCIDENT_RESPONSE_PLAN.md` Section 3 before any PHI-touching migration is deployed. If it still says "pass-through," it has not been updated.

**Phase:** PHI Storage (PHI-1, pre-deployment gate)

---

### Pitfall 2: Audit Logging Gaps for PHI Read Access

**What goes wrong:** The current audit system logs `NOTE_GENERATED` for generation events (metadata only). When PHI is persisted, HIPAA 164.312(b) requires auditing all access to systems containing ePHI -- including read access. The PHI Storage plan adds patient lists, note history, and version timelines, all of which display PHI. If the DAL serves patient/note data without audit entries, there is no trail of who viewed what PHI and when. This is the single most common HIPAA audit failure: organizations cannot prove what happened with PHI access.

**Why it happens:** Developers model audit logging around mutations (create, update, delete) because that matches application state changes. Read access seems "harmless" and gets skipped for performance reasons. But HIPAA auditing is about access to ePHI, not state changes.

**Consequences:** Failed HIPAA audit. If a breach occurs, inability to determine which patients' PHI was accessed. OCR specifically investigates audit trail completeness. The `AUDIT_LOGGING_REQUIREMENTS.md` already flags "Log viewing capability" as Critical/Not Implemented -- once PHI is stored, this gap becomes a regulatory risk, not just a missing feature.

**Prevention:**
- Add new `AuditAction` types: `PATIENT_VIEWED`, `NOTE_VIEWED`, `NOTE_HISTORY_VIEWED`, `PATIENT_LIST_VIEWED`
- Every DAL function that returns PHI must write an audit entry (can be fire-and-forget for reads to avoid latency, but log at error level if it fails per Rule 9)
- Audit entries for reads should include `userId`, `patientId` or `noteId`, timestamp -- never the PHI content itself
- Consider batching audit writes for list views (one entry for "viewed patient list, N results" rather than N individual entries)

**Detection:** Code review gate: every DAL function in `server/dal/patients.ts` and `server/dal/clinical-notes.ts` that returns data must have a corresponding audit call. No exceptions.

**Phase:** PHI Storage (PHI-1, design constraint)

---

### Pitfall 3: Account Deletion Conflicts With PHI Retention

**What goes wrong:** `CONCERNS.md` flags account deletion as manual/email-gated and notes it "will become critical once patient data is retained." Once PHI Storage ships, FlashNote stores patient names, DOB, clinical notes -- all PHI tied to a user. A deletion request triggers conflicting legal obligations:
- HIPAA requires retaining clinical documentation for 6 years minimum (varies by state -- some require 7-10 years)
- CCPA grants California residents the right to delete personal information
- Washington's My Health My Data Act grants deletion rights for health data from non-HIPAA-covered contexts
- ON DELETE RESTRICT on `patients` and `clinical_notes` FKs means a user cannot be hard-deleted if they have PHI records

Without a clear retention policy encoded in the deletion flow, support requests become legal minefields.

**Why it happens:** Account deletion is deferred until "Phase 2 PHI storage lands" per CONCERNS.md. But the deletion logic requires legal analysis of retention obligations, not just a DAL function. Teams build the deletion code without consulting counsel on what can/cannot be deleted and when.

**Consequences:** A single CCPA deletion request from a California user with stored notes requires understanding whether FlashNote is a "business" or "service provider" under CCPA, whether the HIPAA exemption applies, and whether clinical notes qualify for the "legal compliance" exception. Getting this wrong exposes FlashNote to either HIPAA violations (premature deletion) or privacy law violations (refusal to delete).

**Prevention:**
- Before implementing account deletion, document a PHI retention policy (with legal counsel input)
- Implement soft-delete that: (1) anonymizes the user record, (2) cancels Stripe subscription, (3) terminates all sessions, (4) retains clinical notes in a de-identified state for the required retention period, (5) logs the deletion request as an audit event
- The deletion Server Action should return clear messaging about what is deleted vs. retained and why
- Store the deletion request itself as an audit entry (HIPAA requires documenting the request even if deletion is deferred)

**Detection:** If `deleteAccountAction` exists but has no retention-period check or de-identification step, it is incomplete.

**Phase:** PHI Storage (PHI-2 or PHI-3, requires legal input before implementation)

---

### Pitfall 4: HIPAA Proposed Rule Makes MFA Mandatory

**What goes wrong:** The HIPAA Security Rule NPRM (published January 6, 2025, Federal Register) proposes eliminating the "addressable" vs. "required" distinction and making all safeguards mandatory. This includes multi-factor authentication for all access to systems containing ePHI. FlashNote currently uses email/password authentication only (OAuth/social login explicitly out of scope per PROJECT.md). If the final rule passes (expected late 2025 or 2026), FlashNote must implement MFA or be non-compliant.

**Why it happens:** The proposed rule is in comment period, not yet final. Teams defer MFA because "it's not required yet." But the final rule will likely have a compliance deadline of 180 days for small entities and 365 days for larger ones. Implementing MFA after the deadline under time pressure leads to insecure shortcuts.

**Consequences:** Non-compliance with mandatory HIPAA security controls. Civil penalties under HITECH can reach $2.1M per violation category per year.

**Prevention:**
- Track the HIPAA NPRM progress (HHS.gov/hipaa). The final rule is expected late 2025 or 2026.
- Design the auth system to be MFA-extensible: add a `mfa_method` column to `users`, add a `user_mfa_secrets` table, add MFA challenge step to the login flow
- TOTP (Google Authenticator, Authy) is the lowest-friction option for clinical staff who carry phones. Email-based OTP is a fallback.
- Do not wait for the final rule. If PHI Storage ships before MFA, there is a window of regulatory risk.

**Detection:** If the `users` table has no MFA-related columns and the login flow has no MFA challenge step, this is unaddressed.

**Phase:** Deployment Readiness or PHI Storage (design the schema extension in PHI-1, implement before or alongside PHI storage going live). The proposed rule also mandates biannual vulnerability scanning and annual penetration testing.

**Confidence:** MEDIUM -- the NPRM is published but the final rule is not yet issued. Requirements may change.

---

### Pitfall 5: Cloud SQL Backup Restoration Never Tested

**What goes wrong:** Cloud SQL automated daily backups are configured at provisioning (Deployment Readiness Step 3). The team never tests restoring from a backup. Then a data issue occurs -- accidental deletion, corruption, or failed migration -- and the team discovers that backup restoration: (a) takes longer than expected (hours for large databases), (b) restores to a new instance (not in-place), (c) requires reconfiguring connection strings, (d) may lose data since the last backup point. In a healthcare context, loss of clinical notes or audit logs is a HIPAA violation.

**Why it happens:** Backup restoration is an operational task that falls between development and ops. It is not tested because it requires a real Cloud SQL instance, real data, and time. The PRE_LAUNCH_CHECKLIST includes "Test backup restoration" but it is unchecked with no procedure documented.

**Consequences:** During an incident, restoration delay extends the outage. If audit logs are lost, the 6-year HIPAA retention requirement is violated. If clinical notes are lost, patient care continuity is broken.

**Prevention:**
- Test backup restoration during Deployment Readiness Step 4 (staging deploy). Restore to a separate instance, verify data integrity, measure duration.
- Document the restoration procedure: which gcloud commands, how to point Cloud Run at the restored instance, how to verify data completeness.
- Enable point-in-time recovery (PITR) on Cloud SQL -- this enables recovery to a specific timestamp rather than just the last daily backup. Cloud SQL supports PITR for PostgreSQL.
- Include quarterly backup restoration tests in the maintenance schedule (already documented in MONITORING_SETUP.md but not actionable without a procedure).

**Detection:** Ask "Can you restore the database to 3 hours ago and route the app to it?" If the answer is "I think so" rather than "Yes, here is the runbook," this is unaddressed.

**Phase:** Deployment Readiness (Step 3/4)

---

## Moderate Pitfalls

### Pitfall 6: Stripe Test-to-Live Webhook Secret Mismatch

**What goes wrong:** Stripe uses different webhook signing secrets for test mode and live mode. The signing secret is stored in Secret Manager. During the test-to-live transition (Deployment Readiness Step 6), the team creates a production webhook endpoint in the Stripe Dashboard and gets a new signing secret (`whsec_live_...`). If they forget to update the `STRIPE_WEBHOOK_SECRET` in Secret Manager, or if the environment variable still references the test mode secret, every live webhook fails signature verification. The app silently drops all payment events -- subscriptions never activate, cancellations never process, failed payment handling never fires.

**Why it happens:** The transition from test to live mode requires updating secrets in multiple places: Stripe Dashboard, Secret Manager, and possibly the Cloud Run service (if the secret is mounted as an env var resolved at startup). The webhook endpoint URL is the same (`flashnote.co/api/webhooks/stripe`), which masks the fact that the signing secret changed.

**Consequences:** Customers complete checkout but their subscription status never updates. They see trial-expired errors despite paying. Revenue is lost. Support tickets pile up. The billing service logs `WEBHOOK_PROCESSING_FAILED` audit entries (if the Pino logger is active), but without alerting configured, these go unnoticed.

**Prevention:**
- Create the live webhook endpoint and update the signing secret in Secret Manager before switching Stripe API keys to live mode
- Immediately verify by making a real $1 charge (as documented in PRE_LAUNCH_CHECKLIST) and confirming the webhook processes successfully in Cloud Logging
- Set up a Cloud Monitoring alert for `jsonPayload.source="billing_webhook" severity=ERROR` (documented in MONITORING_SETUP.md but not yet implemented)
- Consider adding a startup health check in the billing service that validates the Stripe API key mode matches the webhook secret mode (both test or both live)

**Detection:** After switching to live mode, check Cloud Logging for webhook signature verification failures within the first hour.

**Phase:** Deployment Readiness (Step 6)

---

### Pitfall 7: Cloud Run Connection Pool Exhaustion on Scale-Up

**What goes wrong:** FlashNote uses `pg.Pool` as a singleton with a default `max` of 10 connections. Cloud Run autoscales by adding container instances. Each new instance creates its own pool with up to 10 connections. At 5 instances, that is 50 database connections. Cloud SQL's default `max_connections` varies by instance size (e.g., ~25 for `db-f1-micro`, ~100 for `db-custom-1-3840`). If Cloud Run scales aggressively during a traffic spike (e.g., clinic onboards 20 PTs at once), connection exhaustion crashes all database queries across all instances simultaneously.

**Why it happens:** The pool is configured for single-instance development. Cloud Run autoscaling is invisible -- it happens without code changes. The developer tests with 1 instance locally and never sees the multiplication effect.

**Consequences:** All requests fail with "too many connections" errors. The app appears completely down. Because every instance is competing for connections, even the health check fails, which triggers Cloud Run to spin up more instances (making the problem worse).

**Prevention:**
- Set `pg.Pool` max to 5 (not 10) in production to leave headroom for multiple instances
- Set Cloud Run `--max-instances` to a reasonable ceiling (e.g., 10 for beta, 20 for production)
- Size the Cloud SQL instance to support `max_instances * pool_max + overhead` connections
- Consider enabling Cloud SQL's Managed Connection Pooling (PgBouncer-based, released 2025) as a layer between Cloud Run and PostgreSQL
- Add connection pool metrics to health check endpoint (current health check is shallow)
- Monitor Cloud SQL connection count in Cloud Monitoring

**Detection:** Check Cloud SQL metrics for `num_connections` approaching `max_connections`. If it exceeds 80% during normal traffic, the pool sizing is wrong.

**Phase:** Deployment Readiness (Step 3, infrastructure sizing) and Pipeline Hardening (Step 2, deep health check)

---

### Pitfall 8: Secret Manager Environment Variables Resolved at Startup

**What goes wrong:** Cloud Run resolves Secret Manager references at instance startup time. If a secret is rotated (e.g., database password, Stripe webhook secret), existing container instances keep using the old value until they are replaced. With `min-instances=1`, the warm instance never sees the rotation. The team rotates a compromised credential in Secret Manager and assumes the app is using the new value, but it is still running with the old one.

**Why it happens:** Secret Manager integration with Cloud Run uses environment variable injection at startup, not runtime fetching. This is not obvious from the Cloud Run configuration UI. Google's documentation recommends pinning to a specific secret version rather than using `latest`, but most teams use `latest` for convenience.

**Consequences:** During an incident response (credential rotation), the team believes the compromised credential has been revoked but the running app still uses it. For HIPAA incident response, this extends the exposure window.

**Prevention:**
- After rotating a secret, force a new Cloud Run revision deployment (`gcloud run services update --no-traffic` then traffic migration) to pick up the new value
- Document this in the incident response runbook: "Rotating secrets requires deploying a new Cloud Run revision"
- For the most critical secrets (DB password), pin to a specific version and deploy when rotating rather than relying on `latest`
- Alternatively, use file-based secret mounting instead of environment variables -- Cloud Run can mount secrets as files, and some configurations support live reloading

**Detection:** After any secret rotation, verify the running revision's creation timestamp is after the rotation. If not, the old secret is still in use.

**Phase:** Deployment Readiness (Step 3, infrastructure configuration) and ongoing operations

---

### Pitfall 9: Audit Log Retention Sink Not Configured Before PHI Storage

**What goes wrong:** HIPAA requires 6-year retention of audit logs. The roadmap tracks "Cloud Logging log sink for HIPAA audit retention (6 years)" as a post-launch monitoring ops item. If PHI Storage ships before this sink is configured, audit entries for PHI access flow into Cloud Logging's `_Default` bucket with its default 30-day retention. After 30 days, those entries are permanently deleted. The PostgreSQL `audit_logs` table provides the primary audit trail, but if the database is compromised or corrupted, the Cloud Logging backup is the defense-in-depth layer -- and it is gone.

**Why it happens:** The log sink is categorized as "post-launch monitoring ops" in the roadmap, while PHI Storage is a separate track. The dependency is not explicitly wired.

**Consequences:** Loss of the defense-in-depth audit backup. During an investigation, the inability to cross-reference application audit logs with infrastructure-level Cloud Logging entries weakens the compliance posture.

**Prevention:**
- Move the Cloud Logging HIPAA audit sink to a prerequisite of PHI Storage, not a post-launch item
- The commands are already documented in `MONITORING_SETUP.md` (the `gcloud` commands for bucket creation, retention locking, and sink routing)
- Lock the retention policy on the Cloud Storage bucket (this is irreversible -- objects cannot be deleted before retention expires)
- Verify the sink is receiving entries before PHI-1 goes live

**Detection:** Run `gcloud logging sinks list` and check for a sink routing `jsonPayload.audit=true` to a Cloud Storage bucket. If none exists, this is unaddressed.

**Phase:** PHI Storage prerequisites (before PHI-1 deployment)

---

### Pitfall 10: PHI Leaking into Structured Logs

**What goes wrong:** Once PHI is stored, more code paths handle patient data. A developer adds logging for debugging and accidentally includes patient context, note content, or patient names in a structured log field. Pino's redaction configuration (`redact.paths` in `logger.ts`) catches known field names (`patient`, `noteContent`, `quickNotes`, etc.), but it cannot catch arbitrary field names. If a developer logs `{ patientData: record }` instead of `{ patient: record }`, the redaction is bypassed.

**Why it happens:** The Pino redaction is a safety net, not a primary defense. It relies on field name conventions. New PHI fields introduced by PHI Storage (patient first/last name, DOB, clinical note sections, patient context) may use different field names than what the redaction list anticipates.

**Consequences:** PHI in Cloud Logging. Even with the Google Cloud BAA covering Cloud Logging, PHI in logs violates the minimum necessary principle and creates a broader attack surface if logs are exported or shared during debugging.

**Prevention:**
- Update Pino's `redact.paths` when adding PHI Storage fields: add `firstName`, `lastName`, `dateOfBirth`, `content`, `sections`, `patientData`, `clinicalNote`, `soapNote`, `context`
- Establish a code review convention: any PR that adds a `logger.*` call in code that handles PHI must be reviewed for field safety
- The primary defense remains "never pass PHI to the logger" -- redaction is defense-in-depth
- Add a test that imports the logger config and asserts all known PHI field names are in the redaction list

**Detection:** Search the codebase for `logger.` calls in files under `server/dal/patients.ts`, `server/dal/clinical-notes.ts`, and `server/services/note-generation.ts`. Check that no PHI fields are passed as structured context.

**Phase:** PHI Storage (PHI-1, code review gate) and Monitoring (Pino logger PR)

---

### Pitfall 11: Migration Fails on Production With Real Data

**What goes wrong:** PHI Storage requires a significant database migration (5 new tables, indexes, triggers, seed data). The migration is tested against a clean local database. In production, the migration runs against a database with real users, sessions, usage records, and audit logs. Edge cases emerge: (a) the seed data INSERT for the built-in SOAP template uses a hardcoded UUID (`00000000-0000-0000-0000-000000000001`) that may conflict if the template was manually created during staging testing, (b) the migration takes longer than expected on a production-sized database, (c) Cloud Run's deploy pipeline runs migrations before traffic cutover (per Step 2 of Deployment Readiness), but if the migration fails, the old code is still running against a partially-migrated schema.

**Why it happens:** Migration testing is done against empty or synthetic databases. Production databases accumulate state that migrations do not anticipate. The deploy pipeline runs migrations as a blocking step, but failure handling is often "stop the deploy" without a rollback plan.

**Consequences:** Failed migration during deploy blocks all future deploys until manually resolved. If the migration is partially applied (some tables created, others not), the application may start with a broken schema. In the worst case, the `ON DELETE RESTRICT` constraints on new FKs could block existing user operations.

**Prevention:**
- Test the migration against a clone of the production database (Cloud SQL supports cloning instances)
- Make migrations idempotent where possible (use `IF NOT EXISTS` for table creation, `ON CONFLICT DO NOTHING` for seed data)
- Add a migration rollback script (the corresponding DOWN migration) and test it
- Time the migration on a production-sized dataset -- if it takes more than a few seconds, consider running it during a maintenance window
- The roadmap's migration runner already has advisory locks (M-20 fixed), preventing concurrent migration runs

**Detection:** If the migration script does not include `IF NOT EXISTS` guards and the seed data uses `INSERT` without `ON CONFLICT`, it is fragile.

**Phase:** PHI Storage (PHI-1, pre-deployment testing)

---

### Pitfall 12: Redis Failure Disables All Rate Limiting Silently

**What goes wrong:** `CONCERNS.md` documents this: when Redis (Upstash) is unavailable, `checkRateLimit` returns `{ success: true }` -- all rate limiting silently stops. In production, if Upstash has an outage, brute-force protection on login, registration, and note generation is completely disabled. An attacker who discovers the rate limiting gap (e.g., by monitoring response times or attempting rapid requests) can exploit it during the Upstash outage window.

**Why it happens:** The fail-open design was intentional for development/testing. It was not upgraded to fail-closed for production because doing so would block all authenticated requests during a Redis outage, which is arguably worse.

**Consequences:** Account takeover via credential stuffing during an Upstash outage. The progressive lockout system (database-backed) still functions as a secondary defense, but it has higher thresholds (5-20 attempts before lockout) than the rate limiter (5 per 15 minutes).

**Prevention:**
- Add `REDIS_REQUIRED_IN_PRODUCTION` guard as suggested in CONCERNS.md -- throw on startup if Redis is not configured in production
- Add a health check probe for Redis connectivity (separate from the database health check)
- Add Cloud Monitoring alerting on rate limiter failures (requires the Pino logger to be active)
- Document the progressive lockout as the secondary defense, but do not rely on it as the primary mechanism

**Detection:** Set `UPSTASH_REDIS_REST_URL` to an invalid value in staging and attempt rapid login requests. If they all succeed, the fail-open behavior is confirmed.

**Phase:** Deployment Readiness (Step 2, health check enhancement) or Pipeline Hardening

---

## Minor Pitfalls

### Pitfall 13: `min-instances=0` Causes Cold Starts for First Users

**What goes wrong:** The deploy pipeline defaults to `min-instances=0` for pre-launch cost savings. Beta Launch Gate (Step 7) includes "Increase `min-instances` from 0 to 1." If this is forgotten, the first user request after an idle period triggers a cold start (Next.js standalone build + pg.Pool initialization + Pino logger setup). For a Node.js app, this is typically 1-3 seconds. For a PT generating a note between patients, a 3-second blank page feels broken.

**Prevention:** Make `min-instances=1` part of the deploy.yml for the production environment. Keep `min-instances=0` only for staging/preview environments.

**Phase:** Deployment Readiness (Step 7, Beta Launch Gate)

---

### Pitfall 14: Stripe Dashboard Settings Sync Between Test and Live Mode

**What goes wrong:** Some Stripe Dashboard settings (Customer Portal configuration, billing settings, tax settings) apply to both test and live mode. Changes made while testing in test mode can inadvertently affect the live mode configuration. For example, enabling "Allow customers to cancel subscriptions" in test mode to test the flow also enables it in live mode.

**Prevention:** After configuring Stripe live mode (Step 6), review all Dashboard settings with the live mode toggle active. Verify Customer Portal, webhook endpoints, and product/price configurations match expectations.

**Phase:** Deployment Readiness (Step 6)

---

### Pitfall 15: `checkDeviceBinding` Never Called -- Session Security Monitoring Gap

**What goes wrong:** `CONCERNS.md` documents that `checkDeviceBinding` is exported but never called. A stolen session token used from a different IP/user agent produces no security signal. Once PHI is stored, a hijacked session grants access to patient records and clinical notes -- the blast radius is much larger than the current pass-through model.

**Prevention:** Wire `checkDeviceBinding` into `getSession` in `server/lib/get-session.ts` before PHI Storage ships. Log device mismatches at `warn` level with `{ audit: true }` for HIPAA retention.

**Phase:** PHI Storage prerequisites or Deployment Readiness

---

### Pitfall 16: Permanently Locked Accounts Require Direct DB Access

**What goes wrong:** `CONCERNS.md` flags that `unlockAccount` has no admin interface. With PHI Storage, a locked clinician cannot access their patient records or notes. In a clinical setting, this directly impacts patient care -- the PT needs to document visits during the session.

**Prevention:** Implement a minimal admin CLI script (`pnpm admin:unlock-account --userId=...`) before beta launch. A full admin dashboard can wait, but the ability to unlock accounts cannot.

**Phase:** Deployment Readiness (Step 7, Beta Launch Gate) or early Phase 3

---

### Pitfall 17: CSP `unsafe-inline` for Styles Under Proposed HIPAA Rule

**What goes wrong:** The proxy uses `style-src 'self' 'unsafe-inline'` for Tailwind compatibility. The proposed HIPAA Security Rule NPRM eliminates the "addressable" exception for certain technical safeguards and may explicitly require stricter CSP policies as part of web application security controls. While the current `unsafe-inline` for styles is an accepted risk for script-free contexts, the regulatory bar is likely rising.

**Prevention:** Track Tailwind's CSS extraction capabilities and Next.js style nonce support. If either becomes practical before the final rule, remove `unsafe-inline`. This is low urgency until the final rule is published.

**Phase:** Phase 3 (Quality) or when the HIPAA final rule is published

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Reference |
|-------------|---------------|------------|-----------|
| **Deployment Readiness Step 3** (GCP Provisioning) | Cloud SQL instance undersized for multi-instance connection pooling | Size `max_connections` to `cloud_run_max_instances * pool_max + 10`. Use `db-custom-1-3840` minimum. | Pitfall 7 |
| **Deployment Readiness Step 3** | Secret Manager `latest` version causes stale secrets after rotation | Pin to specific version, deploy new revision after rotation | Pitfall 8 |
| **Deployment Readiness Step 4** (Staging Deploy) | Backup restoration never tested -- no runbook exists | Restore to a separate instance during staging verification, document procedure | Pitfall 5 |
| **Deployment Readiness Step 6** (Stripe Live) | Test mode webhook secret used in production | Update `STRIPE_WEBHOOK_SECRET` in Secret Manager, verify with real $1 charge | Pitfall 6 |
| **Deployment Readiness Step 7** (Beta Gate) | No admin unlock capability for locked clinicians | Ship CLI script before inviting beta users | Pitfall 16 |
| **PHI Storage (PHI-1)** | Incident response plan references pass-through model | Update Section 3 before PHI migration goes live | Pitfall 1 |
| **PHI Storage (PHI-1)** | No audit logging for PHI read access | Add `PATIENT_VIEWED`, `NOTE_VIEWED` audit actions to DAL | Pitfall 2 |
| **PHI Storage (PHI-1)** | Audit retention sink not configured | Run the `gcloud` commands from MONITORING_SETUP.md before PHI-1 deploys | Pitfall 9 |
| **PHI Storage (PHI-1)** | PHI in logger structured fields | Update Pino redaction paths, code review gate for logger calls in PHI paths | Pitfall 10 |
| **PHI Storage (PHI-1)** | Migration fails on production data | Test migration against production clone, add idempotency guards | Pitfall 11 |
| **PHI Storage (PHI-2/3)** | Account deletion conflicts with HIPAA retention | Document retention policy with legal counsel before implementing deletion | Pitfall 3 |
| **PHI Storage or Deployment** | MFA not implemented before storing ePHI | Track HIPAA NPRM progress, design MFA-extensible auth schema | Pitfall 4 |
| **Monitoring** | Redis failure silently disables rate limiting | Add `REDIS_REQUIRED_IN_PRODUCTION` startup guard | Pitfall 12 |

---

## Sources

**HIPAA Regulatory:**
- [HHS HIPAA Security Rule NPRM Fact Sheet](https://www.hhs.gov/hipaa/for-professionals/security/hipaa-security-rule-nprm/factsheet/index.html) -- mandatory encryption, MFA, vulnerability scanning requirements
- [HIPAA Security Rule 2025 Changes (Coalfire)](https://coalfire.com/the-coalfire-blog/hipaa-security-rule-2025-say-goodbye-to-good-enough) -- elimination of addressable vs. required distinction
- [HIPAA 2025 Changes (Axonius)](https://www.axonius.com/blog/hipaa-2025-changes-the-impact-and-how-to-address-the-new-requirements) -- MFA and encryption mandates
- [2026 HIPAA Rule Updates (Chess Health)](https://www.chesshealthsolutions.com/2025/11/06/2026-hipaa-rule-updates-what-healthcare-providers-administrators-and-compliance-officers-need-to-know/) -- compliance timeline
- [Common HIPAA Violations 2026 (HIPAA Journal)](https://www.hipaajournal.com/common-hipaa-violations/) -- most frequent enforcement actions
- [HIPAA Cloud Misconfigurations (HIPAA Vault)](https://www.hipaavault.com/resources/hipaa-cloud-misconfigurations/) -- cloud-specific compliance failures
- [Why Healthcare Apps Fail HIPAA (Digital Scientists)](https://digitalscientists.com/blog/why-most-healthcare-apps-fail-hipaa-compliance/) -- architectural compliance mistakes

**GCP Infrastructure:**
- [Cloud SQL Manage Connections (Google)](https://cloud.google.com/sql/docs/postgres/manage-connections) -- connection pooling best practices
- [Cloud SQL Managed Connection Pooling (Google)](https://docs.google.com/sql/docs/postgres/managed-connection-pooling) -- PgBouncer-based pooling
- [Cloud Run Connect to Cloud SQL (Google)](https://docs.google.com/sql/docs/postgres/connect-run) -- Cloud Run to Cloud SQL configuration
- [Secret Manager Best Practices (Google)](https://cloud.google.com/secret-manager/docs/best-practices) -- version pinning, rotation
- [Cloud Run Min Instances (Google)](https://cloud.google.com/run/docs/configuring/min-instances) -- cold start mitigation
- [How to Fix Cloud SQL Max Connections (OneUpTime)](https://oneuptime.com/blog/post/2026-02-17-how-to-fix-cloud-sql-max-connections-reached-error-and-tune-connection-pooling/view) -- connection exhaustion diagnosis

**Stripe:**
- [Stripe Go-Live Checklist (Stripe Docs)](https://docs.stripe.com/get-started/checklist/go-live) -- official transition checklist
- [Common Stripe Mistakes (MoldStud)](https://moldstud.com/articles/p-five-common-mistakes-to-avoid-when-starting-with-stripe) -- webhook and API key issues
- [Stripe Webhook Debugging (Dev.to)](https://dev.to/nerdincode/debugging-stripe-webhook-signature-verification-errors-in-production-1h7c) -- signature verification failures
- [Stripe Webhook Troubleshooting (Stripe Support)](https://support.stripe.com/questions/troubleshooting-webhook-delivery-issues) -- delivery issues

**PHI and Data Retention:**
- [Secure PHI Deletion (SecurityMetrics)](https://www.securitymetrics.com/blog/secure-data-deletion-permanently-deleting-phi-healthcare) -- deletion vs. retention obligations
- [CCPA Right to Delete (Securiti)](https://securiti.ai/blog/ccpa-right-to-delete/) -- state privacy law obligations
- [GDPR vs HIPAA (Censinet)](https://censinet.com/perspectives/gdpr-vs-hipaa-cloud-phi-compliance-differences) -- conflicting data handling requirements

**Confidence Levels:**
- Pitfalls 1-3, 5-12, 15-16: HIGH -- verified against codebase and official documentation
- Pitfall 4 (MFA mandate): MEDIUM -- based on published NPRM, final rule not yet issued
- Pitfall 17 (CSP under NPRM): LOW -- speculative extrapolation from proposed rule language
