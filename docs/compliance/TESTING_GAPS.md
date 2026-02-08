# Testing Gaps Audit — Launch Blockers

> **Status:** LAUNCH BLOCKER — All items must be resolved before production launch
> **Date:** February 2026
> **Source:** Unit test coverage audit at 95% threshold enforcement

## Context

With 478 unit tests across web (227) and extension (251) and 95% coverage thresholds enforced via CI, the core shared libraries and UI components are well-tested. However, the audit revealed gaps in coverage scope, test quality, and application code that must be addressed before launch.

---

## 1. Coverage Scope Gaps

These files contain runtime logic that is excluded from coverage measurement entirely.

### 1.1 CRITICAL: Stripe Webhook Route (Web)

**File:** `web/src/app/api/webhooks/stripe/route.ts`

**Risk:** Revenue-critical payment processing with Stripe signature verification. Currently hidden inside the blanket `src/app/**` coverage exclusion (intended for Next.js page components, not API routes).

**What's untested:**
- Stripe webhook signature validation
- Payment event handling (checkout completed, subscription updated, etc.)
- Error handling for invalid/replayed webhooks

**Action:** Add to coverage includes or carve out from the `src/app/**` exclusion. Write unit tests mocking the Stripe SDK and verifying signature validation, event routing, and error paths.

### 1.2 HIGH: Extension App Component

**File:** `extension/src/sidepanel/App.tsx` (~238 lines)

**Risk:** Main application component with complex state management that is entirely outside coverage scope.

**What's untested:**
- View switching logic (login → generator → results → settings)
- Email verification polling and resend flow
- Auth state-driven rendering
- Interaction between useAuth hook and UI state

**Action:** Add `src/sidepanel/App.tsx` to coverage includes. Write component tests for view transitions and auth-dependent rendering.

### 1.3 MEDIUM: Extension Background Service Worker

**File:** `extension/src/background/service-worker.ts` (~187 lines)

**Risk:** Chrome extension lifecycle management, message passing, and tab tracking. Not in coverage scope.

**What's untested:**
- Message handling between content script and sidepanel
- Tab activation and badge management
- Extension install/update handlers

**Action:** Add `src/background/**` to coverage includes. Test message handlers and state management (may require mocking chrome runtime APIs more extensively).

### 1.4 MEDIUM: Extension Content Script

**File:** `extension/src/content/floating-button.ts` (~220 lines)

**Risk:** DOM injection into EMR pages. Not in coverage scope.

**What's untested:**
- DOM element creation and injection
- Preference-driven show/hide logic
- Event handling for button clicks
- Cleanup on navigation

**Action:** Add `src/content/**` to coverage includes. Extract testable logic from DOM manipulation where possible.

### 1.5 LOW: Extension Sentry Wrapper

**File:** `extension/src/shared/sentry.ts` (~185 lines, explicitly excluded)

**Risk:** PHI sanitization in `beforeSend` hook is runtime logic with HIPAA implications. Currently excluded with comment "BrowserClient init requires integration testing."

**What's untested:**
- `beforeSend` PHI sanitization (breadcrumb filtering, URL stripping, body redaction)
- Scope cloning and context attachment in `captureException`
- `initSentry` no-op behavior without DSN

**Note:** The sanitization logic in `sentry-sanitization.ts` IS tested. The gap is the Sentry client integration that calls it. The `sentry.test.ts` file exists but only tests no-op behavior when the client isn't initialized.

**Action:** Either extract the `beforeSend` sanitization into a testable pure function, or add targeted tests that initialize the BrowserClient with a mock transport.

---

## 2. Application Code Issues Found During Testing

These are bugs or design problems in the source code that the testing process revealed.

### 2.1 HIGH: `useApi` Hook Unstable Dependency Array

**File:** `extension/src/sidepanel/hooks/useApi.ts:35`

```typescript
const execute = useCallback(
  async (...args: Args): Promise<T | null> => { ... },
  [apiFunction, options]  // options is an OBJECT — new reference every render
);
```

**Problem:** The `options` parameter is an object compared by reference. If callers pass inline options (`{ onSuccess: () => {} }`), `execute` gets a new identity every render, which can cause infinite loops in any `useEffect` that depends on it.

**Action:** Either memoize the options internally (extract `onSuccess`/`onError` and use them as individual deps), or document that callers must memoize the options object.

### 2.2 HIGH: Extension ErrorBoundary Exposes Error Details in Production

**File:** `extension/src/sidepanel/components/ErrorBoundary.tsx:62-69`

**Problem:** The web ErrorBoundary gates error details behind `process.env.NODE_ENV === 'development'`, but the extension version always renders error messages and stack traces. Error messages could contain internal API URLs, stack traces, or user input that may include PHI.

**Action:** Gate error detail rendering behind a development/debug mode check, matching the web version's behavior.

