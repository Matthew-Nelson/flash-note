# FlashNote Component Patterns — Refined Teal

Code-level implementation patterns for the Refined Teal design system. Each pattern shows correct markup, ARIA attributes, and Tailwind classes.

Design token reference: [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Component CSS classes: [DESIGN_SYSTEM.md#component-css-classes](./DESIGN_SYSTEM.md#component-css-classes)

**Next.js note:** All internal links use `<Link>` from `next/link`, not raw `<a>` tags. Examples below use `Link` for client-side navigation.

---

## 1. Page Shell

The main layout wrapper. Sidebar + main content area as a flex row.

```tsx
<div className="flex min-h-screen">
  <Sidebar />
  <div className="flex-1 flex flex-col min-w-0">
    <TopBar title="New Note" />
    <main id="main-content" className="flex-1 p-6">
      {children}
    </main>
  </div>
</div>
```

- `min-w-0` on the content column prevents flex overflow from long content.
- `<main id="main-content">` is the skip-link target.

---

## 2. Sidebar

Dark navigation panel. 240px fixed width, dark teal background.

```tsx
<nav aria-label="Main navigation" className="w-fn-sidebar bg-fn-sidebar-bg flex flex-col flex-shrink-0">
  {/* Header */}
  <div className="p-5 pb-4 flex items-center gap-2.5">
    <div className="w-8 h-8 bg-fn-primary-DEFAULT rounded-fn-base flex items-center justify-center">
      <svg aria-hidden="true" ...>{/* Lightning icon */}</svg>
    </div>
    <span className="text-fn-lg font-bold text-fn-sidebar-text-active tracking-fn-tight">
      FlashNote
    </span>
  </div>

  {/* Section Label */}
  <div className="px-5 py-2">
    <span className="text-fn-2xs font-semibold text-fn-sidebar-text uppercase tracking-fn-wider">
      Menu
    </span>
  </div>

  {/* Nav Items */}
  <ul className="flex-1 px-3 space-y-1">
    <li>
      <Link href="/dashboard"
        className="flex items-center gap-3 px-3 py-2 rounded-fn-sm text-fn-sm font-medium
                   text-fn-sidebar-text hover:bg-fn-sidebar-hover
                   aria-[current=page]:bg-fn-sidebar-active aria-[current=page]:text-fn-sidebar-text-active"
        aria-current="page">
        <svg aria-hidden="true" className="w-5 h-5" .../>
        Dashboard
      </Link>
    </li>
  </ul>

  {/* CTA Button */}
  <div className="px-3 py-4">
    <Link href="/dashboard?new=true"
      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-fn-base
                 bg-fn-primary-DEFAULT text-white text-fn-sm font-semibold
                 hover:bg-fn-accent-primary-hover transition-colors">
      <svg aria-hidden="true" .../>
      New Note
    </Link>
  </div>

  {/* User Footer */}
  <div className="px-3 py-4 border-t border-white/10">
    <div className="flex items-center gap-3 px-2">
      <div className="w-8 h-8 rounded-full bg-fn-primary-DEFAULT flex items-center justify-center text-white text-fn-xs font-semibold">
        MN
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-fn-sm font-medium text-fn-sidebar-text-active truncate">Matt Nelson</p>
        <p className="text-fn-2xs text-fn-sidebar-text truncate">matt@example.com</p>
      </div>
    </div>
  </div>
</nav>
```

---

## 3. Top Bar

Page header with optional back button, title/breadcrumbs, and action buttons.

```tsx
<header className="flex items-center justify-between px-6 py-4 border-b border-fn-border bg-fn-bg-card">
  <div className="flex items-center gap-3">
    <button aria-label="Go back" onClick={goBack}
      className="w-8 h-8 flex items-center justify-center rounded-fn-sm
                 text-fn-text-secondary hover:bg-fn-bg-secondary transition-colors">
      <svg aria-hidden="true" className="w-4 h-4" .../>
    </button>
    <h1 className="text-fn-xl font-bold text-fn-text-primary tracking-fn-tight">
      New Note
    </h1>
  </div>
  <div className="flex items-center gap-2">
    {/* Action buttons slot */}
  </div>
</header>
```

---

## 4. Form Layout

Grid-based form rows. Single-column (`form-row-full`) and two-column (`form-row`) patterns.

```tsx
<form className="space-y-5">
  {/* Two-column row */}
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label htmlFor="template" className="label block mb-1.5">Template</label>
      <select id="template" className="input-field w-full px-3 py-2.5 text-fn-base">
        <option>Standard SOAP Note</option>
      </select>
    </div>
    <div>
      <label htmlFor="modality" className="label block mb-1.5">Modality</label>
      <select id="modality" className="input-field w-full px-3 py-2.5 text-fn-base">
        <option>Manual Therapy</option>
      </select>
    </div>
  </div>

  {/* Full-width textarea */}
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label htmlFor="notes" className="label">Session Notes</label>
      <span className="text-fn-xs text-fn-text-muted">{charCount}/5000</span>
    </div>
    <textarea id="notes"
      className="input-field w-full px-4 py-3 text-fn-base min-h-[200px] resize-y"
      placeholder="Enter your session notes..."
      maxLength={5000}
    />
    <p className="text-fn-xs text-fn-text-muted mt-1.5">
      Use shorthand — FlashNote expands abbreviations automatically.
    </p>
  </div>

  {/* Submit */}
  <button type="submit" className="btn-primary w-full py-3 text-fn-base">
    Generate Note
  </button>
</form>
```

---

## 5. SOAP Section

Card with colored accent bar header. Each SOAP section (S/O/A/P) has a unique accent color.

```tsx
{/* accent is one of: fn-soap-subjective, fn-soap-objective, fn-soap-assessment, fn-soap-plan */}
<section className="card" aria-labelledby="soap-subjective-heading">
  <div className="flex items-center justify-between px-4 py-3 border-b border-fn-border">
    <div className="flex items-center gap-3">
      <div className="w-[3px] h-5 rounded-full bg-fn-soap-subjective" aria-hidden="true" />
      <h3 id="soap-subjective-heading" className="text-fn-base font-semibold text-fn-text-primary">
        Subjective
      </h3>
    </div>
    <div className="flex items-center gap-1">
      <button aria-label="Copy Subjective section"
        className="btn-ghost w-8 h-8 flex items-center justify-center rounded-fn-sm">
        <svg aria-hidden="true" className="w-4 h-4" .../>
      </button>
      <button aria-label="Edit Subjective section"
        className="btn-ghost w-8 h-8 flex items-center justify-center rounded-fn-sm">
        <svg aria-hidden="true" className="w-4 h-4" .../>
      </button>
    </div>
  </div>
  <div className="p-4 text-fn-base text-fn-text-primary leading-relaxed">
    <p>{content}</p>
  </div>
  {/* aria-live region for copy feedback — container always in DOM, content changes */}
  <div aria-live="polite" aria-atomic="true" className="sr-only">
    {copySuccess && <span>Copied Subjective section to clipboard</span>}
  </div>
</section>
```

---

## 6. Note Metadata

Icon + text items with dividers displaying note context.

```tsx
<div className="flex items-center gap-3 text-fn-sm text-fn-text-secondary flex-wrap">
  <div className="flex items-center gap-1.5">
    <svg aria-hidden="true" className="w-4 h-4" .../>
    <span>March 2, 2026</span>
  </div>
  <span className="text-fn-border" aria-hidden="true">|</span>
  <div className="flex items-center gap-1.5">
    <svg aria-hidden="true" className="w-4 h-4" .../>
    <span>45 min</span>
  </div>
  <span className="text-fn-border" aria-hidden="true">|</span>
  <span className="badge badge-trial">Initial Eval</span>
</div>
```

---

## 7. Patient Selector

Two states: search (empty) and selected (patient chosen). Stub for Phase 2.

```tsx
{/* Search state */}
<div>
  <label htmlFor="patient-search" className="label block mb-1.5">Patient</label>
  <div className="relative">
    <svg aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fn-text-muted" .../>
    <input id="patient-search" type="text"
      className="input-field w-full pl-9 pr-3 py-2.5 text-fn-base"
      placeholder="Search patients..." />
  </div>
</div>

{/* Selected state */}
<div className="flex items-center gap-3 p-3 bg-fn-primary-light rounded-fn-base">
  <div className="w-10 h-10 rounded-full bg-fn-primary-DEFAULT flex items-center justify-center text-white text-fn-sm font-semibold">
    JD
  </div>
  <div className="flex-1 min-w-0">
    <p className="text-fn-base font-medium text-fn-text-primary truncate">Jane Doe</p>
    <p className="text-fn-xs text-fn-text-secondary truncate">DOB: 1985-03-15</p>
  </div>
  <button aria-label="Clear patient selection"
    className="btn-ghost w-8 h-8 flex items-center justify-center rounded-fn-sm">
    <svg aria-hidden="true" className="w-4 h-4" .../>
  </button>
</div>
```

---

## 8. Context Panel

Right-side panel with titled sections (background, last note, recent notes). Stub for Phase 2.

```tsx
<aside className="w-fn-context-panel border-l border-fn-border bg-fn-bg-card p-5 space-y-6 overflow-y-auto"
  aria-label="Patient context">
  <div>
    <h2 className="text-fn-xs font-semibold text-fn-text-muted uppercase tracking-fn-wider mb-3">
      Patient Background
    </h2>
    <p className="text-fn-sm text-fn-text-secondary">Select a patient to see context</p>
  </div>
</aside>
```

---

## 9. Button Variants

### Primary (teal fill)
```tsx
<button className="btn-primary px-4 py-2.5 text-fn-base">Save Note</button>
```

### Secondary (bordered)
```tsx
<button className="btn-secondary px-4 py-2.5 text-fn-base">Cancel</button>
```

### Ghost (transparent)
```tsx
<button className="btn-ghost px-3 py-2 text-fn-sm">View All</button>
```

### Sizes
```tsx
{/* Small */}
<button className="btn-primary px-3 py-1.5 text-fn-sm">Copy</button>
{/* Default */}
<button className="btn-primary px-4 py-2.5 text-fn-base">Generate</button>
{/* Large */}
<button className="btn-primary px-6 py-3 text-fn-base">Generate Note</button>
```

---

## 10. Icon Button

Always requires `aria-label`. Consistent 32px hit target.

```tsx
<button aria-label="Copy to clipboard"
  className="btn-ghost w-8 h-8 flex items-center justify-center rounded-fn-sm">
  <svg aria-hidden="true" className="w-4 h-4" .../>
</button>
```

---

## 11. Empty State / Coming Soon

Minimal message for stubbed features (Notes, Patients, Templates before Phase 2).

```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <svg aria-hidden="true" className="w-12 h-12 text-fn-text-muted mb-4" .../>
  <h2 className="text-fn-lg font-semibold text-fn-text-primary mb-2">
    Coming Soon
  </h2>
  <p className="text-fn-sm text-fn-text-secondary max-w-sm">
    Patient management is on the way. For now, generate notes from the dashboard.
  </p>
</div>
```

---

## 12. Rating Widget

Star rating for note quality feedback. Interactive fill/hover states.

```tsx
<div role="radiogroup" aria-label="Rate this note">
  {[1, 2, 3, 4, 5].map((star) => (
    <button key={star}
      role="radio"
      aria-checked={rating === star}
      aria-label={`${star} star${star !== 1 ? 's' : ''}`}
      onClick={() => setRating(star)}
      className="w-8 h-8 flex items-center justify-center">
      <svg aria-hidden="true"
        className={`w-5 h-5 ${star <= (hovered ?? rating) ? 'text-yellow-400 fill-yellow-400' : 'text-fn-text-muted'}`}
        .../>
    </button>
  ))}
</div>
```

---

## 13. Edit Mode

SOAP section inline editing. Textarea replaces content, save/cancel actions appear, editing badge shown.

```tsx
{/* Editing state */}
<section className="card ring-2 ring-fn-primary-DEFAULT bg-fn-primary-50">
  <div className="flex items-center justify-between px-4 py-3 border-b border-fn-border">
    <div className="flex items-center gap-3">
      <div className="w-[3px] h-5 rounded-full bg-fn-soap-subjective" aria-hidden="true" />
      <h3 className="text-fn-base font-semibold text-fn-text-primary">Subjective</h3>
      <span className="badge bg-fn-primary-light text-fn-primary-DEFAULT text-fn-2xs">Editing</span>
    </div>
    <div className="flex items-center gap-2">
      <button className="btn-ghost px-3 py-1.5 text-fn-sm" onClick={handleCancel}>Cancel</button>
      <button className="btn-primary px-3 py-1.5 text-fn-sm" onClick={handleSave}>Save</button>
    </div>
  </div>
  <div className="p-4">
    <textarea
      className="w-full min-h-[120px] text-fn-base text-fn-text-primary bg-transparent
                 border-none resize-y leading-relaxed
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fn-primary-DEFAULT focus-visible:ring-inset"
      value={editContent}
      onChange={(e) => setEditContent(e.target.value)}
      aria-label="Edit Subjective section content"
    />
  </div>
  {/* aria-live region for save/cancel feedback */}
  <div aria-live="polite" aria-atomic="true" className="sr-only">
    {saveSuccess && <span>Subjective section saved</span>}
    {saveError && <span>Failed to save Subjective section</span>}
  </div>
</section>
```
