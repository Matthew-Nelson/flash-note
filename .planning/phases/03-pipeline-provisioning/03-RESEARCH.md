# Phase 3: Pipeline & Provisioning - Research

**Researched:** 2026-03-19
**Domain:** GCP infrastructure provisioning (Terraform), CI/CD pipeline hardening (GitHub Actions), Cloud Run deployment
**Confidence:** HIGH

## Summary

This phase provisions all GCP infrastructure via Terraform and hardens the deploy pipeline with automated migrations, environment promotion, and secret management. The core technology stack is Terraform (~v1.14) with the `hashicorp/google` provider (~v7.24) managing Cloud Run, Cloud SQL, Secret Manager, Artifact Registry, Vertex AI, Workload Identity Federation, and a Global External Application Load Balancer for custom domain SSL.

The existing deploy.yml provides a working WIF auth pattern and Docker build/push flow that should be preserved during the rewrite. The health endpoint already probes DB connectivity with a timeout -- INFRA-02 is partially satisfied but needs review. The migration runner (`web/src/server/db/migrate.ts`) already has advisory locking and transactional execution -- it just needs to be invoked as a Cloud Run job in the deploy pipeline.

**Primary recommendation:** Use a flat Terraform structure in `infra/` with `staging.tfvars` and `production.tfvars`, provision all GCP resources declaratively, rewrite `deploy.yml` to a staging/production split with migration job execution before traffic cutover, and use a Global External Application Load Balancer (not Cloud Run domain mapping) for custom domain SSL.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Terraform (not OpenTofu) for all GCP resource provisioning
- State stored in a GCS bucket with state locking
- CI-automated: terraform plan on PR (comments diff for review), terraform apply on merge to main
- Single infra/ directory with shared .tf files; environment differences via staging.tfvars and production.tfvars
- Terraform plan step added to ci.yml when infra/ files change
- Cloud Run job runs migrations using the same Docker image as the app
- Deploy flow: build image -> run migration Cloud Run job -> wait for success -> deploy new Cloud Run revision
- Forward-only migrations (no down migrations) -- rollbacks are new forward migrations
- Migrations must be backward-compatible with the currently-running app version
- On migration failure: block the deploy, keep old Cloud Run revision serving traffic
- Separate GCP projects: flashnote-staging and flashnote-prod (full resource isolation)
- Single Terraform config with per-environment tfvars files
- staging.flashnote.co subdomain for staging, flashnote.co for production
- Full rewrite of deploy.yml -- remove Sentry references, add migration job step, split staging/production, wire DEPLOY_VERSION
- Dockerfile cleaned up: remove NEXT_PUBLIC_SENTRY_DSN build arg and SENTRY_SUPPRESS_TURBOPACK_WARNING env var
- Auto-deploy to staging on every merge to main
- Production deploy requires GitHub environment approval gate
- DEPLOY_VERSION env var set during build/deploy

