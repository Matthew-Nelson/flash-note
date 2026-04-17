# Phase 4: Staging Verification - Research

**Researched:** 2026-03-19
**Domain:** GCP staging deployment, integration verification, manual smoke testing
**Confidence:** HIGH

## Summary

Phase 4 is an integration verification phase, not a code-writing phase. The application code, infrastructure (Terraform), and deploy pipeline (GitHub Actions) are all built. The work is: trigger the first staging deploy, populate secrets in Secret Manager, configure third-party services (Stripe webhook URL, Upstash Redis instance), and manually walk through four success criteria to confirm everything works end-to-end.

The primary risk is configuration mismatches -- environment variables, secret values, DNS propagation, and service-to-service connectivity. The codebase has fail-fast config validation (Zod schema in `config.ts` exits the process on missing required env vars), so most misconfigurations will surface immediately as container startup failures visible in Cloud Logging.

**Primary recommendation:** Structure the plan as a sequential checklist: prerequisites (secrets, third-party config) -> deploy trigger -> smoke test each success criterion -> fix cycle -> re-verify. Claude handles code fixes; the user handles GCP Console and third-party dashboard actions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Manual walkthrough against staging.flashnote.co -- no scripted tests (E2E automation is Phase 10)
- Pass/fail checklist embedded directly in PLAN.md -- the plan IS the test record
- Each of the 4 success criteria maps to specific verification steps in the checklist
- Issues found during verification are fixed inline immediately, then re-verified
- Pino log verification: Cloud Logging console, filter by Cloud Run service, confirm structured JSON + Cloud Error Reporting grouping. No deep field-level verification.
- Vertex AI ADC verification: implicit via note generation through staging UI. No separate token exchange test.
- Real Resend delivery: configure RESEND_API_KEY in staging Secret Manager
- Stripe: check if test-mode products/prices exist; create if needed. Add test-mode keys to Secret Manager.
- Upstash Redis: check if staging instance exists; create if needed (free tier). Add credentials to Secret Manager.
- Invite code: insert directly into staging database via SQL after migrations run
- Fix issues inline as discovered -- all 4 success criteria must pass, no deferrals
- Plan includes clear manual steps checklist with exact values/commands where possible
- Claude does not execute gcloud commands for secret management -- user handles all GCP console and third-party dashboard configuration
- Connection pool: sanity check only (generate a few notes, check health endpoint, confirm no connection errors). Keep pool defaults (max 20, idle 30s, connect 2s). No formal load testing.

### Claude's Discretion
- Exact ordering of manual setup steps vs automated deploy steps
- How to structure the fix cycle workflow (deploy -> test -> fix -> redeploy)
- Whether to verify Cloud SQL Auth Proxy connectivity separately or let it surface through the auth flow
- Specific SQL for invite code insertion

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-09 | First staging deploy succeeds with Pino logs in Cloud Logging and errors in Cloud Error Reporting | Deploy pipeline analysis, logger configuration, Cloud Error Reporting auto-grouping via `@google-cloud/pino-logging-gcp-config` serviceContext |
| INFRA-10 | Vertex AI ADC verified working (note generation uses ADC endpoint, not consumer API key) | ADC token flow in `gemini-provider.ts`, env vars in deploy.yml (`GEMINI_USE_ADC=true`, Vertex AI URL), runtime SA has `roles/aiplatform.user` |
| INFRA-11 | Smoke test: register -> verify email -> login -> generate note -> logout | Auth flow through Server Actions, Resend email delivery, invite code requirement (`REGISTRATION_MODE=invite`), session management |
| INFRA-12 | Smoke test: Stripe checkout (test mode) -> webhook -> subscription active -> notes unlocked | Billing service with server-side checkout redirect, webhook signature verification, test-mode Stripe configuration needed |
</phase_requirements>

## Standard Stack

This phase uses no new libraries. All technology is already deployed in the codebase.

