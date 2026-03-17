---
phase: 1
slug: ui-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 + React Testing Library v16 + jsdom |
| **Config file** | `web/vitest.config.ts` |
| **Quick run command** | `cd web && pnpm test` |
| **Full suite command** | `cd web && pnpm test:coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd web && pnpm test`
- **After every plan wave:** Run `cd web && pnpm test:coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | UIPOL-01 | unit | `cd web && pnpm vitest --run src/components/ui/Button.test.tsx` | Yes (update) | ⬜ pending |
| 01-01-02 | 01 | 1 | UIPOL-01 | unit | `cd web && pnpm vitest --run src/components/ui/Alert.test.tsx` | Yes (update) | ⬜ pending |
| 01-01-03 | 01 | 1 | UIPOL-02 | unit | `cd web && pnpm vitest --run src/components/ui/Button.test.tsx` | Yes (update) | ⬜ pending |
| 01-02-01 | 02 | 1 | UIPOL-03 | unit | `cd web && pnpm vitest --run src/app/dashboard/settings/loading.test.tsx` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | UIPOL-04 | unit | Covered by component className assertions | Partial | ⬜ pending |
| 01-04-01 | 04 | 2 | UIPOL-05 | unit | `cd web && pnpm vitest --run src/components/notes/GeneratedNote.test.tsx` | Yes (update) | ⬜ pending |
| 01-05-01 | 05 | 1 | UIPOL-06 | manual | CSS inspection + browser DevTools | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/app/dashboard/settings/loading.test.tsx` — stubs for UIPOL-03 (settings skeleton renders correctly)

*Existing infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reduced-motion exempts functional spinners | UIPOL-06 | CSS `@media (prefers-reduced-motion)` cannot be tested in jsdom | Enable "Reduce motion" in OS settings or browser DevTools → Emulate CSS media feature. Verify spinners still animate. Verify decorative animations are instant. |
| Print layout renders clinical document | UIPOL-05 | `@media print` cannot be tested in jsdom | Open generated note → Ctrl+P / Cmd+P → Verify: no sidebar/nav/buttons visible, clinical header with blank patient fields, SOAP sections with bold headers, signature block at bottom, black & white only |
| 375px viewport has no horizontal scroll | UIPOL-04 | Viewport behavior requires real browser | Chrome DevTools → Toggle Device Toolbar → iPhone SE (375px) → Navigate all pages → Verify no horizontal scrollbar |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
