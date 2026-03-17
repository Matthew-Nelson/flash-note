---
phase: 01-ui-polish
plan: 01
subsystem: ui
tags: [tailwind, css, accessibility, touch-targets, reduced-motion, wcag]

# Dependency graph
requires: []
provides:
  - "44px minimum touch targets on all interactive elements via Button base classes and per-component fixes"
  - "cursor-pointer on all clickable elements via CSS component classes and Tailwind utility"
  - "Reduced-motion spinner exemption for functional loading indicators (animate-spin, loading-spinner, loading-dots)"
affects: [01-ui-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "min-h-[44px] as standard touch target enforcement pattern"
    - "Functional animation exemption pattern in prefers-reduced-motion media query"

key-files:
  created: []
  modified:
    - web/src/components/ui/Button.tsx
    - web/design-system/components.css
    - web/design-system/design-tokens-teal.css
    - web/src/components/ui/Alert.tsx
    - web/src/components/Sidebar.tsx
    - web/src/components/Footer.tsx
    - web/src/components/MarketingNav.tsx
    - web/src/components/ui/Button.test.tsx
    - web/src/components/ui/Alert.test.tsx
    - web/src/components/Sidebar.test.tsx
    - web/src/components/Footer.test.tsx
    - web/src/components/MarketingNav.test.tsx

key-decisions:
  - "cursor-pointer applied both in CSS classes (btn-primary, btn-secondary, btn-ghost, .link) and Button.tsx Tailwind class for defense-in-depth"
  - "Reduced-motion exempts functional spinners with 1s duration and infinite iteration, keeping decorative animations instant"

patterns-established:
  - "Touch target: min-h-[44px] on all interactive elements, min-w-[44px] on icon-only buttons"
  - "Spinner exemption: .animate-spin, .loading-spinner::before, .loading-spinner-sm, .loading-dots are exempt from prefers-reduced-motion blanket disable"

requirements-completed: [UIPOL-01, UIPOL-02, UIPOL-06]

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 01 Plan 01: Touch Targets, Cursor, and Reduced-Motion Summary

**44px touch targets on all interactive elements, cursor-pointer on all clickable elements, and reduced-motion spinner exemption for functional loading indicators**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-17T04:06:29Z
- **Completed:** 2026-03-17T04:12:21Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Button.tsx now enforces 44px minimum touch target and cursor-pointer in base classes, propagating to every button in the app
- CSS component classes (btn-primary, btn-secondary, btn-ghost, .link) all include cursor: pointer
- Reduced-motion media query refined to exempt functional spinners (.animate-spin, .loading-spinner::before, .loading-spinner-sm, .loading-dots) while keeping decorative animations instant
- Alert dismiss button, Sidebar nav items, Footer links, and MarketingNav links all have 44px touch targets
- 11 new tests across 5 test files verifying touch target and cursor behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Button, CSS classes, and reduced-motion refinement** - `eb77e60` (feat)
2. **Task 2: Touch target and cursor audit on Alert, Sidebar, Footer, MarketingNav** - `47c05d0` (feat)

## Files Created/Modified
- `web/src/components/ui/Button.tsx` - Added min-h-[44px] and cursor-pointer to base classes
- `web/design-system/components.css` - Added cursor: pointer to btn-primary, btn-secondary, btn-ghost, .link
- `web/design-system/design-tokens-teal.css` - Refined reduced-motion to exempt functional spinners
- `web/src/components/ui/Alert.tsx` - Dismiss button gets 44px touch target and cursor-pointer
- `web/src/components/Sidebar.tsx` - NavItem links and New Note CTA get 44px touch targets
- `web/src/components/Footer.tsx` - All footer links get inline-flex min-h-[44px]
- `web/src/components/MarketingNav.tsx` - Desktop links, CTA, and mobile drawer links get 44px touch targets
- `web/src/components/ui/Button.test.tsx` - 4 new tests for touch target and cursor
- `web/src/components/ui/Alert.test.tsx` - 2 new tests for dismiss button touch target
- `web/src/components/Sidebar.test.tsx` - 2 new tests for NavItem and CTA touch targets
- `web/src/components/Footer.test.tsx` - 1 new test for footer link touch targets
- `web/src/components/MarketingNav.test.tsx` - 2 new tests for desktop link and CTA touch targets

## Decisions Made
- cursor-pointer applied in both CSS classes and Button.tsx Tailwind class for defense-in-depth coverage (raw `<Link>` elements with btn-primary get it from CSS; Button component gets it from Tailwind)
- Reduced-motion spinner exemption uses 1s animation-duration (matching the CSS spinner definitions) rather than restoring original durations, for simplicity and consistency
- Footer links use inline-flex + items-center + min-h-[44px] pattern rather than wrapping elements, keeping markup clean

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All interactive elements now meet 44px touch target requirement
- Foundation is set for Phase E polish pass (focus trapping, skeletons, print, 375px responsive)
- Full test suite passes: 1519 tests, 0 failures

## Self-Check: PASSED

All 13 files verified present. Both task commits (eb77e60, 47c05d0) verified in git log.

---
*Phase: 01-ui-polish*
*Completed: 2026-03-17*
