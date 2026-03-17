# FlashNote Design System — Refined Teal

Source of truth for all visual design tokens, typography, and principles. Extracted from the HTML mockups in `docs/design/`.

Implementation: `web/design-system/design-tokens-teal.css` + `web/design-system/tailwind-preset-teal.js`

---

## Color Palette

### Primary

| Token | Value | Usage |
|-------|-------|-------|
| `--fn-primary` | `#0D6E6E` | Buttons, links, active states, brand |
| `--fn-primary-hover` | `#0A5A5A` | Button hover, interactive hover |
| `--fn-primary-light` | `#E6F5F5` | Light tints, selected states, ghost button hover |
| `--fn-primary-50` | `#F0FDFA` | Subtle backgrounds (editing state) |

### Accent

| Token | Value | Usage |
|-------|-------|-------|
| `--fn-accent` | `#0EA5E9` | Secondary actions, Objective section accent |
| `--fn-accent-light` | `#E0F2FE` | Accent tints |

### SOAP Section Accents

| Token | Value | Section |
|-------|-------|---------|
| `--fn-soap-subjective` | `#0D6E6E` | Subjective — teal |
| `--fn-soap-objective` | `#0369A1` | Objective — sky-800 |
| `--fn-soap-assessment` | `#7C3AED` | Assessment — violet-600 |
| `--fn-soap-plan` | `#047857` | Plan — emerald-700 |

### Neutrals (Slate)

| Token | Value | Usage |
|-------|-------|-------|
| `--fn-slate-50` | `#F8FAFC` | — |
| `--fn-slate-100` | `#F1F5F9` | Subtle separators, hover bg |
| `--fn-slate-200` | `#E2E8F0` | Default borders |
| `--fn-slate-300` | `#CBD5E1` | — |
| `--fn-slate-400` | `#94A3B8` | Placeholders, muted text |
| `--fn-slate-500` | `#64748B` | Secondary text |
| `--fn-slate-600` | `#475569` | — |
| `--fn-slate-700` | `#334155` | — |
| `--fn-slate-800` | `#1E293B` | Headings, body text |
| `--fn-slate-900` | `#0F172A` | Darkest text |

### Surfaces

| Token | Value | Usage |
|-------|-------|-------|
| `--fn-bg-surface` | `#F8FAFB` | Page background |
| `--fn-bg-card` | `#FFFFFF` | Card/panel backgrounds |
| `--fn-sidebar-bg` | `#0D3D3D` | Sidebar background |
| `--fn-sidebar-text` | `#B8D8D8` | Sidebar inactive text |
| `--fn-sidebar-text-active` | `#FFFFFF` | Sidebar active text |

### Semantic

| Token | Value | Usage |
|-------|-------|-------|
| `--fn-success` / light / dark | `#059669` / `#ECFDF5` / `#047857` | Success states |
| `--fn-error` / light / dark | `#EF4444` / `#FEF2F2` / `#DC2626` | Error states |
| `--fn-warning` / light / dark | `#D97706` / `#FFFBEB` / `#B45309` | Warning states |
| `--fn-info` / light / dark | `#0EA5E9` / `#E0F2FE` / `#0284C7` | Info states |

---

## Typography

### Font

**Plus Jakarta Sans** (400, 500, 600, 700) via `next/font/google`

Fallback: `-apple-system, BlinkMacSystemFont, sans-serif`

Replaces Inter. Plus Jakarta Sans is more distinctive and friendly while remaining professional — avoids the "generic tech product" feel of Inter.

### Scale

| Token | Size | Usage |
|-------|------|-------|
| `--fn-text-2xs` | 11px | Uppercase labels |
| `--fn-text-xs` | 12px | Helper text |
| `--fn-text-sm` | 13px | Body small |
| `--fn-text-base` | 14px | Body text, inputs |
| `--fn-text-lg` | 18px | Logo |
| `--fn-text-xl` | 20px | Page titles |
| `--fn-text-2xl` | 24px | Note titles |

