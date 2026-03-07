# Screenshot Manifest

Standard set of screenshots taken at the end of each UI overhaul phase. Every phase captures the same screens for consistent visual diffing.

## Screenshots

| # | Filename | Page | Viewport | Auth | Description |
|---|----------|------|----------|------|-------------|
| 1 | `landing-page.png` | `/` | Desktop (1440x900) | No | Full-page screenshot. MarketingNav, hero, How It Works, See the Difference, pricing preview, Footer. |
| 2 | `login-page.png` | `/login` | Desktop | No | Login form with BetaBadge. |
| 3 | `dashboard-home.png` | `/dashboard` | Desktop | Yes | Sidebar + TopBar + main content area. |
| 4 | `new-note-page.png` | `/dashboard/notes/new` | Desktop | Yes | Note generation form with back button in TopBar. |
| 5 | `notes-stub.png` | `/dashboard/notes` | Desktop | Yes | Notes list page (stub/coming soon initially, populated after Phase 2). |
| 6 | `settings-page.png` | `/dashboard/settings` | Desktop | Yes | Account settings with back button. |
| 7 | `mobile-dashboard.png` | `/dashboard` | Mobile (375x812) | Yes | Mobile layout with hamburger menu visible, sidebar hidden. |
| 8 | `mobile-sidebar-open.png` | `/dashboard` | Mobile (375x812) | Yes | Mobile sidebar drawer open with backdrop. Tap hamburger to open before capturing. |
| 9 | `pricing-page-authenticated.png` | `/pricing` | Desktop | Yes | Full-page screenshot. Session-aware nav shows "Dashboard" link. Pricing cards + FAQ + Footer. |

## Capture Steps

```
1. Start dev server: pnpm --filter web dev
2. Navigate to http://localhost:3000 (desktop 1440x900)
3. Screenshot #1: landing-page.png (full page)
4. Navigate to /login
5. Screenshot #2: login-page.png (viewport)
6. Fill login form with test account, submit
7. Screenshot #3: dashboard-home.png (viewport, now at /dashboard)
8. Click "New Note" in sidebar
9. Screenshot #4: new-note-page.png (viewport, at /dashboard/notes/new)
10. Click "Notes" in sidebar
11. Screenshot #5: notes-stub.png (viewport, at /dashboard/notes)
12. Click "Settings" in sidebar
13. Screenshot #6: settings-page.png (viewport, at /dashboard/settings)
14. Resize to 375x812
15. Navigate to /dashboard
16. Screenshot #7: mobile-dashboard.png (viewport)
17. Click hamburger button to open sidebar
18. Screenshot #8: mobile-sidebar-open.png (viewport)
19. Resize back to 1440x900
20. Navigate to /pricing
21. Screenshot #9: pricing-page-authenticated.png (full page)
22. Close browser, kill dev server
```

## Adding New Screenshots

When a phase introduces new pages or significant UI changes, add entries to this manifest. Keep the numbering sequential. New entries should be added at the end — don't renumber existing screenshots so diffs across phases remain meaningful.

## Phase History

| Phase | Date | PR | Notes |
|-------|------|----|-------|
| A | 2026-03-06 | #113 | Sidebar layout, shared MarketingNav/Footer, stub pages |
| B | 2026-03-06 | #114 | Note experience — SOAP cards, form redesign, inline editing |
| C | 2026-03-06 | #115 | Dashboard home — KPI cards, trial banner, quick actions, skeleton loader |
