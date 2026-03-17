# Codebase Concerns

**Analysis Date:** 2026-03-16

---

## Tech Debt

**Pino Logger Migration (Wide Scope):**
- Issue: Entire codebase uses `console.error` / `console.warn` / `console.log` with `eslint-disable no-console` suppressions. Every log call carries a TODO comment referencing the planned Pino migration.
- Files: `src/server/services/auth.ts` (lines 82–284), `src/server/services/billing.ts` (lines 189–276), `src/server/services/audit.ts` (line 21), `src/actions/auth.ts` (lines 162–348), `src/actions/notes.ts` (lines 106–156), `src/actions/billing.ts` (line 62), `src/server/services/llm/gemini-provider.ts` (lines 309–333), `src/server/services/llm/provider.ts` (line 101), `src/server/services/llm/claude-provider.ts` (lines 225–251), `src/server/lib/get-session.ts` (lines 55–77), `src/server/dal/usage.ts` (line 89), `src/app/dashboard/error.tsx` (line 18), `src/app/api/cleanup/webhook-events/route.ts` (line 31)
- Impact: Console logs go to Cloud Run stdout but are unstructured. Cloud Error Reporting cannot group errors from these paths. Security events (session refresh failures, audit failures) are invisible in dashboards.
- Fix approach: Install `pino` + `@google-cloud/pino-logging-gcp-config`, create `src/server/lib/logger.ts` singleton, replace all `console.*` calls. See `docs/planning/MONITORING_SETUP.md` for the full plan.

**Cleanup Endpoint Uses Shared Secret Instead of OIDC:**
- Issue: `src/app/api/cleanup/webhook-events/route.ts:11` uses `CLEANUP_SECRET` bearer token for auth. The code explicitly documents "Phase 1.7 will upgrade to OIDC tokens."
- Files: `src/app/api/cleanup/webhook-events/route.ts`
- Impact: Shared secrets are weaker than OIDC service account tokens. Requires manual rotation. No expiry on the credential itself.
- Fix approach: Replace bearer token check with Google Cloud OIDC token verification from Cloud Scheduler.

**`checkDeviceBinding` Exported but Never Called:**
- Issue: `src/server/dal/sessions.ts:197` exports `checkDeviceBinding` which logs IP/UA mismatches for security monitoring. It is never invoked anywhere in production code (only tested). The function has no call sites outside tests.
- Files: `src/server/dal/sessions.ts` (lines 197–227)
- Impact: Device binding anomalies (IP/UA changes) are never audited. A session token stolen and used from a different IP produces no security signal.
- Fix approach: Call `checkDeviceBinding` from `getSession` in `src/server/lib/get-session.ts` after the session is validated. Pass the request context.

**`unlockAccount` Has No Admin Interface:**
- Issue: `src/server/services/lockout.ts:145` exports `unlockAccount` for admin use, but there is no admin UI, CLI tool, or Route Handler that calls it. Permanently locked accounts (20+ failures) require direct database intervention to unlock.
- Files: `src/server/services/lockout.ts`
- Impact: Support cannot unlock permanently locked accounts without direct DB access. This is a gap for clinical staff who get locked out.
- Fix approach: Implement an admin CLI script or an authenticated admin Route Handler that calls `unlockAccount`. For v1, a CLI script (npm run admin:unlock-account -- --userId=...) is sufficient.

**Account Deletion Is Manual (Email-Gated):**
- Issue: `src/app/dashboard/settings/DeleteAccountSection.tsx` shows a confirm dialog then redirects users to `support@flashnote.co` to request deletion. No automated deletion flow exists. No DAL function for soft-deleting users is exposed to Server Actions.
- Files: `src/app/dashboard/settings/DeleteAccountSection.tsx`
- Impact: Non-compliant with GDPR/CCPA right-to-erasure requirements. Support burden for each deletion. Until Phase 2 PHI storage lands, the risk is low (no stored notes), but this will become critical once patient data is retained.
- Fix approach: Implement `deleteAccountAction` Server Action that soft-deletes the user, terminates all sessions, cancels Stripe subscription, and logs audit entry.

**`SESSION_IDLE_TTL_MS` vs. CLAUDE.md Documentation Mismatch:**
- Issue: `src/server/db/config.ts:176` sets `SESSION_IDLE_TTL_MS = 24 * 60 * 60 * 1000` (24 hours). `CLAUDE.md` states "Session expiry: 7 days (configurable)". The session absolute max is 7 days (`SESSION_ABSOLUTE_MAX_MS`), but the idle TTL is 24 hours.
- Files: `src/server/db/config.ts`
- Impact: Not a security issue — shorter idle TTL is more secure. Documentation is misleading for anyone configuring the system.
- Fix approach: Update CLAUDE.md to accurately state the idle TTL is 24 hours (rolling) with a 7-day absolute maximum.

