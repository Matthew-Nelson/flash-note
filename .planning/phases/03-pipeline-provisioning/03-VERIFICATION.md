---
phase: 03-pipeline-provisioning
verified: 2026-03-19T17:30:00Z
status: passed
score: 11/11 truths verified
re_verification: false
gaps: []
human_verification:
  - test: "After ingress fix: confirm direct Cloud Run URL access is blocked"
    expected: "https://<service-url>.run.app/api/health returns 403 Forbidden; traffic through ALB URL returns 200"
    why_human: "Requires deployed GCP infrastructure to verify the ALB-only enforcement is active"
  - test: "End-to-end terraform apply on staging"
    expected: "terraform apply -var-file=staging.tfvars completes without error and all resources are created"
    why_human: "Terraform apply requires live GCP project credentials and cannot be verified programmatically in this environment"
  - test: "Google-managed SSL certificate provisioning"
    expected: "HTTPS request to staging.flashnote.co returns a valid certificate and 200 from Cloud Run"
    why_human: "Requires DNS propagation and GCP certificate provisioning, both external runtime dependencies"
---

# Phase 3: Pipeline Provisioning Verification Report

**Phase Goal:** The deploy pipeline is hardened for safe production deployments and all GCP infrastructure is provisioned and configured
**Verified:** 2026-03-19T17:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | Database migrations run automatically before traffic cutover during deployment | VERIFIED | deploy.yml lines 72-81 and 121-130: `gcloud run jobs update` + `gcloud run jobs execute --wait` before every `gcloud run deploy` in both environments. Migration failure exits non-zero, blocking the deploy step. |
| 2  | The health endpoint probes actual database connectivity | VERIFIED | `web/src/app/api/health/route.ts` calls `checkDbHealth()`. `web/src/server/dal/health.ts` runs `db.query('SELECT 1')` with a 3-second timeout. Returns `{ status: 'degraded', db: 'unreachable' }` on failure. |
| 3  | All required GCP APIs are declared for enablement in Terraform | VERIFIED | `infra/apis.tf` enables 9 APIs via `for_each`: run, sqladmin, secretmanager, artifactregistry, aiplatform, iam, iamcredentials, compute, certificatemanager. |
| 4  | Cloud SQL is configured with encryption at rest, ssl_mode, and automatic backups | VERIFIED | `infra/database.tf`: `ssl_mode = "ENCRYPTED_ONLY"` (modern replacement for deprecated `require_ssl`), `backup_configuration.enabled = true`, `point_in_time_recovery_enabled = true`, 30-day retention. Encryption at rest is Google-managed default. |
| 5  | All 9 runtime secrets have Secret Manager shell resources defined | VERIFIED | `infra/secrets.tf`: `for_each = local.secrets` over 9 secret IDs. IAM per-secret bindings in `infra/iam.tf` via `google_secret_manager_secret_iam_member`. |
| 6  | WIF pool and provider are configured for GitHub Actions OIDC | VERIFIED | `infra/iam.tf`: `google_iam_workload_identity_pool.github_actions` and `google_iam_workload_identity_pool_provider.github_provider` with `issuer_uri = "https://token.actions.githubusercontent.com"` and numeric `attribute_condition` on `repository_owner_id`. |
| 7  | Cloud Run runtime service account has roles/secretmanager.secretAccessor and roles/aiplatform.user | VERIFIED | `infra/iam.tf`: `google_project_iam_member.runtime_aiplatform` (roles/aiplatform.user), `google_secret_manager_secret_iam_member.runtime_secret_access` per-secret for all 9 secrets (roles/secretmanager.secretAccessor). |
| 8  | Production Cloud Run runtime SA has roles/artifactregistry.reader on the staging Artifact Registry | VERIFIED | `infra/iam.tf`: `google_artifact_registry_repository_iam_member.prod_pull_from_staging` gated on `var.prod_runtime_sa_email != ""`. Applied from staging config to avoid cross-project provider complexity. Empty placeholder in `staging.tfvars` until production SA is created. |
| 9  | Dockerfile no longer references Sentry build args or env vars | VERIFIED | No Sentry references in Dockerfile. The ARG NEXT_PUBLIC_SENTRY_DSN, ENV NEXT_PUBLIC_SENTRY_DSN, and ENV SENTRY_SUPPRESS_TURBOPACK_WARNING lines are gone. No Sentry references in deploy.yml either. |
| 10 | Dockerfile compiles migrate.ts to migrate.mjs in the builder stage and copies the compiled output to the runner | VERIFIED | Dockerfile lines 22-27: `npx tsc` with `--module es2022 --moduleResolution node` outputs to `/tmp/migrate-build/migrate.js` then `cp` renames to `migrate.mjs`. Runner stage line 42: `COPY --from=builder /app/web/src/server/db/migrate.mjs`. cloudrun-job.tf uses `args = ["web/src/server/db/migrate.mjs"]` matching the actual output path. |
| 11 | Deploy workflow enforces internal-load-balancer ingress matching Terraform configuration | VERIFIED | deploy.yml uses `--ingress=internal-and-cloud-load-balancing` in both staging and production deploy steps, matching `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` in cloudrun-service.tf. `--allow-unauthenticated` removed. |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `infra/main.tf` | Terraform provider config, GCS backend, locals | VERIFIED | GCS backend with CLI-injected config, google + random providers, staging alias, locals block |
| `infra/variables.tf` | All input variable declarations | VERIFIED | 14 variables covering all Plan 01 + Plan 03 needs including `manage_dns`, `prod_runtime_sa_email` |
| `infra/apis.tf` | GCP API enablement resources | VERIFIED | 9 APIs via `for_each` over `local.required_apis` |
| `infra/iam.tf` | Service accounts, IAM bindings, WIF pool/provider, cross-project registry access | VERIFIED | Both SAs, all role bindings, WIF pool/provider with numeric owner_id condition, conditional cross-project AR binding |
| `infra/database.tf` | Cloud SQL instance, database, user | VERIFIED | POSTGRES_15, ssl_mode=ENCRYPTED_ONLY, PITR, 30-day backups, random_password with ignore_changes |
| `infra/secrets.tf` | Secret Manager secret shells for all 9 runtime secrets | VERIFIED | 9 secrets via for_each, auto-generated DATABASE_URL secret version with socket path format |
| `infra/registry.tf` | Artifact Registry Docker repository | VERIFIED | format=DOCKER, depends_on AR API |
| `infra/staging.tfvars` | Staging environment variable values | VERIFIED | flashnote-staging, db-f1-micro, ZONAL, max 5 instances, manage_dns=false |
| `infra/production.tfvars` | Production environment variable values | VERIFIED | flashnote-prod, db-custom-1-3840, REGIONAL, max 10 instances, manage_dns=false |
| `Dockerfile` | Multi-stage build without Sentry references, with compiled migrate.mjs | VERIFIED | 48 lines, 3 stages, no Sentry, tsc compilation to migrate.mjs, COPY to runner |
| `infra/cloudrun-service.tf` | Cloud Run v2 service with secret mounts, Cloud SQL sidecar, env vars | VERIFIED | 9 secret_key_ref mounts, cloudsql volume, INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER, 8 non-secret env vars |
| `infra/cloudrun-job.tf` | Cloud Run v2 migration job with DATABASE_URL secret mount and node migrate.mjs entrypoint | VERIFIED | timeout=300s, max_retries=0, command=node args=migrate.mjs, DATABASE_URL only, cloudsql sidecar |
| `infra/loadbalancer.tf` | Global External ALB with serverless NEG, managed SSL, HTTP redirect | VERIFIED | Complete chain: global IP, NEG, backend, URL map, SSL cert, HTTPS proxy/forwarding, HTTP redirect chain |
| `infra/dns.tf` | DNS zone and records pointing domain to ALB IP | VERIFIED | Conditional (manage_dns=false default), A record using ALB IP output |
| `.github/workflows/deploy.yml` | Full deploy pipeline with staging/production split, migration job | VERIFIED | 3-job pipeline, migration with --wait, DEPLOY_VERSION, Sentry removed, ingress=internal-and-cloud-load-balancing matches Terraform |
| `.github/workflows/ci.yml` | CI pipeline with terraform plan job for infra/ changes | VERIFIED | terraform-plan job with paths-filter, WIF auth, plan output PR comment via env var (injection-safe), ci-success skip-tolerant gate |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `infra/iam.tf` | `infra/secrets.tf` | `roles/secretmanager.secretAccessor` per-secret IAM | WIRED | `google_secret_manager_secret_iam_member.runtime_secret_access` iterates `local.secrets` (defined in secrets.tf), granting access to each `google_secret_manager_secret.app[each.key]` |
| `infra/iam.tf` | `infra/database.tf` | `roles/cloudsql.client` on runtime SA | WIRED | `google_project_iam_member.runtime_cloudsql` |
| `infra/iam.tf` | Vertex AI | `roles/aiplatform.user` on runtime SA | WIRED | `google_project_iam_member.runtime_aiplatform` |
| `infra/iam.tf` | `infra/registry.tf` | `roles/artifactregistry.reader` for prod runtime SA on staging registry | WIRED | `google_artifact_registry_repository_iam_member.prod_pull_from_staging` references `google_artifact_registry_repository.flashnote.repository_id` |
| `infra/apis.tf` | all other infra/*.tf | `depends_on` API enablement before resource creation | WIRED | All resource blocks in iam.tf, database.tf, secrets.tf, registry.tf, cloudrun-*.tf, loadbalancer.tf use `depends_on = [google_project_service.apis["..."]` |
| Dockerfile (builder stage) | Dockerfile (runner stage) | Compiled migrate.mjs copied from builder to runner | WIRED | Line 42: `COPY --from=builder /app/web/src/server/db/migrate.mjs ./web/src/server/db/migrate.mjs` |
| `infra/cloudrun-service.tf` | `infra/secrets.tf` | `secret_key_ref` for all 9 secrets | WIRED | 9 `value_source.secret_key_ref` blocks, each referencing `google_secret_manager_secret.app["<key>"].secret_id` |
| `infra/cloudrun-service.tf` | `infra/database.tf` | Cloud SQL Auth Proxy sidecar volume | WIRED | `cloud_sql_instance { instances = [google_sql_database_instance.main.connection_name] }` |
| `infra/cloudrun-job.tf` | `infra/secrets.tf` | DATABASE_URL secret mount on migration job | WIRED | `secret_key_ref { secret = google_secret_manager_secret.app["database-url"].secret_id }` |
| `infra/cloudrun-job.tf` | Dockerfile (Plan 01) | Job command matches compiled output path | WIRED | `args = ["web/src/server/db/migrate.mjs"]` matches Dockerfile COPY destination |
| `infra/loadbalancer.tf` | `infra/cloudrun-service.tf` | Serverless NEG pointing to Cloud Run service | WIRED | `cloud_run { service = google_cloud_run_v2_service.flashnote.name }` |
| `infra/dns.tf` | `infra/loadbalancer.tf` | A record pointing domain to ALB global IP | WIRED | `rrdatas = [google_compute_global_address.default.address]` |
| `.github/workflows/deploy.yml` | Cloud Run migration job | `gcloud run jobs execute --wait` | WIRED | Both deploy-staging and deploy-production run `gcloud run jobs update` + `execute --wait` before `gcloud run deploy` |
| `.github/workflows/deploy.yml` | Cloud Run service | `DEPLOY_VERSION` set to commit SHA | WIRED | `DEPLOY_VERSION=${{ needs.build.outputs.image_tag }}` in --set-env-vars for both environments |
| `.github/workflows/deploy.yml` | Cloud Run service | Ingress matches Terraform INTERNAL_LOAD_BALANCER setting | WIRED | `--ingress=internal-and-cloud-load-balancing` in both deploy steps matches `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` in cloudrun-service.tf |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| INFRA-01 | 03-02, 03-03 | Deploy pipeline runs DB migrations before traffic cutover | SATISFIED | `gcloud run jobs execute --wait` before `gcloud run deploy` in both environments; migration job defined in `infra/cloudrun-job.tf` with 0 retries, 5-minute timeout |
| INFRA-02 | 03-02 | `/api/health` probes DB connectivity | SATISFIED | `web/src/server/dal/health.ts` runs `SELECT 1` with 3-second timeout, returns `{ status: 'degraded' }` on failure |
| INFRA-03 | 03-01 | GCP project provisioned with all required APIs enabled | SATISFIED | `infra/apis.tf` enables Cloud Run, Cloud SQL, Artifact Registry, Vertex AI, Secret Manager, IAM, compute, certificatemanager APIs |
| INFRA-04 | 03-01 | LLM service account configured with `roles/aiplatform.user` | SATISFIED | `infra/iam.tf:26-32`: `google_project_iam_member.runtime_aiplatform` grants roles/aiplatform.user to cloudrun_runtime SA |
| INFRA-05 | 03-01 | Cloud SQL provisioned with encryption at rest, ssl enforcement, automatic backups | SATISFIED | `infra/database.tf`: `ssl_mode = "ENCRYPTED_ONLY"` (modern equivalent of deprecated `require_ssl`), `backup_configuration.enabled = true`, `point_in_time_recovery_enabled = true`, Google-managed encryption at rest |
| INFRA-06 | 03-01, 03-03 | Runtime secrets stored in Secret Manager with Cloud Run mounts | SATISFIED | 9 shells in `infra/secrets.tf`, all 9 mounted via `secret_key_ref` in `infra/cloudrun-service.tf` |
| INFRA-07 | 03-01 | Workload Identity Federation configured for keyless GitHub Actions auth | SATISFIED | `infra/iam.tf`: WIF pool + provider with OIDC issuer, numeric owner_id attribute_condition, serviceAccountUser grant to WIF principal |
| INFRA-08 | 03-03 | Custom domain with SSL configured on Cloud Run | SATISFIED | `infra/loadbalancer.tf`: Google-managed SSL cert, ALB chain, HTTP-to-HTTPS redirect. `infra/cloudrun-service.tf`: ingress=INTERNAL_LOAD_BALANCER. `deploy.yml` uses `--ingress=internal-and-cloud-load-balancing` in both environments, consistent with Terraform. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
None found.

### Human Verification Required

#### 1. Ingress Enforcement After Fix

**Test:** After updating deploy.yml to use `--ingress=internal-and-cloud-load-balancing`, deploy to staging and attempt to access the direct Cloud Run service URL (the `.run.app` URL).
**Expected:** The direct Cloud Run URL returns 403 Forbidden; the ALB domain (staging.flashnote.co) returns 200.
**Why human:** Requires a live GCP environment. Cannot verify network topology programmatically.

#### 2. Terraform Apply Correctness

**Test:** Run `terraform init -backend-config="bucket=flashnote-terraform-state" -backend-config="prefix=staging" && terraform apply -var-file=staging.tfvars` against the staging project.
**Expected:** All resources are created without errors. `terraform plan` shows no remaining changes.
**Why human:** Requires live GCP project with Terraform state bucket and API credentials. Cannot verify against a real GCP project programmatically here.

#### 3. SSL Certificate Provisioning

**Test:** After terraform apply and DNS configuration, wait for certificate to provision and access https://staging.flashnote.co.
**Expected:** Valid SSL certificate, 200 response from the health endpoint.
**Why human:** Requires DNS propagation and GCP's certificate provisioning (15-30 minutes), both external runtime dependencies.

### Gaps Summary

No gaps. All 11 truths verified, all 8 requirements satisfied, all artifacts present and correctly wired.

The ingress gap identified in initial verification (deploy.yml using `--ingress=all` overriding Terraform's `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER`) was fixed inline before phase completion.

---

_Verified: 2026-03-19T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
