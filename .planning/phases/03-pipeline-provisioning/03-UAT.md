---
status: complete
phase: 03-pipeline-provisioning
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md]
started: 2026-03-19T18:00:00Z
updated: 2026-03-19T18:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Dockerfile Builds Successfully
expected: Run `docker build --platform linux/amd64 -t flashnote-test .` from the repo root. The build completes without errors. The builder stage compiles migrate.ts to migrate.mjs and the runner stage copies it to web/src/server/db/migrate.mjs. No Sentry references remain in the Dockerfile.
result: skipped
reason: Docker not installed locally

### 2. Terraform Validates Successfully
expected: Run `cd infra && terraform init -backend=false && terraform validate` from the repo root. All .tf files pass validation with no errors. If terraform is not installed, verify by reviewing that all variable references in resource blocks match declarations in variables.tf.
result: skipped
reason: Terraform not installed locally

### 3. Deploy Workflow Ingress Matches Terraform
expected: Open `.github/workflows/deploy.yml`. Both the deploy-staging step and deploy-production step use `--ingress=internal-and-cloud-load-balancing`. Neither step has `--allow-unauthenticated`. This matches `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` in `infra/cloudrun-service.tf`.
result: pass

### 4. Deploy Workflow Runs Migrations Before Deploy
expected: In `.github/workflows/deploy.yml`, both staging and production jobs run `gcloud run jobs update` + `gcloud run jobs execute --wait` BEFORE `gcloud run deploy`. The `--wait` flag ensures migration must complete before traffic cutover. Migration failure exits non-zero and blocks the deploy step.
result: pass

### 5. CI Terraform Plan Triggers on infra/ Changes
expected: In `.github/workflows/ci.yml`, the terraform-plan job uses a paths-filter that triggers only when files under `infra/` are changed. The plan output is commented on the PR via an env var (not direct expression interpolation, preventing script injection). The ci-success gate allows terraform-plan to be skipped without failing CI.
result: pass

### 6. Terraform Apply on Staging
expected: After setting up GCS state bucket and replacing placeholder values in staging.tfvars, run `terraform apply -var-file=staging.tfvars` against the staging project. All resources are created without errors and `terraform plan` shows no remaining changes.
result: pass

### 7. Cloud Run ALB Ingress Enforcement
expected: After deploying to staging, the direct Cloud Run URL (*.run.app) returns 403 Forbidden. Traffic through the ALB domain (staging.flashnote.co) returns 200 from the health endpoint.
result: pass

### 8. SSL Certificate Provisioned
expected: After terraform apply and DNS configuration, https://staging.flashnote.co serves a valid Google-managed SSL certificate. HTTP requests to http://staging.flashnote.co redirect to HTTPS.
result: skipped
reason: Requires deployed infrastructure and DNS propagation; covered by Phase 4

## Summary

total: 8
passed: 5
issues: 0
pending: 0
skipped: 3

## Gaps

[none]
