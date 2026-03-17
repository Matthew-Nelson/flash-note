# Testing Patterns

**Analysis Date:** 2026-03-16

## Test Framework

**Runner:**
- Vitest v4 (`^4.0.18`)
- Config: `web/vitest.config.ts`
- Environment: `jsdom` (all tests run in simulated browser environment)

**Assertion Library:**
- Vitest built-in `expect`
- `@testing-library/jest-dom` v6 matchers (loaded in `src/test/setup.ts`)

**Component Testing:**
- `@testing-library/react` v16
- `@testing-library/user-event` v14

**E2E:**
- Playwright v1.58 — config at `web/playwright.config.ts`
- Test dir: `web/tests/e2e/`

**Run Commands:**
```bash
cd web
pnpm test                # Run all unit/integration tests (no coverage)
pnpm test:watch          # Watch mode
pnpm test:coverage       # Run with coverage report
pnpm test:ci             # Coverage + verbose reporter (CI)
pnpm test:e2e            # Playwright E2E (requires running server)
pnpm test:e2e:headed     # E2E with visible browser
pnpm test:e2e:debug      # E2E in Playwright debug mode
```

## Test File Organization

**Location:** Co-located with source files (same directory, `.test.ts` or `.test.tsx` suffix)

**Naming:**
- Unit: `<module>.test.ts` / `<component>.test.tsx`
- Integration (service-layer): `<module>.integration.test.ts`
- Integration (auth/flow): `src/test/integration/<flow>.test.ts`
- Environment-specific: `<module>-<variant>.test.ts` (e.g., `session-cookie-production.test.ts`)
- E2E: `web/tests/e2e/<feature>.spec.ts`

**Coverage scope** (`vitest.config.ts`):
- Included: `src/lib/**`, `src/components/**`, `src/server/**`
- Excluded: `src/app/**` (Next.js routes — E2E tested), `src/lib/types/**`, barrel `index.ts` files, `src/server/db/migrate.ts` (CLI script)
- App pages have their own `.test.tsx` files but they run under `include: src/**/*.test.{ts,tsx}` — those tests ARE in the coverage run. The exclusion of `src/app/**` from `include` in coverage means the page source files themselves don't contribute to the coverage report (their tests still run).

## Coverage Requirements

**Enforced thresholds** (pre-commit hook fails if not met):
```
lines:      95%
functions:  95%
branches:   95%
statements: 95%
```

**Current state:** 1493 tests, 97.79% statements, 95.46% branches.

**Coverage provider:** V8 (`@vitest/coverage-v8`)

**Reports:** text, html, lcov, json-summary written to `web/coverage/`

```bash
pnpm test:coverage        # Generate coverage
open coverage/index.html  # View HTML report
```

## Global Test Setup

`src/test/setup.ts` runs before every test file:

```typescript
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// React 19 requires manual cleanup (not automatic)
afterEach(() => { cleanup(); });

// Global mocks applied to all tests:
vi.mock('server-only', () => ({}));          // Allows server/ imports in tests
vi.mock('@sentry/nextjs', () => ({ ... }));  // Sentry mocked globally
vi.mock('next/navigation', () => ({          // Router, pathname, redirect mocked
  useRouter: vi.fn(() => ({ push, replace, back, refresh, prefetch })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  redirect: vi.fn(),
}));
// sessionStorage spy-able mock with backing Map
```

Key: `next/navigation`'s `redirect` is mocked as `vi.fn()`. Tests that need redirect to throw (matching Next.js behavior) do:
```typescript
vi.mocked(redirect).mockImplementation((): never => {
  throw new Error('NEXT_REDIRECT');
});
```

## Test Suite Structure

