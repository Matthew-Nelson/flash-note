# Design Direction: "Refined Teal" Rebrand

**Status:** Planning complete — implementation deferred to post-Tier 3
**Decision date:** Feb 2026
**Mockups:** `docs/design/*.html` (serve locally to view)

---

## Problem Statement

FlashNote's current "Warm Wellness" design (emerald/teal gradients, cream backgrounds, Inter font, stone neutrals) communicates "friendly wellness app" rather than "precise clinical AI tool." As we build the web app dashboard and compete with products like Twofold, the design needs to signal both **clinical trust** (PTs must trust us with patient data) and **AI credibility** (we're a serious technology company).

### Competitive context

Twofold uses a disconnected design: their marketing site (coral/salmon, editorial serif typography, warm cream) looks polished, but their product (generic blue, system font, minimal styling) feels like a developer prototype. This disconnect is a weakness — users feel a trust drop moving from marketing → app. Our opportunity is **design consistency across all surfaces**: one system, marketing through product.

---

## Design Direction: "Refined Teal" with Dark Sidebar

After evaluating multiple directions (dark authority/navy+gold, light sidebar, neutral-forward), we chose **Refined Teal with a dark sidebar** as the target direction.

### Why this direction

- **Deep teal is still in the green/health family** — maintains the healing/growth association without reading as "wellness spa"
- **Dark sidebar creates visual grounding** — anchors the navigation and makes the content area feel like a focused workspace. Scales well as feature density increases (patients, notes, templates, settings)
- **Slate neutrals replace stone** — cooler grays read as "technology" rather than "spa." Text feels sharper and more precise
- **Flat primary, no gradients** — gradients everywhere cheapens the brand. Flat `#0D6E6E` for 90% of UI. Reserve gradients for logo/wordmark only
- **Plus Jakarta Sans replaces Inter** — distinctive but professional. Avoids the "didn't pick a font" signal of Inter

### Rejected alternatives

| Direction | Why rejected |
|-----------|-------------|
| **Dark Authority** (navy `#0A2540` + gold `#C9952D`) | Strong "fintech" feel but too dramatic a departure. Gold accent felt luxury rather than clinical. Risk of alienating PTs who expect health-forward colors. |
| **Light Sidebar** (white sidebar, teal accents) | More open/airy (Notion-like) but the navigation blended into the background. Lost the visual grounding needed for a dense feature set. |
| **Neutral-forward** (grayscale + green accent only) | Maximum "serious software" signal but lost brand personality. FlashNote would be indistinguishable from any SaaS tool. |

---

## Design Specification

### Color Palette

```
Primary
  --primary:        #0D6E6E    (deep teal — actions, active states, CTAs)
  --primary-hover:  #0A5A5A    (hover/pressed state)
  --primary-light:  #E6F5F5    (subtle backgrounds, badges, highlights)
  --primary-50:     #F0FDFA    (hover rows, selected states)

Accent
  --accent:         #0EA5E9    (sky blue — secondary actions, info states, links)
  --accent-light:   #E0F2FE    (info badges, secondary highlights)

Surfaces
  --surface:        #F8FAFB    (page background — crisp near-white, not cream)
  --card:           #FFFFFF    (card/panel backgrounds)

Sidebar (dark)
  --sidebar-bg:         #0D3D3D    (deep dark teal)
  --sidebar-text:       #B8D8D8    (muted teal for inactive nav items)
  --sidebar-text-active:#FFFFFF    (active nav item)
  --sidebar-hover:      rgba(255,255,255,0.08)
  --sidebar-active:     rgba(255,255,255,0.12)

Text
  --text-primary:   #1E293B    (slate-800 — headings, body)
  --text-secondary: #64748B    (slate-500 — descriptions, secondary)
  --text-muted:     #94A3B8    (slate-400 — placeholders, meta)

Borders
  --border:         #E2E8F0    (slate-200 — standard borders)
  --border-subtle:  #F1F5F9    (slate-100 — inner dividers)

Semantic
  --success:        #059669    (emerald-600)
  --success-light:  #ECFDF5
  --error:          #DC2626
  --error-light:    #FEF2F2
  --warning:        #D97706
  --warning-light:  #FFFBEB
```

### What changes from current

