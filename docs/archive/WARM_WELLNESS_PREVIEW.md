# Warm Wellness Theme - Visual Preview

This document shows the concrete differences between the current and proposed theme.

---

## Color Palette Comparison

### Backgrounds

| Role | Current | Proposed |
|------|---------|----------|
| Primary BG | `#ffffff` Pure white | `#fdfcfb` Warm cream |
| Secondary BG | `#f8fafc` Cool slate | `#f7f5f3` Warm stone |
| Tertiary BG | `#f1f5f9` Cool gray | `#f0edeb` Warm beige |
| Card BG | `#ffffff` | `#ffffff` (cards stay white to "float") |

**Visual difference:** The overall canvas has a subtle warmth, similar to Claude's interface. Cards appear to float on the cream background.

### Brand Colors

| Role | Current | Proposed |
|------|---------|----------|
| Primary | `#06b6d4` Cyan | `#10b981` Emerald |
| Secondary | `#8b5cf6` Violet | `#14b8a6` Teal |
| Tertiary | `#ec4899` Pink | `#f59e0b` Amber |

### Gradient Comparison

**Current (3-color, animated):**
```css
background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%);
animation: gradient-shift 3s ease infinite;
```

**Proposed (2-color, static by default):**
```css
background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
/* No animation - cleaner for clinical use */
```

### Neutral Text Colors

| Role | Current (Cool Slate) | Proposed (Warm Stone) |
|------|---------------------|----------------------|
| Primary | `#0f172a` | `#1c1917` |
| Secondary | `#475569` | `#57534e` |
| Muted | `#64748b` | `#78716c` |

---

## Component Previews

### Primary Button

```
┌─────────────────────────────────────────────────────────────┐
│  CURRENT                        PROPOSED                    │
│                                                             │
│  ┌──────────────────┐          ┌──────────────────┐        │
│  │ Generate Note    │          │ Generate Note    │        │
│  │                  │          │                  │        │
│  │ Cyan→Violet→Pink │          │ Emerald → Teal   │        │
│  │ (animated)       │          │ (static)         │        │
│  └──────────────────┘          └──────────────────┘        │
│                                                             │
│  • 3-color rainbow gradient     • 2-color green gradient   │
│  • Constantly animating         • Static (calmer)          │
│  • Violet glow on hover         • Green glow on hover      │
└─────────────────────────────────────────────────────────────┘
```

### Secondary Button (Outline)

```
┌─────────────────────────────────────────────────────────────┐
│  CURRENT                        PROPOSED                    │
│                                                             │
│  ┌──────────────────┐          ┌──────────────────┐        │
│  │ Cancel           │          │ Cancel           │        │
│  │ ═══════════════  │          │ ═══════════════  │        │
│  │ Rainbow border   │          │ Green border     │        │
│  └──────────────────┘          └──────────────────┘        │
│                                                             │
│  Border: Cyan→Violet→Pink       Border: Emerald→Teal       │
└─────────────────────────────────────────────────────────────┘
```

### App Header Bar

