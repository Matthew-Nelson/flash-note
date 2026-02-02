# FlashNote Unified Styling System Plan

> **Status**: Planned (not yet implemented)
> **Created**: January 2026
> **Priority**: Important but not immediate

## Problem Summary

The extension and web app have divergent styling approaches:
- **Extension**: Rich component CSS classes (`.btn-primary`, `.card`, `.input-field`, etc.) but uses non-standard variable prefixes (`--bg-*` instead of `--fn-*`)
- **Web**: Inline Tailwind utilities with minimal custom CSS
- **Result**: Visual inconsistency, duplicated code, maintenance burden

## Recommended Approach: Shared CSS Component Layer

Create a unified CSS component library that both apps import. NOT a React component library (too much overhead for a small team).

---

## Architecture

```
shared/
├── design-tokens.css      # Foundation: colors, spacing, typography (EXISTS)
├── components.css         # NEW: Component styles (.fn-btn, .fn-input, etc.)
├── tailwind-preset.js     # Tailwind integration (EXISTS, expand)
└── README.md              # Documentation (update)
```

Both apps import:
```css
@import '../../../shared/design-tokens.css';
@import '../../../shared/components.css';
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## Phase 1: Foundation Consolidation

**Goal**: Fix token inconsistencies, add missing tokens from extension

### Files to Modify
- `/shared/design-tokens.css` - Add missing tokens:
  - `--fn-trial-bg`, `--fn-trial-border` (currently only in extension)

  Note: `--fn-error-light` and `--fn-success-light` already exist in shared tokens.

- `/shared/tailwind-preset.js` - Add Tailwind utilities for new tokens

### Decision: Border Radius
- **Standardize on 8px** (`--fn-radius-base`)
- Extension's 10px usage will be updated to use 8px for consistency
- This creates a tighter, more professional look across both apps

---

## Phase 2: Create Shared Component CSS

**Goal**: Extract reusable component styles with `fn-` namespace

### Create `/shared/components.css`

Components to include (extracted from extension):

| Component | Class Names | Description |
|-----------|-------------|-------------|
| Buttons | `.fn-btn`, `.fn-btn-primary`, `.fn-btn-secondary`, `.fn-btn-icon` | Gradient primary, outline secondary |
| Inputs | `.fn-input`, `.fn-label` | Gradient focus border, consistent styling |
| Cards | `.fn-card`, `.fn-card-header` | Elevated container with gradient accent |
| Feedback | `.fn-error-message`, `.fn-success-message` | Status messages |
| Links | `.fn-link` | Gradient text link |
| Text | `.fn-text-gradient`, `.fn-text-gradient-animated` | Brand gradient text |
| Loading | `.fn-spinner` | Animated loading spinner |
| Borders | `.fn-border-gradient` | Gradient border effect |

### Component CSS Structure
```css
/* Example: Primary Button */
.fn-btn {
  @apply inline-flex items-center justify-center font-medium transition-all;
  border-radius: var(--fn-radius-md);
}

.fn-btn-primary {
  @apply text-white border-none relative overflow-hidden;
  background: linear-gradient(135deg, var(--fn-accent-primary), var(--fn-accent-secondary), var(--fn-accent-tertiary));
  background-size: 200% 200%;
  animation: fn-gradient-shift 3s ease infinite;
}

.fn-btn-primary:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 4px 20px var(--fn-accent-glow);
}

.fn-btn-primary:disabled {
  @apply opacity-50 cursor-not-allowed;
  animation: none;
}
```

---

## Phase 3: Migrate Extension

**Goal**: Update extension to use shared component classes

### 3.1 Variable Replacement Map

| Extension Variable | Shared Variable |
|-------------------|-----------------|
| `--bg-primary` | `var(--fn-bg-primary)` |
| `--bg-secondary` | `var(--fn-bg-secondary)` |
| `--text-primary` | `var(--fn-text-primary)` |
| `--text-secondary` | `var(--fn-text-secondary)` |
| `--accent-primary` | `var(--fn-accent-primary)` |
| `--border-color` | `var(--fn-border-color)` |
| `--error` | `var(--fn-error)` |
| `--success` | `var(--fn-success)` |
| ... | (15+ total replacements) |

### 3.2 Class Replacement Map

| Extension Class | Shared Class |
|----------------|--------------|
| `.btn-primary` | `.fn-btn.fn-btn-primary` |
| `.btn-secondary` | `.fn-btn.fn-btn-secondary` |
| `.input-field` | `.fn-input` |
| `.card` | `.fn-card` |
| `.card-header` | `.fn-card-header` |
| `.label` | `.fn-label` |
| `.link` | `.fn-link` |
| `.error-message` | `.fn-error-message` |
| `.loading-spinner` | `.fn-spinner` |

### 3.3 Files to Update
- `/extension/src/sidepanel/index.css` - Remove local variables and duplicate classes
- `/extension/src/sidepanel/App.tsx`
- `/extension/src/sidepanel/components/LoginForm.tsx`
- `/extension/src/sidepanel/components/NoteGenerator.tsx`
- `/extension/src/sidepanel/components/Settings.tsx`
- `/extension/src/sidepanel/components/ResultDisplay.tsx`
- `/extension/src/sidepanel/components/SessionAlert.tsx`

### 3.4 Migration Strategy: Direct Replacement
- Search-replace all class names at once
- Test thoroughly after each component file update
- No aliases needed - cleaner codebase

---

## Phase 4: Migrate Web App

**Goal**: Replace verbose inline Tailwind with shared component classes

### Example Transformations

**Login Button**:
```tsx
// Before (47 classes)
<button className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50">

