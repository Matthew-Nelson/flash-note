---
phase: 2
slug: structured-logging
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4.0.18 + React Testing Library v16.3.2 + jsdom |
| **Config file** | `web/vitest.config.ts` |
| **Quick run command** | `cd web && pnpm test` |
| **Full suite command** | `cd web && pnpm test:coverage` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd web && pnpm test`
- **After every plan wave:** Run `cd web && pnpm test:coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | MON-01 | unit | `cd web && pnpm vitest run src/server/lib/logger.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | MON-03 | unit | `cd web && pnpm vitest run src/lib/telemetry.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | MON-03 | unit | `cd web && pnpm vitest run src/app/api/telemetry/route.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | MON-02 | unit | `cd web && pnpm test` | ✅ (existing, needs update) | ⬜ pending |
| 02-02-02 | 02 | 2 | MON-04 | unit | `cd web && pnpm vitest run src/components/ErrorBoundary.test.tsx -x` | ✅ (needs update) | ⬜ pending |
| 02-02-03 | 02 | 2 | MON-05 | unit | `cd web && pnpm vitest run src/instrumentation.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-02-04 | 02 | 2 | MON-06 | build+grep | `cd web && pnpm build` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/server/lib/logger.test.ts` — unit tests for logger singleton (prod/dev branch, redaction, child logger)
- [ ] `src/lib/telemetry.test.ts` — tests for client telemetry functions (sendTelemetry, initClientTelemetry, reportErrorBoundary)
- [ ] `src/app/api/telemetry/route.test.ts` — tests for telemetry endpoint (validation, rate limiting, Pino integration)
- [ ] `src/instrumentation.test.ts` — test for onRequestError hook
- [ ] Test helper: shared logger mock pattern (reusable across test files)

*Existing tests requiring updates (handled during migration tasks, not Wave 0):*
- `src/components/ErrorBoundary.test.tsx` — replace Sentry mock with telemetry mock
- `src/server/services/email-devmode.test.ts` — replace console.log spies with logger mock
- `src/server/services/audit.test.ts` — replace console.error spy with logger mock
- `src/server/lib/get-session.test.ts` — replace console.error spy with logger mock
- `src/server/dal/usage.test.ts` — replace console.error spy with logger mock
- `src/test/setup.ts` — remove @sentry/nextjs mock

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GCP Cloud Logging format in production | MON-01 | Requires deployed Cloud Run environment | Deploy to staging, check Cloud Logging console for structured JSON entries with correct severity mapping |
| Cloud Trace correlation in production | MON-01 | Requires GCP load balancer injecting X-Cloud-Trace-Context | Deploy to staging, make request, verify log entries nest under request trace in Cloud Logging |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