**Stripe API Version Pinned with `@ts-expect-error`:**
- Issue: `src/server/services/billing.ts:71` uses `@ts-expect-error` to pin Stripe SDK to API version `2025-12-15.clover` because the SDK types don't match the webhook endpoint version. The `getSubscriptionIdFromInvoice` method on line 480 accesses undocumented `invoice.parent.subscription_details` via `as unknown as InvoiceWithParent` cast.
- Files: `src/server/services/billing.ts` (lines 71–72, 480–496)
- Impact: Type safety is bypassed for all invoice processing. If Stripe changes the `parent` structure the code will silently fail rather than catching the mismatch at compile time.
- Fix approach: When Stripe SDK ships proper types for 2025-12-15, remove the `@ts-expect-error` and the manual interface cast.

---

## Known Bugs / Behavioral Issues

**Zod Field Errors Leaked Unsanitized from Auth Actions:**
- Issue: All auth Server Actions in `src/actions/auth.ts` return raw `parsed.error.flatten().fieldErrors` directly without sanitization (lines 48, 98, 191, 238, 272, 326, 391). By contrast, `src/actions/notes.ts:50` correctly calls `sanitizeFieldErrors()` before returning field errors.
- Files: `src/actions/auth.ts`
- Impact: Exposes Zod validation messages like "Password must be at least 8 characters", "Password must contain at least one uppercase letter" to the client. These messages reveal password policy constraints that an attacker enumerating password policies would find useful. Violates the spirit of Rule L-3 (validation detail leaks).
- Fix approach: Apply `sanitizeFieldErrors()` (or a custom allowlist for auth fields: `email`, `password`, `confirmPassword`, `acceptedLegalTerms`, `inviteCode`) to all `fieldErrors` in `src/actions/auth.ts` before returning. Note: for auth fields, showing "Validation failed" is appropriate — the client-side form already has its own validation messages.

**`clinic_subscription_expired` Error Code Not Mapped in `NoteGenerationForm`:**
- Issue: `src/server/services/subscription.ts:42` returns `clinic_subscription_expired` as a denial reason. `src/actions/notes.ts:81` passes it through as `error`. `src/components/notes/NoteGenerationForm.tsx:10–23` does not include `clinic_subscription_expired` in `NOTE_ERROR_MESSAGES`. The form falls back to `NOTE_ERROR_FALLBACK` ("Something went wrong. Please try again.").
- Files: `src/components/notes/NoteGenerationForm.tsx`, `src/server/services/subscription.ts`
- Impact: Org-plan users whose clinic subscription lapses see a generic error instead of actionable messaging. They cannot diagnose the problem or contact their clinic admin.
- Fix approach: Add `clinic_subscription_expired: 'Your clinic subscription has expired. Please contact your clinic administrator.'` to `NOTE_ERROR_MESSAGES`.

---

## Security Considerations

**Auth Action `fieldErrors` Expose Password Policy (Low Severity):**
- Risk: As described above under Known Bugs — raw Zod messages reveal server-side validation rules to clients.
- Files: `src/actions/auth.ts`
- Current mitigation: Password policy is not secret by NIST standards; this is low severity.
- Recommendations: Apply `sanitizeFieldErrors()` pattern from `src/actions/notes.ts` to auth actions.

**Dev Email Body Logs Plain Text Containing Tokens:**
- Risk: In development when `RESEND_API_KEY` is absent, `src/server/services/email.ts:180` logs the full email `text` body to console, which includes password reset URLs (with token) and email verification URLs (with token). The email recipient address is correctly redacted (`To: [redacted]`), but the token appears in the URL in the body text.
- Files: `src/server/services/email.ts` (line 180)
- Current mitigation: The dev email path is guarded by `isDevelopment && !isTest` — it cannot run in production (`throw new Error('Email service not configured in production')`).
- Recommendations: Log only the token's first 8 characters for debuggability, or strip the token parameter from the logged URL. Acceptable risk in dev but worth tracking.

