# Launch Checklist

Engineering and ops gates that must be true before FlashNote handles real users, real payments, or real PHI. Deployment is deferred (see [ROADMAP.md](./ROADMAP.md#deferred-deployment-track)); this list is for when it resumes.

Business formation, insurance, tax, and marketing tasks are not tracked in this repo.

## Infrastructure (Terraform in `infra/`)

The Terraform is written. Nothing in the repo shows it has been applied (both tfvars files still contain placeholders), and the app has not been deployed.

- [ ] Replace `OWNER_PLACEHOLDER` / `OWNER_ID_PLACEHOLDER` in `infra/staging.tfvars` and `infra/production.tfvars`
- [ ] Apply staging Terraform, then production
- [ ] Populate Secret Manager values (secret names in `infra/secrets.tf`)
- [ ] Set `cloudrun_min_instances = 1` in `infra/production.tfvars` before real traffic (currently `0`)
- [ ] Re-enable the Deploy workflow in GitHub (currently `disabled_manually`). `.github/workflows/deploy.yml` deploys on every green CI run on `main`.
- [ ] Point DNS at the load balancer (`manage_dns = false` by default; DNS is managed outside Terraform)
- [ ] Test a Cloud SQL backup restore (backups are configured in `infra/database.tf`: 30 retained)

## Verification in staging

- [ ] Pino logs appear in Cloud Logging and errors group in Cloud Error Reporting
- [ ] Note generation works through Vertex AI with ADC (not an API key)
- [ ] Register → verify email → log in → generate → save → log out
- [ ] Stripe checkout (test mode) → webhook → subscription active → generation unlocked
- [ ] TLS 1.2+ only at the load balancer (check with SSL Labs)
- [ ] OWASP ZAP baseline scan against staging
- [ ] No PHI in logs: generate a note with synthetic patient data and search the logs for it

## Operations

- [ ] Cloud Logging sink exporting audit entries to Cloud Storage with 6-year locked retention
- [ ] Alert policies: error spikes, auth failures, webhook failures
- [ ] External uptime monitor
- [ ] Schedule `/api/cleanup/webhook-events` (Cloud Scheduler; `CLEANUP_SECRET` is already wired). Nothing calls it today.
- [ ] Decide on session and email-token cleanup: `cleanupExpiredSessions` (`web/src/server/dal/sessions.ts`) and `cleanupExpiredTokens` (`web/src/server/services/token.ts`) exist, but nothing calls them

## Payments

- [ ] Stripe live mode: products/prices, customer portal, production webhook endpoint `https://<domain>/api/webhooks/stripe`
- [ ] Failed-payment email to the customer (the `invoice.payment_failed` handler currently sends none)
- [ ] One real $1 charge, verified end to end, then refunded

## Legal and compliance

- [ ] Attorney review of `docs/legal/` drafts (Terms, Privacy, BAA). They still contain `[DATE]`-style placeholders.
- [ ] Replace the "PENDING LEGAL REVIEW" stubs at `/terms`, `/privacy`, and `/baa` with the final text
- [ ] Update the legal drafts for stored PHI. They were written for the earlier pass-through model.
- [ ] Legal document re-acceptance flow when a document version changes (not built)
- [ ] Google Cloud BAA in place, covering Cloud Run, Cloud SQL, and Vertex AI. It was recorded as signed in Feb 2026; that can't be verified from the repo.
- [ ] Review [compliance/INCIDENT_RESPONSE_PLAN.md](./compliance/INCIDENT_RESPONSE_PLAN.md) against the deployed system

## Launch gate

- [ ] Production stable for 48 hours with no unexplained errors
- [ ] Support email working