### Claude's Discretion
- Terraform module structure and resource organization within infra/
- Cloud SQL instance sizing for staging vs production
- Exact GitHub Actions workflow job structure and step ordering
- Health endpoint changes needed (if any) to satisfy INFRA-02
- GCS bucket configuration for Terraform state (versioning, lifecycle)
- Cloud Run job configuration details (timeout, retries, service account)
- Secret Manager secret names and mounting strategy (env vars vs volume mounts)
- WIF pool/provider naming conventions

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Deploy pipeline runs DB migrations before traffic cutover | Cloud Run job with `--wait` flag in deploy workflow; existing `migrate.ts` script with advisory locking |
| INFRA-02 | `/api/health` probes DB connectivity | Already implemented in `web/src/app/api/health/route.ts` + `web/src/server/dal/health.ts` -- returns `ok`/`degraded` with 3s timeout. Always returns 200 (Cloud Run probe compatible). May need no changes. |
| INFRA-03 | GCP project provisioned with Cloud Run, Cloud SQL, Artifact Registry, Vertex AI APIs enabled | Terraform `google_project_service` resource for each API |
| INFRA-04 | LLM service account configured with `roles/aiplatform.user` for Vertex AI ADC | Terraform IAM binding on Cloud Run runtime service account |
| INFRA-05 | Cloud SQL provisioned with encryption at rest, `require_ssl = true`, automatic backups | Terraform `google_sql_database_instance` with `ssl_mode`, `backup_configuration`, default Google-managed encryption |
| INFRA-06 | Runtime secrets stored in Secret Manager | Terraform `google_secret_manager_secret` + Cloud Run env var references via `secret_key_ref` |
| INFRA-07 | Workload Identity Federation configured for keyless GitHub Actions auth | Terraform `google_iam_workload_identity_pool` + provider + service account impersonation |
| INFRA-08 | Custom domain (flashnote.co) with SSL configured on Cloud Run | Global External Application Load Balancer with serverless NEG + Google-managed SSL certificate |
</phase_requirements>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Terraform | ~1.14.x | Infrastructure as Code | User-locked decision; industry standard for GCP IaC |
| hashicorp/google provider | ~> 7.24 | GCP resource management | Latest stable GA provider with Cloud Run v2 support |
| GitHub Actions | N/A | CI/CD pipeline | Already in use; deploy.yml and ci.yml exist |
| google-github-actions/auth | v2 (upgrade to v3 available) | WIF authentication | Already in use in deploy.yml; v3 is current but v2 works |

### GCP Services
| Service | Purpose | Terraform Resource |
|---------|---------|-------------------|
| Cloud Run v2 (service) | Application hosting | `google_cloud_run_v2_service` |
| Cloud Run v2 (job) | Migration execution | `google_cloud_run_v2_job` |
| Cloud SQL (PostgreSQL) | Database | `google_sql_database_instance` + `google_sql_database` + `google_sql_user` |
| Secret Manager | Runtime secrets | `google_secret_manager_secret` + `google_secret_manager_secret_version` |
| Artifact Registry | Docker image storage | `google_artifact_registry_repository` |
| Workload Identity Federation | Keyless CI/CD auth | `google_iam_workload_identity_pool` + `google_iam_workload_identity_pool_provider` |
| Global External ALB | Custom domain + SSL | `google_compute_global_forwarding_rule` + `google_compute_target_https_proxy` + `google_compute_url_map` + `google_compute_backend_service` + `google_compute_region_network_endpoint_group` + `google_compute_managed_ssl_certificate` |
| Cloud Storage | Terraform state | `google_storage_bucket` (bootstrapped manually) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Global ALB for domain | Cloud Run domain mapping | Domain mapping is preview-only, not production-ready, has latency issues. ALB is recommended by Google for production. |
| Secret Manager env vars | Secret Manager volume mounts | Env vars are simpler for the app (existing Zod validation reads `process.env`); volume mounts support rotation without restart but add complexity. Env vars are the right choice here -- secrets change rarely and restart on deploy anyway. |
| google-github-actions/auth v3 | Keep v2 | v2 works fine in existing workflow. Upgrading to v3 is optional but recommended. |

## Architecture Patterns

### Recommended Terraform Structure
```
infra/
  main.tf              # Provider config, backend config, locals
  variables.tf         # Input variable declarations
  outputs.tf           # Output values (service URLs, connection names)
  apis.tf              # google_project_service resources (API enablement)
  iam.tf               # Service accounts, IAM bindings, WIF pool/provider
  network.tf           # VPC, firewall rules (if needed for Cloud SQL private IP)
  database.tf          # Cloud SQL instance, database, user
  secrets.tf           # Secret Manager secrets (shells only -- values set manually)
  registry.tf          # Artifact Registry repository
  cloudrun-service.tf  # Cloud Run v2 service
  cloudrun-job.tf      # Cloud Run v2 migration job
  loadbalancer.tf      # Global ALB, serverless NEG, SSL cert, HTTP redirect
  dns.tf               # DNS managed zone + records (if managing DNS in Terraform)
  staging.tfvars       # Staging-specific variable values
  production.tfvars    # Production-specific variable values
```

