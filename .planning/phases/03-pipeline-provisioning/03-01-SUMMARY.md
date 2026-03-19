---
phase: 03-pipeline-provisioning
plan: 01
subsystem: infra
tags: [terraform, gcp, cloud-sql, secret-manager, wif, iam, artifact-registry, dockerfile]

# Dependency graph
requires:
  - phase: 02-structured-logging
    provides: Pino logger and DEPLOY_VERSION support in app code
provides:
  - Terraform foundation with GCS remote state backend
  - GCP API enablement for all required services (9 APIs)
  - Cloud SQL PostgreSQL instance with ssl_mode, PITR, and automatic backups
  - Secret Manager shells for all 9 runtime secrets with auto-generated DATABASE_URL
  - IAM service accounts (runtime + CI deploy) with least-privilege roles
  - Workload Identity Federation pool/provider for keyless GitHub Actions auth
  - Artifact Registry Docker repository
  - Cross-project registry access pattern for production pulling from staging
  - Cleaned Dockerfile with compiled migration script (no Sentry artifacts)
affects: [03-02, 03-03, 04-staging-verification]

# Tech tracking
tech-stack:
  added: [hashicorp/google ~>7.24, hashicorp/random ~>3.6, terraform >=1.5]
  patterns: [flat terraform structure with per-env tfvars, for_each for API enablement and secrets, per-secret IAM bindings, cross-project IAM via staging-applied binding]

key-files:
  created:
    - infra/main.tf
    - infra/variables.tf
    - infra/outputs.tf
    - infra/apis.tf
    - infra/iam.tf
    - infra/registry.tf
    - infra/database.tf
    - infra/secrets.tf
    - infra/staging.tfvars
    - infra/production.tfvars
    - infra/.gitignore
  modified:
    - Dockerfile

key-decisions:
  - "Cross-project AR access applied from staging Terraform (prod_runtime_sa_email variable) rather than cross-project provider -- avoids needing credentials for both projects in a single apply"
  - "Migration script compiled to .mjs (not .js) so Node.js treats it as ESM without requiring type:module in package.json"
  - "tsc with --module es2022 used for migration compilation -- preserves import.meta.url and ESM import syntax"
  - "Per-secret IAM bindings (not project-level secretAccessor) for least-privilege Secret Manager access"

patterns-established:
  - "Flat Terraform structure: single infra/ directory, environment differences via staging.tfvars and production.tfvars"
  - "for_each pattern for GCP API enablement and Secret Manager shells"
  - "depends_on API enablement resources before creating dependent GCP resources"
  - "Cross-project Artifact Registry access via variable-gated IAM binding in staging config"