| Token | Current (Warm Wellness) | New (Refined Teal) | Why |
|-------|------------------------|--------------------|----|
| Primary | `#047857` emerald-700 | `#0D6E6E` deep teal | Deeper, more authoritative |
| Neutrals | Stone family (warm gray) | Slate family (cool gray) | Reads "technology" not "spa" |
| Background | `#fdfcfb` cream | `#F8FAFB` cool near-white | Clean, clinical, not yellowed |
| Accent | `#f59e0b` amber | `#0EA5E9` sky blue | Blue = trust in healthcare; amber had no clear role |
| Gradients | Everywhere (buttons, text, borders, accents) | Logo/wordmark only | Flat = confident, mature |
| Font | Inter | Plus Jakarta Sans | Distinctive but professional |

### Typography

```
Font family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif
Font weights: 400 (body), 500 (medium), 600 (semibold labels), 700 (headings)

Scale (unchanged structure, new font):
  fn-xs:   12px
  fn-sm:   13px
  fn-base: 14px (slightly smaller than current 17px — clinical readability at desktop)
  fn-lg:   16px
  fn-xl:   18px
  fn-2xl:  20px
  fn-3xl:  24px
  fn-4xl:  28px

Letter spacing:
  Headings: -0.02em (tighter for Plus Jakarta Sans)
  Body: 0 (default)
  Labels/uppercase: 0.04em
```

### Border Radius

```
  --radius-sm:  6px   (small elements: badges, chips)
  --radius:     8px   (buttons, inputs, dropdowns)
  --radius-lg:  12px  (cards, panels, modals)
```

No `rounded-full` on containers/cards (playful → professional). Reserve full rounding for avatars and circular icon buttons only.

### Shadows

```
  --shadow-sm:  0 1px 2px rgba(0,0,0,0.05)
  --shadow:     0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)
  --shadow-lg:  0 4px 12px rgba(0,0,0,0.08)
```

Cards use `--shadow` on hover only (quiet by default, interactive on engage).

### Iconography

Replace emoji-based selectors (📋 🔍 📈 ✅) with a monochrome SVG icon set. Recommended: **Lucide Icons** (already used in the mockups). Consistent 2px stroke weight, single color matching text hierarchy.

---

## Component Patterns

### Buttons

```
Primary:   flat --primary background, white text. Hover: --primary-hover + subtle shadow.
Secondary: white background, --border border, --text-primary text. Hover: --surface bg.
Ghost:     no background/border, --text-secondary text. Hover: --surface bg.
```

No gradients on buttons. Lift effects (translateY) are optional — use sparingly.

### Section Cards (SOAP notes, dashboard cards)

```
Background: --card
Border:     1px solid --border
Radius:     --radius-lg (12px)
Shadow:     none by default, --shadow on hover

Section header: --surface background, 1px bottom border
Left accent stripe: 3px colored bar per section type
  Subjective: #0D6E6E (teal)
  Objective:  #0EA5E9 (sky)
  Assessment: #8B5CF6 (violet)
  Plan:       #059669 (emerald)
```

### Form Inputs

```
Border:      1px solid --border
Radius:      --radius (8px)
Focus:       border-color: --primary, box-shadow: 0 0 0 3px rgba(13,110,110,0.1)
Placeholder: --text-muted
```

### Sidebar Navigation

```
Dark background (--sidebar-bg: #0D3D3D)
Nav items: icon + text label (never icon-only)
Active state: --sidebar-active background, white text
"New Note" CTA: --primary background, white text (prominent)
Section labels: uppercase, muted, small
User footer: avatar + name + role at bottom
```

---

## Dashboard Layout (Web App)

```
┌──────────────────────────────────────────────────────────────┐
│ Sidebar (240px, dark)  │  Top bar (breadcrumb + actions)     │
│                        ├─────────────────────────────────────│
│  Logo                  │                                     │
│  Dashboard             │  Content area (--surface bg)        │
│  [+ New Note]          │                                     │
│  Notes                 │  Max-width: 860px for note views    │
│  Patients              │  No max-width for list/grid views   │
│                        │                                     │
│  MANAGE                │                                     │
│  Templates             │                                     │
│  Settings              │                                     │
│                        │                                     │
│  ─────────             │                                     │
│  User avatar + name    │                                     │
└────────────────────────┴─────────────────────────────────────┘
```

---

## Key Screens Designed

### 1. Dashboard (`/dashboard`)
- Stats row (4 cards: notes count, active patients, avg generation time, time saved)
- Recent notes list (table with note title, patient, type badge, date)
- Quick action cards (Generate Note, Add Patient, Browse Templates)
- Trial banner with upgrade CTA

**Mockup:** `docs/design/direction-a-refined-teal.html`