### Core (Already Deployed)
| Component | Version/Config | Purpose | Status |
|-----------|---------------|---------|--------|
| Next.js | 16.1.6 | Application framework | Built, Dockerized |
| Pino + GCP config | pino + `@google-cloud/pino-logging-gcp-config` | Structured logging | Code complete (Phase 2) |
| Vertex AI (Gemini 2.5 Flash) | ADC via metadata server | LLM note generation | Code complete, needs runtime verification |
| Stripe | `stripe` SDK, API version `2025-12-15.clover` | Billing / checkout | Code complete, needs webhook URL registration |
| Resend | `resend` SDK | Email delivery | Code complete, needs API key in Secret Manager |
| Upstash Redis | `@upstash/redis` + `@upstash/ratelimit` | Rate limiting | Code complete, needs instance + credentials |
| Cloud SQL (Postgres 15) | `pg` pool, max 20 | Database | Provisioned via Terraform |
| Cloud Run v2 | 1Gi / 1 CPU, min 0 / max 5 | Container runtime | Provisioned via Terraform |
| Global External ALB | Google-managed SSL | Load balancer + TLS | Provisioned via Terraform |

### Third-Party Services Requiring Configuration
| Service | What's Needed | Where to Configure |
|---------|--------------|-------------------|
| Upstash Redis | Staging instance (free tier) | upstash.com console |
| Stripe | Test-mode product + prices | Stripe Dashboard (test mode) |
| Stripe | Webhook endpoint URL | Stripe Dashboard (test mode) |
| Resend | API key for staging | Resend dashboard (existing account) |

## Architecture Patterns

### Deploy Flow (Already Built)

```
Push to main -> CI (lint/test/build) -> Deploy workflow triggers
  -> Build Docker image -> Push to Artifact Registry
  -> Deploy to Staging:
      1. Update migration job image
      2. Execute migration job (runs migrate.mjs via Cloud SQL Auth Proxy)
      3. Deploy Cloud Run service (new revision)
         - Health probe: /api/health (checks DB connectivity)
         - Startup probe: 5s initial delay, 10s period, 3 failures
         - Secrets: 9 secrets from Secret Manager via env vars
         - Env vars: NODE_ENV=production, WEB_URL, LLM config, etc.
  -> Deploy to Production (gated by `production` environment)
```

### Secret Configuration Pattern
Terraform creates empty secret shells. Secret VALUES are populated manually via `gcloud` or the GCP Console. Cloud Run mounts secrets as environment variables with per-secret IAM bindings.

**9 secrets that need values before deploy:**
1. `database-url` -- auto-populated by Terraform (Cloud SQL Auth Proxy socket path)
2. `upstash-redis-rest-url` -- from Upstash dashboard
3. `upstash-redis-rest-token` -- from Upstash dashboard
4. `resend-api-key` -- from Resend dashboard
5. `stripe-secret-key` -- from Stripe dashboard (test mode: `sk_test_...`)
6. `stripe-webhook-secret` -- from Stripe dashboard after webhook endpoint creation (`whsec_...`)
7. `stripe-price-monthly` -- from Stripe dashboard after product/price creation (`price_...`)
8. `stripe-price-annual` -- from Stripe dashboard after product/price creation (`price_...`)
9. `cleanup-secret` -- generate a random 32+ character string

