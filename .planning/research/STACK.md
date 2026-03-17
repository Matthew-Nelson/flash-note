# Technology Stack: Next-Phase Additions

**Project:** FlashNote
**Researched:** 2026-03-16
**Scope:** Libraries and tools needed beyond the existing stack for deployment readiness, PHI storage, E2E testing, accessibility testing, DAST/secret scanning, HIPAA audit retention, and clinic billing.

**Existing stack is not re-evaluated here.** This document covers only net-new additions. For the current stack, see `.planning/codebase/STACK.md`.

---

## Recommended Additions

### Structured Logging

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `pino` | 10.3.1 | Structured JSON logger | Fastest Node.js logger (5-10x faster than Winston). Cloud Run captures stdout automatically. Native JSON output maps directly to Cloud Logging severity levels. Built-in path-based redaction for PHI protection. Child loggers for request-scoped context (trace ID correlation). Already selected in `docs/planning/MONITORING_SETUP.md` -- this research confirms the choice. | HIGH |
| `@google-cloud/pino-logging-gcp-config` | 1.3.3 | GCP Cloud Logging integration | Maps Pino output to Cloud Logging's expected format: severity levels, trace correlation, Error Reporting `@type` field. Maintained by Google Cloud team. Zero transport configuration -- stdout to Cloud Logging is automatic on Cloud Run. | HIGH |
| `pino-pretty` | 13.1.3 | Dev-only human-readable logs | Pretty-prints structured JSON in development. Install as devDependency only -- never shipped to production. | HIGH |

**Next.js 16 configuration required:**

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  serverExternalPackages: ['pino', 'pino-pretty'],
  // ...existing config
};
```

This tells Next.js to treat pino as an external Node.js package rather than bundling it. Required because pino uses `thread-stream` for async I/O which breaks under webpack bundling. Next.js 16.1+ correctly resolves transitive dependencies in `serverExternalPackages` (earlier versions needed explicit `thread-stream` entry).

**Installation:**

```bash
cd web
pnpm add pino @google-cloud/pino-logging-gcp-config
pnpm add -D pino-pretty
```

### E2E Testing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@playwright/test` | 1.58.2 | E2E test runner | Already installed (1.58.1) with config and 12 spec files. Upgrade to 1.58.2 for latest fixes. Playwright is the standard for Next.js E2E testing -- first-party recommendation from Vercel. Supports parallel execution, trace capture on failure, and video recording. | HIGH |

**Note:** Playwright config (`web/playwright.config.ts`) needs updating -- it still references the deleted Express backend in `webServer`. The `webServer` config should start only the Next.js dev server on port 3000.

### Accessibility Testing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@axe-core/playwright` | 4.11.1 | E2E accessibility audits | Standard for Playwright-based accessibility testing. `AxeBuilder` pattern injects axe-core into Playwright pages, runs WCAG audits, returns violations. Integrates directly into existing Playwright spec files -- no separate test runner. 91 npm dependents. Actively maintained (published 1 month ago). | HIGH |
| `@axe-core/react` | 4.11.1 | Dev-time accessibility overlay | Logs accessibility violations to Chrome DevTools console during development whenever a component re-renders. Catches violations before they reach CI. Dev-only -- conditionally loaded behind `NODE_ENV === 'development'` check. | MEDIUM |

**Do NOT use:**
- `vitest-axe` (0.1.0) -- Last published 3+ years ago, effectively unmaintained. Single-person fork of `jest-axe` with no active development.
- `@sa11y/vitest` (8.0.27) -- Salesforce-maintained, actively developed, but the `AxeBuilder` + Playwright approach is superior for FlashNote because: (1) unit-level axe tests on jsdom fragments miss layout-dependent issues (overlapping elements, viewport-dependent visibility, CSS-only focus indicators), (2) E2E axe audits test real rendered pages with actual CSS applied, and (3) FlashNote already has Playwright set up with 12 spec files -- adding `AxeBuilder` assertions to existing specs is lower friction than a separate unit-test-level axe setup.

