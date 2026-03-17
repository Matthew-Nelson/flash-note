# Coding Conventions

**Analysis Date:** 2026-03-16

## Naming Patterns

**Files:**
- Server-only TypeScript modules: `kebab-case.ts` (e.g., `get-session.ts`, `rate-limit.ts`, `session-cookie.ts`)
- React components: `PascalCase.tsx` (e.g., `Button.tsx`, `NoteGenerationForm.tsx`, `DashboardShell.tsx`)
- Test files: `<filename>.test.ts` or `<filename>.test.tsx` co-located with source (e.g., `users.test.ts` next to `users.ts`)
- Next.js special files: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts`
- Server Actions: grouped by domain in `actions/` (e.g., `actions/auth.ts`, `actions/notes.ts`, `actions/billing.ts`)
- Integration tests: `<module>.integration.test.ts` suffix (e.g., `rate-limit.integration.test.ts`)
- Module variants: `<module>-<variant>.test.ts` for environment-specific tests (e.g., `session-cookie-production.test.ts`)

**Functions:**
- `camelCase` for all functions and methods: `findUserByEmail`, `getSession`, `checkRateLimit`
- Action functions suffixed with `Action`: `loginAction`, `generateNoteAction`, `createPortalAction`
- DAL functions prefixed by domain verb: `findUserByEmail`, `createUser`, `updateUserSubscription`, `deleteSession`
- Boolean-returning functions use `is`/`has` or descriptive names: `isRetryable`, `isProduction`
- Helper factory functions prefixed by `create`: `createMockUser`, `createMockUserRow`, `createSession`

**Variables:**
- `camelCase` for all variables: `sessionId`, `trialEndsAt`, `passwordHash`
- Unused parameters/variables prefixed with `_`: `_systemPrompt`, `_userPrompt` (enforced by ESLint)
- Boolean flags: `sidebarOpen`, `hasError`, `isDisabled`, `emailVerified`
- Constants in `UPPER_SNAKE_CASE` when they represent module-level config: `DUMMY_HASH`, `USER_COLUMNS`, `BCRYPT_ROUNDS`

**Types and Interfaces:**
- `PascalCase` for all types: `User`, `SessionData`, `ActionResult`, `LoginResult`
- Interfaces for object shapes: `ButtonProps`, `InputProps`, `RegisterContext`
- Types (not interfaces) for unions and aliases: `ButtonVariant`, `SubscriptionStatus`, `NoteType`
- Database row types suffixed with `Row`: `UserRow`, `SessionRow`, `AuditLogRow` in `src/lib/types/database.ts`
- Result types are discriminated unions: `LoginResult`, `RegisterResult`, `ResetResult`
- Enum used only for `AuditAction` in `src/server/types.ts` — all other enumerations use string literal unions

**Components:**
- Sub-components (used only in one file) defined as named functions at top of the file before the main export (e.g., `StepIndicator`, `TrialBanner` in their respective files)
- React contexts: `SidebarContext`, `useSidebar` hook in same file as the provider (`DashboardShell.tsx`)

## Code Style

**Formatting:**
- No Prettier config found — formatting is not enforced by a formatter tool
- TypeScript strict mode is mandatory (`"strict": true` in `tsconfig.json`)
- Target: ES2017 (`"target": "ES2017"`)
- Module resolution: `bundler`

**Linting:**
- ESLint with `typescript-eslint` recommended type-checked rules (`eslint.config.mjs`)
- `@typescript-eslint/no-explicit-any`: `error` — zero `any` types permitted
- `@typescript-eslint/no-unused-vars`: `error` — must prefix with `_` or remove
- `@typescript-eslint/no-floating-promises`: `error` — all promises must be awaited or explicitly handled
- `@typescript-eslint/no-misused-promises`: `error` (with `checksVoidReturn.attributes: false` to allow async JSX event handlers)
- `react-hooks/rules-of-hooks`: `error`
- `react-hooks/exhaustive-deps`: `error`
- `no-console`: `warn` (only `console.warn` and `console.error` allowed without warning)
- `eslint-plugin-jsx-a11y`: full recommended ruleset — accessibility enforced at lint time
- Tests relax `@typescript-eslint/unbound-method`, `no-unsafe-assignment`, `no-unsafe-member-access`

## Import Organization

**Order (not enforced by tooling, but consistent in codebase):**
1. `'server-only'` import first in server-only files
2. External packages (React, Next.js, third-party)
3. Internal `@/server/**` imports
4. Internal `@/lib/**` and `@/components/**` imports
5. Relative imports (`./ ../`)
6. Type-only imports last (`import type { ... }`)

**Path Aliases:**
- `@/` maps to `src/` (configured in both `tsconfig.json` and `vitest.config.ts`)
- No other aliases — all internal imports use `@/` prefix

**Barrel Files:**
- `src/components/ui/index.ts` — re-exports all UI primitives
- `src/components/auth/index.ts` — re-exports auth components
- `src/components/notes/index.ts` — re-exports note components
- `src/lib/schemas/index.ts` — re-exports schemas
- `src/lib/types/index.ts` — re-exports shared types
- `src/server/dal/index.ts` — re-exports DAL functions
- All barrel files are excluded from coverage (they are re-export-only with no runtime logic)

**Server-only Enforcement:**
- `import 'server-only';` as the first line of every file under `src/server/`
- This causes a build error if a Client Component imports server code

## Server Actions

Actions are thin wrappers — they handle cookie I/O, call services, return results. Pattern enforced in `src/actions/`:

```typescript
'use server';

export async function someAction(formData: FormData): Promise<ActionResult<T>> {
  // 1. Validate input with Zod
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: 'validation_error', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // 2. Rate limit check
  const rl = await checkRateLimit(limiter, key);
  if (!rl.success) return { success: false, error: 'rate_limit_exceeded' };

  // 3. Validate session
  const session = await getSession();
  if (!session) return { success: false, error: 'unauthenticated' };

  // 4. Call service (business logic in server/services/)
  const result = await serviceFunction(parsed.data, session.userId);

  // 5. Return discriminated union — never throw for expected errors
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}
```

**Return type:** `ActionResult<T>` from `src/lib/types/actions.ts` — discriminated union with `success: true/false`.

**Never throw** from Server Actions for expected errors (auth, validation, rate limits). Only unexpected errors throw to be caught by `error.tsx` boundaries.

## Error Handling

**Strategy:** Discriminated unions for expected errors, throws only for unexpected failures.

**Server Actions:**
- Return `{ success: false, error: 'error_code' }` for all expected failures
- Never return raw `err.message` — always map to error codes (Rule 2)
- Unexpected errors: let them throw (caught by `error.tsx` boundaries)

**DAL layer:**
- Check `result.rows.length === 0` before accessing `result.rows[0]` (Rule 10)
- Throw `AppError` with HTTP status, error code, and message for not-found cases
- Never return raw DB errors to callers

**Client Components:**
```typescript
// Map error codes to curated UI strings (Rule 2)
const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Invalid email or password.',
  rate_limit_exceeded: 'Too many requests. Please try again in a few minutes.',
  // ...
};
// Fallback for unknown codes
const message = ERROR_MESSAGES[errorCode] ?? 'Something went wrong. Please try again.';
```
- Error messages exported as named constants (e.g., `NOTE_ERROR_MESSAGES` in `NoteGenerationForm.tsx`) to allow testing

**Fail-closed pattern:**
- `getSession()` catches DB errors and returns `null` — user redirected to login (`src/server/lib/get-session.ts`)
- Lockout check errors → deny access (fail secure)

**Console logging (interim):**
- Current: `console.error()` for server-side errors (Pino migration planned but not yet done)
- ESLint allows `console.warn` and `console.error`, warns on `console.log`
- Log only non-PHI context: `userId`, `sessionId`, `source`, `errorType` — never email, patient data, note content

## Logging

**Framework:** `console.error()` / `console.warn()` (Pino + Cloud Logging is planned — see `docs/planning/MONITORING_SETUP.md`)

**Structured context fields (safe to log):**
- `source`: `'dal_auth'`, `'action_login'`, `'route_webhook'` (snake_case)
- `errorType`: `'session_validation_failed'`, `'webhook_signature_invalid'`
- `userId`: UUID only, never email
- Resource IDs: `subscriptionId`, `sessionId`

**PHI fields — NEVER log:**
- Email addresses (use `userId` instead)
- Note content, patient names, diagnosis/treatment
- Request/response bodies

## Comments

**Security comments:** Extensive comments on security-critical code explaining the "why":
```typescript
// SECURITY: Dummy hash for timing-safe password comparison when user doesn't exist.
// Prevents timing attacks that could reveal whether an email is registered.
const DUMMY_HASH = '...';
```

**HIPAA comments:** PHI protection rationale inline: `// H-4: never log the email`

**TODO comments:** Pino migration deferred with specific note:
```typescript
// TODO: Replace with Pino structured logger when available:
//   logger.error({ err: error, source: '...' }, 'message');
// eslint-disable-next-line no-console
console.error('...', error);
```

**Bug-fix comments:** Reference bug IDs: `// H-12 fix:`, `// L-7 fix:`, `// BUG-11`

**JSDoc:** Used on exported DAL functions and service functions but not on every function. Required on public-facing helpers and complex functions. Not required on React components.

## Validation

All external input validated with Zod (Rule 3):

```typescript
// Server Action — validate before any DB access
const parsed = schema.safeParse(Object.fromEntries(formData));
if (!parsed.success) {
  return { success: false, error: 'validation_error', fieldErrors: parsed.error.flatten().fieldErrors };
}

// Field errors sanitized before sending to client (prevents Zod detail leaks)
// See src/server/lib/validation.ts sanitizeFieldErrors()
```

Schemas defined in `src/lib/schemas/` for shared client/server use. Server Action schemas also defined there. Types exported with `z.infer<typeof schema>` pattern.

## Database Queries

**Pattern:** Parameterized queries with typed generics via `pg`:
```typescript
const result = await db.query<UserRow>(
  `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 AND NOT is_deleted`,
  [id]
);
if (result.rows.length === 0) return null;  // Always check before accessing rows[0]
return rowToUser(result.rows[0]);
```

**Row transformation:** Every DAL module defines a private `rowToUser()` / `rowToSession()` function that maps `snake_case` DB columns to `camelCase` TypeScript types. Runtime validation with Zod used for columns with constrained values (e.g., `subscriptionStatusSchema.parse(row.subscription_status)`).

**Shared column lists:** `const USER_COLUMNS = \`...\`` prevents SELECT * and makes column changes explicit.

**Transactions:** Multi-step writes always use `getPoolClient()` with explicit `BEGIN`/`COMMIT`/`ROLLBACK` (Rule 1).

## Function Design

**Size:** Functions are focused and small. Complex flows (registration, login) are decomposed into service calls rather than inlined.

**Parameters:** Configuration objects for multi-param functions. Session context passed as `{ ipAddress: string, userAgent: string }`.

**Return Values:** Discriminated unions for fallible operations. Null for "not found". Never throw for expected conditions in service layer.

## Module Design

**`src/server/` boundary:** Enforced by `'server-only'` — importing from Client Components is a build error.

**`src/lib/` boundary:** Shared code, no DB imports, no Node.js-only APIs.

**`src/actions/` boundary:** Thin wrappers only — no business logic, no SQL.

**Singleton patterns:** DB pool (`src/server/db/index.ts`), Redis client (`src/server/lib/redis.ts`) created at module level as singletons.

---

*Convention analysis: 2026-03-16*