```
┌─────────────────────────────────────────────────────────────┐
│  CURRENT                                                    │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  FlashNote                                     [≡]    │ │
│  │══════════════════════════════════════════════════════ │ │
│  │  ↑ Rainbow gradient bar (cyan→violet→pink, animated)  │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  PROPOSED                                                   │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  FlashNote                                     [≡]    │ │
│  │══════════════════════════════════════════════════════ │ │
│  │  ↑ Green gradient bar (emerald→teal, slower/static)   │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Card Component

```
┌─────────────────────────────────────────────────────────────┐
│  CURRENT                        PROPOSED                    │
│                                                             │
│  On white background            On cream background         │
│  ┌─────────────────────┐       ┌─────────────────────┐     │
│  │▌Patient Info        │       │▌Patient Info        │     │
│  │▌───────────────────│       │▌───────────────────│     │
│  │ Content here...     │       │ Content here...     │     │
│  │                     │       │                     │     │
│  └─────────────────────┘       └─────────────────────┘     │
│   ↑                             ↑                          │
│   Rainbow accent bar            Green accent bar           │
│   Cool gray header              Warm beige header          │
│   White card on white           White card on cream        │
│   (flat)                        (subtle float effect)      │
└─────────────────────────────────────────────────────────────┘
```

### Input Field Focus State

```
┌─────────────────────────────────────────────────────────────┐
│  CURRENT (focused)              PROPOSED (focused)          │
│                                                             │
│  ┌═══════════════════════┐     ┌═══════════════════════┐   │
│  │ Patient name...       │     │ Patient name...       │   │
│  └═══════════════════════┘     └═══════════════════════┘   │
│   ↑ Rainbow border              ↑ Green border             │
│   + Violet glow                 + Green glow               │
└─────────────────────────────────────────────────────────────┘
```

### Loading Spinner

```
┌─────────────────────────────────────────────────────────────┐
│  CURRENT                        PROPOSED                    │
│                                                             │
│       ●                              ●                      │
│      ╱ ╲                            ╱ ╲                     │
│     ╱   ╲                          ╱   ╲                    │
│    ●     ●                        ●     ●                   │
│    │     │                        │     │                   │
│    │ ◉◉◉ │ ← Rainbow core         │ ◉◉◉ │ ← Green core     │
│    │     │                        │     │                   │
│    ●     ●                        ●     ●                   │
│     ╲   ╱  Cyan dot               ╲   ╱  Emerald dot       │
│      ╲ ╱   Violet dot              ╲ ╱   Teal dot          │
│       ●    Pink dot                 ●    Amber dot         │
│                                                             │
│  Same structure, harmonious       Same structure, calmer    │
│  but jarring colors               earth-tone colors         │
└─────────────────────────────────────────────────────────────┘
```

**The spinner keeps its orbital design** - just with the new color scheme it should feel more cohesive and less like a disco.

---

## Full Interface Mockup

### Current Theme

```
┌─────────────────────────────────────────────────────────────┐
│  Background: Pure White #ffffff                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  FlashNote  (cyan→violet→pink gradient, animated)     │ │
│  │═══════════════════════════════════════════════════════│ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │▌ SOAP Note Generator                                │   │
│  │▌────────────────────────────────────────────────────│   │
│  │                                                      │   │
│  │  Shorthand Input                                     │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │ Enter your notes...                          │   │   │
│  │  │                                              │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │                                                      │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │         Generate Note                          │ │   │
│  │  │      (cyan→violet→pink, animated)              │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Feel: Vibrant, consumer-app, energetic                     │
└─────────────────────────────────────────────────────────────┘
```

### Proposed Theme

```
┌─────────────────────────────────────────────────────────────┐
│  Background: Warm Cream #fdfcfb                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  FlashNote  (emerald→teal gradient, static)           │ │
│  │═══════════════════════════════════════════════════════│ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │▌ SOAP Note Generator                (white card)    │   │
│  │▌────────────────────────────────────────────────────│   │
│  │                                                      │   │
│  │  Shorthand Input                                     │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │ Enter your notes...              (white)     │   │   │
│  │  │                                              │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │                                                      │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │         Generate Note                          │ │   │
│  │  │        (emerald→teal, static)                  │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Feel: Professional, calm, healthcare-appropriate           │
└─────────────────────────────────────────────────────────────┘
```

---

## Side-by-Side Color Swatches

### Primary Palette

```
CURRENT                          PROPOSED
─────────────────────────────────────────────────────────────

Cyan     ████████  #06b6d4       Emerald  ████████  #10b981
Violet   ████████  #8b5cf6       Teal     ████████  #14b8a6
Pink     ████████  #ec4899       Amber    ████████  #f59e0b

         Energetic, playful               Calm, healing
```

### Background Progression

```
CURRENT (Cool)                   PROPOSED (Warm)
─────────────────────────────────────────────────────────────

Primary  ████████  #ffffff       Primary  ████████  #fdfcfb
         Pure white                       Warm cream

Second.  ████████  #f8fafc       Second.  ████████  #f7f5f3
         Cool blue-gray                   Warm beige

Tertiary ████████  #f1f5f9       Tertiary ████████  #f0edeb
         Cool slate                       Warm stone
```

### Text Colors

```
CURRENT (Cool Slate)             PROPOSED (Warm Stone)
─────────────────────────────────────────────────────────────

Primary  ████████  #0f172a       Primary  ████████  #1c1917
Secondary████████  #475569       Secondary████████  #57534e
Muted    ████████  #64748b       Muted    ████████  #78716c

         Slightly blue undertone          Slightly brown undertone
```

---

## Animation Changes

| Element | Current | Proposed |
|---------|---------|----------|
| Header gradient bar | 3s animation loop | 8s loop (or static) |
| Primary button | 3s animation loop | Static (add `.animated` class for marketing) |
| App title gradient | 5s animation loop | Static (add `.animated` class for marketing) |
| Loading spinner | Same speed | Same speed (this animation is functional) |

**Philosophy:** Functional animations (loading, transitions) stay. Decorative animations become optional.

---

## Implementation Files

The following files have been created:

| File | Purpose |
|------|---------|
| `shared/design-tokens-warm.css` | Complete token definitions for warm theme |
| `shared/components-warm.css` | Component class overrides with new colors |

### To Test

1. In `extension/src/sidepanel/index.css`, replace:
   ```css
   @import '../../../shared/design-tokens.css';
   ```
   with:
   ```css
   @import '../../../shared/design-tokens-warm.css';
   @import '../../../shared/components-warm.css';
   ```

2. Rebuild the extension and test

### To Revert

Simply restore the original import.

---

## Summary

| Aspect | Change |
|--------|--------|
| Background | White → Warm cream |
| Primary color | Cyan → Emerald green |
| Secondary color | Violet → Teal |
| Accent color | Pink → Amber |
| Gradients | 3-color animated → 2-color static |
| Text | Cool slate → Warm stone |
| Spinner | Same design, new colors |
| Overall feel | "Tech startup" → "Wellness professional" |

The changes are primarily color swaps and animation reductions. The component structure, spacing, and interaction patterns remain identical.