**Pattern: Embed axe checks in existing Playwright specs rather than creating separate accessibility test files.** This ensures every page that has E2E coverage also has accessibility coverage, and avoids maintaining two parallel test suites for the same pages.

```typescript
// Example: add to existing auth.spec.ts
import AxeBuilder from '@axe-core/playwright';

test('login page is accessible', async ({ page }) => {
  await page.goto('/login');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

**Installation:**

```bash
cd web
pnpm add -D @axe-core/playwright @axe-core/react
```

### Security Scanning

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Gitleaks | 8.x (binary) | Secret scanning in CI | Industry-standard open-source secret scanner (19k GitHub stars, 20M+ Docker pulls). Detects API keys, tokens, passwords in git history. Use the `gitleaks/gitleaks-action@v2` GitHub Action -- no npm dependency needed. Run as a pre-commit hook locally and in CI on every PR. | HIGH |
| OWASP ZAP | latest (Docker) | DAST scanning | Standard for dynamic application security testing. Use `zaproxy/action-baseline@v0.14.0` GitHub Action for baseline scans in CI (5-10 min). Full active scans take 30+ min and should run on a weekly schedule, not on every PR. Targets the running staging app -- no npm dependency needed. | HIGH |

**Do NOT install as npm packages.** Both tools run as Docker containers or GitHub Actions. No application code changes needed.

**Gitleaks CI integration:**

```yaml
# .github/workflows/security.yml
- uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**OWASP ZAP CI integration:**

```yaml
# .github/workflows/security.yml (on schedule or staging deploy)
- uses: zaproxy/action-baseline@v0.14.0
  with:
    target: ${{ env.STAGING_URL }}
    rules_file_name: '.zap/rules.tsv'
    fail_action: true
```

### PHI Storage (Database Layer)

No new npm dependencies required. PHI storage uses the existing stack:

| Technology | Already Installed | Purpose | Notes |
|------------|------------------|---------|-------|
| `pg` | 8.18.0 | PostgreSQL driver | Raw SQL via DAL pattern. New tables (patients, clinical_notes, note_templates, note_template_sections, note_versions) use the same pool/client patterns. |
| `zod` | 3.25.76 | Runtime validation | New Zod schemas for patient CRUD, note content JSONB structure, template sections. |

**Encryption approach: Infrastructure-level only (Cloud SQL default encryption at rest).**

This is the correct approach for Phase 1. Rationale:
- Cloud SQL encrypts all data at rest by default using Google-managed AES-256 keys. This satisfies HIPAA encryption-at-rest requirements.
- CMEK (Customer-Managed Encryption Keys) via Cloud KMS is available but unnecessary for a startup. CMEK adds key rotation management overhead and operational complexity for no security benefit over Google-managed keys when the BAA covers Cloud SQL. Revisit if enterprise customers require CMEK for compliance.
- Application-level encryption (pgcrypto or application-side AES) adds 12-25% query overhead, complicates search/indexing, and moves key management into application code. Not justified when Cloud SQL encryption + DAL access control + audit logging already satisfies HIPAA requirements.
- Row-Level Security (RLS) in PostgreSQL is unnecessary when the DAL is the single access point. RLS is a defense-in-depth measure for environments where multiple applications or users connect directly to the database. FlashNote has one application with one connection pool -- the DAL enforces all access control.

**What protects PHI:**
1. Cloud SQL encryption at rest (default, AES-256)
2. TLS in transit (Cloud SQL enforces `require_ssl`)
3. DAL authorization on every query (`user_id` + `organization_id` scoping)
4. HIPAA audit logging (all PHI access logged)
5. Pino PHI redaction (prevents accidental logging of PHI fields)

### Clinic Billing (Stripe Seat-Based Pricing)

No new npm dependencies. Uses existing `stripe` package (20.3.0, latest is 20.4.1 -- minor upgrade recommended).

