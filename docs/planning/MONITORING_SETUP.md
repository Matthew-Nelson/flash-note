# FlashNote Monitoring Setup Plan

> **Status: PARTIALLY IMPLEMENTED**
>
> - [x] Backend Sentry integration (error tracking)
> - [x] Extension Sentry integration (error tracking)
> - [x] Web app Sentry integration (error tracking)
> - [ ] UptimeRobot monitors
> - [ ] Axiom log aggregation (optional)

This document covers monitoring, logging, and maintenance practices for solo operation of FlashNote.

---

## Recommended Monitoring Stack

### Tier 1: Non-Negotiable (Set Up Before Launch)

| Tool | Purpose | Cost |
|------|---------|------|
| **Sentry** | Error tracking | Free (5K errors/mo) |
| **UptimeRobot** | Uptime monitoring | Free (50 monitors) |

### Tier 2: High Value (First Month)

| Tool | Purpose | Cost |
|------|---------|------|
| **Axiom** | Log aggregation | Free (500GB/mo) |
| **GitHub Dependabot** | Security alerts | Free |

### Tier 3: Growth Stage (Paying Customers)

| Tool | Purpose | Cost |
|------|---------|------|
| **Sentry Team Plan** | Error tracking + BAA | $26/mo |
| **PagerDuty/Opsgenie** | Escalating alerts | ~$10/mo |

---

## Sentry Setup (Error Tracking)

### Backend Integration (IMPLEMENTED)

The backend Sentry integration is complete with HIPAA-compliant PHI filtering.

**Key files:**
- `src/instrument.ts` - Sentry initialization with PHI sanitization
- `src/index.ts` - Imports instrument first, adds Express error handler
- `src/middleware/error-handler.ts` - Captures unknown errors to Sentry
- `src/db/index.ts` - Captures database pool errors to Sentry

**HIPAA protections:**
- Request bodies are NOT sent (may contain patient notes)
- PHI-sensitive fields automatically redacted (patient, diagnosis, treatment, soap, etc.)
- Console breadcrumbs disabled (may contain logged PHI)
- URL query params stripped from HTTP breadcrumbs
- Only safe headers forwarded (content-type, user-agent, etc.)

**To configure:**
```bash
# Add to .env
SENTRY_DSN=https://your-key@xxx.ingest.us.sentry.io/xxx
```

### Extension Integration (IMPLEMENTED)

The extension Sentry integration uses `BrowserClient` + `Scope` (not `Sentry.init()`) per Sentry's recommended pattern for browser extensions. This avoids global state pollution that could conflict with websites also using Sentry.

**Key files:**
- `src/shared/sentry.ts` - BrowserClient setup with HIPAA PHI sanitization
- `src/shared/sentry-sanitization.ts` - PHI field detection and object sanitization
- `src/sidepanel/main.tsx` - Initializes Sentry + global error handlers for sidepanel
- `src/background/service-worker.ts` - Initializes Sentry + global error handlers for service worker
- `src/sidepanel/components/ErrorBoundary.tsx` - Captures React render errors to Sentry
- `src/shared/api.ts` - Captures API/network errors after retry exhaustion
- `src/sidepanel/hooks/useAuth.ts` - Sets Sentry user context (ID only, no PHI)

**Integration points:**
- React ErrorBoundary captures render errors
- API client captures 5xx/network errors after all retries exhausted
- API client captures token refresh failures
- Global `error` and `unhandledrejection` handlers in both sidepanel and service worker
- User ID set on Sentry scope when auth state changes

**HIPAA protections (same as backend):**
- PHI-sensitive fields automatically redacted (patient, diagnosis, treatment, soap, etc.)
- Console breadcrumbs disabled (may contain logged PHI)
- URL query params stripped from HTTP breadcrumbs
- Request bodies removed from events
- `sendDefaultPii: false`

**To configure:**
```bash
# Add to .env.development or .env.production
VITE_SENTRY_DSN=https://your-key@xxx.ingest.us.sentry.io/xxx
```

### Web App Integration (IMPLEMENTED)

The web app uses `@sentry/nextjs` with the standard `Sentry.init()` pattern, configured for three Next.js runtimes: client (browser), server (Node.js), and edge (middleware).

