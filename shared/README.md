# FlashNote Shared Design System

Lightweight shared design tokens for visual consistency between the web app and browser extension.

## Philosophy

This is **not** a shared component library. Each app owns its components independently. We only share:

1. **Design tokens** (colors, typography, spacing)
2. **Tailwind preset** (extends both apps with the same design vocabulary)

This approach gives us visual consistency without the complexity overhead of a monorepo component library.

## Files

```
shared/
├── design-tokens.css   # CSS custom properties for colors, spacing, etc.
├── tailwind-preset.js  # Shared Tailwind configuration
└── README.md           # This file
```

## Usage

### In CSS

Both apps import the design tokens in their main CSS file:

```css
@import '../../../shared/design-tokens.css';
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
presets: [require('../shared/tailwind-preset.js')]
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

## Design Tokens Reference

### Colors

| Token | Description |
|-------|-------------|
| `--fn-bg-primary` | Main background (white in light mode) |
| `--fn-bg-secondary` | Card/section backgrounds |
| `--fn-bg-tertiary` | Subtle backgrounds, hover states |
| `--fn-text-primary` | Main text color |
| `--fn-text-secondary` | Secondary/body text |
| `--fn-text-muted` | Placeholder, disabled text |
| `--fn-accent-primary` | Brand cyan (#06b6d4) |
| `--fn-accent-secondary` | Brand violet (#8b5cf6) |
| `--fn-accent-tertiary` | Brand pink (#ec4899) |
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
| `--fn-text-base` | 1rem (16px) |
| `--fn-text-lg` | 1.125rem (18px) |
| `--fn-text-xl` | 1.25rem (20px) |
| `--fn-text-2xl` | 1.5rem (24px) |
| `--fn-text-3xl` | 1.875rem (30px) |
| `--fn-text-4xl` | 2.25rem (36px) |

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

## Design Style

FlashNote uses a clean, professional "Gradient Accent" design style featuring:

- White backgrounds with subtle gradients
- Cyan (#06b6d4), Violet (#8b5cf6), and Pink (#ec4899) brand accents
- Modern, accessible styling for healthcare environments

## Adding New Tokens

1. Add the CSS variable to `design-tokens.css` under the appropriate section
2. Add the Tailwind utility to `tailwind-preset.js` if needed
3. Document it in this README

Use the `--fn-` prefix for CSS variables and `fn-` prefix for Tailwind utilities to avoid conflicts with app-specific styles.
