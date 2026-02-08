# FlashNote Code Quality Review

**Date:** 2026-02-06
**Scope:** Full codebase review across backend, extension, and web packages
**Focus:** Maintainability issues common in AI-coded applications

---

## Executive Summary

The codebase is **significantly better than most vibe-coded applications**. Security patterns are consistent, HIPAA concerns are well-addressed, and the backend architecture is solid. However, there are real maintainability risks that will compound over time. The biggest issues are: **massive cross-package code duplication** (especially the API client), **type drift across packages**, and **several areas where the extension and web have diverged in architecture without good reason**.

This review is organized by severity. Each finding includes the specific files involved so you can evaluate them directly.

---

## CRITICAL: Issues That Will Bite You

### 1. Three Nearly-Identical API Clients

**Files:**
- `extension/src/shared/api.ts` (class-based, 333 lines)
- `web/src/lib/api.ts` (function-based, 363 lines)

These two files implement the **exact same logic** — token refresh, CSRF handling, retry with exponential backoff, auth invalidation events, login/register/logout — but in different styles. The web version was literally "ported from extension" (the comment says so on line 11).

**Why this is critical:** When you fix a bug in one API client (e.g., a retry edge case, a token refresh race condition), you must remember to fix it in the other. History shows this never happens reliably. Any auth or networking behavior change requires updating two files.

**The divergences that already exist:**
- Extension `ApiClient` is a class; web uses standalone functions
- Extension `storage` is async (chrome.storage); web is sync (sessionStorage)
- Extension `refreshToken()` calls `captureException` from a custom sentry wrapper; web uses `@sentry/nextjs` directly
- Web `logout()` uses `try/finally`; extension uses `try/catch` with separate `storage.clearAuth()` call
- Web has `createCheckoutSession()` and `createPortalSession()` methods; extension doesn't (opens external links instead)

**Recommendation:** Since you're not doing a monorepo, accept that there are two API clients. But extract the core logic patterns (retry, token refresh, request wrapper) into a documented contract/checklist. When one changes, grep for the equivalent pattern in the other. Consider a lightweight shared test suite that validates both clients behave identically for the common paths.

---

### 2. Type Definitions Defined 3-4 Times

The `User` interface is defined **four separate times** with subtle differences:

| Location | `emailVerified` | `trialEndsAt` | `subscriptionStatus` |
|---|---|---|---|
| `backend/src/types/index.ts:21` | `boolean` (required) | `Date` | union type |
| `extension/src/shared/types.ts:3` | **missing** | `string` | `string` |
| `extension/src/sidepanel/hooks/useAuth.ts:6` | `boolean?` (optional) | `string \| null?` | `string` |
| `web/src/lib/types.ts:10` | `boolean?` (optional) | `string \| null` | `string` |

**Problems caused by this drift:**
- Extension `types.ts` User doesn't have `emailVerified` at all, but `schemas.ts` storedUserSchema has it as optional — the types file is stale
- The `Settings.tsx` component defines its *own* inline `User` interface (line 4) that also lacks `emailVerified`
- `subscriptionStatus` is a typed union in the backend (`'trialing' | 'active' | 'canceled' | 'past_due' | 'unpaid'`) but just `string` everywhere else — losing type safety entirely on the frontend

Similarly duplicated:
- `NoteType` — defined in `backend/src/types/index.ts`, `extension/src/shared/types.ts`, `extension/src/shared/schemas.ts` (3x)
- `GeneratedNote` / `GenerateNoteInput` — defined in both `extension/src/shared/types.ts` AND `extension/src/shared/schemas.ts` (within the same package!)
- `ApiResponse` / `ApiError` — defined in `backend/src/types/index.ts`, `extension/src/shared/api.ts`, `web/src/lib/types.ts`
- `SessionEndReason` — defined in both `extension/src/shared/api.ts` and `web/src/lib/types.ts`
- `StoredAuth` — defined in both `extension/src/shared/storage.ts` AND `extension/src/shared/schemas.ts`

