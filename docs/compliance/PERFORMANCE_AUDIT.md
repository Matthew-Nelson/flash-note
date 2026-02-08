# Performance & Memory Leak Audit

**Date:** 2026-02-07
**Scope:** Backend, Web App, Browser Extension

---

## High Severity

### 1. Unbounded Database Table Growth

Cleanup functions exist but are never invoked. Over time these tables will degrade query performance, increase storage costs, and put pressure on the connection pool.

| Table | Cleanup Function | Location | Status |
|-------|-----------------|----------|--------|
| `email_tokens` | `cleanupExpiredTokens()` | `backend/src/services/token-service.ts:167-175` | Defined, never called |
| `processed_webhook_events` | `cleanupOldWebhookEvents()` | `backend/src/db/queries/webhooks.ts:32-40` | Defined, never called |
| `audit_logs` | None | `backend/src/services/audit-service.ts` | No cleanup exists |

**Fix:** Schedule a daily cleanup job (cron or application-level scheduler) that calls `cleanupExpiredTokens()` and `cleanupOldWebhookEvents()`. For audit logs, add a retention-based pruning function that respects HIPAA retention requirements (typically 6 years).

### 2. Uncancelled setTimeout on Unmounted Component

**File:** `extension/src/sidepanel/components/ResultDisplay.tsx:21-25`

```typescript
setTimeout(() => setCopiedSection(null), 2000); // never cancelled on unmount
```

When the user copies text and navigates away before the 2-second timeout fires, React attempts a state update on an unmounted component. This is a classic memory leak pattern.

**Fix:** Store the timeout ID in a `useRef`, clear it in a `useEffect` cleanup function.

---

## Medium Severity

### 3. Missing AbortController on Fetch Calls

Fetch requests in `useEffect` hooks have no `AbortController`. If a component unmounts mid-request, the response handler runs against stale or unmounted state, leaking memory.

**Affected files:**
- `extension/src/shared/api.ts` (all fetch calls)
- `web/src/app/reset-password/page.tsx`
- `web/src/app/verify-email/page.tsx`
- `web/src/app/forgot-password/page.tsx`
- `web/src/app/dashboard/page.tsx` (recursive polling)

**Fix:** Pass an `AbortSignal` to fetch calls and abort in `useEffect` cleanup.

### 4. Background Polling Without Request Deduplication

Both the extension and web app poll on a fixed interval regardless of whether the previous request has completed or the tab is visible.

**Affected files:**
- `extension/src/sidepanel/hooks/useAuth.ts:90-99` (5-minute interval, polls even when sidepanel is hidden)
- `web/src/lib/auth-context.tsx:110-118` (same pattern, interval recreated on dependency change)

**Fix:**
- Track in-flight request state; skip polling if a request is already pending.
- Pause polling when `document.visibilityState !== 'visible'`.

### 5. Recursive Polling Without Overall Timeout

**File:** `web/src/app/dashboard/page.tsx:30-64`

`pollForSubscription()` uses recursive `setTimeout` up to 10 attempts with no `AbortController`. If the user navigates away mid-poll, promises accumulate without cleanup.

**Fix:** Add an `AbortController` and cancel it in the `useEffect` cleanup.

### 6. Content Script History API Monkey-Patching

**File:** `extension/src/content/floating-button.ts:185-195`

`history.pushState` and `history.replaceState` are globally replaced and never restored. If the content script is injected multiple times on a SPA, the wrappers chain, adding overhead to every navigation.

**Fix:** Guard against double-patching by checking for a sentinel property before wrapping.

### 7. In-Memory Rate Limiter Store

**File:** `backend/src/middleware/rate-limit.ts`

Uses the default `express-rate-limit` MemoryStore. This works for a single instance but breaks under horizontal scaling (each instance has independent state).

**Fix (before scaling):** Switch to a Redis-backed store (e.g., `rate-limit-redis`).

---

## Low Severity

### 8. Event Listener Dependency Churn

**File:** `extension/src/sidepanel/hooks/useAuth.ts:65-88`

Visibility/focus listeners are torn down and re-added every time the `fetchUser` callback reference changes. This adds GC pressure.

**Fix:** Stabilize the `fetchUser` reference with `useRef` to avoid unnecessary listener churn.

### 9. Rapid Interval Create/Destroy in NoteGenerator

**File:** `extension/src/sidepanel/components/NoteGenerator.tsx:42-84`

Phase transitions (`idle` -> `loading` -> `success` -> `idle`) create and destroy intervals/timeouts in quick succession, adding GC pressure during note generation.

**Fix:** Consolidate animation logic or use a single timer managed by a ref.

### 10. Chrome Storage Listener Never Removed

**File:** `extension/src/content/floating-button.ts:203-211`

A `chrome.storage.onChanged` listener is registered once and never removed. Chrome cleans this up on script destruction, but it's an inconsistent pattern.

**Fix:** Store the listener reference and remove it in a cleanup path.

### 11. No Explicit JSON Body Size Limit

**File:** `backend/src/index.ts:48-55`

Express defaults to ~100KB, but the limit is not set explicitly.

**Fix:** Add `express.json({ limit: '1mb' })` for clarity and defense in depth.

---

## Not a Problem (Verified Good)

These were checked and are well-implemented:

- **DB connection pool** — 20 max connections, 30s statement timeout, 2s connection timeout
- **Session cleanup** — Enforced on login, max 5 per user
- **Webhook idempotency** — Atomic INSERT with ON CONFLICT
- **Token version validation** — Single query per request
- **Sentry PHI sanitization** — `beforeSend` hooks strip sensitive fields in all components

---

## Recommended Fix Order

### Immediate (real risk of degradation)
1. Schedule cleanup jobs for expired tokens, webhook events, and old audit logs
2. Fix `ResultDisplay` copy timeout (store ID in ref, clear on unmount)
3. Add `AbortController` to fetch calls in `useEffect` hooks

### Soon (quality improvements)
4. Add request deduplication to background polling
5. Pause polling when tab/sidepanel is not visible
6. Add `express.json({ limit: '1mb' })` explicitly
7. Guard content script against double history API patching

### Before scaling
8. Move rate limiter to Redis-backed store
9. Add connection pool exhaustion monitoring
