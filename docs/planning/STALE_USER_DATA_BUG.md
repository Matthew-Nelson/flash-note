# Critical Bug: Stale User Data After State Changes

**Created:** February 2, 2026
**Status:** Documented - Fix Required Before Launch
**Priority:** P0 (Launch Blocker)
**Affected Components:** Web App, Chrome Extension

---

## Executive Summary

User data cached in the frontend becomes stale after server-side state changes (email verification, subscription status updates). This causes users to be blocked from features they should have access to, requiring a logout/login cycle to resolve.

**Impact:** Users complete email verification or Stripe checkout successfully, but the app still shows their old status and blocks them from proceeding.

---

## Problem Description

### Root Cause

Both the web app and extension cache user data locally after login:
- **Web App:** React context + sessionStorage
- **Extension:** React state + chrome.storage.local

When the backend updates user state (via email verification endpoint or Stripe webhook), the frontend's cached data becomes stale. There is no automatic mechanism to sync these changes back to the client.

### Affected User Flows

| Flow | Trigger | Backend Update | Frontend Awareness |
|------|---------|----------------|-------------------|
| Email Verification | User clicks verification link | `email_verified = true` | ❌ None (was broken) |
| Subscription Checkout | Stripe webhook fires | `subscription_status = 'active'` | ⚠️ Web polls, Extension broken |
| Subscription Cancellation | Stripe webhook fires | `subscription_status = 'canceled'` | ❌ None |
| Trial Expiration | Cron/middleware check | `subscription_status = 'expired'` | ❌ None |

---

## Current State Analysis

### Web App

| Scenario | Status | Mechanism |
|----------|--------|-----------|
| Email verification | ✅ **Fixed** | Calls `refreshUser()` after successful verification |
| Post-checkout sync | ✅ Works | Polls `refreshUser()` every 3s for 30s after `?success=true` redirect |
| Subscription changes (no redirect) | ❌ Broken | No mechanism |
| Trial expiration | ❌ Broken | No mechanism |

**Code Reference:** `web/src/app/dashboard/page.tsx:26-79` (polling implementation)

### Chrome Extension

| Scenario | Status | Mechanism |
|----------|--------|-----------|
| Email verification | ✅ Works | Polls every 10s while `emailVerified === false` |
| Post-checkout sync | ❌ **Broken** | Checkout happens in external tab; extension unaware |
| Subscription changes | ❌ Broken | No mechanism |
| Trial expiration | ❌ Broken | No mechanism |

**Code Reference:** `extension/src/sidepanel/App.tsx:59-75` (email polling only)

---

## User Experience Impact

### Scenario: Extension User Subscribes

1. User is on trial in extension, clicks "View Plans"
2. Opens `flashnote.com/pricing` in new browser tab
3. Completes Stripe checkout successfully
4. Returns to extension
5. **Extension still shows "Trial - 14 days left"**
6. User tries to generate note → may be blocked or confused
7. **User must log out and log back in to see active subscription**

### Scenario: Web User Verifies Email (Before Fix)

1. User registers, receives verification email
2. Clicks verification link, sees "Email Verified!" success page
3. Navigates to pricing page to subscribe
4. **Gets error: "Please verify your email before subscribing"**
5. User confused - they just verified!
6. **User must log out and log back in**

---

## Proposed Solutions

### Option A: Periodic Background Refresh

**Description:** Refresh user data every N minutes while the app/extension is active.

**Implementation:**
```typescript
// In useAuth hook or App component
useEffect(() => {
  const interval = setInterval(() => {
    refreshUser();
  }, 5 * 60 * 1000); // Every 5 minutes

  return () => clearInterval(interval);
}, []);
```

**Pros:**
- Simple to implement
- Catches all state changes eventually
- Works for both web and extension

**Cons:**
- Wasteful API calls when nothing changed
- 5-minute window where data is still stale
- Could hit rate limits with many active users
- Doesn't solve immediate post-checkout UX

**Recommendation:** Use as a safety net, not primary solution.

---

### Option B: Refresh on App/Extension Focus

**Description:** When user returns to the app (tab focus, extension panel open), check if data might be stale and refresh.

**Implementation:**
```typescript
// Track last refresh time
const lastRefresh = useRef(Date.now());

useEffect(() => {
  const handleFocus = async () => {
    const timeSinceRefresh = Date.now() - lastRefresh.current;
    if (timeSinceRefresh > 30_000) { // 30 seconds
      await refreshUser();
      lastRefresh.current = Date.now();
    }
  };

  // Web: window focus
  window.addEventListener('focus', handleFocus);

  // Extension: visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') handleFocus();
  });

  return () => { /* cleanup */ };
}, []);
```

**Pros:**
- Efficient - only refreshes when user is actively using app
- Handles the common case (user completes external action, returns)
- No polling waste
- Works for subscription, email verification, and other state changes