**Recommendation:** Within each package, consolidate to a single source of truth for types. The extension has the worst case — `types.ts` and `schemas.ts` define overlapping types that have already drifted. Pick one (schemas.ts is better since types are Zod-inferred and validated). Delete the duplicates in `types.ts`. For cross-package sync, document the canonical shapes in a single reference doc and use it as a checklist during API changes.

---

### 3. Sentry Sanitization Copy-Pasted 3 Times

**Files:**
- `backend/src/utils/sentry-sanitization.ts` (125 lines)
- `extension/src/shared/sentry-sanitization.ts` (85 lines)
- `web/src/lib/sentry-sanitization.ts` (87 lines)

These are **character-for-character identical** (the extension/web versions are slightly shorter only because they omit `filterSafeHeaders` and `SAFE_HEADERS`). The comments even say "if you update patterns here, update the other versions too."

**Why this matters:** This is HIPAA-critical code. If a PHI field pattern needs to be added (e.g., you add a `clinicianNotes` field), you must update three files. Miss one and you're leaking PHI to Sentry from that package.

**Recommendation:** This is the one case where a tiny shared npm package (even published to a private registry, or just copied as a build step) might be worth the overhead. Alternatively, make a CI check that diffs the three files and fails if they diverge. At minimum, add a test in each package that asserts the PHI_FIELD_PATTERNS array matches a canonical list.

---

## HIGH: Architectural Concerns

### 4. Password Validation Schema Defined 3 Times

**Files:**
- `backend/src/routes/auth.ts:28-36` (registerSchema)
- `extension/src/shared/schemas.ts:11-19` (registerSchema)
- `web/src/lib/schemas.ts:27-39` (registerSchema)

Same regex patterns, same min lengths, but the web version adds `confirmPassword` with a `.refine()`. The CLAUDE.md even documents this as a known sync problem. If you add a "must contain special character" rule, you'll need to update three files.

**Recommendation:** Document the password policy as a versioned constant (e.g., `PASSWORD_POLICY_V1`) in your reference docs. Better yet, make the backend the single enforcer and have frontends show generic validation with a "min 8 chars" hint, relying on backend error messages for the precise rules. Client-side validation is UX convenience, not security.

---

### 5. Duplicate Validation Functions in Extension

**Files:**
- `extension/src/shared/schemas.ts:163-194` — `validateLogin()`, `validateRegister()`, `validateGenerateNote()`
- `web/src/lib/schemas.ts:59-86` — `validateLogin()`, `validateRegister()`

These are identical wrapper functions around `.safeParse()` that transform Zod errors into `{ success, errors }` format. They're copy-pasted between packages.

But more importantly, the extension has **both** raw schemas AND wrapper functions, and different components use different styles:
- `LoginForm.tsx` uses `validateLogin()` / `validateRegister()` (wrapper)
- `NoteGenerator.tsx` uses `validateGenerateNote()` (wrapper)
- Web `login/page.tsx` uses `loginSchema.safeParse()` directly
- Web `signup/page.tsx` uses `registerSchema.safeParse()` directly

**Recommendation:** Pick one pattern per package and stick to it. The web's direct `.safeParse()` approach is simpler and more idiomatic Zod. The wrapper functions add indirection without value.

---

### 6. `req as AuthenticatedRequest` Cast Repeated Everywhere

**Files:**
- `backend/src/routes/auth.ts:169` — `(req as AuthenticatedRequest).user`
- `backend/src/routes/notes.ts:33` — `(req as AuthenticatedRequest).user`
- `backend/src/routes/billing.ts:38,59` — `(req as AuthenticatedRequest).user`
- `backend/src/middleware/csrf.ts:78` — `(req as AuthenticatedRequest).user?.userId`
- `backend/src/middleware/subscription.ts:19` — `req as AuthenticatedRequest`
- `backend/src/middleware/email-verification.ts:23` — `req as AuthenticatedRequest`

Every route and middleware that runs after `requireAuth` has to manually cast `req` to `AuthenticatedRequest`. This is fragile — if someone adds a new route and forgets the cast, TypeScript won't catch the missing `.user` property because `req` is typed as plain `Request`.