### 2.3 MEDIUM: `fetchUser()` TOCTOU Race Condition

**Files:** `web/src/lib/api.ts:289-305`, `extension/src/shared/api.ts:298-315`

```typescript
async fetchUser() {
  const data = await this.request('/user/me');  // reads storage for token
  const auth = await storage.getAuth();          // reads storage AGAIN
  if (auth) {
    await storage.setAuth({ ...auth, user: data.user });
  }
  return data;
}
```

**Problem:** Between the `request()` call (which reads auth for the token header) and the second `storage.getAuth()`, a concurrent logout could clear auth. The test `should skip storage update when getAuth returns null after fetch` proves this race exists. In the extension, this is async storage with real race potential.

**Action:** Either read auth once and pass it through, or accept the race with a comment explaining why it's benign (the user sees a momentary stale state before being logged out).

### 2.4 MEDIUM: `unknown_error` Code Path Lacks Response Validation

**Files:** `web/src/lib/api.ts:171-173`, `extension/src/shared/api.ts:154-156`

```typescript
const errorCode = result.success === false ? result.error.code : 'unknown_error';
const errorMessage = result.success === false ? result.error.message : 'An error occurred';
```

**Problem:** The API response is cast as `ApiResponse<T>` without runtime validation. If the server returns malformed JSON (e.g., `{}`), the code falls through to `unknown_error`. A Zod runtime check of the response envelope would catch server-side regressions and provide better error diagnostics.

**Action:** Add a lightweight runtime check (Zod `.safeParse` or manual validation) of the response envelope shape, at least for error responses.

### 2.5 LOW: Duplicated Code Across Web and Extension

**Files:** `api.ts`, `sentry-sanitization.ts`, `schemas.ts`, `storage.ts` — nearly identical between packages, along with their test files.

**Problem:** Bug fixes and policy changes (e.g., password requirements) must be applied in both places. The web `api.ts` already notes it was "Ported from extension/src/shared/api.ts for consistency."

**Action:** Consider extracting shared code into a `packages/shared` workspace package. Not a launch blocker by itself, but increases the risk of divergence for every item above.

---

## 3. Test Quality Issues

These don't block launch but should be addressed to maintain test reliability.

### 3.1 Weak Negative-Only Assertions

Several tests only assert that a callback was NOT called, without verifying what the user actually sees:

- `LoginForm.test.tsx` — "should show validation errors for empty fields" only checks `onLogin` wasn't called
- `LoginForm.test.tsx` — "should validate password policy on signup" only checks `onRegister` wasn't called
- `NoteGenerator.test.tsx` — "should show validation errors for invalid input" only checks the button is disabled

**Action:** Add assertions for the actual validation error messages rendered in the UI.

### 3.2 ResultDisplay Clipboard v8 Ignore

**File:** `extension/src/sidepanel/components/ResultDisplay.tsx:27-28`

The clipboard error catch block was marked `v8 ignore` because mock interference made the test flaky, not because the code is unreachable. Clipboard failures happen in production.

**Action:** Fix test isolation (reset clipboard mock in `afterEach`) and remove the `v8 ignore` comment.

### 3.3 Timer Mode Switching Fragility

Multiple tests in `useAuth.test.ts` and `auth-context.test.tsx` switch between real and fake timers mid-test. This pattern works but is fragile — reordering lines or adding `waitFor` after the switch will hang the test.

**Action:** Add comments explaining the pattern where it's used. Consider extracting a helper like `switchToFakeTimersAfterSettle()` to encapsulate the pattern.

---

## Priority Summary

| # | Issue | Severity | Type |
|---|-------|----------|------|
| 1.1 | Stripe webhook untested | CRITICAL | Coverage gap |
| 2.1 | `useApi` unstable deps | HIGH | Bug |
| 2.2 | ErrorBoundary exposes details | HIGH | Security / HIPAA |
| 1.2 | App.tsx untested | HIGH | Coverage gap |
| 2.3 | `fetchUser` TOCTOU race | MEDIUM | Bug |
| 2.4 | No response envelope validation | MEDIUM | Robustness |
| 1.3 | Service worker untested | MEDIUM | Coverage gap |
| 1.4 | Content script untested | MEDIUM | Coverage gap |
| 1.5 | Sentry wrapper partially tested | LOW | Coverage gap |
| 2.5 | Code duplication | LOW | Maintenance |
| 3.1 | Weak test assertions | LOW | Test quality |
| 3.2 | Clipboard v8 ignore workaround | LOW | Test quality |
| 3.3 | Timer switching fragility | LOW | Test quality |

**All CRITICAL and HIGH items are launch blockers.** MEDIUM items should be addressed before launch but may be deferred with documented risk acceptance. LOW items are tracked for post-launch improvement.
