# Phase 1: UI Polish - Research

**Researched:** 2026-03-16
**Domain:** CSS/responsive design, print stylesheets, touch targets, animations, skeleton loading
**Confidence:** HIGH

## Summary

This phase is a pure CSS/Tailwind quality pass on an existing, feature-complete Next.js application. No new features, no backend changes, no new dependencies. The work spans six requirements: touch targets (UIPOL-01), cursor audit (UIPOL-02), skeleton loaders (UIPOL-03), 375px responsive (UIPOL-04), print stylesheet (UIPOL-05), and reduced-motion refinement (UIPOL-06).

The codebase already has strong foundations for all six areas. The design system (`design-tokens-teal.css`, `components.css`, `tailwind-preset-teal.js`) provides transition tokens, animation keyframes, and a reduced-motion media query. Several components already implement 44px touch targets (`MarketingNav`, `TopBar`, `GeneratedNote`). The dashboard `loading.tsx` is a well-structured skeleton that serves as the template for settings page skeletons. The main gap areas are: `Button.tsx` missing `cursor-pointer` and minimum height enforcement, the settings `loading.tsx` using a spinner instead of a skeleton, no print stylesheet, the blanket reduced-motion rule killing functional spinners, and several pages needing responsive padding adjustments at 375px.

**Primary recommendation:** Work through each requirement as a distinct task, starting with the two global CSS/component changes (Button.tsx + reduced-motion) that affect every page, then the page-specific work (responsive audit, skeletons, print).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Print layout: Full clinical document format with FlashNote branding (small top-left), patient header with blank underlines for handwriting (patient name, date, duration, modality), SOAP sections, provider signature block and date. Black and white only -- section headers use bold/size not color. Hide all UI chrome (sidebar, nav, buttons, ratings, suggestions panel).
- Skeleton coverage: Skeletons on dashboard (done), settings, and future Server Component data-loading pages. Auth pages do NOT get skeletons. Note generation keeps its spinner. Animation: pulse (animate-pulse, opacity fade). Spinner component kept for inline/button loading states.
- Reduced-motion: Functional spinners (button loading, note generation) are EXEMPT from blanket disable. Decorative animations go instant (0.01ms). Skeleton pulse NOT exempt -- static gray blocks with aria-label.
- Responsive (375px): Zero horizontal scroll tolerance. Reduce main content padding from p-6 to p-4 on small screens. All form fields stack vertically at 375px. SOAP accent bars kept on mobile. Sidebar already handled.
- Touch targets & cursors: All interactive elements 44px+ touch targets. All clickable elements cursor-pointer. Button component needs both minimum height and cursor-pointer in base styles.

### Claude's Discretion
- Exact skeleton shapes for settings page and any other data-loading pages
- Touch target implementation approach (CSS min-height vs padding adjustments per component)
- Which specific elements need cursor-pointer added (audit and fix)
- Print stylesheet margin/page-break decisions
- Transition timing adjustments within the 150-300ms range

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UIPOL-01 | All interactive elements have 44px+ touch targets | Button.tsx `sm` size is 30px tall (py-1.5). Add `min-h-[44px]` to base button styles. Alert dismiss button, sidebar nav items, and footer links need touch target enforcement. |
| UIPOL-02 | All clickable elements have cursor-pointer | Button.tsx CSS classes (`btn-primary`, `btn-secondary`, `btn-ghost`) lack `cursor-pointer`. Links use Tailwind defaults. Audit needed for all interactive elements. |
| UIPOL-03 | Remaining spinner loading states replaced with content-shaped skeletons | Settings `loading.tsx` uses `<Spinner size="lg" />` -- replace with content-shaped skeleton. Dashboard skeleton already done. Auth pages exempt. Note generation spinner exempt. |
| UIPOL-04 | All pages render without horizontal scroll at 375px viewport | NoteGenerationForm uses `lg:grid-cols-2` which is fine (stacks on mobile). Dashboard `p-6` needs `sm:p-6 p-4`. TopBar `px-6` needs `px-4 sm:px-6`. Landing page `text-5xl` pricing may overflow. Footer 4-column grid needs mobile stacking. |
| UIPOL-05 | Generated notes have a print stylesheet | No print CSS exists. Need `@media print` rules in globals.css or a dedicated print.css import. Must hide sidebar, nav, buttons, ratings, suggestions panel. Must format SOAP sections as a clinical document. |
| UIPOL-06 | All transitions are 150-300ms and respect prefers-reduced-motion | Design tokens define 150ms/200ms/300ms. Components use these. Blanket `@media (prefers-reduced-motion: reduce)` exists but kills functional spinners. Needs refinement to exempt `fn-spin` keyframes. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | (via Next.js) | Utility-first CSS | Already in project, all styles use it |
| CSS custom properties | n/a | Design tokens | `design-tokens-teal.css` is the single source of truth |
| Next.js App Router | 16.1.6 | `loading.tsx` convention | Skeleton loading files per route segment |

