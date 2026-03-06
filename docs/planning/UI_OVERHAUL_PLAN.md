# UI Overhaul Plan — Refined Teal

Comprehensive implementation plan for the FlashNote UI overhaul. Supersedes the UI-2 through UI-5 items in `ROADMAP.md`.

**Foundation complete:** UI-1 (design tokens, Tailwind preset, Plus Jakarta Sans, globals.css) is done. This plan covers everything from sidebar layout through final polish.

**Reference docs:**
- Design tokens: [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Implementation: `web/design-system/design-tokens-teal.css`
- Component patterns: [COMPONENT_PATTERNS.md](./COMPONENT_PATTERNS.md)
- Design mockups: `docs/design/direction-a-*.png`
- Accessibility rules: `CLAUDE.md` Rules 11-14
- UI audit findings: `docs/compliance/UI_AUDIT.md`

---

## Design Decisions (Settled)

These decisions came from the UI/UX audit (March 2026) and are not up for re-evaluation without new evidence.

| Decision | Rationale |
|----------|-----------|
| **Keep `#0D6E6E` primary teal** | Deeper and more authoritative than generic healthcare cyan (`#0891B2`). 5.2:1 contrast on white. Differentiates from "every health app" blue. |
| **Keep Plus Jakarta Sans** | Confirmed as strong choice for SaaS dashboards. More distinctive than Inter while remaining professional. |
| **Uniform accent bar on note sections** | Single teal left border (`--fn-primary`) on all note sections. Sections may become dynamic/variable (custom templates, non-SOAP formats), so hardcoded section-to-color mappings would break. One accent color keeps the visual identity without coupling to a fixed schema. |
| **Dark sidebar (`#0D3D3D`)** | Creates "workspace tool" feeling. PTs will have this open alongside their EMR. Signals density and professionalism. |
| **Cool slate neutrals, not warm grays** | Reads "clinical technology," not "wellness spa." `#F8FAFB` background + slate text. |
| **No gradients in UI** | Flat colors only. Gradients reserved for logo/wordmark. Ensures WCAG AA contrast everywhere. |
| **No neumorphism** | Recommended as secondary style for healthcare by pattern databases, but it reduces contrast and looks dated. Skip it. |
| **No dark mode (v1)** | PT offices are well-lit. Dark mode adds complexity without meaningful value for the target user. Defer indefinitely. |
| **No animations beyond functional feedback** | Copy confirmation, loading states, transitions. No decorative motion. Respect `prefers-reduced-motion`. |
| **Monospace for clinical data** | CPT codes, ROM measurements, abbreviations use `font-mono`. Signals domain expertise. |
| **44px minimum touch targets** | All interactive elements. Non-negotiable per WCAG and UI/UX audit. |
| **Skeleton loaders over spinners** | Content-shaped loading placeholders instead of centered spinners. Prevents layout shift and feels faster. |
| **Icon-only buttons always have `aria-label`** | Rule 11. No exceptions. |
| **Word count over character count** | Show word count as the primary indicator on textareas. More meaningful to clinicians than "487/5000 characters." Keep max character enforcement in Zod validation. |
| **"Generate Professional Note" CTA copy** | Not "Generate SOAP Note." "Professional" communicates value to the PT, not implementation format. |
| **Uniform accent color adopted** | Use single teal accent bar (`--fn-primary`) on all note sections. Sections may become dynamic/variable in future (custom templates, non-SOAP formats), so per-section color mapping would create a maintenance burden and break for non-standard schemas. |

---

## Design Identity Guidelines

What makes FlashNote feel like a clinical tool rather than a generic SaaS product. Every phase must adhere to these principles.

**Do:**
- Use a uniform teal accent bar on note section cards — consistent visual identity that works regardless of section names or count
- Favor data density over whitespace — PTs are used to EMR interfaces, not marketing sites
- Use `font-mono` for any clinical data (CPT codes, ROM, abbreviations, structured output)
- Show generation metadata transparently (time, model, confidence) — builds clinician trust
- Use flat, solid colors for all interactive elements
- Use cool slate neutrals (`--fn-slate-*`) for all non-primary text and backgrounds
- Ensure every page has a single `<main id="main-content">` landmark
- Keep the dark sidebar as visual anchor — it grounds the workspace

**Don't:**
- Add illustrations, mascots, or decorative graphics
- Use rounded/bubbly UI (excessive border-radius, pill shapes on everything)
- Add animation beyond functional feedback (150-300ms transitions only)
- Use blue-gradient-on-white (the "generic health tech" look)
- Use AI purple/pink gradients (the "every AI product" look)
- Add emoji as icons — use SVG (Heroicons style, inline)
- Make it airy — density communicates competence for clinical tools

---

## Z-Index Scale

Define once, use everywhere. Prevents stacking context conflicts.

| Level | Value | Usage |
|-------|-------|-------|
| Base | `z-0` | Default content |
| Sidebar | `z-10` | Desktop sidebar |
| Sticky | `z-20` | Sticky headers, top bar |
| Overlay | `z-30` | Mobile sidebar overlay backdrop |
| Drawer | `z-40` | Mobile sidebar drawer |
| Modal | `z-50` | Future modals/dialogs |

---

## Phase Breakdown

Five phases, each independently committable as a single PR. Each phase has explicit entry criteria, scope, file list, and verification criteria.

**Visual diff requirement:** At the end of every phase, after the code review passes and before pushing, capture the standard screenshot set and commit them alongside the code. Full procedure below.

Dependencies: `A --> B --> C` (sequential), `D` (parallel with B/C), `E` (after all others).

---

### Post-Phase Screenshot Capture

Every UI phase must end with a Playwright screenshot capture. This creates a visual timeline for comparing the UI across phases.

**When:** After code review passes, before push and PR.

**Procedure:**
1. Start the dev server (`pnpm --filter web dev`)
2. Use Playwright MCP to capture the screenshots listed in `docs/screenshots/SCREENSHOT_MANIFEST.md`
3. Follow the exact capture steps, filenames, and viewports in the manifest
4. Save to `docs/screenshots/phase-{x}/` (e.g., `phase-a/`, `phase-b/`)
5. Visually inspect screenshots and flag any issues
6. Kill the dev server
7. Commit screenshots: `git add docs/screenshots/phase-{x}/ && git commit -m "docs: add Phase {X} UI screenshots"`

**Test account:** `test2@example.com` / `Test1234!`

**Manifest location:** `docs/screenshots/SCREENSHOT_MANIFEST.md` — defines the standard set of 9 screenshots (landing, login, dashboard, new note, notes list, settings, mobile dashboard, mobile sidebar, pricing authenticated). Update the manifest if a phase adds new pages worth capturing.

```
Phase A: Structural Foundation
    |
    +--> Phase B: Note Experience
    |        |
    |        +--> Phase C: Dashboard Home
    |
    +--> Phase D: Auth + Marketing (parallel with B/C)
              |
              +--> Phase E: Polish Pass
```

---

### Phase A: Structural Foundation

**Goal:** Replace top-nav with sidebar layout. Establish route structure. Extract shared components.

**Entry criteria:** UI-1 complete (tokens, preset, font, globals.css). Current branch clean.

#### Shared Component Extraction

**`web/src/components/MarketingNav.tsx`** (new, Server Component)
- Extract nav from `app/page.tsx`, `app/pricing/page.tsx`, and legal pages
- Props: `showAuthLinks?: boolean` (default true)
- Logo with BetaBadge, nav links (Pricing), auth links (Sign In, Get Started) or dashboard link if session exists
- Mobile: hamburger toggle with slide-out drawer at `md` breakpoint
- Use `<nav aria-label="Main">` landmark

**`web/src/components/Footer.tsx`** (new, Server Component)
- Extract footer from `app/page.tsx` and other marketing pages
- 4-column grid: company, product, support, legal
- Dark inverse background (`bg-fn-bg-inverse`)
- Copyright with dynamic year

**`web/src/components/BetaBadge.tsx`** (new)
- Extract the `BETA` badge that's copy-pasted 11+ times
- Single source: `<span className="text-[9px] font-normal px-1.5 leading-4 rounded-full border border-fn-border text-fn-text-secondary">BETA</span>`

#### Sidebar Component

**`web/src/components/Sidebar.tsx`** (new, mixed Server/Client)

Structure per `COMPONENT_PATTERNS.md` section 2:
```
<nav aria-label="Main navigation" className="w-fn-sidebar bg-fn-sidebar-bg ...">
  Logo header (lightning icon + "FlashNote")
  "New Note" CTA button (links to /dashboard/notes/new)
  CORE section label
    Dashboard (grid icon) — active: aria-current="page"
    Notes (document icon) — "Coming soon" badge
    Patients (people icon) — "Coming soon" badge
  MANAGE section label
    Templates (template icon) — "Coming soon" badge
    Settings (gear icon)
  User footer (initials avatar + name + email)
</nav>
```

Props:
- `user: { name: string; email: string }` — for user footer
- `currentPath: string` — for active state (`aria-current="page"`)

Responsive behavior:
- `lg+`: Visible as fixed 240px sidebar
- `< lg`: Hidden off-canvas. Hamburger button in TopBar triggers slide-in drawer
- Mobile overlay: `z-30` backdrop + `z-40` drawer (see z-index scale)
- Escape key and backdrop click close the drawer

Client component needed for: mobile toggle state, escape key handler.

"Coming soon" badge: Small inline badge next to nav item text. Use `text-fn-2xs` + subtle styling. Nav item is still rendered (not hidden) but click goes to stub page.

#### TopBar Component

**`web/src/components/TopBar.tsx`** (new, Server Component with client slot)

Structure per `COMPONENT_PATTERNS.md` section 3:
```
<header className="flex items-center justify-between px-6 py-4 border-b border-fn-border bg-fn-bg-card">
  Left: optional back button + page title (h1)
  Right: action button slot (children)
  Mobile: hamburger button (lg:hidden) for sidebar toggle
</header>
```

Props:
- `title: string`
- `backHref?: string` — if provided, shows back arrow link
- `children?: ReactNode` — action buttons slot (right side)
- `onMenuToggle?: () => void` — mobile hamburger click handler

#### Dashboard Layout Rewrite

**`web/src/app/dashboard/layout.tsx`** (modify)

Current: top nav bar with logo + email + settings + logout.
New: Page shell with Sidebar + TopBar per `COMPONENT_PATTERNS.md` section 1.

```tsx
<div className="flex min-h-screen">
  <Sidebar user={{ name, email }} currentPath={pathname} />
  <div className="flex-1 flex flex-col min-w-0">
    {children}
  </div>
</div>
```

- Keep existing session check + email verification redirect (Rule 8)
- Pass user data from session to Sidebar
- Remove old `<nav>` top bar entirely
- `LogoutButton` moves into Sidebar user footer area (or accessible from Settings)

#### New Routes

**`web/src/app/dashboard/notes/new/page.tsx`** (new)
- Move `NoteGenerationForm` here from dashboard page
- TopBar: title "New Note", back button to `/dashboard`
- Server Component wrapper with session check
- Client Component form below

**`web/src/app/dashboard/notes/page.tsx`** (new, stub)
- Empty state per `COMPONENT_PATTERNS.md` section 11
- "Coming Soon — Note history is on the way."
- TopBar: title "Notes"

**`web/src/app/dashboard/patients/page.tsx`** (new, stub)
- Empty state: "Coming Soon — Patient management is on the way."
- TopBar: title "Patients"

**`web/src/app/dashboard/templates/page.tsx`** (new, stub)
- Empty state: "Coming Soon — Custom templates are on the way."
- TopBar: title "Templates"

#### Files Modified

| File | Action |
|------|--------|
| `components/MarketingNav.tsx` | Create |
| `components/Footer.tsx` | Create |
| `components/BetaBadge.tsx` | Create |
| `components/Sidebar.tsx` | Create |
| `components/TopBar.tsx` | Create |
| `app/dashboard/layout.tsx` | Rewrite (sidebar layout) |
| `app/dashboard/notes/new/page.tsx` | Create (move form here) |
| `app/dashboard/notes/page.tsx` | Create (stub) |
| `app/dashboard/patients/page.tsx` | Create (stub) |
| `app/dashboard/templates/page.tsx` | Create (stub) |
| `app/page.tsx` | Modify (use MarketingNav + Footer) |
| `app/pricing/page.tsx` | Modify (use MarketingNav + Footer) |
| `app/terms/page.tsx` | Modify (use MarketingNav + Footer) |
| `app/privacy/page.tsx` | Modify (use MarketingNav + Footer) |
| `app/baa/page.tsx` | Modify (use MarketingNav + Footer) |
| `components/ui/index.ts` | Update exports |

#### Tests

- Sidebar: renders nav items, active state, user footer, "Coming soon" badges, mobile toggle
- TopBar: renders title, back button, action slot
- MarketingNav: renders links, responsive hamburger
- Footer: renders all columns and links
- Dashboard layout: sidebar renders, session enforcement still works
- `/dashboard/notes/new`: form renders and submits
- Stub pages: render empty states with correct headings
- Existing dashboard tests: update for new route structure

#### Verification

- [ ] Sidebar renders on all dashboard pages
- [ ] Active nav item highlighted with `aria-current="page"`
- [ ] "New Note" CTA navigates to `/dashboard/notes/new`
- [ ] Note form works at new route (generate, copy, error states)
- [ ] Stub pages render empty states
- [ ] Mobile: hamburger toggles sidebar drawer
- [ ] Mobile: escape key and backdrop click close drawer
- [ ] Marketing pages use shared MarketingNav + Footer
- [ ] Session enforcement unchanged (redirect on no session, unverified email)
- [ ] `pnpm build` succeeds
- [ ] All tests pass with coverage maintained

---

### Phase B: Note Experience

**Goal:** Redesign the note generation form and SOAP note display to match the mockups. This is the core product experience.

**Entry criteria:** Phase A merged. Form lives at `/dashboard/notes/new`. Sidebar layout active.

#### Note Form Redesign

**`web/src/components/notes/NoteGenerationForm.tsx`** (modify)

Current: noteType dropdown, quickNotes textarea, patientContext input, submit button.
New layout per `COMPONENT_PATTERNS.md` section 4:

```
Patient selector (stub — disabled, "Coming in a future update")
2-col row: Template dropdown (noteType) + Modality dropdown (new field)
2-col row: Duration input (optional, minutes) + Date (auto-filled, readonly)
Session Notes textarea (hero element — taller, better placeholder)
Character count (bottom-right aligned)
Generate Note button (primary, full-width)
```

Changes:
- Add `modality` field: `'in_person' | 'telehealth'` — new select input. Passed to Server Action but not yet used in prompt (future enhancement). Default: `'in_person'`.
- Add `duration` field: optional number input (minutes). Passed to Server Action but not yet used in prompt. Placeholder: "45 min".
- Add `sessionDate` field: auto-filled to current date/time, readonly display. Not editable in v1.
- Patient selector: Disabled input with placeholder "Patient selection coming soon" and subtle "Coming soon" label. Not functional.
- Textarea: Increase `rows` from 6 to 8+. Use `min-h-[200px]`. Better placeholder text per COMPONENT_PATTERNS.md. Label: "Session Notes" (not "Quick Notes"). Placeholder: clinical shorthand example.
- Show **word count** as primary indicator (e.g., "144 words") instead of character count. Keep `maxLength={5000}` on the element and Zod validation unchanged.
- Submit button text: **"Generate Professional Note"** (not "Generate SOAP Note")
- Two-column grid on `lg+`, single column on mobile: `grid grid-cols-1 lg:grid-cols-2 gap-4`
- Move general error alert above the form (not between textarea and button)
- Responsive padding: `px-4 md:px-6`
- Add lightweight **step indicator** above the form: `1. Enter Notes` (active) → `2. Review & Copy` (inactive). Simple flex row with numbered circles and labels. When generation completes and result renders, step 2 becomes active. This sets the UX foundation for a 3-step flow (Capture → Review → Finalize) once note persistence lands in Phase 2.

Patient context panel (right side, `lg+` only):
- Stub panel per `COMPONENT_PATTERNS.md` section 8
- `<aside>` with "Patient Context" heading
- Body: "Select a patient to see context" empty state
- Width: `w-fn-context-panel` (340px) on `xl+`, hidden below `xl`
- Split layout: `<div className="flex gap-6">` wrapping form + aside

#### SOAP Note Display Redesign

**`web/src/components/notes/GeneratedNote.tsx`** (rewrite)

Current: flat text with uppercase headers and tiny copy buttons.
New: SOAP section cards with accent bars per `COMPONENT_PATTERNS.md` section 5.

**Action bar** (above SOAP sections):
```
<div className="flex items-center justify-between mb-4">
  <h2>Generated SOAP Note</h2>
  <div className="flex items-center gap-2">
    <CopyButton text={fullNote} label="Copy full SOAP note" variant="primary" />
  </div>
</div>
```

**Metadata bar** per `COMPONENT_PATTERNS.md` section 6:
- Date (auto-filled) | Duration (if provided) | Note type badge | Generation time
- `flex items-center gap-3 text-fn-sm text-fn-text-secondary`

**SOAP Section component** (internal to GeneratedNote):
```tsx
interface NoteSectionProps {
  title: string;          // Generic — works for SOAP or any future section names
  content: string;
  onEdit?: (newContent: string) => void;
}
```

Structure (adapted from `COMPONENT_PATTERNS.md` section 5):
- Card with `border-l-[3px] border-fn-primary` — uniform teal accent on all sections
- Header: accent bar + title (h3) + copy button + edit button
- Content: `whitespace-pre-wrap` text
- Copy/edit buttons: `w-8 h-8` minimum (upgrade from `w-3.5 h-3.5` — touch target fix)
- `aria-labelledby` pointing to section heading ID
- `aria-live="polite"` region for copy feedback (already exists, keep it)

**Inline editing** per `COMPONENT_PATTERNS.md` section 13:
- Edit button toggles section into edit mode
- Edit mode: textarea replaces content, card gets `ring-2 ring-fn-primary bg-fn-primary-50`
- "Editing" badge appears in header
- Save/Cancel buttons replace Copy/Edit buttons
- Save updates local state only (no server persistence in v1 — that's Phase 2)
- Cancel reverts to original content
- `aria-live` region announces save/cancel result

**Billing, Goals, Alerts, UncertainAreas sections:** Keep existing logic but apply card styling consistent with SOAP sections. No accent bars on these — they use standard `card` class.

**Suggestions panel** (right side, `xl+` only):
- On wide screens (`xl+`), render `uncertainAreas` + billing suggestions in a right-side panel alongside the SOAP sections, rather than buried below them.
- Uses `<aside aria-label="AI suggestions">` with `w-[300px]` fixed width.
- Structure: "Smart Suggestions" heading, then cards for each uncertain area and billing suggestion.
- On smaller screens, these collapse below the SOAP sections (existing behavior, just in card format).
- This positions the UI for the richer "Smart Suggestions" panel (coding opportunities, trend matches, missing details) that will come with Phase 2 historical data.

**Rating widget** per `COMPONENT_PATTERNS.md` section 12:
- 5-star interactive rating below SOAP sections
- `role="radiogroup"` with `role="radio"` on each star
- No server persistence in v1 — local state only
- Yellow fill on selected stars, muted on unselected

#### CopyButton Redesign

**`web/src/components/notes/GeneratedNote.tsx`** (internal CopyButton)

Current issues:
- Icon is `w-3.5 h-3.5` (14px) — fails 44px touch target
- "Copied!" text changes button width (layout shift)
- No `cursor-pointer` class

Fixes:
- Button: `min-w-[44px] min-h-[44px]` hit area with `p-2`
- Use icon-only for section copy (with `aria-label`), icon+text for "Copy All"
- "Copied" state: swap icon only (checkmark), don't change text width
- Add `cursor-pointer` class
- Keep clipboard fallback textarea behavior

#### Files Modified

| File | Action |
|------|--------|
| `components/notes/NoteGenerationForm.tsx` | Major modify (new fields, layout, patient stub) |
| `components/notes/GeneratedNote.tsx` | Rewrite (SOAP cards, accent bars, edit mode, rating) |
| `app/dashboard/notes/new/page.tsx` | Modify (split layout with context panel stub) |
| `lib/schemas/notes.ts` | Modify (add modality, duration fields — optional) |
| `actions/notes.ts` | Modify (accept new fields, pass through) |

#### Tests

- NoteGenerationForm: new fields render, 2-col layout, patient stub visible, form still submits
- GeneratedNote: SOAP section cards render with accent bars, copy buttons work, edit mode toggles, rating widget interactive
- CopyButton: touch target size, clipboard success/failure, layout doesn't shift
- Inline editing: edit/save/cancel cycle, content reverts on cancel
- Schema: new optional fields accepted, missing fields don't break validation

#### Verification

- [ ] Note form has template + modality 2-col row
- [ ] Patient selector stub visible with "Coming soon" indication
- [ ] Context panel stub visible on `xl+` screens
- [ ] SOAP sections have colored left accent bars (4 distinct colors)
- [ ] Copy buttons are 44px+ touch targets
- [ ] "Copy All" works for full note
- [ ] Per-section copy works
- [ ] Edit mode: click edit -> textarea appears -> save updates content -> cancel reverts
- [ ] Rating widget renders 5 stars, click selects
- [ ] Metadata bar shows date, type, generation time
- [ ] Mobile: single-column form, no context panel, SOAP sections stack
- [ ] All tests pass

---

### Phase C: Dashboard Home

**Goal:** Replace the "form is the dashboard" with a proper home page. Move stats/subscription info here. Quick actions point to dedicated routes.

**Entry criteria:** Phase B merged. Form lives at `/dashboard/notes/new` and works.

#### Dashboard Page Redesign

**`web/src/app/dashboard/page.tsx`** (rewrite)

Current: h1 "Dashboard", h2 "Generate a SOAP Note", NoteGenerationForm, usage card, subscription card, support card.

New layout:
```
TopBar: title "Dashboard", no back button
Trial/subscription banner (conditional — only if trialing/expired/past_due)
Stats row: 2 KPI cards in a grid
  - "Notes This Month" — large number + month name (from getUsageForUser)
  - "Subscription" — status badge + contextual message
Shorthand CTA block (prominent, full-width)
  - Dark teal background card with headline "Quick Shorthand"
  - Subtitle: "Enter your session notes here. Our AI transforms them into professional SOAP documentation in seconds."
  - Non-functional textarea preview (placeholder text, not a real form)
  - "Generate Professional Note" button that navigates to /dashboard/notes/new
  - This replaces the generic "Generate SOAP Note" quick action card — makes the dashboard feel purposeful
Quick action cards: 2-card grid below shorthand block
  - "Add a Patient" (stub — "Coming soon" subtitle, muted icon)
  - "Browse Templates" (stub — "Coming soon" subtitle, muted icon)
```

**KPI Card pattern:**
```tsx
<div className="card p-5">
  <p className="text-fn-2xs font-semibold text-fn-text-muted uppercase tracking-fn-wider mb-2">
    Notes This Month
  </p>
  <p className="text-3xl font-bold text-fn-text-primary mb-1">47</p>
  <p className="text-fn-sm text-fn-success">+12% from last month</p>
</div>
```

Note: "% from last month" requires comparing current vs previous month usage. If `getUsageForUser` doesn't return previous month data, just show the count without a comparison. Don't add a DAL query for this — it's cosmetic.

**Quick action card pattern:**
```tsx
<Link href="/dashboard/notes/new" className="card p-5 hover:shadow-fn-md transition-shadow cursor-pointer group">
  <div className="w-10 h-10 rounded-fn-base bg-fn-primary-light flex items-center justify-center mb-3">
    <svg aria-hidden="true" className="w-5 h-5 text-fn-primary" ... />
  </div>
  <h3 className="text-fn-base font-semibold text-fn-text-primary mb-1">Generate SOAP Note</h3>
  <p className="text-fn-sm text-fn-text-secondary">Create a new clinical note from your session shorthand.</p>
</Link>
```

Stub cards: Same structure but no `href`, muted icon background, "Coming soon" in subtitle. `cursor-default` instead of `cursor-pointer`.

**Trial banner:**
```tsx
<div className="flex items-center justify-between p-4 rounded-fn-lg bg-fn-primary-light border border-fn-primary/20">
  <p className="text-fn-sm text-fn-text-primary">
    <strong>12 days remaining</strong> in your free trial. Upgrade to keep generating notes.
  </p>
  <Link href="/pricing" className="btn-primary px-4 py-2 text-fn-sm">View Plans</Link>
</div>
```

#### Loading Skeleton

**`web/src/app/dashboard/loading.tsx`** (rewrite)

Current: centered `<Spinner size="lg">`.
New: content-shaped skeleton matching dashboard layout.

```tsx
<div className="p-6 space-y-6 animate-pulse">
  {/* Banner skeleton */}
  <div className="h-14 rounded-fn-lg bg-fn-bg-secondary" />
  {/* Stats row skeleton */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div className="h-28 rounded-fn-lg bg-fn-bg-secondary" />
    <div className="h-28 rounded-fn-lg bg-fn-bg-secondary" />
  </div>
  {/* Shorthand CTA skeleton */}
  <div className="h-48 rounded-fn-lg bg-fn-bg-secondary" />
  {/* Quick actions skeleton */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div className="h-36 rounded-fn-lg bg-fn-bg-secondary" />
    <div className="h-36 rounded-fn-lg bg-fn-bg-secondary" />
  </div>
</div>
```

#### SubscriptionContent Refactor

Move `SubscriptionContent` from `dashboard/page.tsx` into the trial banner and subscription KPI card. The current sprawling switch statement stays but renders in a more compact format (badge + one-line message + CTA link).

#### Files Modified

| File | Action |
|------|--------|
| `app/dashboard/page.tsx` | Rewrite (KPI cards, quick actions, trial banner) |
| `app/dashboard/loading.tsx` | Rewrite (skeleton loader) |
| `app/dashboard/CheckoutSuccessAlert.tsx` | Keep, render above trial banner |
| `app/dashboard/ManageSubscriptionButton.tsx` | Keep, used in subscription KPI card |

#### Tests

- Dashboard page: renders KPI cards with usage data, subscription banner, quick action cards
- Quick action links: "Generate SOAP Note" links to `/dashboard/notes/new`
- Stub cards: render "Coming soon" text, no navigation
- Trial banner: appears for `trialing` status, hidden for `active`
- Loading skeleton: renders placeholder shapes (no spinner)

#### Verification

- [ ] Dashboard shows stats + quick actions (not the note form)
- [ ] "Generate SOAP Note" card links to `/dashboard/notes/new`
- [ ] Trial banner shows for trial users with correct days remaining
- [ ] Subscription card shows correct status + CTA
- [ ] Loading state shows skeleton, not spinner
- [ ] CheckoutSuccessAlert still works
- [ ] All tests pass

---

### Phase D: Auth + Marketing Pages

**Goal:** Reskin auth pages and marketing pages with refined teal design. Apply shared components.

**Entry criteria:** Phase A merged (shared MarketingNav + Footer available). Can run parallel with B/C.

#### Auth Pages

**All 6 auth pages** (`login`, `signup`, `forgot-password`, `reset-password`, `verify-email`, `resend-verification`) + `check-email`:

- Update `AuthLayout.tsx`: Ensure card uses `shadow-fn-base`, rounded-fn-lg, consistent padding (`p-6 sm:p-8`)
- Verify all form inputs use `input-field` class with correct sizing (`py-2.5` for comfortable touch targets)
- Verify all buttons use `btn-primary` / `btn-secondary` classes
- Verify link styling uses `link` class (teal, semibold)
- Ensure password hint text is visible and uses `text-fn-text-secondary`
- Legal checkboxes on signup: ensure touch target is 44px+ (padding around checkbox)

No structural changes to auth pages — they already work. This is a styling refinement pass.

#### Landing Page

**`web/src/app/page.tsx`** (modify)

Changes:
1. Use `<MarketingNav />` and `<Footer />` (from Phase A)
2. Add trust signals section after "How It Works":
   - HIPAA compliant badge (shield icon + text)
   - "Built for Physical Therapists" badge
   - "256-bit encryption" badge
   - Flex row, centered, subtle styling
3. Enhance "See the Difference" section:
   - Output side: apply SOAP accent colors to S/O/A/P labels
   - Use `font-mono` for the input example
4. Add placeholder testimonials section (after trust signals):
   - 2-3 cards with placeholder content: "Testimonials from beta testers coming soon"
   - Structure ready for real testimonials post-beta
5. Responsive hero CTAs: `flex-wrap` to prevent overflow on small screens
6. Responsive text: hero h1 uses `text-2xl sm:text-3xl md:text-4xl lg:text-5xl`

#### Pricing Page

**`web/src/app/pricing/page.tsx`** (modify)

Changes:
1. Use `<MarketingNav />` and `<Footer />`
2. Pricing cards: use `card` class with `shadow-fn-base`, teal accent on "recommended" card border
3. Annual plan: teal "Save 17%" badge using `badge` class
4. Feature lists: checkmark icons in `text-fn-success`

#### Legal Pages (Terms, Privacy, BAA)

Minimal changes:
1. Use `<MarketingNav />` and `<Footer />`
2. Ensure heading hierarchy is sequential (h1 -> h2 -> h3)
3. Body text: `text-fn-base` with `leading-relaxed`, max-width for readability (`max-w-3xl`)

#### Files Modified

| File | Action |
|------|--------|
| `components/auth/AuthLayout.tsx` | Modify (card shadow, padding refinement) |
| `app/page.tsx` | Modify (shared nav/footer, trust signals, testimonial placeholder, responsive) |
| `app/pricing/page.tsx` | Modify (shared nav/footer, card styling) |
| `app/pricing/CheckoutButtons.tsx` | Modify (card styling refinement) |
| `app/terms/page.tsx` | Modify (shared nav/footer, heading hierarchy) |
| `app/privacy/page.tsx` | Modify (shared nav/footer, heading hierarchy) |
| `app/baa/page.tsx` | Modify (shared nav/footer, heading hierarchy) |
| Auth pages (7 files) | Minor modify (styling verification, touch targets) |

#### Tests

- Landing page: trust signals section renders, testimonial placeholder renders
- Marketing pages: shared nav and footer render
- Auth pages: existing tests still pass after styling changes
- Pricing: card styling renders correctly

#### Verification

- [ ] Landing page has trust signals section with HIPAA badge
- [ ] "See the Difference" output uses SOAP accent colors
- [ ] Hero CTAs don't overflow on 375px viewport
- [ ] All marketing pages use shared MarketingNav + Footer
- [ ] Auth pages render with consistent card styling
- [ ] Legal pages have correct heading hierarchy
- [ ] All tests pass

---

### Phase E: Polish Pass

**Goal:** Fix accumulated interaction issues, touch targets, loading states, and responsive edge cases across the entire app.

**Entry criteria:** Phases A-D merged. Full app is on new design.

#### Touch Target Audit

Scan all interactive elements and ensure 44px minimum:
- Alert dismiss buttons (`Alert.tsx`)
- Icon-only buttons (settings gear, copy, edit, dismiss)
- Checkbox/radio inputs on auth pages
- Nav links on mobile
- "Coming soon" badge links (if any are interactive)

Fix pattern: Add `min-h-[44px] min-w-[44px]` or sufficient padding.

#### Cursor Audit

Add `cursor-pointer` to all clickable elements that don't already have it:
- Quick action cards (if using `<Link>`)
- Nav items
- Dismissible alerts
- Any `<div onClick>` patterns

#### Skeleton Loader Pass

Replace remaining centered spinners:
- `app/dashboard/settings/loading.tsx` — skeleton matching settings card layout
- Any other `loading.tsx` files still using `<Spinner>`

#### Responsive Audit (375px)

Test all pages at 375px width:
- Hero CTA buttons: verify `flex-wrap` prevents overflow
- Sidebar: verify hamburger appears and drawer works
- Forms: verify single-column layout
- SOAP sections: verify cards don't overflow
- Tables (billing section): verify horizontal scroll works
- Footer: verify columns stack

#### Copy Button Layout Shift

Fix the "Copied!" text changing button width:
- Use fixed-width button or icon-only swap
- Ensure no parent layout shift when state changes

#### Print Stylesheet

Add `@media print` rules to `globals.css`:
- Hide sidebar, nav, footer, buttons
- Show SOAP note content full-width
- Use black text on white background
- Show page URL in footer

#### Interaction Timing

Verify all transitions are 150-300ms:
- Button hover/focus: 200ms
- Sidebar drawer: 200ms slide
- Alert dismiss: 150ms fade
- Copy confirmation: 200ms swap

#### Files Modified

| File | Action |
|------|--------|
| `components/ui/Alert.tsx` | Modify (dismiss button touch target) |
| `components/notes/GeneratedNote.tsx` | Modify (if copy button fixes needed) |
| `app/dashboard/settings/loading.tsx` | Rewrite (skeleton) |
| `app/globals.css` | Add print styles |
| Various pages | Minor touch target and cursor fixes |

#### Verification

- [ ] All interactive elements have 44px+ touch targets
- [ ] All clickable elements have `cursor-pointer`
- [ ] No layout shift on copy button state change
- [ ] All loading states use skeletons (no centered spinners)
- [ ] 375px viewport: no horizontal scroll, no overflow, hamburger works
- [ ] Print: SOAP note prints cleanly without UI chrome
- [ ] `prefers-reduced-motion`: animations disabled
- [ ] All tests pass
- [ ] `pnpm build` succeeds
- [ ] Full test suite passes with coverage maintained

---

## External Mockup Analysis (March 2026)

Google Stitch mockups were evaluated for the dashboard, note input, and note result screens. Key takeaways incorporated into this plan:

**Adopted:**
- "Session Notes" / "Session Scribbles" naming instead of "Quick Notes"
- "Generate Professional Note" CTA copy instead of "Generate SOAP Note"
- Word count as primary indicator (over character count)
- Step indicator concept (1. Enter Notes → 2. Review & Copy) for note generation workflow
- Suggestions panel positioning (uncertainAreas + billing in right sidebar on xl+ screens)
- Prominent shorthand CTA block on dashboard home

**Rejected (with rationale):**
- Warm sage sidebar → our dark teal (`#0D3D3D`) is more authoritative and clinical
- Donut chart for note count → adds charting dependency for one widget; large number is cleaner
- Decorative watermark/background shapes → clinical tools don't have decorative elements
- "Focus Flow" dashboard title → too marketing-y; "Dashboard" is clearer

**Deferred to Phase 2+:**
- Patient status cards (Progressing/Attention/Maintenance)
- "AI Insight" cards, "Time Efficiency" stats, "Note Quality Score"
- "Finalize & Sign" workflow (requires note persistence)
- Dictate and Attach File buttons
- "APPLY SUGGESTION" / "FIX NOW" smart actions
- Autosaved indicator (requires draft persistence)

---

## What's NOT in This Plan

These items are explicitly deferred. Do not build them during the UI overhaul.

| Item | Why Deferred | When |
|------|-------------|------|
| Patient selector (functional) | Requires PHI storage (Phase 2) | Phase 2: PHI-3 |
| Context panel (functional) | Requires stored patients + notes | Phase 2: PHI-3 |
| Recent notes table | Requires stored notes | Phase 2: PHI-3 |
| Note result page (`/notes/[id]`) | Requires stored notes with IDs | Phase 2: PHI-2 |
| "Active Patients" stat | Requires patients table | Phase 2: PHI-1 |
| "Time Saved" stat | Requires historical generation data | Phase 2+ |
| Dark mode | Low value for PT offices | Indefinite |
| Note print stylesheet beyond basic | Requires more design work | Post-launch |
| Command palette search | Nice-to-have, not MVP | Post-launch |
| Notification system | No notifications in v1 | Post-launch |
| Custom template builder UI | Phase 2 feature | Phase 2: PHI-1 |