// After (5 classes)
<button className="fn-btn fn-btn-primary w-full py-2 px-4 text-sm">
```

**Input Field**:
```tsx
// Before
<input className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500" />

// After
<input className="fn-input px-3 py-2" />
```

### Files to Update
- `/web/src/app/globals.css` - Import shared components, remove duplicates
- `/web/src/app/login/page.tsx`
- `/web/src/app/signup/page.tsx`
- `/web/src/app/dashboard/page.tsx`
- `/web/src/app/forgot-password/page.tsx`
- `/web/src/app/reset-password/page.tsx`
- `/web/src/app/verify-email/page.tsx`
- `/web/src/app/resend-verification/page.tsx`

---

## Phase 5: Cleanup and Documentation

- Remove all deprecated local CSS from extension
- Remove duplicate animations (use `fn-*` versions)
- Update `/shared/README.md` with component reference
- Remove `.text-gradient` etc. from web globals (now in shared)

---

## Tailwind v4 Compatibility

This plan supports future Tailwind v4 migration:
- CSS custom properties are already primary (v4 pattern)
- `@apply` usage is contained in shared components only
- Colors reference CSS variables, not hardcoded JS values
- Can convert `tailwind-preset.js` to `@theme` directive later

### Tailwind v3 → v4 Key Changes (for reference)

| v3 Class | v4 Class |
|----------|----------|
| `shadow-sm` | `shadow-xs` |
| `shadow` | `shadow-sm` |
| `rounded-sm` | `rounded-xs` |
| `rounded` | `rounded-sm` |
| `outline-none` | `outline-hidden` |
| `ring` (3px) | `ring-3` |

Configuration moves from `tailwind.config.js` to CSS `@theme` directive.

---

## Verification Plan

1. **Visual regression**: Compare screenshots before/after each phase
2. **Extension testing**: Load extension, test all views (login, generator, settings, results)
3. **Web testing**: Test all auth pages, dashboard, pricing
4. **Cross-browser**: Chrome, Firefox, Safari for web
5. **Build verification**: `pnpm build` succeeds in both projects
6. **Accessibility**: Focus states, reduced motion still work

---

## Risk Assessment

| Phase | Risk | Mitigation |
|-------|------|------------|
| 1 | Low | Additive only, no breaking changes |
| 2 | Low | New files, existing code unchanged |
| 3 | Medium-High | Test thoroughly after each file update |
| 4 | Low | Simpler components, easier to verify |
| 5 | Low | Cleanup after all tests pass |

---

## Decisions Made

1. **Border radius**: Standardize on 8px
2. **Migration approach**: Direct replacement (no aliases)
3. **Scope priority**: Extension first, then web

## Execution Order

1. Phase 1: Foundation consolidation (shared tokens)
2. Phase 2: Create `/shared/components.css`
3. Phase 3: Migrate extension (priority)
4. Phase 4: Migrate web app
5. Phase 5: Cleanup and documentation

---

## Current State Reference

### Extension CSS Variables (to be replaced)
Located in `/extension/src/sidepanel/index.css`:
- 15+ local variables with `--bg-*`, `--text-*`, `--accent-*` prefixes
- Should use `--fn-*` prefix from shared design tokens

### Extension Component Classes (to be extracted)
- `.btn-primary`, `.btn-secondary` - Button styles
- `.input-field` - Form input styling
- `.card`, `.card-header` - Card container
- `.loading-spinner` - Loading animation
- `.error-message` - Error feedback
- `.success-checkmark-*` - Success animation
- `.trial-banner` - Trial status banner

### Web Utilities (to be consolidated)
Located in `/web/src/app/globals.css`:
- `.text-gradient`, `.text-gradient-animated` - Gradient text
- `.border-gradient` - Gradient border
- `.focus-ring` - Focus indicator
