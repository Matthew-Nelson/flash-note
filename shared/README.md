# FlashNote Shared Design System

Shared design tokens and component styles for visual consistency between the web app and browser extension.

## Philosophy

This is **not** a shared component library. Each app owns its React components independently. We share:

1. **Design tokens** (colors, typography, spacing)
2. **Component CSS classes** (buttons, inputs, cards, etc.)
3. **Tailwind preset** (extends both apps with the same design vocabulary)

This approach gives us visual consistency without the complexity of a monorepo component library.

## Current Theme: Warm Wellness

The design system uses a **green-forward, warm background** aesthetic designed for healthcare/physical therapy environments:

| Element | Value | Purpose |
|---------|-------|---------|
| Primary | Emerald `#10b981` | Healing, growth, recovery |
| Secondary | Teal `#14b8a6` | Clinical + modern |
| Accent | Amber `#f59e0b` | Warm highlights |
| Background | Cream `#fdfcfb` | Reduces eye strain, human-centered |
| Neutrals | Stone palette | Warm grays (not cool slate) |

## Files

```
shared/
├── design-tokens-warm.css   # Warm Wellness theme tokens (CURRENT)
├── design-tokens.css        # Original theme tokens (archived)
├── components.css           # Shared component classes
├── tailwind-preset-warm.js  # Warm theme Tailwind config (CURRENT)
├── tailwind-preset.js       # Original Tailwind config (archived)
└── README.md                # This file
```

## Usage

### In CSS

Both apps import the design tokens and components in their main CSS file:

```css
/* For Warm Wellness theme (current) */
@import '../../../shared/design-tokens-warm.css';
@import '../../../shared/components.css';
```

Use the `--fn-*` prefixed variables:

```css
.my-component {
  background: var(--fn-bg-primary);
  color: var(--fn-text-primary);
  border-radius: var(--fn-radius-base);
}
```

### In Tailwind Classes

Both apps extend from the shared preset in their `tailwind.config`:

```js
// For Warm Wellness theme (current)
presets: [require('../shared/tailwind-preset-warm.js')]
```

Use the `fn-*` prefixed utilities:

```html
<div class="bg-fn-bg-primary text-fn-text-primary rounded-fn-base">
  Content
</div>

<button class="bg-fn-accent-primary text-white">
  Primary Action
</button>
```

### Component Classes

Use shared component classes for consistent styling:

```html
<!-- Buttons -->
<button class="btn-primary px-4 py-2">Primary Action</button>
<button class="btn-secondary px-4 py-2">Secondary Action</button>

<!-- Forms -->
<input class="input-field px-3 py-2" placeholder="Enter text..." />
<label class="label">Field Label</label>

<!-- Cards -->
<div class="card">
  <div class="card-header">Header</div>
  <div class="p-4">Content</div>
</div>

<!-- Feedback -->
<div class="alert alert-success">Success message</div>
<div class="alert alert-error">Error message</div>

<!-- Links -->
<a href="#" class="link">Gradient link</a>
```

## Design Tokens Reference

### Colors (Warm Wellness Theme)

| Token | Description |
|-------|-------------|
| `--fn-bg-primary` | Main background (warm cream) |
| `--fn-bg-secondary` | Section backgrounds (warm beige) |
| `--fn-bg-tertiary` | Hover states, subtle backgrounds |
| `--fn-card-bg` | Card backgrounds (white) |
| `--fn-text-primary` | Main text (warm dark) |
| `--fn-text-secondary` | Body text |
| `--fn-text-muted` | Placeholder, disabled text |
| `--fn-accent-primary` | Emerald (#10b981) |
| `--fn-accent-secondary` | Teal (#14b8a6) |
| `--fn-accent-tertiary` | Amber (#f59e0b) |
| `--fn-border-color` | Default border color |
| `--fn-success` | Success state green |
| `--fn-error` | Error state red |
| `--fn-warning` | Warning state amber |

### Typography

| Token | Value |
|-------|-------|
| `--fn-font-sans` | Inter, system fonts |
| `--fn-text-xs` | 0.75rem (12px) |
| `--fn-text-sm` | 0.875rem (14px) |
| `--fn-text-base` | 1.0625rem (17px) |
| `--fn-text-lg` | 1.125rem (18px) |
| `--fn-text-xl` | 1.25rem (20px) |
| `--fn-text-2xl` | 1.5rem (24px) |

### Spacing

| Token | Value |
|-------|-------|
| `--fn-space-1` | 0.25rem (4px) |
| `--fn-space-2` | 0.5rem (8px) |
| `--fn-space-3` | 0.75rem (12px) |
| `--fn-space-4` | 1rem (16px) |
| `--fn-space-6` | 1.5rem (24px) |
| `--fn-space-8` | 2rem (32px) |

### Border Radius

| Token | Value |
|-------|-------|
| `--fn-radius-sm` | 0.25rem (4px) |
| `--fn-radius-base` | 0.5rem (8px) |
| `--fn-radius-md` | 0.625rem (10px) |
| `--fn-radius-lg` | 0.75rem (12px) |
| `--fn-radius-xl` | 1rem (16px) |

## Component Classes Reference

| Class | Description |
|-------|-------------|
| `.btn-primary` | Gradient button (emerald→teal) |
| `.btn-secondary` | Outline button with gradient border |
| `.input-field` | Text input with gradient focus |
| `.label` | Form label styling |
| `.card` | Container with border and shadow |
| `.card-header` | Card header with accent bar |
| `.link` | Gradient text link |
| `.alert`, `.alert-success`, `.alert-error`, `.alert-warning` | Alert boxes |
| `.badge`, `.badge-trial`, `.badge-active`, `.badge-expired` | Status badges |
| `.loading-spinner` | Animated loading spinner |

## Design Decisions

1. **2-color gradients** - Cleaner and more professional than 3-color
2. **Static animations** - Buttons don't animate by default (less distracting for clinical use)
3. **Warm backgrounds** - Cream/beige reduces eye strain
4. **Green primary** - Represents healing/growth (appropriate for PT)
5. **17px base font** - Slightly larger for clinical readability

## Adding New Tokens

1. Add the CSS variable to `design-tokens-warm.css` under the appropriate section
2. Add the Tailwind utility to `tailwind-preset-warm.js` if needed
3. Document it in this README

Use the `--fn-` prefix for CSS variables and `fn-` prefix for Tailwind utilities to avoid conflicts with app-specific styles.