### Pattern 1: Secret Manager Env Var Mounting
**What:** Cloud Run reads secrets from Secret Manager as environment variables at instance startup.
**When to use:** All runtime secrets (DATABASE_URL, STRIPE_SECRET_KEY, etc.)
**Why:** The app already validates env vars via Zod schema in `config.ts`. Secret Manager env vars appear as normal `process.env` values -- zero code changes needed.

```hcl
# In secrets.tf -- create the secret shell (value set via console/gcloud)
resource "google_secret_manager_secret" "database_url" {
  secret_id = "database-url"
  replication {
    auto {}
  }
}

# In cloudrun-service.tf -- mount as env var
resource "google_cloud_run_v2_service" "flashnote" {
  template {
    containers {
      image = var.image
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }
    }
  }
}
```

**Important:** Google recommends pinning to a specific version for env vars (resolved at startup). However, "latest" is acceptable here because:
1. Secret values change rarely (key rotation, not every deploy)
2. Every deploy creates a new Cloud Run revision, which re-resolves "latest"
3. Version pinning would require updating Terraform on every secret rotation

### Pattern 2: Cloud Run Job for Migrations
**What:** A Cloud Run job using the same Docker image as the app, with a different entrypoint that runs `migrate.ts`.
**When to use:** Every deployment, before the new Cloud Run revision receives traffic.

```hcl
resource "google_cloud_run_v2_job" "migrate" {
  name     = "flashnote-migrate"
  location = var.region

  template {
    template {
      containers {
        image   = var.image
        command = ["node"]
        args    = ["web/server.js"]  # Override at execution time
        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.database_url.secret_id
              version = "latest"
            }
          }
        }
      }
      timeout     = "300s"   # 5 minute timeout for migrations
      max_retries = 0        # No retries -- migration failures need manual investigation
      service_account = google_service_account.cloudrun_runtime.email
    }
  }
}
```

**Deploy workflow step:**
```yaml
- name: Run database migrations
  run: |
    gcloud run jobs execute flashnote-migrate \
      --region=${{ secrets.GCP_REGION }} \
      --update-env-vars="DATABASE_URL=${{ steps.db-url.outputs.value }}" \
      --args="npx,tsx,web/src/server/db/migrate.ts" \
      --wait
```

Note: The migration job needs `DATABASE_URL` but does NOT need all other env vars (it creates its own pg.Pool directly from DATABASE_URL, bypassing `config.ts`). The `--wait` flag blocks until the job completes or fails.

### Pattern 3: Cloud SQL Connection via Auth Proxy Sidecar
**What:** Cloud Run automatically provisions a Cloud SQL Auth Proxy sidecar when you declare a `cloud_sql_instance` volume.
**When to use:** Both the Cloud Run service and the migration job.

```hcl
# In the Cloud Run service template
volumes {
  name = "cloudsql"
  cloud_sql_instance {
    instances = [google_sql_database_instance.main.connection_name]
  }
}
```

The Auth Proxy sidecar provides:
- Encrypted tunnel (no application-level SSL needed)
- IAM-based authentication
- Connection via Unix socket at `/cloudsql/{connection_name}`

The app's `DATABASE_URL` in production should use the socket path:
```
postgresql://user:password@/flashnote?host=/cloudsql/project:region:instance
```

### Pattern 4: WIF for Keyless GitHub Actions Auth
**What:** GitHub Actions authenticates to GCP using OIDC tokens -- no long-lived service account keys.
**When to use:** All GitHub Actions workflows that interact with GCP.

```hcl
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-actions"
  display_name              = "GitHub Actions"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  # Security: Use repository_owner_id (numeric) instead of repository_owner (string)
  # to prevent typosquatting/cybersquatting attacks
  attribute_condition = "assertion.repository_owner_id == 'OWNER_ID'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}
```

### Pattern 5: Global External ALB for Custom Domain
**What:** A global HTTPS load balancer with a serverless NEG pointing to Cloud Run, Google-managed SSL certificate, and HTTP-to-HTTPS redirect.
**When to use:** Custom domain mapping (flashnote.co and staging.flashnote.co).

