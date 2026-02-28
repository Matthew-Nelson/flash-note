# Migrate `middleware.ts` to `proxy.ts`

## Context

Next.js 16 deprecated the `middleware.ts` file convention in favor of `proxy.ts`. We're on Next.js 16.1.6 and getting this warning on every dev server start:

> The "middleware" file convention is deprecated. Please use "proxy" instead.

The new `proxy` convention runs on the **Node.js runtime** (not Edge). Our middleware logic (CSP nonces + cookie-based auth redirects) works on either runtime and doesn't rely on any Edge-specific behavior. This is a mechanical rename with no behavioral changes.

## Changes

### 1. Rename the source file

- `web/src/middleware.ts` → `web/src/proxy.ts`
- Rename the exported function: `middleware()` → `proxy()`
- Update the comment on line 35 from "Middleware runs on Edge Runtime" to reflect the new Node.js runtime
- `config` export stays unchanged

### 2. Rename the test file

- `web/src/middleware.test.ts` → `web/src/proxy.test.ts`
- Update import: `from './middleware'` → `from './proxy'`
- Update import: `{ middleware, config }` → `{ proxy, config }`
- Replace all `middleware(` calls → `proxy(` (~20 occurrences)
- Rename describe block: `'Middleware'` → `'Proxy'`

### 3. Update code comments (2 files)

These comments reference "middleware" in the context of explaining redirect behavior:

- `web/src/app/dashboard/layout.tsx:18` — update comment: "doesn't re-run middleware" → "doesn't re-run the proxy"
- `web/src/actions/auth.ts:54` — update comment: "doesn't re-run middleware" → "doesn't re-run the proxy"

### 4. Update CLAUDE.md (5 locations)

Update references to match the new convention. Key changes:

- Section title "Next.js Middleware Responsibilities" → "Next.js Proxy Responsibilities"
- Update body text in that section (DOES/does NOT lists)
- Rule 8 reference: "don't rely solely on middleware" → "don't rely solely on the proxy"
- Cloud Run section: update Edge Runtime paragraph to reflect Node.js runtime
- Logging convention table: `middleware` source name stays `middleware` (this is a log source identifier, not a file reference — but we should update it to match)

### 5. Update docs/ROADMAP.md (surgical — only where it refers to the Next.js file)

Several ROADMAP mentions refer to the *Express* middleware (legacy backend) or describe completed work historically. Only update references that describe the Next.js `middleware.ts` file convention to avoid confusing future readers:

- Phase 1.4 title/description: "Middleware" → "Proxy" where it refers to the Next.js file
- Phase 1.4.5 description: "middleware redirect" → "proxy redirect", "middleware tests" → "proxy tests"

Leave historical audit table entries (M-4, L-2) untouched — they describe Express middleware, not Next.js.

### 6. Update docs/planning/NEXTJS_MIGRATION_PLAN.md (selective)

This is a planning doc with 12 mentions. Most are historical architecture discussion. Update only the references that describe the current Next.js file convention to avoid confusion:

- "Edge Runtime in Middleware" risk section → update to reflect Node.js runtime and new naming
- Phase 4 description references to the Next.js middleware file

Leave architecture comparison prose (Options A/C/transplant discussion) as-is — they describe past decisions accurately.

## Files Modified

| File | Change |
|------|--------|
| `web/src/proxy.ts` (renamed from `middleware.ts`) | Rename function |
| `web/src/proxy.test.ts` (renamed from `middleware.test.ts`) | Update imports + all call sites |
| `web/src/app/dashboard/layout.tsx` | 1 comment |
| `web/src/actions/auth.ts` | 1 comment |
| `CLAUDE.md` | ~5 sections |
| `docs/ROADMAP.md` | ~3 lines |
| `docs/planning/NEXTJS_MIGRATION_PLAN.md` | ~3 lines |

## What Does NOT Change

- **No behavioral changes** — same CSP logic, same auth redirects, same matcher config
- **No new dependencies**
- **`next.config.ts`** — no middleware-specific config keys exist, nothing to rename
- **Backend `middleware/` directory** — Express middleware, unrelated, being deleted in Phase 1.6
- **`config` export name** — stays `config` per Next.js docs

## Verification

1. `cd web && pnpm test` — all 764+ tests pass (including renamed proxy tests)
2. `pnpm build` — no deprecation warning, successful build
3. `pnpm dev` — deprecation warning gone, CSP headers present, auth redirects work
