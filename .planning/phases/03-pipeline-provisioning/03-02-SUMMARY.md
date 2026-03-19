---
phase: 03-pipeline-provisioning
plan: 02
subsystem: infra
tags: [github-actions, cloud-run, terraform, ci-cd, deploy-pipeline, migrations]

# Dependency graph
requires:
  - phase: 02-structured-logging
    provides: DEPLOY_VERSION logger support and Sentry removal from app code
provides:
  - Deploy workflow with staging/production split and migration job execution
  - CI workflow with Terraform plan on infra/ changes
  - DEPLOY_VERSION wired as Cloud Run env var on every deployment
affects: [03-pipeline-provisioning, 04-staging-verification]

# Tech tracking
tech-stack:
  added: [dorny/paths-filter@v3, hashicorp/setup-terraform@v3]
  patterns: [staging-production-deploy-chain, migration-before-deploy, terraform-plan-on-pr]

key-files:
  modified:
    - .github/workflows/deploy.yml
    - .github/workflows/ci.yml

key-decisions:
  - "Production deploy references staging Artifact Registry image URL (cross-project pull via Plan 01 IAM binding)"
  - "Terraform plan output passed via env var (not expression interpolation) to prevent GitHub Actions script injection"
  - "TRUSTED_PROXY_COUNT=2 for both staging and production (ALB + Cloud Run proxy hops)"
  - "Production uses separate WIF secrets (GCP_PROD_WORKLOAD_IDENTITY_PROVIDER, GCP_PROD_SA_EMAIL, GCP_PROD_SA_RUNTIME_EMAIL)"
  - "INFRA-02 already satisfied by existing health endpoint -- no code changes needed"

patterns-established:
  - "Deploy chain: build -> deploy-staging (auto) -> deploy-production (approval gate)"
  - "Migration before deploy: gcloud run jobs update + execute --wait before gcloud run deploy"
  - "Terraform plan on PR: paths-filter gated, plan output commented on PR, failure blocks CI"
  - "ci-success skip-tolerant: terraform-plan result == 'failure' blocks, 'skipped' passes"

requirements-completed: [INFRA-01, INFRA-02]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 3 Plan 2: Deploy Pipeline & CI Terraform Summary

**Deploy workflow rewritten with build/staging/production job chain, migration-before-deploy pattern, and Terraform plan job added to CI for infra/ changes**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T16:38:33Z
- **Completed:** 2026-03-19T16:41:33Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Deploy workflow rewritten with 3-job pipeline (build -> deploy-staging -> deploy-production) with environment-based approval gates
- Migration Cloud Run job runs with --wait before every Cloud Run deploy, blocking traffic cutover on failure (INFRA-01)
- DEPLOY_VERSION set to commit SHA on every deployment, wiring the Pino logger version field
- All Sentry references and NEXT_PUBLIC_API_URL build arg removed from deploy workflow
- Terraform plan job added to CI that runs on PRs with infra/ changes, comments plan output on PRs
- INFRA-02 confirmed already satisfied by existing health endpoint (no code changes needed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite deploy workflow with staging/production split and migration job** - `59b229f` (feat)
2. **Task 2: Add Terraform plan job to CI workflow** - `d1955ab` (feat)

## Files Created/Modified
- `.github/workflows/deploy.yml` - Full rewrite: 3-job deploy pipeline with migration execution, staging/production split, Sentry cleanup
- `.github/workflows/ci.yml` - Added terraform-plan job with paths-filter, WIF auth, plan output PR comment, skip-tolerant ci-success gate

## Decisions Made
- **Cross-project image URL**: Production deploy uses the same staging Artifact Registry IMAGE env var. Plan 01's IAM binding grants the production SA read access to the staging registry.
- **Script injection prevention**: Terraform plan output is passed to the PR comment step via an `env:` block (`PLAN_OUTPUT`) and referenced as `process.env.PLAN_OUTPUT`, avoiding direct `${{ steps.plan.outputs.stdout }}` interpolation in the script body.
- **TRUSTED_PROXY_COUNT=2**: Both staging and production set this to 2, accounting for the Global ALB + Cloud Run's built-in proxy. This affects rate limiting IP extraction.
- **Production WIF secrets**: Production deploy job uses separate secrets (`GCP_PROD_WORKLOAD_IDENTITY_PROVIDER`, `GCP_PROD_SA_EMAIL`, `GCP_PROD_SA_RUNTIME_EMAIL`, `GCP_PROD_PROJECT_ID`) to enforce project isolation.
- **Ingress TODO**: Both staging and production currently use `--ingress=all --allow-unauthenticated` with a TODO comment. Plan 03 will tighten to `--ingress=internal-and-cloud-load-balancing` once the Global ALB is provisioned.
- **INFRA-02**: The existing health endpoint at `/api/health` already probes DB connectivity with a 3-second timeout and returns 200 always (Cloud Run probe compatible). No code changes needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Terraform plan output injection prevention**
- **Found during:** Task 2 (Terraform plan job)
- **Issue:** The plan specified `${{ steps.plan.outputs.stdout }}` directly in the JavaScript template literal, which is vulnerable to script injection if the Terraform plan output contains backticks or `${` expressions.
- **Fix:** Passed the plan output through an `env:` block and referenced it via `process.env.PLAN_OUTPUT` in the script.
- **Files modified:** .github/workflows/ci.yml
- **Verification:** No direct expression interpolation of untrusted output in script body
- **Committed in:** d1955ab (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical security)
**Impact on plan:** Security improvement to Terraform plan PR comment step. No scope creep.

## Issues Encountered
None

## User Setup Required

The following GitHub repository configuration is required before these workflows function:

**GitHub Environments:**
- Create `staging` environment (no protection rules -- auto-deploy)
- Create `production` environment (add required reviewers for approval gate)

**GitHub Secrets (per environment or repository-level):**
- `GCP_REGION` - GCP region (e.g., us-central1)
- `GCP_PROJECT_ID` - Staging GCP project ID
- `GCP_WORKLOAD_IDENTITY_PROVIDER` - Staging WIF provider resource name
- `GCP_SA_EMAIL` - Staging CI/CD service account email
- `GCP_SA_RUNTIME_EMAIL` - Staging Cloud Run runtime service account email
- `GCP_PROD_PROJECT_ID` - Production GCP project ID
- `GCP_PROD_WORKLOAD_IDENTITY_PROVIDER` - Production WIF provider resource name
- `GCP_PROD_SA_EMAIL` - Production CI/CD service account email
- `GCP_PROD_SA_RUNTIME_EMAIL` - Production Cloud Run runtime service account email

**Cloud Run Migration Job:**
- `flashnote-migrate` Cloud Run job must exist in both staging and production projects before the first deploy (created by Terraform in Plan 01)

## Next Phase Readiness
- Deploy pipeline ready for staging/production deployments once GCP infrastructure is provisioned (Plan 01 Terraform)
- CI Terraform plan job ready once infra/ directory exists with Terraform config (Plan 01)
- Plan 03 (ALB/domain) will tighten Cloud Run ingress from `--ingress=all` to `--ingress=internal-and-cloud-load-balancing`

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 03-pipeline-provisioning*
*Completed: 2026-03-19*
