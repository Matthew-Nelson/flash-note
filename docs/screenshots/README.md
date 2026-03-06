# UI Screenshots

Visual record of the FlashNote UI at each phase of the overhaul. Used to track design evolution and catch regressions.

## Directory Structure

```
docs/screenshots/
  phase-a/    # Structural Foundation (sidebar, shared components, new routes)
  phase-b/    # Note Experience (SOAP cards, form redesign, inline editing)
  phase-c/    # Dashboard Home (KPI cards, trial banner, quick actions)
  phase-d/    # Auth + Marketing (reskin, trust signals, responsive)
  phase-e/    # Polish Pass (touch targets, skeletons, print, 375px)
```

Each phase directory contains the same set of screenshots taken at the end of that phase, enabling side-by-side comparison.

## Standard Screenshot Set

These screenshots are taken at the end of every UI phase. The list is defined in `SCREENSHOT_MANIFEST.md`.

### Viewports

- **Desktop**: 1440x900
- **Mobile**: 375x812 (iPhone SE equivalent)

### Test Account

- Email: `test2@example.com`
- Password: `Test1234!`

### Capture Process

1. Start the dev server: `pnpm --filter web dev`
2. Use Playwright MCP to navigate and screenshot each page
3. Save to `docs/screenshots/phase-{x}/` using the standard filenames
4. Compare against previous phase for regressions

See `SCREENSHOT_MANIFEST.md` for the exact list and steps.