**Key files:**
- `sentry.client.config.ts` - Client-side Sentry init with full HIPAA PHI sanitization
- `sentry.server.config.ts` - Server-side Sentry init with PHI filtering
- `sentry.edge.config.ts` - Edge runtime Sentry init with PHI filtering
- `src/instrumentation.ts` - Next.js instrumentation hook (loads server/edge configs)
- `src/app/global-error.tsx` - App Router last-resort error boundary
- `src/lib/sentry-sanitization.ts` - PHI field detection and object sanitization
- `next.config.ts` - Wrapped with `withSentryConfig` for source map uploads
- `src/components/ErrorBoundary.tsx` - Captures React render errors to Sentry
- `src/lib/api.ts` - Captures API/network errors after retry exhaustion
- `src/lib/auth-context.tsx` - Sets Sentry user context (ID only, no PHI)

**Integration points:**
- React ErrorBoundary captures render errors
- `global-error.tsx` captures root layout errors (App Router)
- `onRequestError` captures Server Component, middleware, and proxy errors
- API client captures 5xx/network errors after all retries exhausted
- API client captures token refresh failures
- User ID set on Sentry when auth state changes

**HIPAA protections (same as backend and extension):**
- PHI-sensitive fields automatically redacted (patient, diagnosis, treatment, soap, etc.)
- Console breadcrumbs disabled on client (may contain logged PHI)
- URL query params stripped from fetch/XHR breadcrumbs
- Request bodies and cookies removed from events
- `sendDefaultPii: false`
- Session Replay intentionally NOT enabled (captures DOM which may contain PHI)

**To configure:**
```bash
# Add to .env.local
NEXT_PUBLIC_SENTRY_DSN=https://your-key@xxx.ingest.us.sentry.io/xxx

# For source map uploads in CI (optional)
SENTRY_AUTH_TOKEN=sntrys_xxx
```

---

## UptimeRobot Setup (Uptime Monitoring)

### Monitors to Create

| Monitor Name | URL | Interval |
|--------------|-----|----------|
| API Health | `https://api.flashnote.app/health` | 5 min |
| Web App | `https://flashnote.app` | 5 min |
| Stripe Webhook | `https://api.flashnote.app/billing/webhook` | 5 min |

---

## Axiom Setup (Log Aggregation)

```bash
cd backend
pnpm add winston @axiomhq/winston
```

Create `src/utils/logger.ts`:

```typescript
import winston from 'winston';
import { WinstonTransport as AxiomTransport } from '@axiomhq/winston';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new AxiomTransport({
      dataset: 'flashnote-backend',
      token: process.env.AXIOM_TOKEN,
    }),
  ],
});
```

### HIPAA-Safe Logging

```typescript
// Good: Metadata only
logger.info('Note generated', { userId: user.id, durationMs: 1234, success: true });

// Bad: Contains PHI - NEVER DO THIS
logger.info('Note generated', { noteContent: generatedNote, patientName: context.patient });
```

---

## HIPAA Compliance for Monitoring

### Rules for All Monitoring Tools

1. **Never send PHI** to external services
2. **Sanitize before logging** — strip note content, patient names, DOBs
3. **Use metadata only** — user IDs, timestamps, success/failure, durations
4. **Get a BAA** when handling PHI (Sentry Team plan, $26/mo)

### What's Safe to Send

| Safe | Not Safe |
|------|----------|
| User ID | Patient name |
| Timestamp | Date of birth |
| Error type | Note content |
| Request path | Diagnosis |
| Response status | Treatment details |
| Duration (ms) | Medical record numbers |

### Audit Log Retention

Your PostgreSQL `audit_logs` table is the source of truth for HIPAA audits. External monitoring is for operational visibility only.

Retain audit logs for **6 years** per HIPAA requirements.

---

## Dependabot Setup (Security Alerts)

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/backend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5

  - package-ecosystem: "npm"
    directory: "/extension"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5

  - package-ecosystem: "npm"
    directory: "/web"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
