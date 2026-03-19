# Phase 3: Pipeline & Provisioning - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the deploy pipeline for safe production deployments (automated DB migrations, deep health checks, environment promotion) and provision all GCP infrastructure (Cloud SQL, Secret Manager, Workload Identity Federation, Vertex AI, Artifact Registry, custom domain). Covers INFRA-01 through INFRA-08.

</domain>

<decisions>
## Implementation Decisions

### Infrastructure as Code approach
- Terraform (not OpenTofu) for all GCP resource provisioning
- State stored in a GCS bucket with state locking
- CI-automated: terraform plan on PR (comments diff for review), terraform apply on merge to main
- Single infra/ directory with shared .tf files; environment differences via staging.tfvars and production.tfvars
- Terraform plan step added to ci.yml when infra/ files change

### Migration execution strategy
- Cloud Run job runs migrations using the same Docker image as the app
- Deploy flow: build image → run migration Cloud Run job → wait for success → deploy new Cloud Run revision
- Forward-only migrations (no down migrations) — rollbacks are new forward migrations
- Migrations must be backward-compatible with the currently-running app version (additive changes only; destructive changes in follow-up migration after new code is deployed)
- On migration failure: block the deploy, keep old Cloud Run revision serving traffic. Manual investigation required.

### Environment separation
- Separate GCP projects: flashnote-staging and flashnote-prod (full resource isolation — different Cloud SQL, Secret Manager, IAM)
- Single Terraform config with per-environment tfvars files
- staging.flashnote.co subdomain for staging environment
- flashnote.co for production

### Deploy pipeline
- Full rewrite of deploy.yml (not incremental patches) — remove Sentry references, add migration job step, split staging/production, wire DEPLOY_VERSION
- Dockerfile cleaned up: remove NEXT_PUBLIC_SENTRY_DSN build arg and SENTRY_SUPPRESS_TURBOPACK_WARNING env var
- Auto-deploy to staging on every merge to main
- Production deploy requires GitHub environment approval gate (required reviewers, audit trail)
- DEPLOY_VERSION env var set during build/deploy (Pino reads it for serviceContext.version, per Phase 2 decision)

### Claude's Discretion
- Terraform module structure and resource organization within infra/
- Cloud SQL instance sizing for staging vs production
- Exact GitHub Actions workflow job structure and step ordering
- Health endpoint changes needed (if any) to satisfy INFRA-02 more specifically
- GCS bucket configuration for Terraform state (versioning, lifecycle)
- Cloud Run job configuration details (timeout, retries, service account)
- Secret Manager secret names and mounting strategy (env vars vs volume mounts)
- WIF pool/provider naming conventions

</decisions>

<specifics>
## Specific Ideas

- The deploy workflow currently exists (.github/workflows/deploy.yml) with WIF auth, Docker build, and Cloud Run deploy already wired — rewrite should preserve the working patterns while restructuring
- Health endpoint already probes DB connectivity (returns ok/degraded) — INFRA-02 may already be partially satisfied
- Phase 2 prepared DEPLOY_VERSION support in Pino logger — Phase 3 wires the actual env var in the pipeline
- Phase 2 removed Sentry from the app — Phase 3 removes Sentry artifacts from Dockerfile and deploy workflow
- STATE.md flagged: "Cloud Run connection pool exhaustion risk under autoscaling. Must validate pool sizing during Phase 4 staging verification."

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.github/workflows/deploy.yml`: Existing deploy workflow with WIF auth pattern (google-github-actions/auth@v2), Docker build, Cloud Run deploy. Rewrite should preserve the auth and image tagging patterns.
- `.github/workflows/ci.yml`: Existing CI with lint, test, build, coverage summary, and security audit. TF plan job will be added here.
- `Dockerfile`: Working multi-stage build (deps → builder → runner, Alpine, non-root user, standalone output). Needs Sentry arg removal.
- `web/src/app/api/health/route.ts`: Health check already calls `checkDbHealth()` from DAL. Returns 200 always (Cloud Run probe compatible).
- `web/src/server/db/migrate.ts`: Migration runner (CLI script, `pnpm db:migrate`). Cloud Run job will invoke this.

### Established Patterns
- WIF auth via `google-github-actions/auth@v2` with `id-token: write` permission
- Docker image tagged with commit SHA + `latest`
- Cloud Run deployed via `gcloud run deploy` with explicit resource limits
- Env var validation at startup via Zod schema in `web/src/server/db/config.ts`

### Integration Points
- `deploy.yml` triggers on CI success (`workflow_run` of CI workflow)
- Config.ts validates all env vars at startup — new Secret Manager-mounted vars must pass existing validation
- `GEMINI_USE_ADC=true` + Vertex AI endpoint already coded in gemini-provider.ts — needs service account with `roles/aiplatform.user`
- Cloud SQL Auth Proxy sidecar connection is referenced in codebase docs but not yet configured

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-pipeline-provisioning*
*Context gathered: 2026-03-19*