**`NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` and `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL` Are Client-Exposed:**
- Risk: Stripe price IDs are exposed as `NEXT_PUBLIC_` env vars in `src/app/pricing/page.tsx:10–11`. Price IDs are inlined into the client bundle at build time.
- Files: `src/app/pricing/page.tsx`
- Current mitigation: The `createCheckoutAction` in `src/actions/billing.ts:13–16` validates the price ID against the server-side allowlist (`config.STRIPE_PRICE_MONTHLY`, `config.STRIPE_PRICE_ANNUAL`). A client cannot submit an arbitrary price ID.
- Recommendations: This is acceptable — price IDs are not secret (they appear in Stripe's public-facing products). Document the defense-in-depth in the billing action.

**CSP Uses `unsafe-inline` for Styles:**
- Risk: `src/proxy.ts:25` includes `style-src 'self' 'unsafe-inline'`. This permits arbitrary inline `<style>` and `style=` attribute injection if XSS is achieved.
- Files: `src/proxy.ts`
- Current mitigation: A documented accepted risk (Tailwind + Next.js image placeholders require inline styles). `script-src` correctly uses nonces. XSS via style injection is limited attack surface.
- Recommendations: Track this as a known gap. If CSS nonce support becomes practical, remove `unsafe-inline`.

---

## Performance Bottlenecks

**`getUsageForUser` Makes Up to 3 Sequential DB Queries:**
- Problem: `src/server/dal/usage.ts:29–59` runs: (1) usage query, (2) `findActiveMembership`, (3) `findOrganizationById` — all sequential for org users. The dashboard page calls this on every render.
- Files: `src/server/dal/usage.ts`, `src/app/dashboard/page.tsx:189`
- Cause: Defensive design (stale `organization_id` on user table). The queries could be combined into a single JOIN.
- Improvement path: Rewrite `getUsageForUser` as a single SQL query joining `usage`, `organization_members`, and `organizations`. Or add React `cache()` wrapping (currently not cached).

**`getSession` Called Multiple Times Per Request Without Global Cache:**
- Problem: `getSession` in `src/server/lib/get-session.ts:30` uses `React.cache()` which deduplicates within a single React render tree. However, `getSession` is also called from Server Actions. Server Actions run outside the React render cache scope, causing duplicate DB lookups on action + page render.
- Files: `src/server/lib/get-session.ts`
- Cause: `React.cache()` scope is per React render, not per HTTP request.
- Improvement path: Acceptable for current scale. If latency becomes a concern, use Next.js unstable_cache or AsyncLocalStorage to share the result.

---

## Fragile Areas

**Stripe Invoice Subscription Extraction via Cast:**
- Files: `src/server/services/billing.ts` (lines 480–496)
- Why fragile: `getSubscriptionIdFromInvoice` accesses `invoice.parent.subscription_details.subscription` by casting `invoice as unknown as InvoiceWithParent`. This bypasses TypeScript. If Stripe changes the response shape, the code silently returns `null` and the webhook event is a no-op — subscription status will not update.
- Safe modification: Add explicit runtime validation (Zod) for the `parent` structure rather than relying on the cast. Add monitoring when `getSubscriptionIdFromInvoice` returns null.
- Test coverage: No test exists for the `parent.subscription_details` path being null or malformed.

**`adcTokenCache` Is Instance-Level State in `GeminiProvider`:**
- Files: `src/server/services/llm/gemini-provider.ts` (lines 275–305)
- Why fragile: The ADC token cache is a property on the `GeminiProvider` class instance. If Cloud Run spins up a new container, the cache is lost and a fresh token fetch is required. This is correct behavior, but if the provider singleton is ever not truly a singleton (e.g., re-instantiated per request), token requests will spike. Additionally, there is no error handling for the metadata server being temporarily unreachable beyond throwing `AuthenticationError`.
- Safe modification: The current singleton pattern in `src/server/services/llm/index.ts` is safe. Do not move provider instantiation into per-request scope.
- Test coverage: ADC token caching and refresh are tested in `gemini-provider.test.ts`.

**Permanent Lockout Requires Manual DB Intervention:**
- Files: `src/server/services/lockout.ts` (line 20), `src/server/dal/users.ts` (line 272)
- Why fragile: When `failed_login_attempts >= 20`, `locked_until` is set to `NULL`. Permanent lock detection in `getAccountLockoutStatus` (lines 46–49) relies on `failedLoginAttempts >= 20 && lockedUntil === null && lastFailedLoginAt !== null`. This triple-condition check is a fragile heuristic: if `lastFailedLoginAt` is NULL on an old account that somehow accumulated 20 failures without timestamps, the lock would not be detected. Also, `unlockAccount` is never called from any user-facing or admin interface.
- Safe modification: Add a dedicated boolean column `is_permanently_locked` to the `users` table to eliminate the heuristic, or implement the admin unlock interface described under Tech Debt.

**`registrationAction` Pre-validates Invite Code then Re-validates Inside Transaction:**
- Files: `src/actions/auth.ts` (lines 122–132), `src/server/services/auth.ts` (lines 167–214)
- Why fragile: The action does a `findByCode` check (optimistic fast-fail) before the expensive bcrypt hash. The auth service then re-validates the code inside a transaction with `FOR UPDATE`. This is correct. However, if `validateCodeRedeemable` logic diverges between the action's pre-check and the service's in-transaction check, a user could be misled about code validity. Both call paths use the same `validateCodeRedeemable` function from `src/server/dal/invite-codes.ts`, so this is currently safe.
- Safe modification: Ensure `validateCodeRedeemable` is never duplicated or overridden.

---

## Missing Critical Features

**No Admin Interface:**
- Problem: There is no admin dashboard or admin CLI. Permanently locked accounts, organization management, invite code creation, and user management all require direct PostgreSQL access.
- Blocks: Support operations. Customer success workflows.

**No PHI Storage (Phase 2 Blocked):**
- Problem: Note generation is pass-through — no notes are stored. Patient management, note history, and templates pages are all stubs showing "Coming soon." The `patientContext` field in `NoteGenerationForm` is explicitly marked `TEMPORARY` pending PHI Storage Phase 2.
- Files: `src/components/notes/NoteGenerationForm.tsx` (lines 294–301), `src/app/dashboard/notes/page.tsx`, `src/app/dashboard/patients/page.tsx`, `src/app/dashboard/templates/page.tsx`
- Blocks: Core product value proposition (note history, patient lookup, template reuse). Required before the product can be fully HIPAA-compliant end-to-end.

**BAA Not Finalized:**
- Problem: `src/app/baa/page.tsx` shows "PENDING LEGAL REVIEW" with Version 0.1 Draft. The BAA page is live and public-facing but contains no actual agreement. This is a HIPAA precondition for operating with covered entities.
- Files: `src/app/baa/page.tsx`
- Blocks: Legal ability to sign BAAs with customers. Required before production launch.

**No Scheduled Session Cleanup Job:**
- Problem: `src/server/dal/sessions.ts:233` implements `cleanupExpiredSessions` which returns a count. No Cloud Scheduler job or cron triggers this. Expired sessions accumulate in the `sessions` table indefinitely (though they are filtered by `expires_at > NOW()` in all queries, so they don't affect correctness — only table bloat).
- Files: `src/server/dal/sessions.ts`
- Blocks: Nothing functional, but table growth is unbounded.

---

## Test Coverage Gaps

**Sidebar Mobile Drawer Lacks `inert` Attribute:**
- What's not tested: `src/components/Sidebar.tsx` mobile drawer does not use `inert` when closed (unlike `MarketingNav.tsx:97` which correctly sets `inert={!isOpen}`). Focus can escape into the visually hidden drawer via keyboard navigation.
- Files: `src/components/Sidebar.tsx` (lines 196–204)
- Risk: Keyboard accessibility regression. Meets Phase E concern (focus trapping) documented in project memory.
- Priority: Medium — accessibility regression in a healthcare app.

**`checkDeviceBinding` Never Reached in Production Code:**
- What's not tested: End-to-end behavior of device change logging cannot be verified because the function is never called.
- Files: `src/server/dal/sessions.ts`
- Risk: Session security monitoring gap (see Tech Debt section).
- Priority: High.

**Webhook `invoice.paid` Path for Canceled Subscriptions:**
- What's not tested: The `handleInvoicePaid` handler in `src/server/services/billing.ts:401–422` logs an error and returns when `currentStatus === 'canceled'`. No test exists for this path.
- Files: `src/server/services/billing.ts`
- Risk: A Stripe retry delivering a paid invoice for a canceled sub would be silently no-oped with no test catching a regression.
- Priority: Low — the behavior is correct, just untested.

**Auth Action Unsanitized `fieldErrors` Return Paths:**
- What's not tested: No test verifies that raw Zod error messages are not returned from auth actions. Tests verify the error code (`validation_error`) but not the message content in `fieldErrors`.
- Files: `src/actions/auth.ts`
- Risk: Schema detail leak goes undetected.
- Priority: Medium.

**`clinic_subscription_expired` UI Message Gap:**
- What's not tested: No test verifies the `NoteGenerationForm` renders a meaningful message when `clinic_subscription_expired` is returned.
- Files: `src/components/notes/NoteGenerationForm.tsx`
- Risk: Silent fallback to generic error for org users.
- Priority: Low.

---

## Scaling Limits

**ADC Token Cache Is Per-Instance (Acceptable):**
- Current capacity: One token fetch per GeminiProvider instance per 60-minute expiry window. Multiple Cloud Run instances each maintain their own cache.
- Limit: GCP instance metadata server throttles excessive calls. Each container cold start triggers one token fetch.
- Scaling path: Acceptable at current scale. Would become an issue only if containers are cycling faster than the token TTL (< 1 minute), which is pathological.

**Redis Rate Limiting Returns Success When Redis Is Unavailable:**
- Current capacity: `src/server/lib/rate-limit.ts:83–84` — when `limiter === null` (Redis not configured), `checkRateLimit` returns `{ success: true }`. This is documented dev/test behavior.
- Limit: If Redis becomes unavailable in production, ALL rate limiting silently stops. There is no circuit breaker or fallback enforcement.
- Scaling path: Add a `REDIS_REQUIRED_IN_PRODUCTION` guard in `src/server/lib/redis.ts` that throws on startup if Redis is unconfigured in the production environment.

---

*Concerns audit: 2026-03-16*
