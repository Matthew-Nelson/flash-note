---
phase: 4
slug: staging-verification
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-19
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification (per CONTEXT.md decision) |
| **Config file** | N/A — no automated tests for this phase |
| **Quick run command** | `pnpm test` (existing 1493-test suite for regression) |
| **Full suite command** | Complete all 4 success criteria checklists on staging.flashnote.co |
| **Estimated runtime** | ~30 minutes (manual walkthrough) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test` (regression check — code fixes only)
- **After every plan wave:** Walk through affected success criteria on staging
- **Before `/gsd:verify-work`:** All 4 success criteria pass with evidence documented in PLAN.md checklist
- **Max feedback latency:** N/A (manual verification phase)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | INFRA-09 | manual | Visual: Cloud Logging console shows structured JSON + Error Reporting groups | N/A | ⬜ pending |
| 04-01-02 | 01 | 1 | INFRA-10 | manual | Visual: Generate note via staging UI — ADC implicit verification | N/A | ⬜ pending |
| 04-01-03 | 01 | 1 | INFRA-11 | manual | Walkthrough: register → verify email → login → generate note → logout | N/A | ⬜ pending |
| 04-01-04 | 01 | 1 | INFRA-12 | manual | Walkthrough: Stripe checkout → webhook → subscription active → notes unlocked | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed.

- Existing unit/integration test suite (1493 tests, 97.79% coverage) provides code correctness confidence
- Phase 4 validates runtime integration, not code logic
- Any code fixes discovered during verification run through the existing test suite for regression

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pino logs in Cloud Logging | INFRA-09 | Requires GCP Console access to verify log routing | Filter Cloud Logging by Cloud Run service, confirm structured JSON entries with correct severity. Trigger an error, confirm Error Reporting groups it. |
| Vertex AI ADC note generation | INFRA-10 | Requires deployed environment with ADC credentials | Generate a SOAP note via staging UI. Success = ADC works. |
| Full auth flow | INFRA-11 | Requires live staging with email delivery, database, Redis | Register with invite code → check email → click verify → login → generate note → logout. Each step must succeed. |
| Stripe checkout + webhook | INFRA-12 | Requires live Stripe test mode, webhook delivery, Secret Manager | Start Stripe checkout → complete with test card → verify webhook received → confirm subscription active → confirm note generation unlocked. |

---

## Validation Sign-Off

- [x] All tasks have manual verify instructions
- [x] Sampling continuity: manual walkthrough covers all requirements in sequence
- [x] Wave 0 covers all MISSING references (none needed)
- [x] No watch-mode flags
- [x] Feedback latency: N/A (manual phase)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
