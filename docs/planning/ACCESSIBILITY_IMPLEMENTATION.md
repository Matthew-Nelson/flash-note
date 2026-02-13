# Accessibility (WCAG AA) Implementation Plan

> **Status: IN PROGRESS**
>
> - [x] Phase 1: ESLint static analysis (`eslint-plugin-jsx-a11y`)
> - [x] Phase 2: Fix existing accessibility violations
> - [ ] Phase 3: Unit test assertions (`vitest-axe`)
> - [ ] Phase 4: E2E accessibility audits (`@axe-core/playwright`)
> - [ ] Phase 5: Dev-time overlay (`@axe-core/react`)

This plan adds WCAG AA accessibility compliance tooling and fixes across the web and extension packages. It is designed to be implemented in order — each phase builds on the previous one.

---

## Current State

- **No accessibility tooling installed** — no `eslint-plugin-jsx-a11y`, no `vitest-axe`, no `@axe-core/*`
- **No accessibility-specific tests** in unit or E2E suites
- Both packages use: ESLint 9 flat config, Vitest 4 + jsdom, Playwright, React 19, Tailwind CSS 3.4
- CI runs lint (`ci.yml`) and E2E (`e2e.yml`) separately — both trigger on web/extension changes

### What Already Works

- `<html lang="en">` is set in `web/src/app/layout.tsx`
- `Input.tsx` has proper `htmlFor`, `aria-invalid`, `aria-describedby`
- `Alert.tsx` has `role="alert"`
- `Spinner.tsx` has `role="status"` + `aria-label`
- Floating action button has `aria-label`
- `prefers-reduced-motion` is respected for animations
- Focus ring CSS custom property exists: `--fn-focus-ring` in design tokens
- `globals.css` has `.focus-ring:focus-visible` utility class

### Known Issues

