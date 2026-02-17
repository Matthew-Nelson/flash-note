# FlashNote UI Quality Audit

**Date:** February 6, 2026
**Scope:** Extension (sidepanel, content script) and Web App (all pages)
**Standards:** WCAG 2.1 AA, HIPAA UX requirements, responsive design best practices

---

## Table of Contents

1. [Accessibility (a11y)](#1-accessibility-a11y)
2. [Error Handling](#2-error-handling)
3. [Styling & Consistency](#3-styling--consistency)
4. [Mobile Responsiveness](#4-mobile-responsiveness)
5. [General UI/UX Improvements](#5-general-uiux-improvements)
6. [Priority Summary](#6-priority-summary)

---

## 1. Accessibility (a11y)

### 1.1 Color Contrast Failures (WCAG AA)

**Severity: P0 -- Legal risk (ADA/Section 508)**

The brand gradient (emerald-500 / teal-500) fails WCAG AA contrast requirements everywhere it is used as text or as a button background with white text.

| Pattern | Approx Ratio | Required | Locations |
|---------|-------------|----------|-----------|
| `.btn-primary` white text on emerald/teal gradient bg | ~2.4:1 | 4.5:1 | Every primary button across both apps |
| `.link` / `.text-gradient` gradient text on white | ~2.3:1 | 4.5:1 | All links, brand name, loading stages |
| `.status-trial` gradient text on white | ~2.3:1 | 4.5:1 | Extension settings, dashboard |
| BETA badge `text-stone-400` on cream bg | ~2.4:1 | 4.5:1 | Nav header across 11+ pages |
| `.error-message` red on light red bg | ~3.4:1 | 4.5:1 | All form error displays |
| ~~Focus ring at 12% opacity (`--fn-accent-glow-light`)~~ | ~~Nearly invisible~~ | ~~Clearly visible~~ | Fixed: opacity bumped to 18% in `shared/design-tokens-warm.css:214` |

**Fix:** Darken text-use variants of brand colors (e.g., emerald-700/teal-700 passes 4.5:1). Keep lighter gradient for backgrounds with white text, but verify the darkest point of the gradient passes. Define separate `--fn-accent-text` tokens for text-on-light usage.

**Files to modify:**
- `shared/design-tokens-warm.css` -- add high-contrast text token variants
- `shared/components.css` -- update `.link`, `.status-trial`, `.error-message`
- `shared/tailwind-preset-warm.js` -- add contrast-safe text color utilities
- `extension/src/sidepanel/index.css` -- sync after shared changes
- All web pages using `text-gradient` or `text-fn-accent-primary` as text color

---

### 1.2 Missing ARIA Roles on Dynamic Content

**Severity: P1 -- Screen reader users miss critical status changes**

No `aria-live` regions or `role="alert"` exist for dynamically injected content. Screen readers will not announce:

| Dynamic Content | File | Lines |
|----------------|------|-------|
| Session invalidation alerts | `extension/.../SessionAlert.tsx:51` | Missing `role="alert"` |
| Form validation errors (extension) | `extension/.../LoginForm.tsx:138-142` | `.error-message` div, no ARIA |
| Form validation errors (extension) | `extension/.../NoteGenerator.tsx:306-318` | `.error-message` div, no ARIA |
| Loading/success/error phase transitions | `extension/.../NoteGenerator.tsx:126-242` | No `aria-live` on phase container |
| "Copied!" confirmation | `extension/.../ResultDisplay.tsx:63-82` | Visual-only feedback |
| Dashboard success/error/polling alerts | `web/.../dashboard/page.tsx:142-183` | Raw div, no ARIA role |
| Loading spinner status text | `extension/.../App.tsx:60-65` | No `aria-live` |

**Fix:** Add `role="alert"` to all error containers. Add `aria-live="polite"` to status regions (loading text, copy confirmation). Add `aria-live="assertive"` to session alerts and auth errors.

---

### 1.3 Decorative SVGs Not Hidden from Assistive Technology

**Severity: P1**

30+ inline SVG icons across both apps lack `aria-hidden="true"`. Screen readers attempt to traverse the SVG path data, producing unintelligible output.

**Affected areas (all inline `<svg>` elements):**
- Extension: `LoginForm.tsx`, `NoteGenerator.tsx`, `ResultDisplay.tsx`, `Settings.tsx`, `SessionAlert.tsx`, `ErrorBoundary.tsx`
- Web: `Alert.tsx`, `Button.tsx`, `Input.tsx`, `Spinner.tsx`, `ErrorBoundary.tsx`, `SessionAlert.tsx`, all page files with inline SVGs
- Icons inside buttons also need the button to have an `aria-label` if it has no visible text

**Fix:** Add `aria-hidden="true"` to every decorative SVG. For icon-only buttons, add `aria-label` to the button element.

---

### 1.4 Invalid Nested Interactive Elements (Web)

**Severity: P1 -- Invalid HTML, unpredictable behavior for assistive tech**

12 instances of `<Link>` wrapping `<Button>` create nested interactive elements (`<a><button>`), which is invalid HTML. Assistive technology behavior is undefined.

**Affected files:**
- `web/src/app/dashboard/page.tsx` (multiple instances)
- `web/src/app/forgot-password/page.tsx`
- `web/src/app/reset-password/page.tsx`
- `web/src/app/verify-email/page.tsx`
- `web/src/app/resend-verification/page.tsx`

**Fix:** Either use `Button` with `asChild` prop (Radix pattern) to forward button styles onto `<Link>`, or style `<Link>` directly with button classes. Pick one pattern and apply consistently.

---

### 1.5 No Skip-to-Content Link

**Severity: P1**

No page provides a "skip to main content" link. Keyboard-only users must tab through the full navigation on every page.

**Fix:** Add a visually-hidden, focus-visible skip link as the first child of `<body>` (or layout component). Target the `<main>` element's `id`.

---

### 1.6 Missing `<main>` Landmark

**Severity: P1**

8 web pages wrap content in generic `<div>` elements instead of `<main>`:

- `web/src/app/page.tsx` (home)
- `web/src/app/pricing/page.tsx`
- `web/src/app/login/page.tsx`
- `web/src/app/signup/page.tsx`
- `web/src/app/forgot-password/page.tsx`
- `web/src/app/reset-password/page.tsx`
- `web/src/app/verify-email/page.tsx`
- `web/src/app/resend-verification/page.tsx`

**Fix:** Replace the outermost content `<div>` on each page with `<main>`. Add `id="main-content"` for the skip link target.

---

### 1.7 Heading Hierarchy Violations

**Severity: P2**

| Page | Issue |
|------|-------|
| login, signup, forgot-password, reset-password, verify-email, resend-verification | No `<h1>` element. Page title is a styled `<div>` or `<p>` |
| privacy/page.tsx, terms/page.tsx | Skip from `<h1>` to `<h3>`, missing `<h2>` |
| extension ResultDisplay.tsx | Uses `<h4>` for SOAP section headings with no preceding `<h2>`/`<h3>` |

**Fix:** Ensure every page has exactly one `<h1>`. Use sequential heading levels (h1 > h2 > h3). Can use CSS to decouple visual size from semantic level.

---

### 1.8 Focus Management Issues

**Severity: P1**

| Issue | File | Details |
|-------|------|---------|
| `outline: none` on `.input-field:focus` | `shared/components.css:142` | Replaced with `box-shadow` only. Box-shadow is invisible in Windows High Contrast Mode. |
| No `:focus-visible` on `.btn-primary`, `.btn-secondary` | `shared/components.css` | No focus indicator defined at all for buttons |
| View transitions lose focus | `extension/.../App.tsx:215`, `NoteGenerator.tsx` | When content swaps (e.g., generator -> result), focus drops to `<body>` |

**Fix:**
- Add `outline: 2px solid transparent` alongside box-shadow on all `:focus` rules (transparent outline becomes visible in High Contrast Mode)
- Add `:focus-visible` styles to all interactive components in `shared/components.css`
- Use `useEffect` + `ref.focus()` to move focus to the new view's heading or first interactive element on view transitions

---

### 1.9 Other Accessibility Issues

| Issue | File | Fix |
|-------|------|-----|
| Settings toggle `role="switch"` not connected to label | `extension/.../Settings.tsx:93-108` | Add `aria-labelledby` pointing to label text ID |
| External links (`target="_blank"`) missing "opens in new tab" | `extension/.../Settings.tsx` | Add sr-only text or `aria-label` |
| Password requirements in placeholder only | Extension and web signup forms | Add visible hint text connected via `aria-describedby` |
| Input `hint` prop not connected via `aria-describedby` | `web/.../ui/Input.tsx:34-36` | Add `aria-describedby={hintId}` to `<input>` |
| Dashboard dismiss buttons lack `aria-label` | `web/.../dashboard/page.tsx:150-157, 174-181` | Add `aria-label="Dismiss"` |
| Button missing `aria-busy` when loading | `web/.../ui/Button.tsx` | Add `aria-busy="true"` when `loading` prop is true |
| Duplicate `<nav>` elements without distinguishing labels | `web/.../dashboard/settings/page.tsx` | Add `aria-label` to differentiate (e.g., "Main navigation" vs "Settings navigation") |

---

## 2. Error Handling

### 2.1 Silent Clipboard Copy Failure

**Severity: P0 -- Patient safety risk**

When `navigator.clipboard.writeText()` fails in `ResultDisplay.tsx:26-28`, only `console.error` fires. The user sees no indication the copy failed. A PT could believe they copied a SOAP note, then paste stale or wrong content into a patient's EMR chart.

```typescript
// Current (DANGEROUS)
} catch (err) {
  console.error('Failed to copy:', err);
}
```

**Fix:** Show a visible error state on the copy button (e.g., red "Copy failed" text, shake animation). Consider a fallback using `document.execCommand('copy')` with a hidden textarea for browsers that restrict clipboard API.

**File:** `extension/src/sidepanel/components/ResultDisplay.tsx:26-28`

---

### 2.2 Web Auth Pages Bypass API Client

**Severity: P1 -- Missing retry logic on critical flows**

Four web pages use raw `fetch()` instead of the `api` client, losing exponential backoff retry logic:

| Page | File | Line |
|------|------|------|
| Forgot Password | `web/src/app/forgot-password/page.tsx` | 25 |
| Reset Password | `web/src/app/reset-password/page.tsx` | 35, 83 |
| Verify Email | `web/src/app/verify-email/page.tsx` | 29 |
| Resend Verification | `web/src/app/resend-verification/page.tsx` | 25 |

A transient 503 on password reset immediately shows an error instead of retrying. This is the worst possible time to fail without retry -- the user just proved they can't remember their password.

**Fix:** Route these requests through the `api` client, or at minimum add retry logic with backoff to these raw fetch calls.

---

### 2.3 Form Errors Don't Clear on Input Change

**Severity: P2 -- Poor UX, causes user confusion**

All forms in both apps keep error messages visible until the next form submission. Users who start correcting their input see stale error messages.

**Affected:**
- `web/src/app/login/page.tsx:30-31`
- `web/src/app/signup/page.tsx:34-35`
- `web/src/app/reset-password/page.tsx:57-58`
- `extension/src/sidepanel/components/LoginForm.tsx:23`
- `extension/src/sidepanel/components/NoteGenerator.tsx:88`

**Fix:** Clear error state `onChange` or `onFocus` of the associated input field. For form-level errors, clear on any input change.

---

### 2.4 Inconsistent Error Display Patterns

**Severity: P2**

| Component | Pattern | Issue |
|-----------|---------|-------|
| Dashboard (`web/.../dashboard/page.tsx`) | Raw `<div>` with hardcoded Tailwind | Every other web page uses `<Alert>` component |
| Extension error containers | `.error-message` CSS class | No `role="alert"`, no accessible announcement |
| Extension Settings (`Settings.tsx:41-43`) | `console.error` only | Preference save failure is silent to user |

**Fix:** Use `Alert` component on dashboard. Add `role="alert"` to extension `.error-message` containers. Show a brief toast or inline error in Settings when preference save fails.

---

### 2.5 NoteGenerator Hides Actionable Errors Behind Animation

**Severity: P2**

`extension/.../NoteGenerator.tsx:150-193` -- The error phase shows an animated X icon with "Something went wrong" for 1.5 seconds before revealing the actual actionable message (e.g., "Trial expired", "Rate limit exceeded").

**Fix:** Show the actual error message alongside the animation, not after it. Or reduce the animation hold time significantly (300ms).

---

### 2.6 ~~No Offline Detection~~ (Deferred)

**Severity: P2 — Deferred to post-launch polish**

Neither app checks `navigator.onLine` or listens for `online`/`offline` events. Existing API error handling and retry logic provides adequate coverage for beta.

---

### 2.7 No Request Timeout

**Severity: P2**

Neither API client (`extension/src/shared/api.ts`, `web/src/lib/api.ts`) uses `AbortController` with a timeout. A hanging server connection can leave users watching a spinner indefinitely, especially during note generation where retries compound the wait.

**Fix:** Wrap all `fetch()` calls with an `AbortController` and a configurable timeout (e.g., 30s for note generation, 10s for auth calls).

---

### 2.8 Extension Resend Verification Error Is Terminal

**Severity: P3**

`extension/.../App.tsx:204-206` -- When resend verification hits a rate limit, `resendStatus` stays `'error'` with no dismiss or retry button. The user is stuck until they navigate away.

**Fix:** Add a dismiss button or auto-reset the error state after a timeout (e.g., 30s to match rate limit window).

---

### 2.9 Dead Code: Unused `useApi` Hook

**Severity: P3 -- Technical debt**

`extension/src/sidepanel/hooks/useApi.ts` -- A well-structured error/loading/data hook that is never imported. All components manage their own state manually, leading to inconsistent patterns.

**Fix:** Either adopt `useApi` across all extension components for consistency, or delete it to reduce dead code.

---

### 2.10 Dashboard Polling Has No Unmount Cleanup

**Severity: P3**

`web/.../dashboard/page.tsx:28-63` -- Subscription polling uses recursive async calls with `setTimeout` but no `AbortController` or `isCancelled` flag. If the user navigates away during polling, state updates fire on an unmounted component.

**Fix:** Add a cleanup ref (`isCancelled = true` on unmount) or use `AbortController` to cancel in-flight requests.

---

### 2.11 No Nested ErrorBoundaries

**Severity: P2**

Both apps use a single top-level `ErrorBoundary`. A rendering crash in `NoteGenerator` takes down the entire extension sidepanel (including Settings and logout). A crash on the dashboard takes down navigation.

**Fix:** Wrap individual views in their own ErrorBoundaries. The chrome (nav, footer) should remain functional even when a view crashes.

---

## 3. Styling & Consistency

### 3.1 Extension CSS Forks Shared Styles

**Severity: P2 -- Maintenance hazard**

`extension/src/sidepanel/index.css` is 772 lines, with ~400+ lines duplicating `shared/components.css`. The extension redeclares `.btn-primary`, `.btn-secondary`, `.card`, `.input-field`, `.link`, etc. with subtly different values. The web app correctly imports `shared/components.css`; the extension does not.

**Fix:** Refactor `extension/src/sidepanel/index.css` to import `shared/components.css` and only contain extension-specific overrides and animations.

---

### 3.2 Dashboard Uses Off-Brand Colors

**Severity: P2**

`web/.../dashboard/page.tsx` constructs three inline alert patterns:
- Success: `bg-green-50 border-green-200 text-green-800`
- Polling: `bg-blue-50 border-blue-200 text-blue-800` (blue doesn't exist in the design system)
- Error: `bg-red-50 border-red-200 text-red-800`

These bypass the design system token colors.

**Fix:** Replace with `<Alert variant="success">`, `<Alert variant="info">`, `<Alert variant="error">`.

---

### 3.3 BETA Badge Duplicated 11+ Times

**Severity: P3 -- Maintenance debt**

The exact Tailwind string `text-[9px] font-normal px-1.5 leading-4 rounded-full border border-stone-400 text-stone-400` is copy-pasted across every page with a navigation header.

**Fix:** Extract into a `<BetaBadge />` component or a shared CSS class.

---

### 3.4 Navigation and Footer Are Not Shared Components

**Severity: P2**

The navigation bar is duplicated with slight variations across 6+ pages. The footer is defined as a local function in `privacy/page.tsx` and `terms/page.tsx`. The landing page inlines its own separate footer.

**Fix:** Extract `<Nav />` and `<Footer />` into `web/src/components/` and use them across all pages. Ensures consistency and makes updates (e.g., adding mobile nav) a single change.

---

### 3.5 ErrorBoundary Uses Hardcoded Colors

**Severity: P3**

Both extension and web `ErrorBoundary` components use `text-gray-900`, `bg-gray-100` etc. instead of design system token classes (`text-fn-text-primary`, `bg-fn-bg-secondary`).

**Files:**
- `extension/src/sidepanel/components/ErrorBoundary.tsx:54, 58, 67, 75`
- `web/src/components/ErrorBoundary.tsx:57, 61, 66, 70, 81, 87`

**Fix:** Replace hardcoded Tailwind gray classes with design system equivalents.

---

## 4. Mobile Responsiveness

### 4.1 No Mobile Navigation

**Severity: P1 -- Non-functional on mobile**

The navigation on public pages (home, pricing, privacy, terms) and the dashboard uses horizontal flex with `space-x-6`. No responsive collapse or hamburger menu exists. Links overflow or crowd on mobile screens.

**Fix:** Add a responsive hamburger menu. Use `hidden md:flex` for desktop nav and `md:hidden` for mobile toggle. Consider a slide-out drawer pattern.

---

### 4.2 Hero and Pricing Text Doesn't Scale

**Severity: P2**

| Page | Class | Issue |
|------|-------|-------|
| Landing page | `text-5xl` | No responsive prefix |
| Pricing page | `text-5xl` (2 headings) | No responsive prefix |

On mobile, `text-5xl` (3rem / 48px) causes headings to overflow or wrap awkwardly.

**Fix:** Use responsive sizing: `text-3xl md:text-4xl lg:text-5xl`.

---

### 4.3 CTA Buttons May Overflow on Small Screens

**Severity: P2**

Landing page CTA buttons (`web/.../page.tsx:47`) use `flex` without `flex-wrap`. Two `px-8 py-4 text-lg` buttons side-by-side overflow on screens narrower than ~375px.

**Fix:** Add `flex-wrap` and/or stack buttons vertically on small screens with `flex-col sm:flex-row`.

---

### 4.4 Touch Targets Below 44x44px Minimum

**Severity: P2**

| Element | Approx Size | Location |
|---------|-------------|----------|
| Nav text links | ~20x20px | All pages with navigation |
| Alert dismiss buttons | ~20x20px | Dashboard alerts |
| Settings gear icon | ~20x20px | Dashboard header |
| Footer links | Stacked with 8px gap | Landing page, legal pages |

**Fix:** Ensure all interactive elements meet 44x44px minimum tap target. Add padding to links and icon buttons. Increase gap between stacked footer links.

---

## 5. General UI/UX Improvements

### 5.1 Extension Settings Toggle Flash

**Severity: P3**

`extension/.../Settings.tsx:21-33` -- `showFloatingBadge` initializes to `true`, then async-loads the stored value. If stored value is `false`, the toggle visually flashes ON then OFF.

**Fix:** Initialize state as `null` and show a loading placeholder until the stored value is read.

---

### 5.2 Placeholder Link on Dashboard

**Severity: P3**

`web/.../dashboard/page.tsx:282` -- `<a href="#">Chrome Web Store</a>` is a non-functional link. Users clicking it go nowhere.

**Fix:** Either link to the actual Chrome Web Store listing or remove the link until it's available.

---

### 5.3 No Dark Mode Support

**Severity: P3 -- Future enhancement**

Neither app supports dark mode. The design token architecture (`:root` semantic tokens) is well-positioned for it, but no `.dark` class or `prefers-color-scheme: dark` rules exist.

**Fix:** Define dark-mode token overrides in `shared/design-tokens-warm.css` under a `.dark` or `@media (prefers-color-scheme: dark)` block. PTs often work early mornings and late evenings -- dark mode reduces eye strain.

---

### 5.4 No Print Styles

**Severity: P3**

No `@media print` rules exist. For a healthcare documentation tool, PTs or compliance officers may want to print terms/privacy pages for records.

**Fix:** Add basic print styles that hide navigation, simplify layout, and ensure text is black-on-white.

---

## 6. Priority Summary

### P0 -- Fix Now (Patient Safety / Legal Compliance)

| # | Issue | Category | Impact |
|---|-------|----------|--------|
| 1 | [2.1] Silent clipboard copy failure | Error Handling | PT could paste wrong note into EMR |
| 2 | [1.1] Color contrast failures across brand colors | Accessibility | WCAG AA violation, ADA legal risk |

### P1 -- Fix Soon (Accessibility Compliance / Usability)

| # | Issue | Category | Impact |
|---|-------|----------|--------|
| 3 | [1.2] Missing ARIA roles on dynamic content | Accessibility | Screen reader users miss critical alerts |
| 4 | [1.3] SVGs not hidden from assistive tech | Accessibility | Garbled screen reader output |
| 5 | [1.4] Nested `<Link><Button>` invalid HTML | Accessibility | Undefined assistive tech behavior |
| 6 | [1.5] No skip-to-content link | Accessibility | Keyboard navigation penalty |
| 7 | [1.6] Missing `<main>` landmark | Accessibility | Screen reader navigation broken |
| 8 | [1.8] Focus management issues | Accessibility | Invisible focus, lost focus on transitions |
| 9 | [2.2] Web auth pages bypass API client retry | Error Handling | Password reset fails on transient errors |
| 10 | [4.1] No mobile navigation | Responsiveness | Unusable on mobile devices |

### P2 -- Important (UX Quality / Consistency)

| # | Issue | Category | Impact |
|---|-------|----------|--------|
| 11 | [1.7] Heading hierarchy violations | Accessibility | Poor screen reader navigation |
| 12 | [1.9] Miscellaneous a11y issues | Accessibility | Multiple small gaps |
| 13 | [2.3] Errors don't clear on input change | Error Handling | Confusing stale errors |
| 14 | [2.4] Inconsistent error display patterns | Error Handling | Dashboard diverges from rest of app |
| 15 | [2.5] NoteGenerator hides errors behind animation | Error Handling | Delayed actionable information |
| ~~16~~ | ~~[2.6] No offline detection~~ | ~~Error Handling~~ | Deferred to post-launch |
| 17 | [2.7] No request timeout | Error Handling | Infinite spinner on hanging requests |
| 18 | [2.11] No nested ErrorBoundaries | Error Handling | Single crash takes down entire UI |
| 19 | [3.1] Extension CSS forks shared styles | Styling | Drift between extension and web |
| 20 | [3.2] Dashboard uses off-brand colors | Styling | Inconsistent visual language |
| 21 | [3.4] Nav/Footer not shared components | Styling | Duplicated code, inconsistent updates |
| 22 | [4.2] Hero/pricing text doesn't scale | Responsiveness | Overflow on mobile |
| 23 | [4.3] CTA buttons overflow on small screens | Responsiveness | Broken layout on narrow viewports |
| 24 | [4.4] Touch targets too small | Responsiveness | Frustrating mobile interaction |

### P3 -- Polish (Technical Debt / Enhancements)

| # | Issue | Category | Impact |
|---|-------|----------|--------|
| 25 | [2.8] Resend verification error is terminal | Error Handling | No recovery without navigation |
| 26 | [2.9] Dead `useApi` hook | Error Handling | Unused code |
| 27 | [2.10] Dashboard polling no cleanup | Error Handling | Memory leak on navigation |
| 28 | [3.3] BETA badge duplicated 11+ times | Styling | Maintenance burden |
| 29 | [3.5] ErrorBoundary hardcoded colors | Styling | Breaks with theme changes |
| 30 | [5.1] Settings toggle flash | UX | Visual flicker |
| 31 | [5.2] Placeholder Chrome Web Store link | UX | Dead link |
| 32 | [5.3] No dark mode | UX | Eye strain for evening users |
| 33 | [5.4] No print styles | UX | Can't print legal pages |

---

## Implementation Notes

### Shared Design System Changes (affects both apps)
Most P0 and P1 accessibility fixes should start in `shared/`:
- `shared/design-tokens-warm.css` -- contrast-safe color tokens
- `shared/components.css` -- focus styles, ARIA-ready patterns
- `shared/tailwind-preset-warm.js` -- utility classes for accessible colors

### Extension-Specific
- Deduplicate `extension/src/sidepanel/index.css` by importing shared styles
- Add `role="alert"` to error containers
- Fix clipboard copy failure handling

### Web-Specific
- Extract `<Nav>`, `<Footer>`, `<BetaBadge>` shared components
- Add `<main>` landmarks and fix heading hierarchy
- Route auth pages through API client
- Add responsive navigation

### Cross-Cutting
- Add `aria-hidden="true"` to all decorative SVGs (both apps)
- Add `useOnlineStatus()` hook (both apps)
- Add request timeouts to API clients (both apps)