| Technology | Already Installed | Purpose | Notes |
|------------|------------------|---------|-------|
| `stripe` | 20.3.0 | Billing SDK | Stripe natively supports per-seat pricing via `quantity` on subscriptions. Create a product with a per-unit price, set `quantity` = number of seats at checkout, update via `stripe.subscriptions.update()` when seats change. No additional libraries needed. |

**Stripe per-seat implementation pattern:**
- Create a "Clinic Plan" price in Stripe Dashboard (per-unit, recurring)
- At checkout: `stripe.checkout.sessions.create({ line_items: [{ price: CLINIC_PRICE_ID, quantity: seatCount }] })`
- Seat changes: `stripe.subscriptions.update(subId, { items: [{ id: itemId, quantity: newSeatCount }] })`
- Proration is automatic (Stripe prorates mid-cycle seat changes by default)

### HIPAA Audit Retention (Cloud Infrastructure)

No npm dependencies. This is purely GCP infrastructure configuration.

| Component | Tool | Purpose |
|-----------|------|---------|
| Log sink | `gcloud logging sinks create` | Routes `audit=true` tagged Pino logs to Cloud Storage |
| Storage bucket | `gcloud storage buckets create` | 6-year locked retention policy (2190 days) |
| Retention lock | `gcloud storage buckets update --lock-retention-period` | Irreversible -- objects cannot be deleted until retention expires |

This is an ops task, not a code task. The only code requirement is tagging audit log entries with `{ audit: true }` in Pino calls, which is part of the Pino migration.

### Monitoring Infrastructure (Cloud Native)

No npm dependencies beyond Pino (above). Everything else is GCP configuration.

| Component | Tool | Purpose |
|-----------|------|---------|
| Cloud Error Reporting | Automatic (free, always-on) | Groups errors from structured Pino output via `@type` field |
| Cloud Monitoring | GCP Console / Terraform | Alert policies for error spikes, auth failures, billing failures |
| UptimeRobot | External SaaS (free tier) | External uptime monitoring for `/api/health` |
| Dependabot | `.github/dependabot.yml` | Dependency security alerts |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Logging | Pino + GCP config | Winston | 5-10x slower. More configuration surface. Pino's JSON-first design maps perfectly to Cloud Logging. |
| Logging | Pino + GCP config | Bunyan | Effectively unmaintained. Pino is Bunyan's spiritual successor by the same authors. |
| Logging transport | stdout (GCP auto-capture) | `@google-cloud/logging` SDK | Unnecessary on Cloud Run. Adding the Logging SDK adds a network dependency and complexity for zero benefit -- Cloud Run captures stdout automatically. |
| Error tracking | Cloud Error Reporting | Sentry ($26/mo with BAA) | Additional BAA, additional vendor, additional cost. Cloud Error Reporting is free, covered under existing GCP BAA, and auto-groups errors from Pino output. Sentry's DX is better (source maps, breadcrumbs) but not worth the compliance overhead for a solo developer. |
| Accessibility (unit) | @axe-core/playwright (E2E) | vitest-axe | Unmaintained (3 years stale). jsdom fragments miss layout-dependent accessibility issues. |
| Accessibility (unit) | @axe-core/playwright (E2E) | @sa11y/vitest | Active but redundant. E2E axe audits on real rendered pages are more valuable than unit-level fragments. |
| PHI encryption | Cloud SQL default + DAL | pgcrypto column-level | 12-25% query overhead. Complicates search, indexing, and migration. Cloud SQL default encryption satisfies HIPAA. |
| PHI encryption | Cloud SQL default + DAL | Application-level AES | Moves key management into app code. Adds latency. Only justified if you distrust the cloud provider -- but you already signed a BAA with them. |
| Secret scanning | Gitleaks (GitHub Action) | TruffleHog | Both capable. Gitleaks has wider adoption (19k stars), simpler config, and a first-party GitHub Action. TruffleHog's verification feature (checks if secrets are live) is nice but unnecessary for CI blocking. |
| DAST | OWASP ZAP | Burp Suite | Burp Suite is commercial. ZAP is free, open-source, and the industry standard for automated DAST in CI. |