### Supporting
No new libraries needed. This phase is pure CSS and Tailwind utility work.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS `@media print` | react-to-print | Adds dependency for something CSS handles natively. CSS print stylesheet is simpler, no JS needed. |
| Manual touch target audit | @axe-core/react | Out of scope for this phase (QUAL-08 in Phase 10). Manual audit is the right approach here. |

## Architecture Patterns

### Print Stylesheet Pattern
**What:** A `@media print` block in `globals.css` (or a separate `print.css` imported by `globals.css`) that hides UI chrome, reformats content for paper, and adds clinical document structure.
**When to use:** When the generated note page is printed.
**Implementation approach:**

```css
/* In globals.css or a new print.css imported by globals.css */
@media print {
  /* Hide all UI chrome */
  nav[aria-label="Main navigation"],
  nav[aria-label="Main"],
  .sidebar,
  header,
  footer,
  [role="group"][aria-label="Rate this note"],
  aside[aria-label="AI suggestions"],
  button,
  .xl\\:hidden .card { /* suggestions below SOAP on mobile */
    display: none !important;
  }

  /* Reset backgrounds and shadows */
  body {
    background: white !important;
    color: black !important;
  }

  .card {
    border: none !important;
    box-shadow: none !important;
  }

  /* SOAP sections: bold headers, clear separation */
  /* Page breaks: avoid breaking inside SOAP sections */
  section[aria-labelledby^="section-heading-"] {
    page-break-inside: avoid;
    border-left: none !important;
    margin-bottom: 1rem;
  }
}
```

The print layout also needs a print-only header block (FlashNote branding, patient info blank lines, signature block). These are elements that only render inside `@media print`. The approach: add a `print-header` and `print-footer` div to `GeneratedNote.tsx` that is `hidden` (Tailwind) by default and shown only in print via `print:block`.

