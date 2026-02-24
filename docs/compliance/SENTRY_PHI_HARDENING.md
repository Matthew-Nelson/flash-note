# Sentry PHI Hardening Plan

**Status:** Not started
**Priority:** P0 — closes the only remaining architectural gap for PHI leakage to Sentry
**Estimated effort:** Small (focused changes across existing sanitization code)

## Context

FlashNote's Sentry integration has comprehensive PHI protection:
- `sendDefaultPii: false` on all components
- `sanitizeObject()` recursively redacts PHI-named fields from `event.extra`
- Request bodies (`event.request.data`) deleted in all `beforeSend` hooks
- Console breadcrumbs dropped entirely
- HTTP breadcrumb bodies removed, URLs stripped of query params
- Safe header whitelist on backend (only `content-type`, `user-agent`, etc.)
- Extension uses scoped `BrowserClient` with cloned scopes per capture
- Session Replay is not enabled (would capture DOM containing clinical text)

**The gap:** `Error.message` and exception `value` fields pass through `beforeSend` completely unfiltered. If an error message contains PHI (e.g., from an uncaught exception in the AI service that includes prompt content), it reaches Sentry verbatim.

## Risk Assessment

### How PHI could reach an error message

1. Therapist submits quickNotes containing patient details
2. Text is passed to `buildUserPrompt()` and sent to Gemini
3. An unexpected error occurs (not wrapped in `LLMError`) that includes input text in its message
4. Error propagates to a process-level or global handler
5. `Sentry.captureException(err)` sends the raw error message to Sentry

### Why it's probably not leaking today

- `LLMError` wraps AI errors with safe messages — prompt content isn't in the error message
- The AI service has try/catch that maps errors to `AppError` before they propagate
- Zod validation errors include field names and type errors, not user-provided values

### Why this still needs fixing

The defense is "we wrote careful error handling" rather than "the system prevents it." One future `throw new Error(\`Failed to parse: ${rawInput}\`)` in any code path that touches clinical text would send PHI to Sentry unfiltered. This must be an architectural guarantee, not a convention.

## Findings

### Finding 1: Error.message not sanitized in beforeSend hooks

**Severity:** Critical
**Affected files:**
- `backend/src/instrument.ts` — `beforeSend` (line 36)
- `web/src/instrumentation-client.ts` — `sanitizeEvent()` (line 23)
- `web/sentry.server.config.ts` — `beforeSend` (line 25)
- `web/sentry.edge.config.ts` — `beforeSend` (line 25)
- `extension/src/shared/sentry.ts` — `sanitizeEvent()` (line 32)

All `beforeSend` hooks sanitize `event.extra`, breadcrumbs, and request data, but none inspect or sanitize `event.exception.values[].value` (the error message) or `event.exception.values[].stacktrace.frames[].vars` (local variables in stack frames).

**Fix:** Add exception value sanitization to every `beforeSend` hook:

```typescript
// Add to every beforeSend / sanitizeEvent function:
if (event.exception?.values) {
  for (const exception of event.exception.values) {
    // Sanitize error message
    if (exception.value) {
      exception.value = sanitizeErrorMessage(exception.value);
    }
    // Remove local variables from stack frames (could contain PHI)
    if (exception.stacktrace?.frames) {
      for (const frame of exception.stacktrace.frames) {
        delete frame.vars;
      }
    }
  }
}
```

### Finding 2: sanitizeErrorMessage function does not exist

**Severity:** Critical (prerequisite for Finding 1)
**Affected files:**
- `backend/src/utils/sentry-sanitization.ts`
- `web/src/lib/sentry-sanitization.ts`
- `extension/src/shared/sentry-sanitization.ts`

None of the three sanitization utility files have a function for sanitizing free-text error messages. The existing `sanitizeObject()` operates on key-value pairs (redacting values whose keys match PHI patterns). Error messages are unstructured strings where PHI could appear anywhere.

**Fix:** Add `sanitizeErrorMessage()` to all three sanitization files. The function should:

1. **Truncate long messages** — Legitimate error messages are short. A message over ~500 characters likely contains serialized data or user input. Truncate to a safe length with a `[truncated]` suffix.