requirements-completed: [INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 3 Plan 01: Terraform Foundation Summary

**Terraform infrastructure foundation with Cloud SQL (ssl_mode + PITR + backups), 9 Secret Manager shells, WIF for keyless GitHub Actions auth, IAM with per-secret least-privilege bindings, and Dockerfile cleanup with compiled migration script**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T16:38:35Z
- **Completed:** 2026-03-19T16:42:50Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Complete Terraform infrastructure foundation covering 5 requirements (INFRA-03 through INFRA-07)
- Cloud SQL with ssl_mode=ENCRYPTED_ONLY, point-in-time recovery, 30-day backup retention, and slow query logging
- All 9 runtime secrets defined in Secret Manager with auto-generated DATABASE_URL using Cloud SQL Auth Proxy socket path format
- WIF pool/provider with numeric owner_id condition (typosquatting prevention) and full OIDC configuration
- Dockerfile cleaned of all Sentry artifacts; migration script compiled to ESM JavaScript for slim runner image

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Terraform foundation and IAM/WIF configuration** - `59b229f` (feat)
2. **Task 2: Create Cloud SQL, Secret Manager, and Dockerfile cleanup** - `7e27ea6` (feat)

## Files Created/Modified
- `infra/main.tf` - Terraform provider config (google + random), GCS backend, locals
- `infra/variables.tf` - All input variable declarations (Plan 01 + Plan 03 variables)
- `infra/outputs.tf` - WIF provider name, SA emails, registry URL, Cloud SQL connection name
- `infra/apis.tf` - 9 GCP API enablement resources via for_each
- `infra/iam.tf` - Service accounts, IAM bindings, WIF pool/provider, cross-project AR access
- `infra/registry.tf` - Artifact Registry Docker repository
- `infra/database.tf` - Cloud SQL instance, database, user, random password
- `infra/secrets.tf` - 9 Secret Manager shells + DATABASE_URL secret version
- `infra/staging.tfvars` - Staging environment values (db-f1-micro, ZONAL, max 5 instances)
- `infra/production.tfvars` - Production environment values (db-custom-1-3840, REGIONAL, max 10 instances)
- `infra/.gitignore` - Ignore .terraform/, tfstate, tfplan, lock file
- `Dockerfile` - Removed Sentry args, added migration compilation and COPY steps

## Decisions Made

1. **Cross-project Artifact Registry access applied from staging config** -- The plan offered two approaches for cross-project registry access. Chose the staging-applied approach (prod_runtime_sa_email variable) because it avoids needing credentials for both GCP projects in a single Terraform apply. After production infra creates the runtime SA, re-apply staging with `-var='prod_runtime_sa_email=<email>'`.

2. **Migration compiled to .mjs extension** -- The plan called for migrate.js but the web package.json lacks `"type": "module"`, which means Node.js would treat .js as CommonJS and fail on the ESM import syntax. Using .mjs forces Node.js ESM parsing regardless of package.json configuration.

3. **tsc with --module es2022 for compilation** -- Tested multiple compilation approaches. `--module nodenext` failed because it emits CJS when package.json lacks `"type": "module"`, which breaks `import.meta.url`. `--module es2022` with `--moduleResolution node` produces valid ESM output that preserves `import.meta.url` and import syntax.

4. **Per-secret IAM bindings** -- Granted `roles/secretmanager.secretAccessor` to the runtime SA on each individual secret rather than at the project level. This follows the principle of least privilege and ensures the runtime SA can only access the 9 specific secrets it needs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration compilation output uses .mjs extension instead of .js**
- **Found during:** Task 2 (Dockerfile cleanup)
- **Issue:** The plan specified compiling migrate.ts to migrate.js, but without `"type": "module"` in package.json, Node.js treats .js files as CommonJS. The compiled output uses ESM syntax (`import`, `import.meta.url`) which would fail as CJS.
- **Fix:** Output the compiled migration as `migrate.mjs` so Node.js treats it as ESM regardless of package.json configuration. Updated all Dockerfile COPY references accordingly.
- **Files modified:** Dockerfile
- **Verification:** Local tsc compilation produces valid ESM output; .mjs extension is recognized by Node.js as ESM
- **Committed in:** 7e27ea6 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for correctness -- .js would fail at runtime. No scope creep.

## Issues Encountered
- Docker not available locally to test full image build. Verified compilation approach with local tsc instead.
- Terraform not installed locally to run `terraform fmt -check`. HCL formatting follows consistent indentation manually.

## User Setup Required

The plan's frontmatter documents required user setup. Before first `terraform apply`:
1. Create GCS bucket for Terraform state: `gcloud storage buckets create gs://flashnote-terraform-state --location=us-central1 --uniform-bucket-level-access --versioning`
2. Enable required GCP APIs: `gcloud services enable cloudresourcemanager.googleapis.com iam.googleapis.com --project=flashnote-staging`
3. Replace `OWNER_PLACEHOLDER` and `OWNER_ID_PLACEHOLDER` in staging.tfvars and production.tfvars with actual GitHub values
4. After production Terraform creates the runtime SA, re-apply staging with `prod_runtime_sa_email` set

## Next Phase Readiness
- Plan 03-02 (deploy workflow rewrite) can proceed -- all IAM and infrastructure Terraform is in place
- Plan 03-03 (Cloud Run service/job + load balancer) can proceed -- variables.tf includes all Cloud Run variables it will need
- All 9 required GCP APIs are declared for enablement
- Cross-project Artifact Registry access pattern documented and implemented

## Self-Check: PASSED

All 12 created/modified files verified present on disk. Both task commits (45817dd, 7e27ea6) verified in git history.

---
*Phase: 03-pipeline-provisioning*
*Completed: 2026-03-19*