Key resources needed (in order of dependency):
1. `google_compute_region_network_endpoint_group` (serverless NEG -> Cloud Run)
2. `google_compute_backend_service` (backend -> NEG)
3. `google_compute_url_map` (routing)
4. `google_compute_managed_ssl_certificate` (Google-managed cert for domain)
5. `google_compute_target_https_proxy` (HTTPS proxy -> URL map + cert)
6. `google_compute_global_forwarding_rule` (external IP -> HTTPS proxy)
7. HTTP redirect: separate `google_compute_url_map` + `google_compute_target_http_proxy` + forwarding rule

**Important:** Cloud Run ingress must allow traffic from the load balancer. Set `ingress = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"` on the Cloud Run service to block direct access and force all traffic through the ALB.

### Anti-Patterns to Avoid
- **Cloud Run domain mapping for production:** Preview-only, latency issues, not production-ready per Google's own docs.
- **Terraform-managed secret values:** Never put actual secret values in `.tf` files or `.tfvars`. Terraform manages the secret shells; values are set via `gcloud secrets versions add` or the Console.
- **Single GCP project for staging+prod:** User locked separate projects. Full isolation prevents accidental cross-environment access.
- **`require_ssl` in Cloud SQL config:** Deprecated. Use `ssl_mode` instead (`ENCRYPTED_ONLY` or `TRUSTED_CLIENT_CERTIFICATE_REQUIRED`). However, when using Cloud SQL Auth Proxy (which Cloud Run uses automatically), the proxy handles encryption -- `ssl_mode` is defense-in-depth for direct connections.
- **Hardcoded secrets in deploy.yml:** All secrets should come from Secret Manager (GCP-side) or GitHub Secrets (CI-side). Never embed credentials in workflow files.
- **Using `google_cloud_run_service` (v1):** Use `google_cloud_run_v2_service` -- v2 is the current API and supports Cloud SQL volumes natively.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSL certificates | Manual cert provisioning | `google_compute_managed_ssl_certificate` | Google auto-provisions and renews. Manual certs expire and cause outages. |
| Cloud SQL encryption | Application-level encryption | Google-managed encryption at rest (default) | Cloud SQL encrypts all data at rest by default. No configuration needed. |
| Database connection encryption | Application SSL config | Cloud SQL Auth Proxy sidecar | Auth Proxy provides encrypted tunnel automatically via `cloud_sql_instance` volume. |
| Secret rotation | Custom rotation scripts | Secret Manager + redeploy | Secrets change rarely; new Cloud Run revisions re-read "latest" version. |
| WIF token exchange | Manual OIDC implementation | `google-github-actions/auth` action | The action handles the entire OIDC token exchange flow. |
| Load balancer health checks | Custom health check logic | Cloud Run startup/liveness probes | Cloud Run has built-in probe support; existing `/api/health` endpoint works. |
| Terraform state locking | Custom locking mechanism | GCS backend (built-in locking) | GCS backend creates a `.tflock` file automatically. |

## Common Pitfalls

### Pitfall 1: Cloud SQL Auth Proxy DATABASE_URL Format
**What goes wrong:** App uses `postgresql://user:pass@host:5432/db` format but Cloud SQL Auth Proxy uses Unix sockets.
**Why it happens:** Local dev uses TCP; production uses socket path through the Auth Proxy sidecar.
**How to avoid:** The `DATABASE_URL` in Secret Manager for production must use the socket host format: `postgresql://user:password@/flashnote?host=/cloudsql/PROJECT:REGION:INSTANCE`. The existing Zod validation in `config.ts` accepts this format (it only checks the `postgres://` or `postgresql://` prefix).
**Warning signs:** "ECONNREFUSED 127.0.0.1:5432" in Cloud Run logs.

### Pitfall 2: Secret Manager IAM Permissions
**What goes wrong:** Cloud Run service starts but crashes immediately with "permission denied" accessing secrets.
**Why it happens:** The Cloud Run runtime service account doesn't have `roles/secretmanager.secretAccessor` on the specific secrets.
**How to avoid:** Terraform must grant `roles/secretmanager.secretAccessor` to the Cloud Run service account. Grant at the secret level (not project level) for least privilege.
**Warning signs:** Cloud Run revision fails to become healthy; logs show Secret Manager access denied.