---

## Version Summary

All versions verified against npm registry on 2026-03-16.

### New Production Dependencies

```bash
cd web
pnpm add pino@10.3.1 @google-cloud/pino-logging-gcp-config@1.3.3
```

### New Dev Dependencies

```bash
cd web
pnpm add -D pino-pretty@13.1.3 @axe-core/playwright@4.11.1 @axe-core/react@4.11.1
```

### Recommended Upgrades to Existing Dependencies

| Package | Current | Latest | Priority | Notes |
|---------|---------|--------|----------|-------|
| `@playwright/test` | 1.58.1 | 1.58.2 | Low | Patch release, bug fixes only |
| `stripe` | 20.3.0 | 20.4.1 | Low | Minor release, new API features |

### CI-Only Tools (No npm install)

| Tool | Integration | Version |
|------|-------------|---------|
| Gitleaks | `gitleaks/gitleaks-action@v2` | Latest 8.x |
| OWASP ZAP | `zaproxy/action-baseline@v0.14.0` | Latest |

---

## Next.js Configuration Changes

After adding Pino, `next.config.ts` needs `serverExternalPackages`:

```typescript
// web/next.config.ts (after Sentry removal)
const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  serverExternalPackages: ['pino', 'pino-pretty'],
  // ...headers
};
```

During the Sentry coexistence period (PR 1), the `withSentryConfig` wrapper remains. After Sentry removal (PR 2), the config simplifies to a plain `export default nextConfig`.

---

## Dockerfile Changes

Pino requires no Dockerfile changes. It writes to stdout, which Cloud Run captures. The existing multi-stage Alpine build works as-is.

`pino-pretty` is a devDependency and is NOT included in the production image (the `--frozen-lockfile --prod` flag in the Docker `deps` stage excludes it).

---

## Environment Variables

### New (Production)

| Variable | Value | Purpose |
|----------|-------|---------|
| `LOG_LEVEL` | `info` | Pino log level |
| `DEPLOY_VERSION` | Git SHA or deploy tag | Release tracking in Cloud Error Reporting |
| `GOOGLE_CLOUD_PROJECT` | Auto-set on Cloud Run | Trace correlation (no manual config needed) |

### New (Development)

| Variable | Value | Purpose |
|----------|-------|---------|
| `LOG_LEVEL` | `debug` | Verbose local logging |

---

## Sources

- [Pino npm](https://www.npmjs.com/package/pino) -- Version 10.3.1 confirmed
- [Pino GCP config npm](https://www.npmjs.com/package/@google-cloud/pino-logging-gcp-config) -- Version 1.3.3 confirmed
- [pino-pretty npm](https://www.npmjs.com/package/pino-pretty) -- Version 13.1.3 confirmed
- [@axe-core/playwright npm](https://www.npmjs.com/package/@axe-core/playwright) -- Version 4.11.1 confirmed
- [@axe-core/react npm](https://www.npmjs.com/package/@axe-core/react) -- Version 4.11.1 confirmed
- [Next.js serverExternalPackages docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages)
- [Arcjet: Structured logging for Next.js](https://blog.arcjet.com/structured-logging-in-json-for-next-js/)
- [Stripe per-seat pricing docs](https://docs.stripe.com/subscriptions/pricing-models/per-seat-pricing)
- [Stripe subscription quantities docs](https://docs.stripe.com/billing/subscriptions/quantities)
- [Cloud SQL CMEK docs](https://docs.google.com/sql/docs/postgres/cmek)
- [HIPAA encryption requirements](https://www.hipaajournal.com/hipaa-encryption-requirements/)
- [PostgreSQL encryption options](https://www.postgresql.org/docs/current/encryption-options.html)
- [Gitleaks GitHub](https://github.com/gitleaks/gitleaks) -- 19k stars, MIT licensed
- [OWASP ZAP GitHub Action](https://github.com/zaproxy/action-full-scan)
- [Pino + Next.js 16 Turbopack fix](https://github.com/vercel/next.js/issues/86099)