### Letter Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--fn-tracking-tight` | `-0.02em` | Headings |
| `--fn-tracking-normal` | `-0.01em` | Subheadings |
| `--fn-tracking-wide` | `0.04em` | Uppercase labels |
| `--fn-tracking-wider` | `0.08em` | Uppercase small labels |

---

## Spacing & Surfaces

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--fn-radius-sm` | 6px | Small elements |
| `--fn-radius-base` | 8px | Default (buttons, inputs) |
| `--fn-radius-lg` | 12px | Cards, panels |
| `--fn-radius-xl` | 16px | Large containers |
| `--fn-radius-badge` | 20px | Badges, pills |

### Shadows

| Token | Value |
|-------|-------|
| `--fn-shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` |
| `--fn-shadow-base` | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` |
| `--fn-shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.04)` |
| `--fn-shadow-lg` | `0 4px 12px rgba(0,0,0,0.08)` |

### Layout Dimensions

| Token | Value | Usage |
|-------|-------|-------|
| `--fn-sidebar-width` | 240px | Sidebar |
| `--fn-context-panel-width` | 340px | Right context panel |
| `--fn-content-max-width` | 860px | Centered content (note result) |

### Responsive Breakpoints

| Token | Value | Behavior |
|-------|-------|----------|
| `sm` | 640px | Single-column forms |
| `md` | 768px | Sidebar collapses to icon rail or off-canvas drawer with hamburger toggle |
| `lg` | 1024px | Full sidebar visible, two-column form rows |
| `xl` | 1280px | Context panel visible alongside note form |

**Mobile sidebar strategy:** Below `md`, the sidebar is hidden off-canvas and toggled via a hamburger button in the top bar. The top bar gains a left-aligned menu button at this breakpoint. No icon-rail mode — full hide/show for simplicity.

**Tablet consideration:** PTs commonly use tablets between patients. The `md`–`lg` range (768–1024px) should be usable with the sidebar collapsed and single-column form layout.

---

## Component CSS Classes

Component-level classes are defined in `web/design-system/components.css`. These compose design tokens into reusable styles:

| Class | Purpose |
|-------|---------|
| `input-field` | Text inputs, selects, textareas — border, radius, focus ring, placeholder color |
| `label` | Form labels — size, weight, color |
| `btn-primary` | Teal fill button — bg, text, hover, focus ring, disabled state |
| `btn-secondary` | Bordered button — border, text, hover bg, focus ring |
| `btn-ghost` | Transparent button — text only, hover bg, focus ring |
| `card` | Card container — bg, border, radius, shadow |
| `badge` | Pill badge — padding, radius, font size |
| `badge-trial` | Trial status badge variant |

All button classes include `focus-visible:ring-2 focus-visible:ring-fn-primary-DEFAULT focus-visible:ring-offset-2` for keyboard accessibility.

---

## Design Principles

1. **No gradients in UI.** Gradients are reserved for the logo/wordmark only. Buttons, links, text, and accents use flat solid colors.

2. **Flat primary buttons.** Teal fill (`#0D6E6E`), white text, subtle hover darkening. No gradient fills, no lift/glow effects.

3. **Cool slate neutrals.** Slate (`#E2E8F0`, `#64748B`, `#1E293B`) replaces warm stone (`#e7e5e4`, `#57534e`, `#1c1917`). Reads clinical, not spa.

4. **Dark sidebar for visual grounding.** `#0D3D3D` dark teal sidebar provides navigation anchoring and visual weight on the left edge.

5. **Colored accent bars on SOAP sections.** 3px vertical bars on the left edge of each SOAP section card — Subjective (teal), Objective (sky), Assessment (violet), Plan (green). Not background fills.

6. **Plus Jakarta Sans replaces Inter.** More distinctive character, avoids the "every AI product uses Inter" association. Loaded via `next/font/google` for performance.

7. **Contrast-first color choices.** All text colors meet WCAG AA (4.5:1 minimum). Primary teal `#0D6E6E` achieves 5.2:1 on white. No gradient text anywhere.
