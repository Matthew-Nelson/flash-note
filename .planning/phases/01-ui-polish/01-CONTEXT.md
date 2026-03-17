# Phase 1: UI Polish - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the application feel polished and professional on all devices, including mobile (375px) and print. Covers touch targets, cursor audit, skeleton loaders, responsive fixes, print stylesheet, and reduced-motion compliance. No new features — this is a quality pass on existing UI.

</domain>

<decisions>
## Implementation Decisions

### Print layout
- Full clinical document format: FlashNote branding (small top-left), patient header, SOAP sections, provider signature block
- Black & white only — no color accents. Section headers use bold/size differentiation instead of color
- Since patient records don't exist yet (Phase 6), include blank underlines for handwriting: patient name, date, duration, modality
- Provider signature line and date at the bottom
- Hide all UI chrome (sidebar, nav, buttons, ratings, suggestions panel) via print stylesheet

### Skeleton coverage
- Skeletons on all data-loading pages: dashboard (already done), settings, and any future Server Component pages that fetch user data
- Auth pages do NOT get skeletons (Client Components, forms render instantly)
- Note generation keeps its spinner — it's an active user-triggered operation, not a page load
- Animation style: pulse (animate-pulse, opacity fade) — matches existing dashboard skeleton
- Spinner component kept for inline/button loading states (two tools for two jobs: skeletons for page loads, spinners for actions)

### Reduced-motion behavior
- Functional spinners (button loading, note generation) are EXEMPT from the blanket reduced-motion disable — users need to know something is happening
- Decorative animations (fade-in-up, slide-in, card hover shadows) go instant (final state immediately, 0.01ms duration)
- Skeleton pulse animation is NOT exempt — skeletons become static gray blocks when reduced-motion is on (the shape communicates "loading" without animation; aria-label handles screen readers)
- Implementation: refine the blanket `@media (prefers-reduced-motion: reduce)` rule to exempt spinner keyframes

### Responsive (375px)
- Systematic audit of every page — zero horizontal scroll tolerance
- Reduce main content padding from p-6 (24px) to p-4 (16px) on small screens
- All form fields stack vertically at 375px — no side-by-side layouts on mobile
- SOAP accent bars (4px left border) kept on mobile — minimal space cost, preserves visual identity
- Sidebar already handled (mobile drawer with hamburger in TopBar)

### Touch targets & cursors
- All interactive elements get 44px+ touch targets (UIPOL-01)
- All clickable elements get cursor-pointer (UIPOL-02)
- Button component needs both: minimum height enforcement and cursor-pointer in base styles

### Claude's Discretion
- Exact skeleton shapes for settings page and any other data-loading pages
- Touch target implementation approach (CSS min-height vs padding adjustments per component)
- Which specific elements need cursor-pointer added (audit and fix)
- Print stylesheet margin/page-break decisions
- Transition timing adjustments within the 150-300ms range (UIPOL-06)

</decisions>

<specifics>
## Specific Ideas

- Print layout should be "ready to file or fax" — a real clinical document, not a web page printout
- Blank handwriting lines on print are a bridge until Phase 6 adds patient records that auto-populate

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `loading.tsx` (dashboard): Existing skeleton with `animate-pulse` pattern and proper `role="status"` / `aria-label` — use as template for other skeletons
- `Spinner` component: Keep for button/inline use, don't replace with skeletons
- `design-tokens-teal.css`: Transition tokens (`--fn-transition-fast: 150ms`, `--fn-transition-base: 200ms`, `--fn-transition-slow: 300ms`) and keyframes (fn-spin, fn-shimmer, fn-fade-in, etc.)
- `components.css`: Button classes (`btn-primary`, `btn-secondary`, `btn-ghost`) with transition properties already using design tokens
- `Button.tsx`: Needs cursor-pointer and minimum height (44px) added to base styles. Current `sm` size (`px-3 py-1.5`) is under 44px

### Established Patterns
- Tailwind utility classes for responsive breakpoints (`md:`, `lg:`)
- `animate-pulse` for skeleton loading (Tailwind built-in)
- Reduced-motion blanket rule in `design-tokens-teal.css` (needs refinement to exempt functional spinners)
- 44px touch targets already applied in MarketingNav, TopBar, GeneratedNote — use `min-w-[44px] min-h-[44px]` pattern

### Integration Points
- `globals.css` imports design tokens and components CSS — print stylesheet should be added here or as a new `@import`
- `design-tokens-teal.css` contains the reduced-motion media query that needs refinement
- `Button.tsx` is the shared button component — changes here propagate everywhere

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-ui-polish*
*Context gathered: 2026-03-16*