**Recommendation:** Have `requireAuth` return a typed request through a wrapper, or use a typed middleware chain pattern. Even a simple `getAuthUser(req)` helper that does the cast once with a runtime assertion would be cleaner than scattering casts.

---

### 7. Inline SQL Scattered Across Service and Route Files

**Files:**
- `backend/src/routes/auth.ts:371-382` — Raw SQL in route handler (password reset lockout clearing)
- `backend/src/services/auth-service.ts:212,271-275,289-292,302-325,361-365,431-436,455` — Raw SQL in service layer
- `backend/src/middleware/subscription.ts:41-44` — Raw SQL in middleware

The `db/queries/users.ts` module provides a nice abstraction layer for user queries, but not all SQL lives there. Auth service and route handlers have raw `db.query()` calls for session operations, lockout resets, and subscription checks.

**Recommendation:** Move session-related queries to a `db/queries/sessions.ts` module. This keeps the data access layer centralized, makes the SQL easier to audit, and prevents the same query pattern from being written slightly differently in two places. The lockout reset SQL in `auth.ts:374-382` duplicates logic that should live in `lockout-service.ts`.

---

### 8. Dashboard Usage Data is Hardcoded

**File:** `web/src/app/dashboard/page.tsx:22-25`

```typescript
const usage = {
  notesGenerated: 42,
  month: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
};
```

This is mock data displayed as real. There's a `usage_service.ts` in the backend and a `usage` database table, but no API endpoint to fetch it and no frontend integration. Users see "42 SOAP notes generated" regardless of actual usage.

**Recommendation:** Either connect this to a real `/usage` endpoint or remove it entirely. Showing fake data to paying healthcare customers erodes trust. Even a simple "Notes generated this session: X" counter (client-side) would be more honest.

---

## MEDIUM: Code Quality Improvements

### 9. Extension Has Stale `types.ts` File

**File:** `extension/src/shared/types.ts`

This file defines `User`, `SuggestedCode`, `BillingCharge`, `BillingSummary`, `GoalStatus`, `GoalsTracking`, `GeneratedNote`, `GenerateNoteInput`, and `NoteType` as plain interfaces.

But `extension/src/shared/schemas.ts` **also** defines all of these as Zod schemas with inferred types exported. The schemas version is strictly better — it enables runtime validation.

Components import from both files inconsistently:
- `App.tsx` imports `GeneratedNote` from `schemas.ts`
- `types.ts` User lacks `emailVerified` (stale)
- `storage.ts` defines its own `StoredAuth` and `StoredPreferences` interfaces instead of using the schemas versions

**Recommendation:** Delete `extension/src/shared/types.ts`. Use `schemas.ts` as the single type source. Update `storage.ts` to import from `schemas.ts`.

---

### 10. SVG Icons Inline Everywhere — Not Componentized

Inline SVGs are scattered throughout:
- Settings gear icon: duplicated in `extension/src/sidepanel/App.tsx:155-173` and `web/src/app/dashboard/page.tsx:127-129`
- Loading spinner SVG: duplicated in `extension/LoginForm.tsx:151-154,261-264` and multiple web pages
- Warning triangle icon: `extension/App.tsx:182`, `extension/SessionAlert.tsx:53-64`, `web/SessionAlert.tsx` (similar)
- Check/X icons: `extension/ResultDisplay.tsx`, `extension/NoteGenerator.tsx` (large inline SVGs)
- Chevron back icon: `extension/ResultDisplay.tsx:57-59`

**Recommendation:** The web app already has a `components/ui/` folder. Create a small icon set (5-6 icons used across the app) as simple React components. For the extension, even a single `Icons.tsx` file exporting named components would eliminate 50+ lines of duplication and make icon changes consistent.

---

### 11. Auth Loading State Pattern Repeated

Every web page that needs auth checks has this exact pattern:

```typescript
if (isLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="loading-spinner" />
    </div>
  );
}
```