### Pitfall 3: API Enablement Timing
**What goes wrong:** Terraform fails with "API not enabled" errors when creating resources.
**Why it happens:** `google_project_service` resources haven't finished propagating when dependent resources are created.
**How to avoid:** Use `depends_on` or set `disable_dependent_services = false` and `disable_on_destroy = false` on API resources. API enablement can take 30-60 seconds to propagate.
**Warning signs:** "googleapi: Error 403: ... has not been used in project ... before or it is disabled" errors.

### Pitfall 4: Terraform State Bucket Bootstrap
**What goes wrong:** Chicken-and-egg: Terraform needs a GCS bucket for state, but the bucket should be managed infrastructure.
**Why it happens:** The state backend must exist before `terraform init`.
**How to avoid:** Bootstrap the state bucket manually (one-time `gcloud` command) before the first `terraform init`. Document this as a prerequisite. Enable versioning and uniform bucket-level access.
**Warning signs:** `terraform init` fails with "bucket not found."

### Pitfall 5: Migration Job Image Reference
**What goes wrong:** Migration job runs with stale image (old code) instead of the newly-built image.
**Why it happens:** The Cloud Run job's image is set in Terraform, not updated per deploy.
**How to avoid:** The deploy workflow must override the job's image at execution time using `--update-containers` or update the job before executing. Use `gcloud run jobs update` with the new image tag, then `gcloud run jobs execute --wait`.
**Warning signs:** Migrations appear to run successfully but don't apply new migration files.

### Pitfall 6: Standalone Output Missing Migration Files
**What goes wrong:** The Docker image's standalone output doesn't include migration SQL files because Next.js standalone only bundles imported modules.
**Why it happens:** `next build` with `output: 'standalone'` traces dependencies from `server.js` entry point. Migration SQL files in `src/server/db/migrations/` are read via `fs.readdirSync`, not imported -- they won't be included.
**How to avoid:** Add a `COPY` step in the Dockerfile to explicitly include migration files in the standalone output directory. Something like: `COPY --from=builder /app/web/src/server/db/migrations ./web/src/server/db/migrations`.
**Warning signs:** Migration job starts but reports "0 migrations to apply" even when new migration files exist.

### Pitfall 7: Cloud Run Connection Pool Sizing
**What goes wrong:** Connection pool exhaustion under autoscaling (multiple Cloud Run instances each running pool of 20).
**Why it happens:** Each Cloud Run instance creates its own pg.Pool with `max: 20`. With 10 max instances, that's up to 200 connections. Cloud SQL instances have connection limits (e.g., `db-f1-micro` has ~25 connections).
**How to avoid:** Size Cloud SQL appropriately for max connections. `db-custom-1-3840` supports ~100 connections. Reduce pool size to 5-10 per instance for staging. This is flagged in STATE.md for Phase 4 validation.
**Warning signs:** "too many connections" or "connection pool timeout" errors under load.

### Pitfall 8: GitHub Environment Approval Gate Scope
**What goes wrong:** The approval gate blocks the entire workflow, including staging deployment.
**Why it happens:** GitHub environment protection rules apply at the job level, not the step level.
**How to avoid:** Structure the workflow with separate jobs: `deploy-staging` (automatic) and `deploy-production` (requires `environment: production` with approval gate). The production job depends on staging job success.
**Warning signs:** Staging deploys waiting for manual approval.

## Code Examples

### Existing Health Endpoint (INFRA-02 -- already satisfied)
Source: `web/src/app/api/health/route.ts`
```typescript
// Already probes DB connectivity with 3-second timeout
// Returns { status: 'ok'|'degraded', db: 'connected'|'unreachable' }
// Always returns 200 (Cloud Run probe compatible)
```

