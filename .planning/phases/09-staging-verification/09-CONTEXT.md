# Phase 4: Staging Verification - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the application to GCP staging and verify all integrations work end-to-end. Covers first staging deploy, Pino log verification in Cloud Logging, Vertex AI ADC note generation, full user auth flow, and Stripe test-mode checkout with webhook processing. Covers INFRA-09 through INFRA-12.

</domain>

<decisions>
## Implementation Decisions

### Smoke test approach
- Manual walkthrough against staging.flashnote.co — no scripted tests (E2E automation is Phase 10)
- Pass/fail checklist embedded directly in PLAN.md — the plan IS the test record
- Each of the 4 success criteria maps to specific verification steps in the checklist
- Issues found during verification are fixed inline immediately, then re-verified

### Pino log verification
- Open Cloud Logging console, filter by Cloud Run service, confirm structured JSON entries appear with correct severity levels
- Trigger an error and confirm it auto-groups in Cloud Error Reporting
- No deep field-level verification (DEPLOY_VERSION, PHI redaction paths) — just confirm logs flow and errors surface

### Vertex AI ADC verification
- ADC verified implicitly by generating a real SOAP note through the staging UI
- No separate token exchange verification — if note generation works, ADC works
- This overlaps with INFRA-11 (register → generate note flow)

### Staging data & services
- Real Resend delivery: configure RESEND_API_KEY in staging Secret Manager so verification/reset emails actually send
- Stripe: check if test-mode products/prices exist in Stripe Dashboard during execution; create if needed. Add test-mode keys to Secret Manager
- Upstash Redis: check if staging instance exists; create if needed (free tier sufficient). Add credentials to Secret Manager
- Invite code: insert directly into staging database via SQL after migrations run (deploy.yml sets REGISTRATION_MODE=invite)

### Issue triage policy
- Fix issues inline as discovered — first deploy always has config/integration issues, this is expected
- All 4 success criteria must pass cleanly before phase is complete — no deferrals, no "known issues"
- Plan includes fix cycles after each smoke test pass

### Manual steps
- Plan includes a clear checklist of manual steps the user must perform (add secrets to Secret Manager, configure Stripe webhook URL, create Upstash instance if needed, etc.)
- Exact values/commands provided where possible
- Claude does not execute gcloud commands for secret management — user handles all GCP console and third-party dashboard configuration

### Connection pool validation
- Quick sanity check only: generate a few notes, check health endpoint, confirm no connection errors in Cloud Logging
- Keep current pool defaults (max 20 connections, idle timeout 30s, connect timeout 2s) — adjust only if issues are observed
- No formal load testing — that's disproportionate for staging verification

### Claude's Discretion
- Exact ordering of manual setup steps vs automated deploy steps
- How to structure the fix cycle workflow (deploy → test → fix → redeploy)
- Whether to verify Cloud SQL Auth Proxy connectivity separately or let it surface through the auth flow
- Specific SQL for invite code insertion

</decisions>

<specifics>
## Specific Ideas

- Deploy.yml already wires `REGISTRATION_MODE=invite`, `GEMINI_USE_ADC=true`, `TRUSTED_PROXY_COUNT=2`, and `WEB_URL=https://staging.flashnote.co` for staging
- STATE.md flagged: "Cloud Run connection pool exhaustion risk under autoscaling. Must validate pool sizing during Phase 4 staging verification." — addressed by sanity check, not formal load test
- Phase 3 set ingress to `internal-and-cloud-load-balancing` — all traffic routes through ALB, staging.flashnote.co should resolve once DNS propagates

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `gemini-provider.ts`: ADC token fetch via GCP metadata server already implemented with caching and Zod validation
- `deploy.yml`: Full staging deploy pipeline with migration job, Cloud Run deploy, and env var configuration
- `/api/health/route.ts`: Health endpoint probes DB connectivity (returns ok/degraded)
- `infra/*.tf`: Terraform configs for Cloud SQL, Secret Manager, Cloud Run service/job, ALB, DNS

### Established Patterns
- Secrets mounted via Secret Manager → Cloud Run env vars (per-secret IAM bindings for least privilege)
- Migration job runs same Docker image as app, executed before traffic cutover
- Pino logger configured for GCP JSON format in production, pino-pretty in dev
- Config validation at startup (config.ts Zod schema) — missing env vars cause immediate crash with clear error

### Integration Points
- Cloud SQL Auth Proxy sidecar provides encrypted tunnel — no application-level SSL config needed
- Stripe webhook endpoint: staging.flashnote.co/api/webhooks/stripe (needs to be registered in Stripe Dashboard)
- Resend sends from EMAIL_FROM_ADDRESS (default: noreply@flashnote.app)
- Cloud Logging receives Pino JSON output automatically from Cloud Run stdout

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-staging-verification*
*Context gathered: 2026-03-19*