**Standard pattern:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ModuleName', () => {
  beforeEach(() => {
    resetMocks();          // or vi.clearAllMocks()
    // restore specific mocks if needed
  });

  describe('functionName', () => {
    it('should do X when Y', async () => {
      // Arrange
      mockSomething.mockResolvedValueOnce(value);
      // Act
      const result = await functionUnderTest(input);
      // Assert
      expect(result).toEqual(expected);
    });
  });
});
```

**Discriminated union result checks:**
```typescript
expect(result.success).toBe(true);
if (result.success) {
  expect(result.data.userId).toBe('user-uuid');
}
```
This pattern (narrow before access) is used throughout service and action tests to handle TypeScript discriminated unions.

## DAL Testing Pattern

All DAL tests use `src/test/dal-helpers.ts` which provides:

```typescript
import {
  mockDbQuery,          // vi.fn() wrapping db.query
  mockClientQuery,      // vi.fn() wrapping pg PoolClient.query
  mockGetPoolClient,    // vi.fn() for transaction client acquisition
  resetMocks,           // Call in beforeEach
  createMockUserRow,    // Factory: returns full users table row
  createMockEmailTokenRow,
  createMockSessionWithUserRow,
  createMockOrgRow,
  createMockOrgMemberRow,
} from '@/test/dal-helpers';
```

`dal-helpers.ts` calls `vi.mock('@/server/db', ...)` at module level — importing it auto-installs the DB mock. DO NOT also call `vi.mock('@/server/db')` in the test file.

**Sequence mock pattern for multi-query tests:**
```typescript
mockDbQuery
  .mockResolvedValueOnce({ rows: [userRow] })  // call 1: findUser
  .mockResolvedValueOnce({ rows: [] })          // call 2: check existing
  .mockResolvedValueOnce({ rows: [newRow], rowCount: 1 });  // call 3: insert
```

**Transaction test pattern:**
```typescript
const mockClient = {
  query: mockClientQuery,
  release: vi.fn(),
};
mockGetPoolClient.mockResolvedValue(mockClient);

mockClientQuery
  .mockResolvedValueOnce({ rows: [] })              // BEGIN
  .mockResolvedValueOnce({ rows: [userRow] })       // INSERT users
  .mockResolvedValueOnce({ rows: [{ id: 'la-1' }] }) // INSERT legal acceptance
  .mockResolvedValueOnce({ rows: [] });              // COMMIT

// After operation, verify transaction semantics
expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
expect(mockClient.release).toHaveBeenCalled();
```

## Service and Action Testing

**Mock ordering rule:** `vi.hoisted()` is required when mock declarations are used inside `vi.mock()` factories AND the mock must be accessible outside the factory.

```typescript
// CORRECT: vi.hoisted for mocks used in vi.mock factories
const mockAuditLog = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/server/services/audit', () => ({
  auditService: { log: mockAuditLog, logWithClient: mockAuditLog },
}));

// CORRECT: vi.hoisted for class-based mocks that need same reference for instanceof
const { WebhookSignatureError } = vi.hoisted(() => {
  class WebhookSignatureError extends Error { ... }
  return { WebhookSignatureError };
});
```

**Config mock placement:** `vi.mock('@/server/db/config', ...)` must appear before importing modules that call `process.exit` on missing env vars. Standard pattern used throughout:
```typescript
vi.mock('@/server/db/config', () => ({
  BCRYPT_ROUNDS: 12,
  LEGAL_DOCUMENT_VERSIONS: { baa: '0.1', terms_of_service: '0.1', privacy_policy: '0.1' },
  SESSION_IDLE_TTL_MS: 24 * 60 * 60 * 1000,
  // ... other config values
  isProduction: false,
}));
```

**Dynamic import after mocks** — used when top-level import would execute before mocks are installed:
```typescript
const { POST } = await import('./route');
const { getSession } = await import('./get-session');
```

## Component Testing Pattern

Uses React Testing Library with `userEvent.setup()`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush, ... });
  });

  it('calls action with FormData and navigates on success', async () => {
    vi.mocked(someAction).mockResolvedValueOnce({ success: true, data: ... });
    const user = userEvent.setup();

    render(<ComponentUnderTest />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(someAction).toHaveBeenCalledTimes(1);
    });
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });
});
```

**Querying elements:** Prefer accessible queries (role + name) over test IDs:
- `screen.getByRole('button', { name: 'Sign in' })` — preferred
- `screen.getByLabelText('Email address')` — for form inputs
- `screen.getByTestId(...)` — acceptable when no semantic role applies
- `screen.getByText(...)` — for static text content

**Async pattern for Server Component pages:**
```typescript
// Server Components are async — call as functions, await result
it('redirects unauthenticated users', async () => {
  mockGetSession.mockResolvedValue(null);
  await expect(DashboardPage()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/login?reason=session_expired');
});
```

## Mocking