**Cons:**
- 30-second debounce means rapid tab switching doesn't cause spam
- Requires detecting focus/visibility correctly on each platform
- Small window where stale data persists after returning

**Recommendation:** ✅ **Primary solution for extension.** Simple, efficient, handles the checkout return scenario.

---

### Option C: Cross-App Communication (Web → Extension)

**Description:** After checkout success on web app, send a message to the extension to trigger refresh.

**Implementation:**

Extension (background.js or service worker):
```typescript
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'SUBSCRIPTION_UPDATED') {
    // Notify sidepanel to refresh
    chrome.runtime.sendMessage({ type: 'REFRESH_USER' });
    sendResponse({ success: true });
  }
});
```

Web app (after checkout success):
```typescript
// In checkout success handler
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.sendMessage(EXTENSION_ID, { type: 'SUBSCRIPTION_UPDATED' });
}
```

**Pros:**
- Immediate sync - no delay
- Only triggers when actually needed
- Best possible UX

**Cons:**
- Requires knowing extension ID (changes between dev/prod)
- Adds coupling between web app and extension
- Doesn't work if extension not installed
- Requires `externally_connectable` manifest permission

**Recommendation:** Consider for v2 if Option B doesn't provide good enough UX.

---

### Option D: Keep Checkout Flow in Extension

**Description:** Instead of opening external pricing page, handle checkout within extension using iframe or popup.

**Implementation:**
- Create `/checkout` page on web app designed for iframe embedding
- Extension opens this in a popup or embedded frame
- Can detect completion via `postMessage` or URL changes

**Pros:**
- Full control over checkout flow
- Can detect success/failure immediately
- Best UX - no context switching

**Cons:**
- Significant implementation effort
- Stripe Checkout may have iframe restrictions
- Security considerations for embedded payment flows
- Would need to handle popup blockers

**Recommendation:** Out of scope for initial launch. Revisit post-launch if checkout conversion is an issue.

---

### Option E: Server-Sent Events (SSE) or WebSocket

**Description:** Backend pushes state changes to connected clients in real-time.

**Pros:**
- True real-time sync
- No polling overhead
- Scales to any state change type

**Cons:**
- Significant infrastructure change
- Connection management complexity
- May not work well with serverless/edge deployments
- Overkill for this use case

**Recommendation:** Not recommended for this problem. Over-engineered.

---

## Recommended Implementation Plan

### Phase 1: Immediate Fixes (Pre-Launch)

1. **Web App - Email Verification** ✅ DONE
   - Call `refreshUser()` after successful verification
   - Committed in `3b5b01b`

2. **Extension - Focus-Based Refresh**
   - Implement Option B in extension
   - Refresh user data when extension panel becomes visible
   - Debounce to prevent excessive API calls
   - **Files to modify:** `extension/src/sidepanel/App.tsx` or `useAuth.ts`

3. **Extension - Post-Checkout Awareness**
   - Add a "Refresh Status" button in Settings as fallback
   - Users can manually trigger refresh if focus-based doesn't catch it

### Phase 2: Safety Net (Pre-Launch)

4. **Periodic Background Refresh**
   - Add 5-minute interval refresh as safety net
   - Only if user has been active (not on idle tabs)
   - Catches edge cases like subscription cancellation

### Phase 3: Polish (Post-Launch)

5. **Cross-App Communication**
   - If metrics show users still hitting stale data issues
   - Implement web → extension messaging for immediate sync

---

## Testing Checklist

Before marking this resolved, verify these scenarios work correctly:

### Web App
- [ ] Register → Verify email → Navigate to pricing → Can checkout (no error)
- [ ] Complete checkout → Redirected to dashboard → Shows "active" immediately
- [ ] Active subscription → Cancel in Stripe portal → Status updates within 5 min

### Extension
- [ ] Register → Verify email → Extension shows "Verified" status
- [ ] Trial user → Complete checkout on web → Return to extension → Shows "Active"
- [ ] Close extension → Wait 1 min → Reopen → Status is current
- [ ] "Refresh Status" button updates subscription status immediately

---

## Related Files

| File | Purpose |
|------|---------|
| `web/src/lib/auth-context.tsx` | Web app auth state management |
| `web/src/app/verify-email/page.tsx` | Email verification (fixed) |
| `web/src/app/dashboard/page.tsx` | Post-checkout polling (working) |
| `extension/src/sidepanel/hooks/useAuth.ts` | Extension auth state |
| `extension/src/sidepanel/App.tsx` | Extension main component, email polling |
| `extension/src/shared/api.ts` | API client with `refreshUser()` |
| `extension/src/shared/storage.ts` | Chrome storage wrapper |

---

## References

- PR #24: Web App Buildout (includes email verification fix)
- `docs/ROADMAP.md`: BETA-03 (Stripe checkout e2e test)
- Rate limiting: 30 refreshes per 15 minutes per user

---

**Document Owner:** Engineering
**Last Updated:** February 2, 2026