The health endpoint at `web/src/app/api/health/route.ts:1-17` already calls `checkDbHealth()` from the DAL, which runs `SELECT 1` with a 3-second timeout. It returns `{ status: 'ok' }` or `{ status: 'degraded' }` with 200 status. This satisfies INFRA-02 as written. Cloud Run uses this for startup and liveness probes (already configured in the existing deploy.yml at lines 73-74).

### Dockerfile Cleanup (Sentry Removal)
Current state (`Dockerfile:19-22`):
```dockerfile
# REMOVE these lines:
ARG NEXT_PUBLIC_SENTRY_DSN=""
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV SENTRY_SUPPRESS_TURBOPACK_WARNING=1
```

### Deploy Workflow Sentry Removal
Current state (`deploy.yml:40-49`):
```yaml
# REMOVE the Sentry build arg:
# --build-arg "NEXT_PUBLIC_SENTRY_DSN=${{ secrets.NEXT_PUBLIC_SENTRY_DSN }}"
# REMOVE the Sentry TODO comment (lines 40-43)
```

### Logger DEPLOY_VERSION Integration
Source: `web/src/server/lib/logger.ts:58`
```typescript
version: process.env.DEPLOY_VERSION || 'unknown',
```
Already reads `DEPLOY_VERSION`. The deploy workflow just needs to pass it as a build arg or Cloud Run env var:
```yaml
--set-env-vars=DEPLOY_VERSION=${{ github.sha }}
```

