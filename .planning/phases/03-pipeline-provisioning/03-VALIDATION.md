---
phase: 3
slug: pipeline-provisioning
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 + React Testing Library v16 + jsdom |
| **Config file** | `web/vitest.config.ts` |
| **Quick run command** | `cd web && pnpm test` |
| **Full suite command** | `cd web && pnpm test:ci` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd web && pnpm test` (if app code changes; most Phase 3 changes are infra/ and .github/)
- **After every plan wave:** Run `cd web && pnpm test:ci`
- **Before `/gsd:verify-work`:** Full suite must be green + `terraform plan` shows no drift + staging deploy succeeds
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-XX | 01 | 1 | INFRA-01 | manual-only | N/A — pipeline behavior verified by deploy workflow execution | N/A | ⬜ pending |
| 03-01-XX | 01 | 1 | INFRA-02 | unit | `cd web && pnpm test -- --run src/app/api/health/route.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-XX | 02 | 1 | INFRA-03 | manual-only | `terraform plan` validates resource dependencies | N/A | ⬜ pending |
| 03-02-XX | 02 | 1 | INFRA-04 | manual-only | Verified during Phase 4 staging smoke test (INFRA-10) | N/A | ⬜ pending |
| 03-02-XX | 02 | 1 | INFRA-05 | manual-only | `terraform plan` + Cloud Console verification | N/A | ⬜ pending |
| 03-02-XX | 02 | 1 | INFRA-06 | manual-only | Cloud Run startup succeeds with Secret Manager refs | N/A | ⬜ pending |
| 03-02-XX | 02 | 1 | INFRA-07 | manual-only | Deploy workflow authenticates without service account keys | N/A | ⬜ pending |
| 03-03-XX | 03 | 2 | INFRA-08 | manual-only | `curl -I https://flashnote.co` returns 200 with valid cert | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/src/app/api/health/route.test.ts` — health endpoint DB connectivity test for INFRA-02

*Existing infrastructure covers all other phase requirements. Phase 3 is primarily Terraform + workflow files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migrations run before traffic cutover | INFRA-01 | Pipeline behavior — requires actual Cloud Run deployment | Deploy to staging, verify migration Cloud Run job completes before service revision receives traffic |
| GCP APIs enabled and configured | INFRA-03 | Infrastructure state — verified by `terraform plan` | Run `terraform plan` — no errors about disabled APIs |
| Vertex AI IAM configured | INFRA-04 | IAM policy — verified during Phase 4 staging smoke test | Service account can call Vertex AI Gemini endpoint |
| Cloud SQL encryption + SSL + backups | INFRA-05 | Infrastructure state — Cloud Console verification | Verify encryption, SSL enforcement, and backup schedule in Cloud Console |
| Secrets in Secret Manager | INFRA-06 | Runtime behavior — Cloud Run must start successfully | Deploy to Cloud Run with Secret Manager volume mounts, verify startup |
| WIF configured | INFRA-07 | GitHub Actions auth — verified by deploy workflow | Deploy workflow authenticates to GCP without service account keys |
| Custom domain with SSL | INFRA-08 | DNS + ALB configuration — external network behavior | `curl -I https://flashnote.co` returns 200 with valid TLS cert |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