### 2. Note Generation Form (`/dashboard/notes/new`)
- Split layout: form (60%) + patient context panel (40%)
- Patient selector (searchable typeahead with avatar when selected)
- Template, modality (2-col), duration, date (2-col)
- Session notes textarea (hero element, largest visual weight)
- Context panel shows: patient background, last note summary, recent notes list
- Full-width "Generate Note" button

**Mockup:** `docs/design/direction-a-note-form.html`

### 3. Generated Note View (`/dashboard/notes/:id`)
- Auto-generated title + metadata bar (date, time, modality, duration, patient link, type badge)
- Action bar: Saved indicator, Copy All, Magic Edit, overflow menu
- SOAP sections as cards with colored left accents
- Per-section Copy + Edit buttons (Edit toggles inline textarea with Save/Cancel)
- Editing state: highlighted header, "Editing" badge, focused textarea
- Objective section uses structured subsections with bullet lists
- Rating (5-star) at bottom
- Generation metadata footer

**Mockup:** `docs/design/direction-a-note-result.html`

### 4. Light Sidebar Variant (rejected but preserved)
**Mockup:** `docs/design/direction-a2-light-sidebar.html`

### 5. Dark Authority Variant (rejected but preserved)
**Mockup:** `docs/design/direction-b-dark-authority.html`

---

## Marketing ↔ Product Consistency

**Principle: one design system, two expressions.**

The marketing site (Next.js web app) and the product (dashboard + extension) must use the same:
- Font family (Plus Jakarta Sans)
- Color palette (teal primary, slate neutrals, sky accent)
- Component DNA (border radius, shadow style, button treatment)

The marketing site gets a **display treatment**: larger typography, more whitespace, hero images, storytelling layouts. But it should be unmistakably the same brand as the product. When a PT moves from landing page → signup → dashboard, it should feel like walking from the lobby into the office of the same building.

**Do NOT:**
- Use a different font on the marketing site
- Use a different primary color on the marketing site
- Hire an agency to design the marketing page independently of the product design system

---

## Implementation Plan

### Phase 1: Token Migration
1. Create `shared/design-tokens-teal.css` with the new palette
2. Create `shared/tailwind-preset-teal.js` mapping to new tokens
3. Update `shared/components.css` to remove gradient patterns and use flat colors
4. Install Plus Jakarta Sans (Google Fonts) in extension, web, and any HTML templates

### Phase 2: Extension Update
1. Swap `tailwind-preset-warm.js` → `tailwind-preset-teal.js` in extension config
2. Update `extension/src/index.css` (loading animations, app container, document sections)
3. Replace emoji note type icons with Lucide SVG icons
4. Update floating button CSS to match new palette
5. Test all screens: login, generator, result display, settings

### Phase 3: Web App Dashboard
1. Build dashboard layout shell (sidebar + topbar + content area)
2. Implement screens using new design system from the start
3. The dashboard is net-new code — no migration needed, just build with new tokens

### Phase 4: Web Marketing Pages
1. Update existing Next.js pages to use new font + palette
2. Ensure landing page, pricing, auth pages all match product design

### Phase 5: Cleanup
1. Remove old token files (`design-tokens-warm.css`, `tailwind-preset-warm.js`)
2. Remove legacy files (`design-tokens.css`, `tailwind-preset.js`)
3. Archive this doc to `docs/archive/`

### Dependencies
- Phase 1-2 can be done independently of feature work
- Phase 3 depends on PHI storage (Tier 3) for the dashboard to have real data
- Phase 4 can be done anytime
- This work intersects with Tier 4 UI Quality items in ROADMAP.md — some P0/P1 items (contrast fixes, a11y) should be addressed during the token migration

---

## Appendix: Twofold Competitive Analysis (Design)

### Twofold's design weaknesses (exploitable)
- Marketing site and product are completely different visual identities (coral/serif vs blue/system font)
- Product UI is developer-quality: excessive whitespace, minimal styling, no visual hierarchy
- Icon-only sidebar navigation (no labels, requires guessing)
- No patient context visible during note generation
- Flat, unstructured note content (no subsection formatting in Objective)
- "Magic Edit" buried at bottom of long scroll
- "Special offer" banner in app header erodes clinical credibility
- All SOAP sections look identical (no color differentiation)

### Twofold's design strengths (learn from)
- Marketing page social proof: star ratings, user count, HIPAA badge, testimonials with photos
- Patient Instructions section (AI-generated take-home letter) — useful feature, add to Phase 2
- Notes list visible alongside the form (cross-patient context)
- Bold, high-contrast marketing headlines with strong typography
- Alternating section backgrounds on marketing page for visual rhythm