### Reduced-Motion Refinement Pattern
**What:** Refine the blanket `@media (prefers-reduced-motion: reduce)` rule to exempt functional spinners.
**Implementation:**

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  /* Exempt functional spinners -- users need loading feedback */
  .animate-spin,
  .loading-spinner::before,
  .loading-spinner-sm,
  .loading-dots {
    animation-duration: 1s !important;
    animation-iteration-count: infinite !important;
  }
}
```

The `animate-spin` class is Tailwind's built-in spin utility used by `Spinner.tsx`. The `.loading-spinner::before` and `.loading-dots` are from `components.css`. This exemption restores spin animations for functional indicators while keeping all decorative animations instant.

### Touch Target Pattern
**What:** Enforce 44px minimum touch targets on all interactive elements.
**Approach:** Two strategies depending on element type:

1. **Button component (`Button.tsx`):** Add `min-h-[44px]` to the base class string. This ensures all buttons meet the minimum regardless of size prop. The `sm` size (currently `py-1.5` = ~30px tall) will expand to 44px.

2. **Other interactive elements:** The pattern already used in `GeneratedNote.tsx` and `TopBar.tsx` is `min-w-[44px] min-h-[44px]` with flexbox centering. Apply this to:
   - Alert dismiss button (currently no min-height)
   - Sidebar nav items (currently `px-3 py-2` = ~36px)
   - Footer links (text-only, no min-height)
   - Any remaining icon-only buttons

### Skeleton Pattern (Established)
**What:** Content-shaped placeholder blocks using `animate-pulse` with proper accessibility.
**Template:** Dashboard `loading.tsx` at `web/src/app/dashboard/loading.tsx`.

```tsx
export default function Loading() {
  return (
    <div className="p-6 space-y-6 animate-pulse" role="status" aria-label="Loading settings">
      <span className="sr-only">Loading settings</span>
      {/* Card-shaped skeleton blocks matching settings page layout */}
      <div className="max-w-2xl space-y-6">
        <div className="h-48 rounded-fn-lg bg-fn-bg-secondary" />
        <div className="h-32 rounded-fn-lg bg-fn-bg-secondary" />
        <div className="h-28 rounded-fn-lg bg-fn-bg-secondary" />
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Adding cursor-pointer to disabled buttons:** The `btn-*:disabled` styles already set `cursor: not-allowed`. The cursor-pointer must only apply to non-disabled states.
- **Using `!important` in Tailwind utilities:** Avoid unless inside `@media print` where specificity wars with existing styles are unavoidable.
- **Hardcoding pixel values for touch targets:** Use Tailwind's `min-h-[44px]` pattern, not inline styles.
- **Creating new loading components:** Use Tailwind's built-in `animate-pulse` utility and simple `div` blocks. No need for a shared Skeleton component -- the pattern is simple enough to inline.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Print formatting | Custom print renderer or react-to-print | CSS `@media print` | Pure CSS, no JS dependency, browser-native, zero bundle impact |
| Skeleton loading components | Shared `<Skeleton>` component library | Inline `div` blocks with `animate-pulse` | Each page's skeleton matches its specific layout. A generic component adds abstraction without value. |
| Touch target enforcement | Custom HOC or wrapper component | `min-h-[44px]` Tailwind utility | Pattern already established in codebase. Simple, zero overhead. |
| Responsive breakpoint management | Custom media query hooks | Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) | Already used throughout the codebase. No JS needed for responsive layout. |

**Key insight:** This entire phase requires zero new dependencies. Everything needed is already in the project's Tailwind config, design tokens, and CSS architecture.

## Common Pitfalls

### Pitfall 1: Print Stylesheet Breaking Layout in Screen View
**What goes wrong:** Print-only elements (patient header, signature block) inadvertently render on screen because `hidden` class is overridden.
**Why it happens:** Specificity conflicts or missing `print:block` utility.
**How to avoid:** Use Tailwind's `hidden print:block` pattern for print-only elements. Verify in browser that print-only elements are invisible during normal use.
**Warning signs:** Layout shifts when adding print elements. Unexpected whitespace in generated note view.

### Pitfall 2: Blanket Reduced-Motion Override Hiding Functional Loading
**What goes wrong:** Exempting spinners from reduced-motion requires the exemption selectors to be more specific than the blanket rule.
**Why it happens:** The blanket rule uses `*` with `!important`. Exemptions need `!important` on the restoration too.
**How to avoid:** Use specific class selectors with `!important` in the exemption block. Test with `prefers-reduced-motion: reduce` enabled in browser DevTools.
**Warning signs:** Spinners frozen when reduced-motion is enabled in OS settings.

### Pitfall 3: Touch Target Changes Breaking Existing Visual Design
**What goes wrong:** Adding `min-h-[44px]` to buttons increases their height, which can change page layout in unexpected ways.
**Why it happens:** The `sm` Button size was intentionally small for compact UI areas.
**How to avoid:** Audit each use of `size="sm"` Button. Most uses (LogoutButton, PasswordResetSection, DeleteAccountSection) are fine with 44px height. The increased height is the desired outcome for mobile usability.
**Warning signs:** Buttons looking too tall in specific contexts. Check: sidebar LogoutButton, settings page buttons.

### Pitfall 4: Responsive Padding Changes Breaking Desktop Layout
**What goes wrong:** Changing `p-6` to `p-4 sm:p-6` affects every viewport, not just mobile.
**Why it happens:** Missing the responsive prefix means the change applies globally.
**How to avoid:** Always use `p-4 sm:p-6` (mobile-first) not `p-6 max-sm:p-4`. Tailwind is mobile-first by design.
**Warning signs:** Desktop layout looking cramped after responsive changes.

### Pitfall 5: Print Stylesheet Not Hiding Sidebar/Mobile Drawer
**What goes wrong:** The sidebar renders in print output because it's a fixed/flex element, not hidden by the route-level print CSS.
**Why it happens:** The sidebar is in the dashboard layout, outside the page component tree. Print CSS must target it specifically.
**How to avoid:** Target the sidebar by its `nav[aria-label="Main navigation"]` selector or add a `.print-hide` utility class. Also hide the TopBar header.
**Warning signs:** Sidebar appearing in print preview.

### Pitfall 6: Forgetting cursor-pointer on Non-Button Interactive Elements
**What goes wrong:** Links, select dropdowns, and checkbox labels missing cursor-pointer look non-interactive.
**Why it happens:** Native `<a>` tags have `cursor: pointer` by default but Tailwind's `preflight` resets some defaults. `<select>` elements default to browser cursor.
**How to avoid:** Audit every interactive element type: `<button>`, `<a>`, `<select>`, `<label>` with clickable behavior, `<input type="checkbox">`. Add `cursor-pointer` where missing.
**Warning signs:** Hovering over interactive elements shows default cursor.

## Code Examples

### Button.tsx: Adding cursor-pointer and min-height
```typescript
// Current base classes (line 29):
const baseClasses = variant === 'primary' ? 'btn-primary' : 'btn-secondary';

// Updated: add cursor-pointer and min-h-[44px] to the base string
// cursor-pointer is safe because disabled state already sets cursor: not-allowed
// in the btn-*:disabled CSS rules (which has higher specificity)
<button
  className={`${baseClasses} ${sizeClasses[size]} inline-flex items-center justify-center gap-2 min-h-[44px] cursor-pointer ${className}`}
  disabled={isDisabled}
  {...props}
>
```

### Button CSS: cursor-pointer in component classes
```css
/* In components.css, add cursor-pointer to each button class */
.btn-primary {
  /* ...existing styles... */
  cursor: pointer;
}

.btn-secondary {
  /* ...existing styles... */
  cursor: pointer;
}

.btn-ghost {
  /* ...existing styles... */
  cursor: pointer;
}

/* Disabled states already have cursor: not-allowed which overrides */
```

### Settings Page Skeleton
```tsx
// web/src/app/dashboard/settings/loading.tsx
export default function Loading() {
  return (
    <>
      {/* TopBar placeholder - the real TopBar renders from page.tsx */}
      <div className="sticky top-0 z-20 flex items-center px-6 py-4 border-b border-fn-border bg-fn-bg-card">
        <div className="h-7 w-40 rounded bg-fn-bg-secondary animate-pulse" />
      </div>
      <div className="flex-1 p-4 sm:p-6 animate-pulse" role="status" aria-label="Loading settings">
        <span className="sr-only">Loading settings</span>
        <div className="max-w-2xl space-y-6">
          {/* Account Information card skeleton */}
          <div className="card p-4">
            <div className="h-6 w-48 bg-fn-bg-secondary rounded mb-4" />
            <div className="space-y-4">
              <div className="h-4 w-32 bg-fn-bg-secondary rounded" />
              <div className="h-5 w-56 bg-fn-bg-secondary rounded" />
              <div className="h-4 w-28 bg-fn-bg-secondary rounded" />
              <div className="h-5 w-24 bg-fn-bg-secondary rounded" />
              <div className="h-4 w-36 bg-fn-bg-secondary rounded" />
              <div className="h-5 w-20 bg-fn-bg-secondary rounded" />
            </div>
          </div>
          {/* Change Password card skeleton */}
          <div className="card p-4">
            <div className="h-6 w-40 bg-fn-bg-secondary rounded mb-4" />
            <div className="h-4 w-full bg-fn-bg-secondary rounded mb-4" />
            <div className="h-10 w-56 bg-fn-bg-secondary rounded" />
          </div>
          {/* Danger Zone card skeleton */}
          <div className="card p-4">
            <div className="h-6 w-32 bg-fn-bg-secondary rounded mb-4" />
            <div className="h-4 w-full bg-fn-bg-secondary rounded mb-4" />
            <div className="h-10 w-36 bg-fn-bg-secondary rounded" />
          </div>
        </div>
      </div>
    </>
  );
}
```

### Responsive Padding Pattern
```tsx
// Before:
<main id="main-content" tabIndex={-1} className="flex-1 p-6">

// After (mobile-first: 16px default, 24px at sm+):
<main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6">

// TopBar before:
<header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 ...">

// TopBar after:
<header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-4 ...">
```

### Print-Only Clinical Header and Footer
```tsx
// Inside GeneratedNote.tsx, add above the SOAP sections:
{/* Print-only clinical document header */}
<div className="hidden print:block mb-8">
  <div className="flex justify-between items-start mb-6">
    <p className="text-sm font-semibold">FlashNote</p>
    <p className="text-sm">{generatedDate}</p>
  </div>
  <div className="border-b-2 border-black pb-4 mb-6">
    <h2 className="text-lg font-bold mb-4">SOAP Note</h2>
    <div className="grid grid-cols-2 gap-y-3 text-sm">
      <div>
        <span className="font-semibold">Patient: </span>
        <span className="inline-block border-b border-black w-48">&nbsp;</span>
      </div>
      <div>
        <span className="font-semibold">Date: </span>
        <span className="inline-block border-b border-black w-32">&nbsp;</span>
      </div>
      <div>
        <span className="font-semibold">Duration: </span>
        <span className="inline-block border-b border-black w-24">&nbsp;</span>
        <span> min</span>
      </div>
      <div>
        <span className="font-semibold">Modality: </span>
        <span className="inline-block border-b border-black w-32">&nbsp;</span>
      </div>
    </div>
  </div>
</div>

{/* ... SOAP sections ... */}

{/* Print-only signature block */}
<div className="hidden print:block mt-12 pt-8 border-t-2 border-black">
  <div className="grid grid-cols-2 gap-8 text-sm">
    <div>
      <span className="font-semibold">Provider Signature: </span>
      <span className="inline-block border-b border-black w-full mt-8">&nbsp;</span>
    </div>
    <div>
      <span className="font-semibold">Date: </span>
      <span className="inline-block border-b border-black w-full mt-8">&nbsp;</span>
    </div>
  </div>
</div>
```

## Detailed Audit Findings

### Touch Target Violations (UIPOL-01)

| Component | File | Element | Current Size | Fix |
|-----------|------|---------|-------------|-----|
| Button (sm) | `Button.tsx:15` | All sm buttons | ~30px (py-1.5) | Add `min-h-[44px]` to base classes |
| Alert dismiss | `Alert.tsx:52-59` | Dismiss X button | No min-height (~20px icon) | Add `min-w-[44px] min-h-[44px] flex items-center justify-center` |
| Sidebar NavItem | `Sidebar.tsx:38` | Nav links | ~36px (py-2) | Change to `py-2.5` or add `min-h-[44px]` |
| Footer links | `Footer.tsx:17-54` | All footer links | Text-only, no min-height | Add `inline-block min-h-[44px] flex items-center` or increase `py` |
| Signup checkbox | `signup/page.tsx:146` | Checkbox label wrapper | Has `min-h-[44px]` already | OK -- already compliant |
| MarketingNav desktop links | `MarketingNav.tsx:42-64` | Pricing, Sign In | Text-only | Add `py-2` for better touch target (desktop links, but needed for tablet landscape) |

### Cursor Audit (UIPOL-02)

| Element Type | Current State | Fix |
|-------------|--------------|-----|
| `.btn-primary` | No cursor set | Add `cursor: pointer` to CSS class |
| `.btn-secondary` | No cursor set | Add `cursor: pointer` to CSS class |
| `.btn-ghost` | No cursor set | Add `cursor: pointer` to CSS class |
| `.link` class | No cursor set (browser default for `<a>` is pointer, but `.link` is sometimes applied to non-anchor elements) | Add `cursor: pointer` |
| `<select>` elements | Browser default (varies) | Add `cursor-pointer` class |
| Sidebar "New Note" CTA | `Sidebar.tsx:87-108` | Native `<a>` has pointer | OK |
| Alert dismiss button | Uses inline `<button>` | Needs `cursor-pointer` |
| Dashboard "Generate Professional Note" link | Uses `btn-primary` class on `<Link>` | Fixed by btn-primary cursor change |

### Responsive Issues at 375px (UIPOL-04)

| Page | File | Issue | Fix |
|------|------|-------|-----|
| All dashboard pages | Multiple | `p-6` main content padding = 24px each side = 48px lost | `p-4 sm:p-6` |
| TopBar | `TopBar.tsx:16` | `px-6` = 48px horizontal padding | `px-4 sm:px-6` |
| Landing page hero | `page.tsx:13` | Container `px-6` is fine, but `text-5xl` pricing text ($29) could be tight | Test at 375px, may need `text-4xl sm:text-5xl` |
| Landing page pricing block | `page.tsx:166-177` | `inline-block card p-8` -- 32px padding on 375px leaves ~311px for content | Reduce to `p-6 sm:p-8` |
| Footer | `Footer.tsx:7` | `grid md:grid-cols-4` -- already stacks on mobile. `px-6` padding is fine | OK as-is |
| Pricing page cards | `CheckoutButtons.tsx:142` | `grid md:grid-cols-2` -- stacks on mobile | OK, but check `text-5xl` price fits |
| NoteGenerationForm | `NoteGenerationForm.tsx:177,225` | `grid-cols-1 lg:grid-cols-2` -- already stacks on mobile | OK |
| GeneratedNote metadata bar | `GeneratedNote.tsx:563` | `flex-wrap` already set | OK |
| GeneratedNote SOAP + sidebar | `GeneratedNote.tsx:584` | `flex gap-6` -- suggestions panel is `hidden xl:block` | OK for mobile, panel hidden |
| Settings page | `settings/page.tsx:17` | `p-6` padding, `max-w-2xl` card width | `p-4 sm:p-6` |
| AuthLayout | `AuthLayout.tsx:14` | `py-12 sm:px-6` -- no explicit mobile px, uses browser default | Add `px-4 sm:px-6` for consistent mobile padding |

### Skeleton Loading Gaps (UIPOL-03)

| Page | Current State | Action |
|------|--------------|--------|
| Dashboard (`/dashboard`) | Has skeleton `loading.tsx` with `animate-pulse` | Already done |
| Settings (`/dashboard/settings`) | Uses `<Spinner size="lg" />` | Replace with content-shaped skeleton |
| Notes stub (`/dashboard/notes`) | No loading.tsx, but page is a simple "Coming Soon" stub | Lightweight -- could add minimal skeleton or leave as-is (renders instantly) |
| Patients stub (`/dashboard/patients`) | No loading.tsx, simple stub | Same as Notes |
| Templates stub (`/dashboard/templates`) | No loading.tsx, simple stub | Same as Notes |
| New Note (`/dashboard/notes/new`) | No loading.tsx; NoteGenerationForm is client-side | No skeleton needed -- form renders client-side instantly |

Decision: Settings page needs a real skeleton. The stub pages (Notes, Patients, Templates) do a `getSession()` call then render static content. They *could* benefit from a skeleton, but the session check is fast and the content is minimal. Recommended: add skeletons for settings only, per the user's decision that skeletons go on "data-loading pages."

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `prefers-reduced-motion` blanket disable | Selective exemption for functional animations | CSS best practice since WCAG 2.1 (2018) | Spinners must remain visible for UX |
| Separate print CSS file | `@media print` in main stylesheet or Tailwind `print:` prefix | Tailwind v3.1+ added print variant | Can use `print:hidden`, `print:block` utilities inline |
| 48px touch targets (iOS HIG) | 44px minimum (WCAG 2.5.5 AAA) / 24px minimum (WCAG 2.5.8 AA) | WCAG 2.2 (Oct 2023) | 44px is the established target for healthcare/clinical software |

**Tailwind print variant:** Tailwind CSS includes a `print:` variant that generates `@media print` utilities. This means `print:hidden`, `print:block`, `print:text-black` etc. work inline without needing custom CSS. For complex print styling (page margins, page breaks), the `@media print` block in CSS is still needed.

## Open Questions

1. **Stub page skeletons**
   - What we know: The stub pages (Notes, Patients, Templates) do a `getSession()` call which is fast. Content is static "Coming Soon" text.
   - What's unclear: Whether these warrant skeleton loading files.
   - Recommendation: Skip skeletons for stub pages. They render in < 100ms. The user decision says "data-loading pages" which these barely qualify as. Revisit when these pages get real data.

2. **Print page margins and page breaks**
   - What we know: CSS `@page` can set margins. `page-break-inside: avoid` prevents splitting SOAP sections.
   - What's unclear: Exact margin values that look good when printed or exported to PDF.
   - Recommendation: Start with `@page { margin: 1in; }` (standard clinical document margins). Test with browser print preview. Adjust as needed.

3. **Tailwind print: prefix vs @media print block**
   - What we know: Both work. `print:` prefix is more Tailwind-idiomatic. `@media print` block is needed for `@page` rules and complex selectors.
   - Recommendation: Use both. `print:hidden` and `print:block` inline in JSX for simple show/hide. `@media print` in globals.css for page margins, body resets, and complex selectors that target existing CSS classes.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4 + React Testing Library v16 + jsdom |
| Config file | `web/vitest.config.ts` |
| Quick run command | `cd web && pnpm test` |
| Full suite command | `cd web && pnpm test:coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UIPOL-01 | Button component renders with min-h-[44px] | unit | `cd web && pnpm vitest --run src/components/ui/Button.test.tsx` | Yes (update needed) |
| UIPOL-01 | Alert dismiss button has 44px min touch target | unit | `cd web && pnpm vitest --run src/components/ui/Alert.test.tsx` | Yes (update needed) |
| UIPOL-02 | Button base classes include cursor-pointer | unit | `cd web && pnpm vitest --run src/components/ui/Button.test.tsx` | Yes (update needed) |
| UIPOL-03 | Settings loading.tsx renders skeleton, not spinner | unit | `cd web && pnpm vitest --run src/app/dashboard/settings/loading.test.tsx` | No -- Wave 0 |
| UIPOL-04 | Responsive padding classes present | unit | Covered by existing component tests checking className | Partial |
| UIPOL-05 | Print-only elements have print:block class | unit | `cd web && pnpm vitest --run src/components/notes/GeneratedNote.test.tsx` | Yes (update needed) |
| UIPOL-05 | Print-only elements hidden by default | unit | Same as above | Yes (update needed) |
| UIPOL-06 | Spinner exempt from reduced-motion in CSS | manual-only | Inspect CSS. No runtime test possible for CSS media queries in jsdom. | N/A |

Note: CSS media queries (`@media print`, `@media (prefers-reduced-motion)`) cannot be tested in jsdom. UIPOL-05 tests verify that print-only elements exist in the DOM with the correct classes. UIPOL-06 is verified by CSS inspection and manual browser testing.

### Sampling Rate
- **Per task commit:** `cd web && pnpm test`
- **Per wave merge:** `cd web && pnpm test:coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/app/dashboard/settings/loading.test.tsx` -- covers UIPOL-03 (settings skeleton renders correctly)
- No framework install needed -- Vitest already configured
- No shared fixtures needed -- existing test helpers sufficient

## Sources

### Primary (HIGH confidence)
- Codebase inspection: All findings verified by reading actual source files
  - `web/src/components/ui/Button.tsx` -- current Button implementation
  - `web/design-system/design-tokens-teal.css` -- transition tokens, reduced-motion rule, keyframes
  - `web/design-system/components.css` -- button CSS classes, card styles, animation utilities
  - `web/src/app/dashboard/loading.tsx` -- skeleton template
  - `web/src/app/dashboard/settings/loading.tsx` -- spinner (needs replacement)
  - `web/src/components/notes/GeneratedNote.tsx` -- note display (print target)
  - `web/src/components/notes/NoteGenerationForm.tsx` -- form layout (responsive target)

### Secondary (MEDIUM confidence)
- Tailwind CSS `print:` variant -- documented in Tailwind CSS docs, widely used
- WCAG 2.5.5 (Target Size) -- 44px minimum from WCAG 2.2

### Tertiary (LOW confidence)
- None. All findings are based on direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, everything is existing CSS/Tailwind
- Architecture: HIGH -- patterns already established in codebase (touch targets, skeletons, animations)
- Pitfalls: HIGH -- based on direct inspection of actual code, not hypothetical issues

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- pure CSS work, no external dependency changes expected)