Seen in: `login/page.tsx:83-88`, `signup/page.tsx:83-89`, and variants in `dashboard/page.tsx`, `reset-password/page.tsx`, `pricing/page.tsx`.

**Recommendation:** The `ProtectedRoute` component already wraps the dashboard. Use a similar `AuthLayout` component that handles the loading state for all auth pages, eliminating this copy-paste pattern.

---

### 12. Rate Limiter Configuration is Repetitive

**File:** `backend/src/middleware/rate-limit.ts`

Eight rate limiters all follow the exact same structural pattern with only `windowMs`, `max`, and `message` differing. Each is 15-16 lines of nearly identical code.

**Recommendation:** Create a `createRateLimit(name, windowMs, max)` factory function that builds the config. This reduces 140 lines to ~30 and makes it obvious when a rate limiter deviates from the standard pattern.

---

### 13. No Billing Audit Action for Payment Failed vs Renewal

**File:** `backend/src/services/billing-service.ts:206,240`

Comments say `// Reusing for renewal - consider adding SUBSCRIPTION_RENEWED` and `// Reusing - consider adding PAYMENT_FAILED`. The code reuses `SUBSCRIPTION_CREATED` for renewals and `SUBSCRIPTION_CANCELLED` for payment failures, which makes audit logs misleading.

**Recommendation:** Add `SUBSCRIPTION_RENEWED` and `PAYMENT_FAILED` to the `AuditAction` enum. This is a 2-line change that makes audit logs actually useful for investigating billing issues.

---

### 14. Extension Login Form is a 291-Line God Component

**File:** `extension/src/sidepanel/components/LoginForm.tsx`

This single component handles:
- Login form
- Signup form
- Forgot password form
- Password reset email sent confirmation
- View mode switching between all four states
- Validation for two different schemas
- Loading states

Compare to the web app, which properly separates these into `login/page.tsx`, `signup/page.tsx`, and `forgot-password/page.tsx`.

**Recommendation:** Split `LoginForm.tsx` into `LoginForm.tsx`, `SignupForm.tsx`, and `ForgotPasswordForm.tsx`, with the parent managing which one to show. The three forms share very little actual logic.

---

## LOW: Minor Issues

### 15. `useApi` Hook is Defined But Never Used

**File:** `extension/src/sidepanel/hooks/useApi.ts`

This is a generic hook for wrapping API calls with loading/error state. It's never imported anywhere in the codebase — components call `api.*` directly and manage their own loading states.

**Recommendation:** Either use it or delete it. Dead code is a maintenance burden.

---

### 16. Web Stripe Webhook is a Proxy

**File:** `web/src/app/api/webhooks/stripe/route.ts`

The Next.js webhook handler just forwards the raw request to the backend. This means every Stripe webhook makes two HTTP requests instead of one.

**Recommendation:** Point Stripe's webhook URL directly at the backend's `/billing/webhook` endpoint. The proxy adds latency, failure surface area, and unnecessary code. You only need the proxy if the backend isn't publicly accessible.

---

### 17. BETA Badge Markup Repeated

The BETA badge markup is copy-pasted in 8+ locations across both extension and web:

```tsx
<span className="text-[9px] font-normal px-1.5 leading-4 rounded-full border border-stone-400 text-stone-400">BETA</span>
```

**Recommendation:** Extract to a `<BetaBadge />` component. When you leave beta, you update one file instead of eight.

---

## Findings from Unit Testing (2026-02-07)

The following issues were discovered while writing comprehensive unit tests across both packages (418 tests total). They are not covered in the sections above.

### 18. Extension ErrorBoundary Always Shows Error Details (HIPAA Concern)

**Files:**
- `extension/src/sidepanel/components/ErrorBoundary.tsx:62-70`
- `web/src/components/ErrorBoundary.tsx:65-76` (correctly gated)

The web ErrorBoundary gates error details behind `process.env.NODE_ENV === 'development'`. The extension version has **no such guard** — it always renders a `<details>` block with `this.state.error.message`. If an error message contains PHI (e.g., a validation error echoing patient context back), it's exposed in the production extension UI.