| Priority | Issue | Location |
|----------|-------|----------|
| P0 | `--fn-text-muted` (#78716c) on `--fn-bg-primary` (#fdfcfb) likely fails 4.5:1 contrast | `shared/design-tokens-warm.css:64,71` |
| P0 | Disabled button text (`--fn-text-muted` + `opacity: 0.7`) definitely fails contrast | Various button components |
| P1 | Icon-only buttons missing `aria-label` | `NoteGenerator.tsx`, `ResultDisplay.tsx`, `dashboard/page.tsx` (copy, back, settings, dismiss buttons) |
| P1 | Some interactive elements lack `:focus-visible` styles | Nav links, dismiss buttons, checkboxes |
| P1 | Gradient text (`.text-gradient`) makes focus state invisible | `web/src/app/globals.css:24-33` |
| P2 | Dynamic content not announced to screen readers | Character count, loading stages, copy feedback, errors — missing `aria-live` |
| P2 | No "skip to main content" link | `web/src/app/layout.tsx` |

---

## Phase 1: ESLint Static Analysis

**Goal:** Catch accessibility issues at write-time. Runs in editors and CI automatically via existing `pnpm lint` step.

### 1.1 Install

```bash
pnpm --filter @flashnote/web add -D eslint-plugin-jsx-a11y
pnpm --filter @flashnote/extension add -D eslint-plugin-jsx-a11y
```

### 1.2 Configure — Web (`web/eslint.config.mjs`)

**IMPORTANT:** Use the `flatConfigs` API, NOT the legacy `configs` API.

Add the import at the top:

```js
import jsxA11y from 'eslint-plugin-jsx-a11y';
```

Add `jsxA11y.flatConfigs.recommended` as a config entry in the `tseslint.config()` array:

```js
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  jsxA11y.flatConfigs.recommended,  // <-- ADD THIS LINE
  {
    // ... existing config block (plugins, rules, settings) — no changes needed
  },
  // ... rest unchanged
);
```

This adds the plugin, parser options, and all recommended rules in one line. No need to manually add the plugin to the `plugins` object or spread rules.

### 1.3 Configure — Extension (`extension/eslint.config.mjs`)

Same pattern — add the import and the flat config entry:

```js
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  jsxA11y.flatConfigs.recommended,  // <-- ADD THIS LINE
  {
    // ... existing config block — no changes needed
  },
  // ... rest unchanged
);
```

### 1.4 Verify

```bash
cd /Users/matthewnelson/Workspace/flash-note
pnpm --filter @flashnote/web lint
pnpm --filter @flashnote/extension lint
```

Expect violations. Capture the full output — it becomes the fix list for Phase 2.

### Key Rules in the Recommended Set

| Rule | What It Catches |
|------|----------------|
| `jsx-a11y/alt-text` | Images without alt text |
| `jsx-a11y/anchor-has-content` | Links without discernible text |
| `jsx-a11y/aria-props` | Invalid ARIA attributes |
| `jsx-a11y/aria-role` | Invalid ARIA roles |
| `jsx-a11y/click-events-have-key-events` | `onClick` without `onKeyDown`/`onKeyUp` |
| `jsx-a11y/interactive-supports-focus` | Interactive elements that aren't focusable |
| `jsx-a11y/label-has-associated-control` | Inputs without labels |
| `jsx-a11y/no-noninteractive-element-interactions` | Handlers on non-interactive elements |

### CI Integration

No changes needed. The existing `pnpm lint` step in `.github/workflows/ci.yml` (lines 36, 100, 155) will enforce these rules on every PR.

---

## Phase 2: Fix Existing Accessibility Violations

**Goal:** Resolve all issues found by the ESLint plugin plus the known issues listed above. Fix in this order:

### 2.1 Color Contrast (P0)

File: `shared/design-tokens-warm.css`

Verify and fix these contrast pairs against `--fn-bg-primary` (#fdfcfb):

| Token | Current Value | Required Ratio | Action |
|-------|--------------|----------------|--------|
| `--fn-text-primary` (stone-900) | #1c1917 | 4.5:1 for body text | Likely passes — verify |
| `--fn-text-secondary` (stone-600) | #57534e | 4.5:1 for body text | Needs verification — may need darkening to stone-700 |
| `--fn-text-muted` (stone-500) | #78716c | 4.5:1 for body text, 3:1 if only used at ≥18px bold / ≥24px regular | Likely fails for body text — darken or restrict usage |
| Disabled button text | stone-500 + opacity:0.7 | 3:1 minimum for disabled states | Fails — use a solid color instead of opacity |

Use a contrast checker tool (e.g., WebAIM Contrast Checker or the inclusivecolors.com tool) to verify each pair. WCAG AA requirements:
- **Normal text (<18px bold, <24px regular):** 4.5:1
- **Large text (≥18px bold or ≥24px regular):** 3:1

When changing values, update only the design token — do NOT change individual component colors. The token system ensures consistency.

### 2.2 Missing `aria-label` on Icon-Only Buttons (P1)

Search for icon-only buttons (buttons containing only SVG/icon children with no visible text). Add `aria-label` to each:

```tsx
// BEFORE
<button onClick={handleCopy}><CopyIcon /></button>

// AFTER
<button onClick={handleCopy} aria-label="Copy to clipboard"><CopyIcon /></button>
```

Known locations:
- Copy button in `ResultDisplay.tsx`
- Back button in `NoteGenerator.tsx`
- Settings gear icon
- Dismiss/close buttons (`dashboard/page.tsx`, extension components)

Run `pnpm lint` after — `jsx-a11y/click-events-have-key-events` and `jsx-a11y/interactive-supports-focus` will catch any remaining issues with non-button interactive elements.

### 2.3 Focus Visibility (P1)

Ensure all interactive elements have visible `:focus-visible` styles. Add a global base rule to `web/src/app/globals.css` and the extension's equivalent:

```css
@layer base {
  :focus-visible {
    outline: 2px solid var(--fn-accent-primary);
    outline-offset: 2px;
  }

  :focus:not(:focus-visible) {
    outline: none;
  }
}
```

This provides a universal fallback. The existing `.focus-ring` class can remain for components that need custom focus styling.

For the `.text-gradient` class (where focus ring is invisible due to transparent text fill), ensure any element using it is non-interactive, OR wrap it in a focusable parent that carries the focus ring.

### 2.4 Live Regions for Dynamic Content (P2)

Add `aria-live` regions for content that changes without a page navigation:

```tsx
// Loading state announcements
<div aria-live="polite" aria-busy={isGenerating}>
  {isGenerating ? 'Generating note...' : null}
</div>

// Success announcements
<div role="status" aria-live="polite">
  {note ? 'Note generated successfully' : null}
</div>

// Error announcements
<div role="alert" aria-live="assertive">
  {error ? `Error: ${error.message}` : null}
</div>
```

Key locations needing live regions:
- Note generation loading/completion in the extension
- Copy-to-clipboard feedback
- Form validation error messages (where not already using `role="alert"`)
- Character count updates (use `aria-live="polite"`)

### 2.5 Skip Navigation Link (P2)

Add as the first child inside `<body>` in `web/src/app/layout.tsx`:

```tsx
<body className={inter.className}>
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:text-brand-emerald-700 focus:rounded-fn-base focus:shadow-fn-md"
  >
    Skip to main content
  </a>
  <Providers>{children}</Providers>
</body>
```

Then add `id="main-content"` and `tabIndex={-1}` to the `<main>` element on each page (or in a shared layout component).

### 2.6 Semantic HTML Audit

Verify these patterns across both packages:

- All clickable elements use `<button>` or `<a>`, never `<div onClick={...}>`
- All form inputs have associated `<label>` elements (via `htmlFor`)
- Heading hierarchy is logical (no skipping levels, e.g., `<h1>` → `<h3>`)
- Page landmarks exist: `<header>`, `<nav>`, `<main>`, `<footer>`

The ESLint plugin will catch most of these, but do a quick manual scan for `div` or `span` elements with click handlers.

---

## Phase 3: Unit Test Accessibility Assertions

**Goal:** Add `toHaveNoViolations()` assertions to component tests using `vitest-axe`.

### 3.1 Install

```bash
pnpm --filter @flashnote/web add -D vitest-axe axe-core
pnpm --filter @flashnote/extension add -D vitest-axe axe-core
```

**Compatibility note:** The project uses Vitest 4. If `vitest-axe` has compatibility issues (it was built for earlier Vitest versions), fall back to using `axe-core` directly:

```ts
import axe from 'axe-core';
const results = await axe.run(container);
expect(results.violations).toEqual([]);
```

### 3.2 Extend Matchers Globally

Add to `web/src/test/setup.ts` and `extension/src/test/setup.ts`:

```ts
// Accessibility testing matchers
import 'vitest-axe/extend-expect';
```

Add this **after** the existing `@testing-library/jest-dom/vitest` import.

### 3.3 Create Shared Helper

Create `web/src/test/a11y.ts` and `extension/src/test/a11y.ts`:

```ts
import { axe, type AxeResults } from 'vitest-axe';

/**
 * Run axe accessibility checks on a rendered container.
 * Pre-configured for jsdom environment (disables color-contrast)
 * and targets WCAG AA compliance.
 */
export async function checkA11y(container: HTMLElement): Promise<AxeResults> {
  return axe(container, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    },
    rules: {
      // color-contrast cannot be tested in jsdom (no computed styles)
      // This is covered by @axe-core/playwright E2E tests instead
      'color-contrast': { enabled: false },
    },
  });
}
```

**Why disable `color-contrast`:** jsdom does not compute CSS styles, so axe-core cannot calculate actual contrast ratios. Color contrast is tested in Phase 4 via Playwright, which runs in a real browser.

### 3.4 Add Assertions to Key Component Tests

Add an accessibility test to each major component's existing test file. Pattern:

```ts
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { checkA11y } from '@/test/a11y';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  // ... existing tests ...

  it('should have no accessibility violations', async () => {
    const { container } = render(<MyComponent />);
    expect(await checkA11y(container)).toHaveNoViolations();
  });
});
```

Priority components to cover (both packages):
1. **Forms** — Login, Register, Reset Password, Settings
2. **Navigation** — Header, Footer, Nav
3. **Core product** — NoteGenerator, ResultDisplay (extension)
4. **Interactive elements** — Buttons, Modals, Alerts
5. **Page layouts** — Landing, Pricing, Dashboard

### CI Integration

No changes needed. These run via existing `pnpm test:ci` step in `.github/workflows/ci.yml`.

---

## Phase 4: E2E Accessibility Audits

**Goal:** Full-page accessibility audits in a real browser, including color contrast testing.

### 4.1 Install

```bash
pnpm --filter @flashnote/web add -D @axe-core/playwright
pnpm --filter @flashnote/extension add -D @axe-core/playwright
```

### 4.2 Web E2E Test

Create `web/tests/e2e/accessibility.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = [
  { name: 'Home', path: '/' },
  { name: 'Pricing', path: '/pricing' },
  { name: 'Login', path: '/login' },
  { name: 'Register', path: '/register' },
];

for (const { name, path } of pages) {
  test(`${name} page should have no WCAG AA violations`, async ({ page }) => {
    await page.goto(path);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
}

test('Login form should be keyboard navigable', async ({ page }) => {
  await page.goto('/login');

  await page.keyboard.press('Tab');
  const emailFocused = await page.evaluate(() =>
    document.activeElement?.getAttribute('type')
  );
  expect(emailFocused).toBe('email');

  await page.keyboard.press('Tab');
  const passwordFocused = await page.evaluate(() =>
    document.activeElement?.getAttribute('type')
  );
  expect(passwordFocused).toBe('password');

  await page.keyboard.press('Tab');
  const buttonFocused = await page.evaluate(() =>
    document.activeElement?.tagName.toLowerCase()
  );
  expect(buttonFocused).toBe('button');
});
```

### 4.3 Extension E2E Test

Create `extension/tests/e2e/accessibility.spec.ts` with equivalent tests for the side panel views (login, note input, result display, settings).

### CI Integration

No changes needed. These run via existing `.github/workflows/e2e.yml` which triggers on `web/**` and `extension/**` changes and executes `pnpm test:e2e:ci`.

---

## Phase 5: Dev-Time Overlay (Web Only)

**Goal:** Log accessibility violations to DevTools console during local development.

### 5.1 Install

```bash
pnpm --filter @flashnote/web add -D @axe-core/react
```

### 5.2 Create Dev Component

Create `web/src/components/AxeDevTools.tsx`:

```tsx
'use client';

import { useEffect } from 'react';

export function AxeDevTools() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      void Promise.all([
        import('react'),
        import('react-dom'),
        import('@axe-core/react'),
      ]).then(([React, ReactDOM, axe]) => {
        void axe.default(React, ReactDOM, 1000);
      });
    }
  }, []);

  return null;
}
```

### 5.3 Add to Layout

In `web/src/app/layout.tsx`, add inside the `<body>`:

```tsx
{process.env.NODE_ENV === 'development' && <AxeDevTools />}
```

**Do NOT add to the extension** — `@axe-core/react` requires a standard browser DOM context and won't work correctly in Chrome's side panel.

---

## Reference: What Automated Tools Cannot Catch

Automated tools (axe-core, Lighthouse, ESLint) catch roughly 30-57% of WCAG issues. The rest requires manual testing:

- **Logical reading order** — Does content make sense when linearized?
- **Meaningful link text** — "Click here" vs. descriptive text
- **Keyboard navigation flow** — Is the tab order logical?
- **Screen reader experience** — Do dynamic updates announce properly? (Test with VoiceOver: `Cmd+F5` on macOS)
- **Touch target size** — WCAG 2.2 requires 24x24px minimum (44x44px recommended)
- **Cognitive load** — Is the UI understandable for users with cognitive disabilities?

For a healthcare application with ADA/Section 508 exposure, periodic manual testing with VoiceOver is essential beyond what this plan covers.

---

## Reference: All Install Commands

```bash
# Phase 1: ESLint a11y plugin
pnpm --filter @flashnote/web add -D eslint-plugin-jsx-a11y
pnpm --filter @flashnote/extension add -D eslint-plugin-jsx-a11y

# Phase 3: Vitest axe (component tests)
pnpm --filter @flashnote/web add -D vitest-axe axe-core
pnpm --filter @flashnote/extension add -D vitest-axe axe-core

# Phase 4: Playwright axe (E2E tests)
pnpm --filter @flashnote/web add -D @axe-core/playwright
pnpm --filter @flashnote/extension add -D @axe-core/playwright

# Phase 5: Dev-time overlay (web only)
pnpm --filter @flashnote/web add -D @axe-core/react
```

## Reference: Key File Paths

| File | Purpose |
|------|---------|
| `web/eslint.config.mjs` | Web ESLint flat config — add jsx-a11y here |
| `extension/eslint.config.mjs` | Extension ESLint flat config — add jsx-a11y here |
| `web/src/test/setup.ts` | Web test setup — add vitest-axe matchers here |
| `extension/src/test/setup.ts` | Extension test setup — add vitest-axe matchers here |
| `shared/design-tokens-warm.css` | Color tokens — fix contrast values here |
| `web/src/app/globals.css` | Global CSS — add focus-visible base styles here |
| `web/src/app/layout.tsx` | Root layout — add skip nav + AxeDevTools here |
| `.github/workflows/ci.yml` | CI workflow — no changes needed (lint + test) |
| `.github/workflows/e2e.yml` | E2E workflow — no changes needed (playwright) |