2. **Detect and redact PHI-adjacent patterns** — While you can't reliably detect arbitrary patient names in free text, you can detect structural patterns that indicate dumped clinical data:
   - JSON-like structures containing PHI field names (`"patient"`, `"diagnosis"`, `"note"`, etc.)
   - Key-value patterns like `patient_name: ...` or `patientName=...`
   - Anything matching the existing `PHI_FIELD_PATTERNS` when it appears as a key in a key-value-like context within the string

3. **Strip quoted strings over a length threshold** — Long quoted strings in error messages (e.g., `Failed to parse: "Patient John Doe presented with..."`) are likely user input. Replace quoted strings beyond ~50 characters with `"[REDACTED]"`.

```typescript
const MAX_ERROR_MESSAGE_LENGTH = 500;
const MAX_QUOTED_STRING_LENGTH = 50;

export function sanitizeErrorMessage(message: string): string {
  if (!message) return message;

  let sanitized = message;

  // 1. Redact long quoted strings (likely user input / clinical text)
  sanitized = sanitized.replace(
    /["']([^"']{50,})["']/g,
    '"[REDACTED]"'
  );

  // 2. Redact values adjacent to PHI field names
  //    Matches: patient: "...", patientName=..., "note": "..."
  for (const pattern of PHI_FIELD_PATTERNS) {
    const fieldRegex = new RegExp(
      `(${pattern.source})[\\s]*[:=][\\s]*["']?[^"',;\\n}\\]]{3,}["']?`,
      'gi'
    );
    sanitized = sanitized.replace(fieldRegex, '$1: [REDACTED]');
  }

  // 3. Truncate overall length
  if (sanitized.length > MAX_ERROR_MESSAGE_LENGTH) {
    sanitized = sanitized.substring(0, MAX_ERROR_MESSAGE_LENGTH) + ' [truncated]';
  }

  return sanitized;
}
```

This function must be added to all three copies of the sanitization utility and kept in sync.

### Finding 3: Backend process-level handlers capture raw errors

**Severity:** High
**Affected file:** `backend/src/index.ts` (lines 26-38)

```typescript
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.name);
  Sentry.captureException(err);   // <-- raw error, message not sanitized
  // ...
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection');
  Sentry.captureException(reason); // <-- raw error, message not sanitized
});
```

These handlers capture whatever error propagated uncaught. If an error from the AI service or note generation code path reaches here, its message could contain prompt content.

**Fix:** No change needed to these handlers directly. The `beforeSend` hook fix from Finding 1 will sanitize the error message before it leaves the process. These handlers are the *reason* the `beforeSend` fix is critical — they're the backstop where unhandled errors funnel through.

### Finding 4: Web app global error boundary captures raw errors

**Severity:** Medium
**Affected file:** `web/src/app/global-error.tsx` (line 25)

```typescript
useEffect(() => {
  Sentry.captureException(error);
}, [error]);
```

Same pattern as Finding 3 — raw error captured. Lower risk because the web app client side doesn't process clinical text directly (that happens on the backend), but if a component error occurs while rendering note content, the error message could include it.

**Fix:** Same as Finding 3 — the `beforeSend` hook fix covers this. No changes needed to `global-error.tsx`.

### Finding 5: Web server/edge configs missing breadcrumb sanitization

**Severity:** Low
**Affected files:**
- `web/sentry.server.config.ts` (line 25)
- `web/sentry.edge.config.ts` (line 25)

These configs sanitize `event.extra` and delete request data, but do not filter breadcrumbs. The backend (`instrument.ts`) has a `beforeBreadcrumb` hook that drops console breadcrumbs and sanitizes HTTP breadcrumbs. The web client (`instrumentation-client.ts`) sanitizes breadcrumbs inside `sanitizeEvent()`. The server and edge configs do neither.

**Fix:** Add breadcrumb sanitization to both server and edge `beforeSend` hooks, matching the pattern in `instrumentation-client.ts`:

```typescript
if (event.breadcrumbs) {
  event.breadcrumbs = event.breadcrumbs
    .map((breadcrumb) => {
      if (breadcrumb.category === 'console') return null;
      if (
        breadcrumb.category === 'fetch' ||
        breadcrumb.category === 'xhr'
      ) {
        if (breadcrumb.data?.url) {
          breadcrumb.data.url = sanitizeUrl(breadcrumb.data.url);
        }
        delete breadcrumb.data?.body;
        delete breadcrumb.data?.request_body;
        delete breadcrumb.data?.response_body;
      }
      if (breadcrumb.data) {
        breadcrumb.data = sanitizeObject(breadcrumb.data as Record<string, unknown>);
      }
      return breadcrumb;
    })
    .filter(Boolean) as typeof event.breadcrumbs;
}
```

## Implementation Checklist

### Step 1: Add sanitizeErrorMessage to sanitization utilities

- [ ] `backend/src/utils/sentry-sanitization.ts` — add and export `sanitizeErrorMessage()`
- [ ] `web/src/lib/sentry-sanitization.ts` — add and export `sanitizeErrorMessage()`
- [ ] `extension/src/shared/sentry-sanitization.ts` — add and export `sanitizeErrorMessage()`
- [ ] Verify all three implementations are identical

### Step 2: Add exception value sanitization to all beforeSend hooks

- [ ] `backend/src/instrument.ts` — add `event.exception.values` loop with `sanitizeErrorMessage()` and `frame.vars` deletion
- [ ] `web/src/instrumentation-client.ts` — add to `sanitizeEvent()` function
- [ ] `web/sentry.server.config.ts` — add to `beforeSend`
- [ ] `web/sentry.edge.config.ts` — add to `beforeSend`
- [ ] `extension/src/shared/sentry.ts` — add to `sanitizeEvent()` function

### Step 3: Add breadcrumb sanitization to server/edge configs

- [ ] `web/sentry.server.config.ts` — add breadcrumb filtering to `beforeSend`
- [ ] `web/sentry.edge.config.ts` — add breadcrumb filtering to `beforeSend`

### Step 4: Add tests

- [ ] Test `sanitizeErrorMessage()` with:
  - Short safe messages (unchanged)
  - Messages containing PHI field patterns (redacted)
  - Messages with long quoted strings (redacted)
  - Messages over 500 chars (truncated)
  - Empty/null input (safe passthrough)
- [ ] Test updated `beforeSend` hooks:
  - Error with PHI in message → message sanitized
  - Error with stack frame vars → vars deleted
  - Existing sanitization still works (extras, request data, breadcrumbs)
- [ ] Test breadcrumb sanitization in server/edge configs

### Step 5: Verify

- [ ] Run full test suite across all three components
- [ ] Manual test: trigger an error in dev that would contain PHI-like content, verify Sentry event is sanitized
- [ ] Review diff to confirm no unintended changes

## Files Modified (Summary)

| File | Change |
|------|--------|
| `backend/src/utils/sentry-sanitization.ts` | Add `sanitizeErrorMessage()` |
| `backend/src/instrument.ts` | Add exception value sanitization to `beforeSend` |
| `web/src/lib/sentry-sanitization.ts` | Add `sanitizeErrorMessage()` |
| `web/src/instrumentation-client.ts` | Add exception value sanitization to `sanitizeEvent()` |
| `web/sentry.server.config.ts` | Add exception + breadcrumb sanitization to `beforeSend` |
| `web/sentry.edge.config.ts` | Add exception + breadcrumb sanitization to `beforeSend` |
| `extension/src/shared/sentry-sanitization.ts` | Add `sanitizeErrorMessage()` |
| `extension/src/shared/sentry.ts` | Add exception value sanitization to `sanitizeEvent()` |

## What This Does NOT Cover

- **Axiom/logging PHI prevention** — Separate concern; logging discipline is enforced by convention, not by a sanitization layer. Consider a similar approach if Axiom is retained.
- **Sentry Session Replay** — Not enabled and must stay disabled. Session Replay captures DOM content, which would include clinical text rendered on screen.
- **Sentry Performance/Tracing** — Not currently enabled. If enabled in the future, trace data (e.g., database query strings) must be reviewed for PHI exposure.
