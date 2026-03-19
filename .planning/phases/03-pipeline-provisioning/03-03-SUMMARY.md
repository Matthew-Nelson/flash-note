---
phase: 03-pipeline-provisioning
plan: 03
subsystem: infra
tags: [terraform, gcp, cloud-run, load-balancer, ssl, dns, secret-manager]

# Dependency graph
requires:
  - phase: 03-pipeline-provisioning
    plan: 01
    provides: Terraform foundation (secrets.tf, database.tf, iam.tf, apis.tf, variables.tf)
provides:
  - Cloud Run v2 service with all 9 secrets mounted and Cloud SQL Auth Proxy sidecar
  - Cloud Run v2 migration job with DATABASE_URL-only secret mount and 5min timeout
  - Global External ALB with serverless NEG, managed SSL, HTTP-to-HTTPS redirect
  - Optional Terraform-managed DNS (gated by manage_dns variable)
  - load_balancer_ip output for manual DNS configuration
affects: [04-staging-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: [Global External ALB with serverless NEG for Cloud Run, conditional DNS via count variable, lifecycle ignore for deploy-managed image]

key-files:
  created:
    - infra/cloudrun-service.tf
    - infra/cloudrun-job.tf
    - infra/loadbalancer.tf
    - infra/dns.tf
  modified:
    - infra/staging.tfvars
    - infra/production.tfvars

key-decisions:
  - "Migration job entrypoint uses migrate.mjs (not .js) matching Plan 01 Dockerfile deviation"
  - "DNS managed externally by default (manage_dns=false) -- set true only if using Google Cloud DNS"
  - "Cloud Run ingress locked to INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER forcing all traffic through ALB"

patterns-established:
  - "lifecycle ignore_changes for container image on Cloud Run service and job (deploy workflow manages image)"
  - "Conditional resource creation via count = var.manage_dns ? 1 : 0 pattern for optional infrastructure"
  - "ALB chain: Global IP -> Forwarding Rule -> HTTPS Proxy -> URL Map -> Backend Service -> NEG -> Cloud Run"

requirements-completed: [INFRA-01, INFRA-06, INFRA-08]

# Metrics
duration: 2min
completed: 2026-03-19
---

# Phase 3 Plan 03: Cloud Run + ALB Summary

**Cloud Run v2 service with 9 Secret Manager mounts and Auth Proxy sidecar, migration job with 5min timeout and 0 retries, Global External ALB with managed SSL and HTTP-to-HTTPS redirect**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T16:46:44Z
- **Completed:** 2026-03-19T16:49:39Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Cloud Run v2 service with all 9 secrets from Secret Manager, 8 non-secret env vars, Cloud SQL Auth Proxy sidecar, and ingress locked to ALB only
- Cloud Run v2 migration job with DATABASE_URL-only mount, 5-minute timeout, 0 retries, and `node web/src/server/db/migrate.mjs` entrypoint
- Complete Global External ALB stack: static IP, serverless NEG, backend service, URL map, Google-managed SSL cert, HTTPS proxy/forwarding, and HTTP-to-HTTPS redirect
- Optional Terraform-managed DNS with conditional resource creation

## Task Commits

Each task was committed atomically:

1. **Task 1: Cloud Run service and migration job** - `d685625` (feat)
2. **Task 2: Global External ALB and DNS** - `1579a70` (feat)

## Files Created/Modified
- `infra/cloudrun-service.tf` - Cloud Run v2 service with secret mounts, env vars, probes, Auth Proxy sidecar
- `infra/cloudrun-job.tf` - Cloud Run v2 migration job with DATABASE_URL mount and migrate.mjs entrypoint
- `infra/loadbalancer.tf` - Global External ALB: static IP, NEG, backend, URL map, SSL cert, HTTPS proxy, HTTP redirect
- `infra/dns.tf` - Optional DNS zone and A record (gated by manage_dns variable)
- `infra/staging.tfvars` - Added manage_dns = false
- `infra/production.tfvars` - Added manage_dns = false

## Decisions Made

1. **Migration entrypoint uses .mjs not .js** -- Plan 01 compiled migrate.ts to migrate.mjs (ESM module) due to missing `"type": "module"` in package.json. The Cloud Run job entrypoint must match: `node web/src/server/db/migrate.mjs`.

2. **DNS managed externally by default** -- Set `manage_dns = false` in both tfvars files since DNS provider is not yet determined. The `load_balancer_ip` output provides the IP for manual A record creation.

3. **Ingress locked to internal-load-balancer** -- Cloud Run service only accepts traffic from the ALB. Direct Cloud Run URL access is blocked, forcing all traffic through HTTPS with the managed SSL certificate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migration job entrypoint corrected from migrate.js to migrate.mjs**
- **Found during:** Task 1
- **Issue:** The plan specified `args = ["web/src/server/db/migrate.js"]` but Plan 01's Dockerfile compiles migrate.ts to migrate.mjs (ESM output for Node.js compatibility without `"type": "module"` in package.json). Using .js would fail at runtime with a syntax error.
- **Fix:** Changed args to `["web/src/server/db/migrate.mjs"]` matching the actual compiled output path in the Docker image.
- **Files modified:** infra/cloudrun-job.tf
- **Verification:** Confirmed Dockerfile line 42 copies to `web/src/server/db/migrate.mjs`
- **Committed in:** d685625 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for correctness -- .js would fail at runtime. No scope creep.

## Issues Encountered
- Terraform not installed locally; could not run `terraform fmt -check`. HCL formatting follows consistent 2-space indentation manually.

## User Setup Required

Before first `terraform apply` (in addition to Plan 01 setup):
1. After `terraform apply`, note the `load_balancer_ip` output
2. Create an A record pointing your domain to the `load_balancer_ip` (either manually at your DNS provider, or set `manage_dns = true` in tfvars if using Google Cloud DNS)
3. Wait for Google-managed SSL certificate provisioning (can take up to 24 hours, typically 15-30 minutes once DNS propagates)

## Next Phase Readiness
- Phase 3 is now complete -- all 3 plans (Terraform foundation, deploy workflow, Cloud Run + ALB) are done
- Phase 4 (staging verification) can proceed once infrastructure is applied and DNS is configured
- All INFRA requirements (01-08) are satisfied across the 3 plans

## Self-Check: PASSED

All 6 created/modified files verified present on disk. Both task commits (d685625, 1579a70) verified in git history.

---
*Phase: 03-pipeline-provisioning*
*Completed: 2026-03-19*