**Recommendation:** Add the same `NODE_ENV` or `import.meta.env.MODE` guard as the web version. Alternatively, never render raw error messages in production — show only the generic "Something went wrong" text.

---

### 19. Web `setAuth()` Silently Swallows Storage Write Failures

**File:** `web/src/lib/storage.ts:45-61`

When `sessionStorage.setItem()` fails (quota exceeded, private browsing restrictions), `setAuth()` logs to Sentry and console but **returns void without signaling failure to the caller**. The auth context calls `storage.setAuth(authData)` after login and assumes it succeeded. If it didn't, the user appears logged in (state is in memory) but a page refresh will log them out (nothing persisted).

**Recommendation:** Either return a boolean success indicator or throw so callers can handle the failure (e.g., show a warning: "Your session may not persist across page refreshes").

---

### 20. `useApi` Hook Has Unstable `options` in `useCallback` Dependencies

**File:** `extension/src/sidepanel/hooks/useApi.ts:35`

The `execute` callback depends on `[apiFunction, options]`, but `options` is an object parameter with default value `{}`. If callers pass inline objects like `useApi(api.login, { onSuccess: () => {} })`, the `options` reference changes every render, causing `execute` to get a new identity every render. Any `useEffect` depending on `execute` would loop infinitely.

Note: This hook is currently unused (covered in finding #15), but if it's ever adopted, this bug will surface immediately.

**Recommendation:** If keeping the hook, destructure `onSuccess`/`onError` from options and use them individually in the dependency array, or use `useRef` to store the latest callbacks.

---

### 21. `loadAuth` Not Wrapped in `useCallback` in Extension `useAuth`

**File:** `extension/src/sidepanel/hooks/useAuth.ts:101-114`

`loadAuth` is defined as a plain `async` function inside the hook body but is called via `void loadAuth()` in a `useEffect` with an empty dependency array (`[]`). Unlike `login`, `register`, `logout`, and `fetchUser` — which are all wrapped in `useCallback` — `loadAuth` is recreated every render. This currently works because the effect only runs once (mount), but it triggers the `react-hooks/exhaustive-deps` lint warning and breaks the pattern consistency that other hooks in this file follow.

**Recommendation:** Either wrap in `useCallback` for consistency, or move the logic inline into the `useEffect` callback since it's only called once.

---

### 22. `NoteGenerator` Uses `useRef` for Inter-Phase State Transfer

**File:** `extension/src/sidepanel/components/NoteGenerator.tsx:36-39`

```typescript
const generatedNoteRef = useRef<GeneratedNote | null>(null);
const errorMessageRef = useRef<string | null>(null);
```

These refs store the generated note and error message from `handleSubmit`, which are then read 1.5 seconds later by `useEffect` timeout callbacks during the success/error animation phases. This works but is fragile — the data flow is non-obvious (write in event handler, read in effect), and if the component unmounts and remounts during the animation, the refs are gone. The pattern is essentially a manual message queue between two disconnected pieces of React lifecycle.

**Recommendation:** Use a reducer or combined state object (e.g., `{ phase, note, error }`) so the data and the phase transition are set atomically. This makes the data flow explicit and testable.

---

### 23. Extension `SessionAlert` Dismiss Button Always Renders

**File:** `extension/src/sidepanel/components/SessionAlert.tsx:74-82`

The dismiss button always renders regardless of whether `onDismiss` is provided. When `onDismiss` is `undefined`, clicking dismiss sets `alert` to `null` (hiding the alert) but the parent never learns the alert was dismissed. Compare to the web `SessionAlert` which conditionally renders the dismiss button.

This isn't a bug per se (the alert hides either way), but it's a behavioral divergence from the web version and could confuse future developers who expect dismiss to propagate to the parent.

**Recommendation:** Conditionally render the dismiss button only when `onDismiss` is provided, matching the web version's behavior.

---

### 24. `void fetchUser()` Calls Lack Error Propagation

**Files:**
- `extension/src/sidepanel/hooks/useAuth.ts:71,95`
- `web/src/lib/auth-context.tsx` (similar pattern)

Background refresh calls use `void fetchUser()` (fire-and-forget). The `fetchUser` function catches its own errors and logs to console, so unhandled rejections are avoided. However, there's no mechanism to surface persistent failures to the user. If `fetchUser` fails repeatedly (e.g., backend down, token expired but refresh also failing), the user sees stale data with no indication that refreshes are failing.

**Recommendation:** Add a failure counter. After N consecutive failures, set an error state that the UI can display (e.g., "Unable to connect — your data may be outdated"). This is especially important in a healthcare context where stale subscription status could allow usage beyond trial expiry.

---

### 25. Hardcoded Version String in Settings

**File:** `extension/src/sidepanel/components/Settings.tsx:184`

```tsx
FlashNote v0.1.0
```

This is a hardcoded string that will drift from the actual version in `package.json`. It's already stale if the version has been bumped.

**Recommendation:** Import the version from `package.json` or use a Vite define/env variable (e.g., `import.meta.env.VITE_APP_VERSION`) populated at build time.

---

## What's Actually Good

To be fair, this review focuses on problems. Here's what's working well:

- **Security patterns are consistent and thorough** — timing-safe comparisons, bcrypt with proper rounds, algorithm pinning on JWTs, CSRF with HMAC, rate limiting on every endpoint, fail-secure patterns
- **HIPAA compliance is taken seriously** — PHI never logged, audit trail for all auth events, Sentry sanitization, no PHI in error responses
- **Backend architecture is clean** — routes → services → db queries layering is consistent, error handling flows through a centralized error handler, Zod validation on all inputs
- **LLM abstraction layer is well-designed** — provider interface, factory pattern, proper retry with backoff, structured output validation with Zod schemas
- **The extension's auth flow is robust** — token refresh, CSRF, session invalidation events, forced logout handling
- **Database access uses parameterized queries everywhere** — no SQL injection risk
- **Stripe integration is solid** — webhook idempotency, signature verification, proper error handling for missing metadata

---

## Prioritized Action Items

### Critical (HIPAA / Security)

1. **Fix extension ErrorBoundary** (#18) — Add `import.meta.env.MODE` guard to hide error details in production (5 minutes)
2. **Sentry sanitization sync check** (#3) — Add CI or test to prevent drift (1 hour)

### High (Correctness / Data Integrity)

3. **Fix `setAuth` silent failure** (#19) — Return success indicator or throw so callers can warn users (15 minutes)
4. **Consolidate extension types** (#2, #9) — Delete `types.ts`, use `schemas.ts` as source of truth (30 minutes)
5. **Add missing audit actions** (#13) — `SUBSCRIPTION_RENEWED`, `PAYMENT_FAILED` (5 minutes)
6. **Fix dashboard mock data** (#8) — Either wire up usage API or remove fake numbers (1 hour)
7. **Add background refresh failure indicator** (#24) — Surface persistent `fetchUser` failures to UI (30 minutes)

### Medium (Architecture / Maintainability)

8. **Extract `db/queries/sessions.ts`** (#7) — Move session SQL out of auth service (1 hour)
9. **Create `getAuthUser(req)` helper** (#6) — Eliminate scattered type casts (30 minutes)
10. **Split extension LoginForm** (#14) — Separate login/signup/forgot-password (1 hour)
11. **NoteGenerator state management** (#22) — Replace useRef message-passing with reducer or combined state (30 minutes)
12. **Use build-time version** (#25) — Replace hardcoded `v0.1.0` with `import.meta.env` variable (10 minutes)
13. **API client divergence tracking** (#1) — Document shared behavior contract (1 hour)

### Low (Cleanup)

14. **Rate limiter factory** (#12) — Reduce middleware boilerplate (30 minutes)
15. **Fix `useApi` hook deps** (#15, #20) — Fix or delete dead hook with unstable deps (5 minutes)
16. **Wrap `loadAuth` in useCallback** (#21) — Consistency with other hooks in useAuth (5 minutes)
17. **Extension SessionAlert dismiss guard** (#23) — Conditionally render dismiss button (5 minutes)
