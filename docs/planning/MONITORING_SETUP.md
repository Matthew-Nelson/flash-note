# FlashNote Monitoring Setup Plan

> **Status: NOT YET IMPLEMENTED**
>
> This document outlines the recommended monitoring stack for FlashNote. These integrations are planned but not yet added to the codebase. This is a **critical priority** for production readiness.

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

### Backend Integration

```bash
cd backend
pnpm add @sentry/node
```

Add to `src/index.ts` at the very top, before other imports:

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Strip potential PHI from error reports
    if (event.request?.data) delete event.request.data;
    return event;
  },
});

// Add error handler after all routes
app.use(Sentry.Handlers.errorHandler());
```

### Extension Integration

```bash
cd extension
pnpm add @sentry/react
```

Add to `src/sidepanel/main.tsx`:

```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  beforeSend(event) {
    // Never send note content or patient data
    if (event.extra) {
      delete event.extra.noteContent;
      delete event.extra.patientContext;
    }
    return event;
  },
});
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

- [ ] Set up Sentry account and get DSN
- [ ] Add `@sentry/node` to backend
- [ ] Add `@sentry/react` to extension
- [ ] Add `SENTRY_DSN` to backend config and `.env.example`
- [ ] Add `VITE_SENTRY_DSN` to extension config
- [ ] Set up UptimeRobot monitors
- [ ] Create `.github/dependabot.yml`
- [ ] Set up Axiom account (optional for launch)
- [ ] Add winston + axiom transport to backend (optional for launch)