```

---

## Maintenance Schedule

### Weekly
- Review Sentry for new error patterns
- Check UptimeRobot for downtime incidents
- Merge or close Dependabot PRs
- Glance at Stripe dashboard for failed payments

### Monthly
- Review audit logs for suspicious patterns
- Test database backup restoration
- Update dependencies with breaking changes
- Review usage metrics and costs

### Quarterly
- Full dependency audit (`pnpm audit`)
- Review and rotate secrets if needed
- Test disaster recovery process
- Review error trends and fix recurring issues

### Annually
- Security audit review
- HIPAA compliance documentation update
- Architecture review for scale
- Update Node.js to latest LTS

---

## Incident Response Runbook

### API Down (UptimeRobot Alert)

1. Check Sentry for recent errors
2. Check server logs: `railway logs` or equivalent
3. Check database connectivity
4. Check external services (Gemini, Stripe)
5. If unrecoverable, rollback last deploy

### Spike in Errors (Sentry Alert)

1. Identify affected endpoint/function
2. Check recent deploys — was anything changed?
3. Check if isolated to one user or widespread
4. If critical, rollback and investigate
5. If minor, hotfix and deploy

### Payment Failures (Stripe Alert)

1. Check Stripe dashboard for webhook delivery
2. Verify webhook endpoint is responding
3. Check webhook signature validation
4. Review recent billing code changes
5. Manually sync subscription status if needed

### Suspected Security Incident

1. **Immediately**: Rotate affected secrets
2. Review audit logs for unauthorized access
3. Check for unusual login patterns
4. If PHI exposed: Begin HIPAA breach protocol
5. Document everything for compliance

---

## Environment Variables to Add

### Backend `.env`

```bash
# Sentry
SENTRY_DSN=https://xxx@sentry.io/xxx

# Axiom (optional but recommended)
AXIOM_TOKEN=xaat-xxx
```

### Extension `.env`

```bash
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Web `.env.local`

```bash
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
# CI only:
SENTRY_AUTH_TOKEN=sntrys_xxx
```

---

## Cost Summary

### Free Tier Stack

| Service | Monthly Cost | What You Get |
|---------|--------------|--------------|
| Sentry | $0 | 5K errors/month |
| UptimeRobot | $0 | 50 monitors, 5-min intervals |
| Axiom | $0 | 500GB logs/month |
| Dependabot | $0 | Unlimited |
| **Total** | **$0** | Full observability |

### Production Stack (with BAA)

| Service | Monthly Cost | What You Get |
|---------|--------------|--------------|
| Sentry Team | $26 | 50K errors + BAA |
| UptimeRobot | $0 | Free tier sufficient |
| Axiom | $0 | Free tier sufficient |
| Dependabot | $0 | Unlimited |
| **Total** | **$26** | HIPAA-ready observability |

---

## Quick Reference

### Check if everything is working

```bash
# Backend health
curl https://api.flashnote.app/health

# Check recent errors (if using Axiom CLI)
axiom query "['flashnote-backend'] | where level == 'error' | top 10"
```

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| 401 on all requests | JWT secret mismatch | Check `JWT_SECRET` |
| Webhook failures | Signature mismatch | Verify `STRIPE_WEBHOOK_SECRET` |
| Slow note generation | Gemini rate limit | Check quota, add retry logic |
| Extension not loading | CORS issue | Verify allowed origins |

---

## Implementation Checklist

- [x] Set up Sentry account and get DSN
- [x] Add `@sentry/node` to backend
- [x] Add `SENTRY_DSN` to backend `.env.example`
- [x] Configure HIPAA-compliant PHI filtering in `src/instrument.ts`
- [x] Add Sentry error handler to Express middleware
- [x] Add Sentry capture for database pool errors
- [x] Add `@sentry/browser` to extension (BrowserClient pattern for extensions)
- [x] Add `VITE_SENTRY_DSN` to extension env files
- [x] Add HIPAA PHI sanitization for extension Sentry events
- [x] Add Sentry to ErrorBoundary, API client, and service worker
- [x] Add Sentry ingest domain to manifest.json host_permissions
- [x] Add `@sentry/nextjs` to web app
- [x] Add `NEXT_PUBLIC_SENTRY_DSN` to web app env files
- [x] Configure HIPAA-compliant PHI filtering for web app (client, server, edge)
- [x] Add `withSentryConfig` to `next.config.ts`
- [x] Add `instrumentation.ts` for server/edge runtime init
- [x] Add `global-error.tsx` for App Router error capture
- [x] Add Sentry to web ErrorBoundary, API client, and auth context
- [ ] Set up UptimeRobot monitors
- [ ] Create `.github/dependabot.yml`
- [ ] Set up Axiom account (optional for launch)
- [ ] Add winston + axiom transport to backend (optional for launch)