### Config Validation Behavior
`config.ts` uses a Zod schema with `superRefine` that enforces production constraints:
- **Crashes on missing required secrets** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CLEANUP_SECRET`) when `NODE_ENV=production`
- **Blocks mock AI** (`USE_MOCK_AI` forbidden in production)
- **Blocks direct Gemini API** (URL must be `aiplatform.googleapis.com`, not `generativelanguage.googleapis.com`)
- **Blocks Claude LLM** (no Anthropic BAA)
- **Requires Upstash Redis** in production (`redis.ts` calls `process.exit(1)`)

This means: if any secret is empty or invalid, the container will crash on startup. The health probe will fail and Cloud Run won't route traffic. This is good -- fail-fast behavior makes config issues obvious.

### Invite Code Insertion
The app uses `REGISTRATION_MODE=invite` in staging. New users must provide a valid invite code during registration. The invite code schema:

```sql
-- From 001_initial_schema.sql
CREATE TABLE invite_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'personal',
    max_uses INTEGER NOT NULL DEFAULT 1,
    current_uses INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    organization_id UUID REFERENCES organizations(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

SQL to insert a staging invite code:
```sql
INSERT INTO invite_codes (code, type, max_uses, expires_at)
VALUES ('STAGING-TEST-2026', 'personal', 100, '2027-01-01T00:00:00Z');
```

### Stripe Checkout Flow (Server-Side Redirects)
The billing integration uses Stripe Checkout with server-side session creation and full-page redirects -- no client-side Stripe.js. This means CSP doesn't need modification for Stripe.

Flow: User clicks checkout -> Server Action creates Stripe session -> Returns checkout URL -> Client redirects via `window.location.href` -> User completes payment on Stripe-hosted page -> Stripe redirects to `{WEB_URL}/dashboard?success=true` -> Stripe fires webhook to `{WEB_URL}/api/webhooks/stripe`.

### Webhook Events Handled
The billing service processes these Stripe events:
- `checkout.session.completed` -- Initial subscription activation
- `customer.subscription.updated` -- Status changes (active, past_due, etc.)
- `customer.subscription.deleted` -- Cancellation
- `invoice.payment_succeeded` -- Payment confirmation
- `invoice.payment_failed` -- Payment failure

Each event is deduplicated via the `processed_webhook_events` table.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Staging deploy orchestration | Custom deploy scripts | Existing `deploy.yml` workflow | Already handles image build, migration, deployment with proper IAM |
| Secret management | Env files, inline secrets | GCP Secret Manager (existing Terraform shells) | Per-secret IAM, audit trail, version management |
| SSL/TLS termination | Application-level SSL | Google-managed SSL certificate on ALB | Auto-renewal, no cert management |
| DB connectivity from Cloud Run | Direct TCP with SSL certs | Cloud SQL Auth Proxy sidecar (existing Terraform config) | Automatic encryption, IAM auth, no SSL cert management |
| Health checks | Custom monitoring scripts | Cloud Run health/liveness probes (existing config) | Automatic restart on failure |

## Common Pitfalls

### Pitfall 1: Empty Secret Manager Secrets
**What goes wrong:** Terraform creates secret shells but not all values. Cloud Run tries to mount an empty secret, which may pass as an empty string or fail to mount entirely.
**Why it happens:** `database-url` is auto-populated by Terraform, but the other 8 secrets need manual values.
**How to avoid:** Check all 9 secrets have versions before triggering deploy. Use `gcloud secrets versions list SECRET_NAME --project=flashnote-staging` for each.
**Warning signs:** Container crashes immediately on startup. Cloud Logging shows Zod validation errors from `config.ts`.

### Pitfall 2: GitHub Actions Environment Not Configured
**What goes wrong:** The deploy workflow uses `environment: staging` which requires a GitHub environment with secrets (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SA_EMAIL`, `GCP_SA_RUNTIME_EMAIL`, `GCP_PROJECT_ID`, `GCP_REGION`).
**Why it happens:** Terraform provisions GCP resources but not GitHub environment configuration.
**How to avoid:** Before the first deploy, verify the `staging` GitHub environment exists with all required secrets.
**Warning signs:** Deploy job fails immediately with "secret not found" errors.

### Pitfall 3: DNS Propagation Delay
**What goes wrong:** `staging.flashnote.co` doesn't resolve to the ALB IP immediately. Google-managed SSL certificate can't provision without DNS pointing to the ALB.
**Why it happens:** DNS managed externally (`manage_dns = false`). A records need to be created manually pointing to the Terraform-outputted `load_balancer_ip`.
**How to avoid:** Create DNS records first, verify propagation before expecting HTTPS to work. SSL cert provisioning can take 15-60 minutes after DNS propagates.
**Warning signs:** `ERR_NAME_NOT_RESOLVED` or SSL certificate errors in browser.

### Pitfall 4: Stripe Webhook URL Registration
**What goes wrong:** Stripe checkout completes but webhook never fires, so subscription never activates in the database.
**Why it happens:** Webhook endpoint (`https://staging.flashnote.co/api/webhooks/stripe`) wasn't registered in Stripe Dashboard, or was registered with wrong URL.
**How to avoid:** Register webhook endpoint in Stripe Dashboard (test mode) with these events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`. Copy the webhook signing secret (`whsec_...`) to Secret Manager.
**Warning signs:** Stripe checkout succeeds (user sees success page) but `subscription_status` remains `trial` in the database.

### Pitfall 5: Stripe API Version Mismatch
**What goes wrong:** Webhook signature verification fails because the Stripe Dashboard sends events with a different API version than the SDK expects.
**Why it happens:** The billing service pins to `2025-12-15.clover`. If the webhook endpoint in Stripe Dashboard is configured with a different API version, payload structure may differ.
**How to avoid:** When creating the webhook endpoint in Stripe Dashboard, the API version is set at creation time and cannot be changed. Verify it matches.
**Warning signs:** 400 errors on webhook endpoint. Cloud Logging shows `WebhookSignatureError`.

### Pitfall 6: Cloud Run Ingress Blocks Direct Access
**What goes wrong:** Trying to access the Cloud Run service URL directly returns 403.
**Why it happens:** Ingress is set to `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` -- only the ALB can reach Cloud Run.
**How to avoid:** Always access via `https://staging.flashnote.co`, not the Cloud Run service URL (`https://flashnote-staging-xxx.run.app`).
**Warning signs:** 403 Forbidden when accessing Cloud Run URL directly.

### Pitfall 7: EMAIL_FROM_ADDRESS Domain Verification
**What goes wrong:** Resend rejects email sends because the `from` address domain (`flashnote.app`) isn't verified.
**Why it happens:** Resend requires domain verification before sending from a custom domain.
**How to avoid:** Verify `flashnote.app` domain in Resend dashboard before testing email flows. Alternatively, check if a different verified domain should be used for staging.
**Warning signs:** Email delivery fails silently (Resend API returns success but emails never arrive) or returns a domain verification error.

### Pitfall 8: Cold Start Timeout
**What goes wrong:** First request after deploy times out because Cloud Run scales from 0 instances.
**Why it happens:** `min_instances = 0` for staging (cost savings). Cold start includes container boot, Node.js startup, Pino initialization, and first DB connection.
**How to avoid:** After deploy, hit `/api/health` first to warm the instance before running smoke tests. The startup probe has 5s initial delay + 30s total (3 failures x 10s period).
**Warning signs:** First request hangs for 10-30 seconds, then either succeeds or times out.

## Code Examples

### Verifying Pino Logs in Cloud Logging
Cloud Logging filter to find FlashNote logs:
```
resource.type="cloud_run_revision"
resource.labels.service_name="flashnote-staging"
```

For errors specifically (Cloud Error Reporting auto-groups these):
```
resource.type="cloud_run_revision"
resource.labels.service_name="flashnote-staging"
severity>=ERROR
```

The Pino GCP config (`logger.ts:52-67`) configures:
- `serviceContext.service = 'flashnote-web'` -- groups errors in Cloud Error Reporting
- `serviceContext.version = process.env.DEPLOY_VERSION` -- tracks which deploy introduced errors
- GCP severity mapping (Pino levels -> Cloud Logging severity)
- Stack trace extraction for Error Reporting grouping

### Triggering an Error for Cloud Error Reporting Verification
The telemetry endpoint (`/api/telemetry`) can receive client errors, but the simplest way to trigger a server error is to cause one naturally -- e.g., an invalid API call. Alternatively, checking Cloud Logging for any `severity>=ERROR` entries from the startup/health check flow is sufficient.

### Health Endpoint Response Format
```json
{ "status": "ok", "db": "connected" }
// or
{ "status": "degraded", "db": "unreachable" }
```

### Invite Code Insertion SQL
```sql
-- Connect to staging Cloud SQL (via Cloud SQL Auth Proxy or gcloud sql connect)
INSERT INTO invite_codes (code, type, max_uses, expires_at)
VALUES ('STAGING-TEST-2026', 'personal', 100, '2027-01-01T00:00:00Z');
```

### GitHub Actions Secrets Needed for Staging Environment
| Secret Name | Value Source |
|-------------|-------------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Terraform output: `workload_identity_provider` |
| `GCP_SA_EMAIL` | Terraform output: `ci_deploy_sa_email` |
| `GCP_SA_RUNTIME_EMAIL` | Terraform output: `runtime_sa_email` |
| `GCP_PROJECT_ID` | `flashnote-staging` |
| `GCP_REGION` | `us-central1` |

## State of the Art

Not applicable -- this phase is integration verification, not technology selection.

## Open Questions

1. **DNS configuration status**
   - What we know: Terraform outputs a `load_balancer_ip`. DNS is managed externally (`manage_dns = false`).
   - What's unclear: Has the user already pointed `staging.flashnote.co` A record at the ALB IP?
   - Recommendation: Include a DNS verification step early in the plan. If not configured, that's a prerequisite before anything else.

2. **Resend domain verification**
   - What we know: Emails send from `noreply@flashnote.app`. Resend requires domain verification.
   - What's unclear: Is `flashnote.app` already verified in Resend?
   - Recommendation: Include a Resend domain check in prerequisites. If not verified, user must add DNS records for Resend verification first.

3. **GitHub `staging` environment existence**
   - What we know: `deploy.yml` references `environment: staging`. This needs a GitHub environment with 5 secrets.
   - What's unclear: Has this already been configured?
   - Recommendation: Include a GitHub environment check in prerequisites.

4. **Stripe test-mode products**
   - What we know: The app needs `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_ANNUAL` (both `price_...` format).
   - What's unclear: Whether test-mode products/prices already exist in Stripe.
   - Recommendation: Include instructions for creating a test product with monthly and annual prices if they don't exist.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual verification (per CONTEXT.md decision) |
| Config file | N/A -- no automated tests for this phase |
| Quick run command | Manual walkthrough against staging.flashnote.co |
| Full suite command | Complete all 4 success criteria checklists |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-09 | Pino logs appear in Cloud Logging, errors in Error Reporting | manual | Visual inspection of Cloud Logging console | N/A |
| INFRA-10 | Note generation works via Vertex AI ADC | manual | Generate note through staging UI | N/A |
| INFRA-11 | Register -> verify email -> login -> generate note -> logout | manual | Walk through auth + note flow on staging | N/A |
| INFRA-12 | Stripe checkout -> webhook -> subscription active -> notes unlocked | manual | Walk through billing flow on staging (test mode) | N/A |

### Sampling Rate
- **Per task commit:** Not applicable (manual verification phase)
- **Per wave merge:** Not applicable
- **Phase gate:** All 4 success criteria pass cleanly with evidence documented in PLAN.md checklist

### Wave 0 Gaps
None -- this phase is manual verification. Existing unit/integration test suite (1493 tests, 97.79% coverage) provides confidence in code correctness. Phase 4 validates runtime integration, not code logic.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `deploy.yml`, `config.ts`, `logger.ts`, `gemini-provider.ts`, `billing.ts`, `redis.ts`, `email.ts`
- Terraform configs: `cloudrun-service.tf`, `cloudrun-job.tf`, `secrets.tf`, `iam.tf`, `loadbalancer.tf`, `database.tf`
- Phase 3 STATE.md decisions and completed work

### Secondary (MEDIUM confidence)
- Cloud Run ingress behavior with `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` -- verified via Terraform config and deploy.yml
- Google-managed SSL certificate provisioning timing (15-60 minutes) -- based on GCP documentation

## Metadata

**Confidence breakdown:**
- Deploy pipeline mechanics: HIGH -- full deploy.yml, Terraform configs, and Dockerfile inspected
- Config validation behavior: HIGH -- Zod schema in `config.ts` with production superRefine rules fully reviewed
- Secret requirements: HIGH -- all 9 secrets enumerated from `secrets.tf` and `cloudrun-service.tf`
- Third-party integration points: HIGH -- Stripe webhook, Resend email, Upstash Redis code paths all reviewed
- Pitfalls: HIGH -- derived from direct code inspection of fail-fast paths and infrastructure constraints

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- infrastructure and integration patterns don't change rapidly)
