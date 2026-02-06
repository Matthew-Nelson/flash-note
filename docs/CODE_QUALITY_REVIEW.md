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

1. **Consolidate extension types** — Delete `types.ts`, use `schemas.ts` as source of truth (30 minutes)
2. **Add missing audit actions** — `SUBSCRIPTION_RENEWED`, `PAYMENT_FAILED` (5 minutes)
3. **Fix dashboard mock data** — Either wire up usage API or remove fake numbers (1 hour)
4. **Extract `db/queries/sessions.ts`** — Move session SQL out of auth service (1 hour)
5. **Create `getAuthUser(req)` helper** — Eliminate scattered type casts (30 minutes)
6. **Split extension LoginForm** — Separate login/signup/forgot-password (1 hour)
7. **Rate limiter factory** — Reduce middleware boilerplate (30 minutes)
8. **Sentry sanitization sync check** — Add CI or test to prevent drift (1 hour)
9. **API client divergence tracking** — Document shared behavior contract (1 hour)
10. **Delete dead `useApi` hook** — Zero effort, zero risk (1 minute)