### Migration Script Entry Point
Source: `web/src/server/db/migrate.ts`
- Creates its own pg.Pool from `DATABASE_URL` only (doesn't import config.ts)
- Uses `pg_advisory_lock(1)` to prevent concurrent migration runs
- Runs each migration in a transaction with BEGIN/COMMIT/ROLLBACK
- Exits with code 0 (success) or 1 (failure)

Cloud Run job invocation:
```bash
# The migration job uses the app image but overrides the entrypoint
gcloud run jobs update flashnote-migrate \
  --image=$IMAGE:$SHA \
  --region=$REGION

gcloud run jobs execute flashnote-migrate \
  --region=$REGION \
  --wait
```

### Env Var Validation (config.ts)
Source: `web/src/server/db/config.ts:25-151`
The Zod schema validates all env vars at startup. Secrets mounted from Secret Manager appear as normal `process.env` values -- no code changes needed. The schema already handles:
- `DATABASE_URL` (required, must start with `postgres://` or `postgresql://`)
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (optional in dev, enforced in redis.ts for production)
- `RESEND_API_KEY` (optional in dev)
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (required in production)
- `GEMINI_USE_ADC=true` (production uses ADC, not API key)
- `CLEANUP_SECRET` (required in production, min 32 chars)

### Required Secret Manager Secrets
Based on `config.ts` analysis, these secrets need to be in Secret Manager:
1. `DATABASE_URL` -- PostgreSQL connection string (socket format for Cloud SQL Auth Proxy)
2. `UPSTASH_REDIS_REST_URL` -- Upstash Redis URL for rate limiting
3. `UPSTASH_REDIS_REST_TOKEN` -- Upstash Redis auth token
4. `RESEND_API_KEY` -- Resend email service API key
5. `STRIPE_SECRET_KEY` -- Stripe API secret key
6. `STRIPE_WEBHOOK_SECRET` -- Stripe webhook signing secret
7. `STRIPE_PRICE_MONTHLY` -- Stripe monthly price ID
8. `STRIPE_PRICE_ANNUAL` -- Stripe annual price ID
9. `CLEANUP_SECRET` -- Auth token for cleanup webhook endpoint

Non-secret env vars (set directly on Cloud Run, not in Secret Manager):
- `NODE_ENV=production`
- `DEPLOY_VERSION=$SHA`
- `WEB_URL=https://flashnote.co` (or `https://staging.flashnote.co`)
- `LLM_PROVIDER=gemini`
- `GEMINI_USE_ADC=true`
- `GEMINI_API_URL=https://{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{region}/publishers/google`
- `GEMINI_MODEL=gemini-2.5-flash`
- `TRUSTED_PROXY_COUNT=1` (or 2 with ALB in front)
- `REGISTRATION_MODE=invite` (or as configured)

**Important: TRUSTED_PROXY_COUNT** -- With the Global ALB in front of Cloud Run, there are now TWO proxy hops (ALB + Cloud Run's built-in proxy). The value should be `2` in production, not `1`. This affects rate limiting IP extraction.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `google_cloud_run_service` (v1) | `google_cloud_run_v2_service` | Provider ~v5.0 | v2 API has native Cloud SQL volume support, better secret integration |
| `require_ssl` in Cloud SQL | `ssl_mode` parameter | Provider ~v5.x | `require_ssl` is deprecated; `ssl_mode` offers finer control |
| Cloud Run domain mapping | Global External ALB | Always (domain mapping never left preview) | ALB is Google's recommended production approach |
| `google-github-actions/auth@v1` | `google-github-actions/auth@v2` (v3 available) | 2024 | v2 used in existing deploy.yml; v3 runs on Node 24 |
| Service account keys for CI/CD | Workload Identity Federation | 2022+ | Keyless auth eliminates key rotation burden and leak risk |

**Deprecated/outdated:**
- `require_ssl` on Cloud SQL: Use `ssl_mode` instead
- Cloud Run domain mapping for production: Use Global External ALB
- `google_cloud_run_service` (v1 API): Use `google_cloud_run_v2_service`
- Sentry build args in Dockerfile: Removed in Phase 2 (app-side), Phase 3 removes from Docker/deploy artifacts

## Open Questions

1. **TRUSTED_PROXY_COUNT with ALB**
   - What we know: Cloud Run's load balancer appends one hop. The Global ALB adds another.
   - What's unclear: Whether the ALB preserves the existing `x-forwarded-for` chain or rewrites it.
   - Recommendation: Test in staging with a known client IP. Most likely needs `TRUSTED_PROXY_COUNT=2`.

2. **DNS Management Scope**
   - What we know: flashnote.co needs to point to the ALB's IP. staging.flashnote.co needs a separate record.
   - What's unclear: Whether DNS is managed in Terraform (via `google_dns_managed_zone`) or externally (e.g., Cloudflare, registrar DNS).
   - Recommendation: If the domain's nameservers point to Google Cloud DNS, manage records in Terraform. If external, just document the required A/AAAA records as outputs.

3. **Cloud SQL Instance Sizing**
   - What we know: Staging needs minimal resources; production needs enough for connection limits under autoscaling.
   - What's unclear: Expected concurrent user count for launch.
   - Recommendation: Staging: `db-f1-micro` (shared, ~25 connections, cheapest). Production: `db-custom-1-3840` (~100 connections, dedicated). Reduce app pool to `max: 10` and Cloud Run to `max-instances: 5` initially. Revisit in Phase 4.

4. **VPC / Private IP for Cloud SQL**
   - What we know: Cloud SQL Auth Proxy sidecar works with public IP (default). Private IP requires VPC + serverless VPC connector.
   - What's unclear: Whether the security posture requires private IP only.
   - Recommendation: Start with public IP + Auth Proxy (simpler, still encrypted). Private IP adds VPC complexity that can be added later without app changes. The Auth Proxy encrypts all traffic regardless.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4 + React Testing Library v16 + jsdom |
| Config file | `web/vitest.config.ts` |
| Quick run command | `cd web && pnpm test` |
| Full suite command | `cd web && pnpm test:ci` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Migrations run before traffic cutover | manual-only | N/A -- pipeline behavior verified by deploy workflow execution | N/A |
| INFRA-02 | Health endpoint probes DB | unit | `cd web && pnpm test -- --run src/app/api/health/route.test.ts` | No (route.ts in app/ excluded from coverage) |
| INFRA-03 | GCP APIs enabled | manual-only | `terraform plan` validates resource dependencies | N/A |
| INFRA-04 | Vertex AI IAM configured | manual-only | Verified during Phase 4 staging smoke test (INFRA-10) | N/A |
| INFRA-05 | Cloud SQL encryption + SSL + backups | manual-only | `terraform plan` + Cloud Console verification | N/A |
| INFRA-06 | Secrets in Secret Manager | manual-only | Cloud Run startup succeeds with Secret Manager refs | N/A |
| INFRA-07 | WIF configured | manual-only | Deploy workflow authenticates without service account keys | N/A |
| INFRA-08 | Custom domain with SSL | manual-only | `curl -I https://flashnote.co` returns 200 with valid cert | N/A |

### Sampling Rate
- **Per task commit:** `cd web && pnpm test` (if app code changes; most Phase 3 changes are infra/ and .github/)
- **Per wave merge:** `cd web && pnpm test:ci`
- **Phase gate:** Full suite green + `terraform plan` shows no drift + staging deploy succeeds

### Wave 0 Gaps
None -- Phase 3 is primarily infrastructure (Terraform + workflow files). The existing test infrastructure covers the one app-code touchpoint (Dockerfile cleanup, health endpoint). No new test files are required for Wave 0.

## Sources

### Primary (HIGH confidence)
- Google Cloud official docs: [Cloud Run secrets configuration](https://docs.cloud.google.com/run/docs/configuring/services/secrets) -- secret mounting methods, IAM requirements
- Google Cloud official docs: [Cloud Run job secrets](https://docs.cloud.google.com/run/docs/configuring/jobs/secrets) -- job-specific secret configuration
- Google Cloud official docs: [Cloud Run job execution](https://docs.cloud.google.com/run/docs/execute/jobs) -- `--wait` flag, execution overrides
- Google Cloud official docs: [Custom domain mapping](https://docs.google.com/run/docs/mapping-custom-domains) -- confirmed domain mapping is preview-only, ALB recommended
- Google Cloud official docs: [WIF with deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines) -- attribute mapping, security best practices
- Google Cloud official docs: [Cloud Run + Cloud SQL connection](https://docs.cloud.google.com/run/docs/configuring/connect-cloudsql) -- Auth Proxy sidecar, Unix socket format
- Google Cloud official docs: [Load Balancer Terraform examples](https://docs.cloud.google.com/load-balancing/docs/https/ext-http-lb-tf-module-examples) -- serverless NEG + managed SSL
- Codebase: `web/src/app/api/health/route.ts` -- existing health endpoint implementation
- Codebase: `web/src/server/db/migrate.ts` -- existing migration runner with advisory locking
- Codebase: `web/src/server/db/config.ts` -- Zod env var validation schema
- Codebase: `web/src/server/lib/logger.ts` -- DEPLOY_VERSION already wired
- Codebase: `.github/workflows/deploy.yml` -- existing WIF auth pattern
- Codebase: `Dockerfile` -- existing multi-stage build

### Secondary (MEDIUM confidence)
- [Terraform Google provider releases](https://github.com/hashicorp/terraform-provider-google/releases) -- v7.24.0 is latest (March 2026)
- [Terraform GCS backend docs](https://developer.hashicorp.com/terraform/language/backend/gcs) -- state locking is automatic
- [Cloud SQL SSL configuration issue](https://github.com/hashicorp/terraform-provider-google/issues/17443) -- `require_ssl` vs `ssl_mode` conflict
- [google-github-actions/auth](https://github.com/google-github-actions/auth) -- v3 available, v2 still supported

### Tertiary (LOW confidence)
- Terraform provider version v7.24.0 -- confirmed via web search but not verified against registry directly (JS-required page)
- Terraform CLI v1.14.7 -- reported as latest stable, not independently verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All tools are user-locked decisions or Google-recommended approaches verified against official docs
- Architecture: HIGH -- Patterns derived from official Google Cloud documentation and existing codebase analysis
- Pitfalls: HIGH -- Identified from official docs (domain mapping preview status, ssl_mode deprecation), codebase analysis (standalone output bundling, config.ts validation), and project history (STATE.md connection pool concern)
- Domain mapping: HIGH -- Google official docs explicitly state domain mapping is "not recommended for production services"

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (30 days -- GCP services are stable; Terraform provider may have minor updates)