**What to mock:**
- `@/server/db` — via `dal-helpers.ts` (always use the shared helper, don't duplicate)
- `@/server/db/config` — always mock in service/DAL tests (calls `process.exit` if DATABASE_URL is missing)
- `@/server/lib/get-session` — mock in action and page tests
- `@/server/services/*` — mock when testing consumers (actions, Route Handlers)
- External SDKs: `stripe`, `bcryptjs`, `resend`, `@upstash/ratelimit` — mock in service tests
- `next/navigation` — globally mocked in `setup.ts` (override per-test as needed)
- Child components in component tests when they have their own test files: `vi.mock('./GeneratedNote', () => ({ GeneratedNote: ... }))`

**What NOT to mock:**
- The unit under test itself
- Zod schemas (use real schemas, test actual validation behavior)
- In integration tests: service/DAL functions — only mock the DB driver and external I/O
- bcrypt in integration tests — use `BCRYPT_ROUNDS: 1` to reduce work factor, not mock the function

**Real security mechanisms must run** (Rule 6):
- Auth tests validate actual session rejection, not "function exists"
- DAL auth tests verify user A cannot access user B's data
- Rate limit integration test verifies requests are actually blocked: `src/server/lib/rate-limit.integration.test.ts` (conditionally skipped without Redis credentials)

## Fixtures and Factories

**Client-side factories** (`src/test/helpers.ts`):
```typescript
createMockUser(overrides?: Partial<User>): User
createMockStoredAuth(overrides?): StoredAuth
createMockAuthResponse(overrides?): AuthResponse
createMockApiResponse<T>(data: T): ApiSuccessResponse<T>
createMockApiErrorResponse(code, message): ApiErrorResponse
```

**DAL-level factories** (`src/test/dal-helpers.ts`):
```typescript
createMockUserRow(overrides?: Partial<UserRow>)     // Full DB row (snake_case)
createMockEmailTokenRow(overrides?)
createMockSessionWithUserRow(overrides?)             // JOIN result row
createMockOrgRow(overrides?)
createMockOrgMemberRow(overrides?)
```

**Test-local factories** — defined inline in test files for test-specific shapes:
```typescript
function createMockSession(overrides: Partial<SessionData> = {}): SessionData { ... }
function makeFormData(overrides: Record<string, string> = {}): FormData { ... }
function buildSuccessResponse(overrides = {}): { success: true; data: ... } { ... }
```

**Pattern:** All factories accept `overrides` as `Partial<T>` spread at the end to allow easy customization in individual tests.

## Integration Tests

Two types of integration tests:

**1. Service-layer integration** (`src/test/integration/`):
- Tests the service layer against mocked DB driver — real service, real DAL, mocked `pg`
- Mocks only: `@/server/db` (driver), `email` service (external I/O), `audit` service (side-effect)
- Example: `src/test/integration/auth-lifecycle.test.ts` — tests `register()`, `login()`, `verifyEmail()`, `completePasswordReset()` end-to-end
- Documents intentional deviations: `BCRYPT_ROUNDS: 1` for test speed

**2. Infrastructure integration** (`src/server/lib/rate-limit.integration.test.ts`):
- Tests real Upstash Redis blocking behavior
- Uses `describe.skipIf(!process.env.UPSTASH_REDIS_REST_URL)` — only runs when credentials present
- Must use unique key per test to avoid cross-test pollution: `const key = \`test-${Date.now()}-${Math.random()}\``

## E2E Tests

- Framework: Playwright — `web/tests/e2e/*.spec.ts`
- Uses `test.describe` / `test.beforeEach` / `test` (not `describe`/`it`)
- Queries by accessible role/label: `page.getByLabel('Email address')`, `page.getByRole('button', { name: 'Sign in' })`
- Asserts on URL navigation: `await expect(page).toHaveURL('/dashboard', { timeout: 15000 })`
- Asserts on visible text: `await expect(page.getByText(/invalid email/i)).toBeVisible({ timeout: 10000 })`
- Single browser: Chromium only (Chrome covers 95%+ of PT users)
- `fullyParallel: true` with 2 workers in CI
- `retries: 2` in CI, 0 locally
- Fixtures in `tests/e2e/fixtures/`, helpers in `tests/e2e/helpers/`
- Test data helpers: `generateTestEmail()`, `generateTestPassword()`, `invalidEmails`, `invalidPasswords`

## Coverage Ignore Comments

Minimal use — only for truly untestable branches:
- `/* v8 ignore next */` — used in `src/lib/schemas/auth.ts` for defensive fallback that Zod always covers
- `/* v8 ignore */` — used in `src/components/ErrorBoundary.tsx` for unreachable error boundary branch

Do not add coverage ignores as a shortcut. The 95% threshold must be met with real tests.

## Config Testing Pattern

Modules that call `process.exit()` on invalid config (e.g., `src/server/db/config.ts`) require:
1. `vi.resetModules()` in `beforeEach` and `afterEach` to clear module cache between env manipulations
2. Dynamic `await import('./config')` after setting `process.env` values
3. `vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); })` to intercept exits
4. Restore `process.env` to `originalEnv` in cleanup

---

*Testing analysis: 2026-03-16*
