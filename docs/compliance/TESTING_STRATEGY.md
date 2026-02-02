# FlashNote Testing Strategy & Guidelines

> **Document Status:** Partial Implementation
> **Last Updated:** February 2026
> **Owner:** Engineering Team

## Overview

This document defines the testing strategy, guidelines, and requirements for FlashNote. As HIPAA-regulated healthcare software, our testing standards exceed typical application requirements. Patient safety and data protection depend on rigorous, comprehensive testing at every layer.

**Core Principle:** Code that isn't tested is code that can't be trusted with patient data.

---

## Table of Contents

1. [Current State Assessment](#current-state-assessment)
2. [Testing Philosophy](#testing-philosophy)
3. [Testing Pyramid](#testing-pyramid)
4. [Unit Testing Requirements](#unit-testing-requirements)
5. [Integration Testing Requirements](#integration-testing-requirements)
6. [End-to-End Testing Requirements](#end-to-end-testing-requirements)
7. [Security Testing Requirements](#security-testing-requirements)
8. [HIPAA Compliance Testing](#hipaa-compliance-testing)
9. [Performance Testing](#performance-testing)
10. [CI/CD Pipeline Requirements](#cicd-pipeline-requirements)
11. [Code Coverage Standards](#code-coverage-standards)
12. [Implementation Roadmap](#implementation-roadmap)
13. [Testing Tools & Frameworks](#testing-tools--frameworks)

---

## Current State Assessment

| Project | Testing Framework | Test Coverage | Status |
|---------|------------------|---------------|--------|
| Backend | Vitest 4.0.18 | 95%+ (28 test files) | Healthcare-grade |
| Extension | None | 0% | Not configured |
| Web | None | 0% | Not configured |
| CI/CD | GitHub Actions | Backend tests, builds, security audit | Configured |

### Existing Test Files

**Backend (28 test files):**
- **Services:** auth-service, audit-service, ai-service, billing-service, email-service, lockout-service, token-service, usage-service
- **Middleware:** auth, csrf, email-verification, error-handler, rate-limit, subscription
- **LLM Providers:** claude-provider, gemini-provider, provider-factory, schemas, errors, index
- **Database:** users queries, webhooks queries
- **Utilities:** prompt-sanitization, request-utils
- **Other:** config, pt-prompts
- **Test Setup:** `backend/src/test/setup.ts` - Test utilities and mocks

### Critical Gaps

1. **Extension:** No testing infrastructure - React components handling auth tokens are untested
2. **Web:** No testing infrastructure - Next.js pages/components untested
3. ~~**CI/CD:** No automated test execution in pipelines~~ ✅ **DONE** - GitHub Actions configured
4. **E2E:** No end-to-end testing for critical user journeys
5. **Security:** DAST (OWASP ZAP) not yet configured; secret scanning (GitLeaks) not implemented

---

## Testing Philosophy

### Healthcare-Grade Testing Principles

1. **Defense in Depth:** Multiple layers of testing catch different types of bugs
2. **Security First:** Every test suite must include security-relevant assertions
3. **PHI Protection:** Tests must verify that PHI never leaks to logs, errors, or responses
4. **Audit Trail:** All security-relevant events must be tested for proper logging
5. **Fail Secure:** Tests must verify the system fails closed, not open
6. **Regression Prevention:** Once a bug is found, a test must prevent its return

### What We Test

- **Always Test:** Auth flows, input validation, PHI handling, audit logging, error responses
- **Prioritize:** Security-critical paths, user-facing functionality, data integrity
- **Don't Skip:** Edge cases in auth, boundary conditions, error handling

---

## Testing Pyramid

```
                      ▲
                     /|\
                    / | \         E2E Tests
                   /  |  \        - Critical user journeys
                  /   |   \       - Auth flows end-to-end
                 /    |    \      - 10-20 scenarios
                /-----|-----\
               /      |      \    Integration Tests
              /       |       \   - Service interactions
             /        |        \  - API contracts
            /         |         \ - Database operations
           /----------|----------\- 50-100 tests
          /           |           \
         /            |            \   Unit Tests
        /             |             \  - All business logic
       /              |              \ - Input validation
      /               |               \- Pure functions
     /________________|________________\- 500+ tests
```

### Test Distribution Guidelines

| Test Type | Percentage | Characteristics |
|-----------|------------|-----------------|
| Unit | 70% | Fast, isolated, no external dependencies |
| Integration | 20% | Service boundaries, database, external APIs |
| E2E | 10% | Critical paths, real browser/extension |

---

## Unit Testing Requirements

### Backend (`/backend`)

**Framework:** Vitest
**Location:** Co-located with source files as `*.test.ts`

**Required Coverage Areas:**

| Area | Priority | Coverage Target |
|------|----------|-----------------|
| Auth service | Critical | 95% |
| Session management | Critical | 95% |
| Input validation (Zod schemas) | Critical | 90% |
| Route handlers | High | 85% |
| Database queries | High | 85% |
| Audit logging | Critical | 95% |
| Rate limiting | High | 90% |
| Utility functions | Medium | 80% |

**Unit Test Standards:**

```typescript
// Example: Testing input validation
describe('LoginSchema', () => {
  it('rejects empty email', () => {
    const result = LoginSchema.safeParse({ email: '', password: 'valid123' });
    expect(result.success).toBe(false);
  });

  it('rejects password under minimum length', () => {
    const result = LoginSchema.safeParse({ email: 'test@example.com', password: 'short' });
    expect(result.success).toBe(false);
  });

  it('accepts valid credentials format', () => {
    const result = LoginSchema.safeParse({
      email: 'test@example.com',
      password: 'validPassword123'
    });
    expect(result.success).toBe(true);
  });
});
```

**Security-Specific Unit Tests:**

```typescript
describe('Auth Security', () => {
  it('uses constant-time comparison for passwords', async () => {
    // Verify bcrypt.compare is called even for non-existent users
    // Prevents timing attacks for user enumeration
  });

  it('never includes password hash in returned user object', async () => {
    const user = await authService.login(validCredentials);
    expect(user).not.toHaveProperty('password_hash');
  });

  it('generates cryptographically secure tokens', () => {
    const token1 = generateToken();
    const token2 = generateToken();
    expect(token1).not.toBe(token2);
    expect(token1.length).toBeGreaterThanOrEqual(32);
  });
});
```

### Extension (`/extension`)

**Framework:** Vitest + React Testing Library + jsdom
**Location:** Co-located with source files as `*.test.tsx`

**Required Coverage Areas:**

| Area | Priority | Coverage Target |
|------|----------|-----------------|
| Auth components | Critical | 90% |
| Note editor component | High | 85% |
| API client functions | Critical | 90% |
| Token storage utilities | Critical | 95% |
| Input sanitization | Critical | 95% |
| Form validation | High | 85% |

**Extension-Specific Considerations:**

```typescript
// Mock Chrome APIs
vi.mock('chrome', () => ({
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
  },
}));

describe('TokenStorage', () => {
  it('stores tokens securely in chrome.storage.local', async () => {
    await storeTokens({ accessToken: 'token', refreshToken: 'refresh' });
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'token' })
    );
  });

  it('clears all tokens on logout', async () => {
    await clearTokens();
    expect(chrome.storage.local.remove).toHaveBeenCalledWith([
      'accessToken',
      'refreshToken',
    ]);
  });
});
```

### Web (`/web`)

**Framework:** Vitest + React Testing Library (or Jest with next/jest)
**Location:** Co-located with source files as `*.test.tsx`

**Required Coverage Areas:**

| Area | Priority | Coverage Target |
|------|----------|-----------------|
| Auth pages | High | 85% |
| Dashboard components | Medium | 80% |
| API route handlers | High | 85% |
| Form components | High | 85% |

---

## Integration Testing Requirements

### Backend Integration Tests

**Purpose:** Verify services work correctly together with real database interactions.

**Setup Requirements:**
- Test PostgreSQL database (Docker or in-memory)
- Database migrations run before tests
- Database reset between test suites
- External APIs mocked (Gemini)

**Required Integration Test Scenarios:**

```typescript
describe('Authentication Flow Integration', () => {
  it('registers user → verifies email → logs in → refreshes token → logs out', async () => {
    // Full auth lifecycle test
  });

  it('enforces rate limiting across multiple login attempts', async () => {
    // Verify rate limiter state persists correctly
  });

  it('creates audit log entries for all auth events', async () => {
    // Verify audit trail completeness
  });
});

describe('Session Management Integration', () => {
  it('invalidates all sessions on password change', async () => {
    // Security requirement: password change = all sessions terminated
  });

  it('handles concurrent token refresh requests correctly', async () => {
    // Race condition prevention
  });
});
```

### API Contract Tests

**Purpose:** Ensure API responses match documented contracts.

```typescript
describe('API Contracts', () => {
  it('returns consistent error format for all endpoints', async () => {
    const response = await request(app).post('/api/auth/login').send({});
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: expect.any(String),
        message: expect.any(String),
      },
    });
  });

  it('never includes stack traces in production error responses', async () => {
    const response = await request(app).get('/api/invalid-endpoint');
    expect(response.body.error).not.toHaveProperty('stack');
  });
});
```

---

## End-to-End Testing Requirements

### Framework

**Recommended:** Playwright
**Rationale:**
- Native Chrome extension support
- Cross-browser testing capability
- Excellent debugging tools
- Active maintenance and community

### Critical E2E Scenarios

These scenarios MUST have E2E coverage before production:

| Scenario | Priority | Description |
|----------|----------|-------------|
| User Registration | Critical | Register → Email verify → First login |
| Login Flow | Critical | Login → Dashboard access → Logout |
| Failed Login Lockout | Critical | Multiple failures → Lockout → Recovery |
| SOAP Note Generation | Critical | Login → Enter shorthand → Generate → Copy |
| Session Timeout | High | Inactivity → Timeout → Re-auth required |
| Token Refresh | High | Token expiry → Silent refresh → Continued session |
| Subscription Expiry | High | Trial end → Graceful degradation → Upgrade prompt |
| Password Reset | High | Request reset → Email link → New password → Login |

### E2E Test Structure

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('complete login flow', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'validPassword123');
    await page.click('[data-testid="login-button"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('lockout after failed attempts', async ({ page }) => {
    await page.goto('/login');

    // Attempt login 5 times with wrong password
    for (let i = 0; i < 5; i++) {
      await page.fill('[data-testid="email"]', 'test@example.com');
      await page.fill('[data-testid="password"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');
    }

    // Verify lockout message
    await expect(page.locator('[data-testid="lockout-message"]')).toBeVisible();
  });
});
```

### Extension E2E Testing

```typescript
// tests/e2e/extension.spec.ts
import { test, expect, chromium } from '@playwright/test';

test.describe('Chrome Extension', () => {
  test('generates SOAP note from shorthand', async () => {
    // Load extension in Chrome
    const browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    // Open extension popup
    const extensionPage = await browser.newPage();
    await extensionPage.goto(`chrome-extension://${extensionId}/popup.html`);

    // Enter shorthand and generate
    await extensionPage.fill('[data-testid="shorthand-input"]', 'pt c/o LBP x2wk...');
    await extensionPage.click('[data-testid="generate-button"]');

    // Verify SOAP note generated
    await expect(extensionPage.locator('[data-testid="soap-output"]')).toContainText('SUBJECTIVE');
  });
});
```

---

## Security Testing Requirements

### Static Application Security Testing (SAST)

**Tools:**
- ESLint with security plugins
- TypeScript strict mode (already enabled)
- Dependency vulnerability scanning

**ESLint Security Configuration:**

```json
{
  "plugins": ["security", "@microsoft/sdl"],
  "extends": [
    "plugin:security/recommended",
    "plugin:@microsoft/sdl/required"
  ],
  "rules": {
    "security/detect-object-injection": "error",
    "security/detect-non-literal-regexp": "error",
    "security/detect-unsafe-regex": "error",
    "security/detect-buffer-noassert": "error",
    "security/detect-eval-with-expression": "error",
    "security/detect-no-csrf-before-method-override": "error",
    "security/detect-possible-timing-attacks": "warn"
  }
}
```

**Dependency Scanning:**

```bash
# Run in CI on every PR
pnpm audit --audit-level=moderate

# Block deployment on critical/high vulnerabilities
pnpm audit --audit-level=high
```

### Dynamic Application Security Testing (DAST)

**Tool:** OWASP ZAP (automated) + Burp Suite (manual)

**Automated DAST in CI:**

```yaml
# Run OWASP ZAP against staging environment
security-scan:
  runs-on: ubuntu-latest
  steps:
    - name: OWASP ZAP Scan
      uses: zaproxy/action-full-scan@v0.4.0
      with:
        target: 'https://staging-api.flashnote.app'
        rules_file_name: '.zap/rules.tsv'
        fail_action: true
```

**DAST Test Coverage:**

| Test Category | Frequency | Tool |
|---------------|-----------|------|
| SQL Injection | Every PR | ZAP |
| XSS | Every PR | ZAP |
| CSRF | Every PR | ZAP |
| Auth Bypass | Every PR | ZAP |
| Session Management | Every PR | ZAP |
| Security Headers | Every PR | ZAP |

### Penetration Testing

**Schedule:**

| Type | Frequency | Scope | Performed By |
|------|-----------|-------|--------------|
| Automated DAST | Every deploy | API endpoints | CI/CD |
| Manual pentest | Quarterly | Full application | Internal + External |
| Third-party audit | Annually | Complete security review | External firm |

**Penetration Testing Scope:**

1. **Authentication & Authorization**
   - JWT manipulation (algorithm confusion, signature stripping)
   - Session fixation/hijacking
   - Privilege escalation
   - Auth bypass attempts

2. **Input Validation**
   - SQL injection (verify parameterized queries)
   - XSS in all user inputs
   - Command injection
   - Path traversal

3. **Business Logic**
   - Rate limit bypass
   - Subscription enforcement bypass
   - Usage tracking manipulation

4. **Infrastructure**
   - TLS configuration
   - Security headers
   - CORS policy
   - Error handling (no info leakage)

### Secret Scanning

**Tools:** GitLeaks, TruffleHog, or GitHub Secret Scanning

```yaml
# Pre-commit hook
- repo: https://github.com/gitleaks/gitleaks
  rev: v8.18.0
  hooks:
    - id: gitleaks
```

---

## HIPAA Compliance Testing

### Automated Compliance Test Suite

These tests MUST pass on every deployment:

```typescript
describe('HIPAA Compliance', () => {
  describe('PHI Protection', () => {
    it('never logs PHI in any log level', async () => {
      // Capture logs during operations that handle PHI
      // Verify no PHI patterns appear in logs
    });

    it('never includes PHI in error responses', async () => {
      // Trigger errors with PHI in request
      // Verify error response contains no PHI
    });

    it('never includes PHI in stack traces', async () => {
      // Verify stack traces don't contain request data
    });

    it('sanitizes PHI from request logging', async () => {
      // Verify request logs redact sensitive fields
    });
  });

  describe('Audit Logging', () => {
    it('logs all authentication events', async () => {
      await authService.login(validCredentials);
      const logs = await getAuditLogs({ action: 'LOGIN' });
      expect(logs.length).toBeGreaterThan(0);
    });

    it('logs all authorization failures', async () => {
      await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer invalid');
      const logs = await getAuditLogs({ action: 'AUTH_FAILURE' });
      expect(logs.length).toBeGreaterThan(0);
    });

    it('logs note generation metadata without content', async () => {
      await generateNote(sampleShorthand);
      const logs = await getAuditLogs({ action: 'NOTE_GENERATED' });
      expect(logs[0]).toHaveProperty('userId');
      expect(logs[0]).toHaveProperty('timestamp');
      expect(logs[0]).not.toHaveProperty('noteContent');
      expect(logs[0]).not.toHaveProperty('shorthand');
    });

    it('audit logs are immutable', async () => {
      const log = await createAuditLog(sampleEvent);
      await expect(updateAuditLog(log.id, { action: 'MODIFIED' }))
        .rejects.toThrow();
    });
  });

  describe('Session Security', () => {
    it('enforces session timeout after inactivity', async () => {
      // Verify session expires after configured timeout
    });

    it('invalidates session on logout', async () => {
      // Verify token cannot be used after logout
    });

    it('invalidates all sessions on password change', async () => {
      // Verify all refresh tokens invalidated
    });
  });

  describe('Encryption', () => {
    it('enforces TLS on all connections', async () => {
      // Verify HTTP redirects to HTTPS
      // Verify HSTS header present
    });

    it('uses secure cookie settings', async () => {
      // Verify Secure, HttpOnly, SameSite flags
    });
  });
});
```

### PHI Leak Detection

**Automated scanning for PHI patterns in logs:**

```typescript
const PHI_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,           // SSN
  /\b\d{9}\b/,                        // SSN without dashes
  /\b[A-Z]{2}\d{6,8}\b/,             // Medical record numbers
  /\bDOB[:\s]+\d{1,2}\/\d{1,2}\/\d{4}\b/i, // Date of birth
  /patient\s+name[:\s]+\w+/i,        // Patient name references
];

function scanLogsForPHI(logs: string[]): boolean {
  return logs.some(log =>
    PHI_PATTERNS.some(pattern => pattern.test(log))
  );
}
```

---

## Performance Testing

### Tools

**Recommended:** k6 (modern, scriptable, developer-friendly)
**Alternatives:** Artillery, Apache JMeter

### Performance Test Scenarios

| Scenario | Target | Threshold |
|----------|--------|-----------|
| Login endpoint | 100 req/s | p95 < 200ms |
| Token refresh | 200 req/s | p95 < 100ms |
| Note generation | 50 req/s | p95 < 5000ms |
| Health check | 500 req/s | p95 < 50ms |

### Load Test Script Example

```javascript
// tests/performance/auth-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up
    { duration: '5m', target: 50 },   // Sustain
    { duration: '2m', target: 100 },  // Peak
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.post('https://api.flashnote.app/auth/login', {
    email: 'loadtest@example.com',
    password: 'testpassword123',
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);
}
```

### Performance Testing Schedule

| Type | Frequency | Environment |
|------|-----------|-------------|
| Smoke test | Every deploy | Staging |
| Load test | Weekly | Staging |
| Stress test | Monthly | Staging |
| Spike test | Quarterly | Staging |

---

## CI/CD Pipeline Requirements

### Pipeline Structure

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  # Stage 1: Static Analysis
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r lint
      - run: pnpm -r type-check

  # Stage 2: Security Scanning
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Dependency audit
        run: pnpm audit --audit-level=high
      - name: Secret scanning
        uses: gitleaks/gitleaks-action@v2
      - name: Security linting
        run: pnpm -r lint:security

  # Stage 3: Unit Tests
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [backend, extension, web]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter ${{ matrix.package }} test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./${{ matrix.package }}/coverage/lcov.info
          flags: ${{ matrix.package }}

  # Stage 4: Integration Tests
  integration-tests:
    runs-on: ubuntu-latest
    needs: [lint, security, unit-tests]
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: flashnote_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter backend db:migrate
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/flashnote_test
      - run: pnpm --filter backend test:integration

  # Stage 5: E2E Tests
  e2e-tests:
    runs-on: ubuntu-latest
    needs: [integration-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - name: Install Playwright
        run: pnpm --filter e2e exec playwright install --with-deps
      - name: Run E2E tests
        run: pnpm --filter e2e test
      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: e2e/playwright-report

  # Stage 6: DAST (on staging deploys)
  security-scan:
    runs-on: ubuntu-latest
    needs: [e2e-tests]
    if: github.ref == 'refs/heads/main'
    steps:
      - name: OWASP ZAP Scan
        uses: zaproxy/action-full-scan@v0.4.0
        with:
          target: ${{ secrets.STAGING_URL }}
          fail_action: true

  # Stage 7: Deploy
  deploy:
    runs-on: ubuntu-latest
    needs: [security-scan]
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        run: echo "Deploy steps here"
```

### Required CI Checks

All of these must pass before merge:

| Check | Blocking | Threshold | Status |
|-------|----------|-----------|--------|
| Linting | Yes | 0 errors | ✅ Configured |
| Type checking | Yes | 0 errors | ✅ Via build |
| Dependency audit | Yes | No high/critical | ✅ Configured (continue-on-error) |
| Unit tests | Yes | All pass | ✅ Backend only |
| Coverage (backend) | Yes | 95% minimum | ✅ Enforced |
| Coverage (extension) | Yes | 80% minimum | Not configured |
| Coverage (web) | Yes | 80% minimum | Not configured |
| Integration tests | Yes | All pass | Not configured |
| E2E tests | Yes | All pass | Not configured |
| DAST scan | Yes (main only) | No high/critical | Not configured |

---

## Code Coverage Standards

### Coverage Thresholds

| Package | Line Coverage | Branch Coverage | Function Coverage | Status |
|---------|--------------|-----------------|-------------------|--------|
| Backend | 95% | 90% | 95% | ✅ Enforced |
| Extension | 80% | 75% | 80% | Not configured |
| Web | 80% | 75% | 80% | Not configured |

### Critical Path Coverage

These areas require **95%+ coverage**:

- Authentication service
- Authorization middleware
- Session management
- Audit logging
- Input validation schemas
- Token storage (extension)

### Coverage Configuration

```typescript
// vitest.config.ts (backend - actual configuration)
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/test/**',
        'src/types/**',
        'src/index.ts',
        'src/db/migrate.ts',
        'src/config.ts',
        'src/db/index.ts',
        'src/routes/**', // Route handlers need integration tests
      ],
      // Healthcare-grade thresholds - do not lower these
      thresholds: {
        lines: 95,
        branches: 90,
        functions: 95,
        statements: 95,
      },
    },
  },
});
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

- [x] Set up GitHub Actions CI pipeline with existing backend tests
- [ ] Add Vitest to extension package
- [ ] Add Vitest to web package
- [x] Configure code coverage reporting (artifact upload configured; Codecov integration pending)
- [x] Add `pnpm audit` to CI pipeline
- [ ] Add pre-commit hooks for linting

**Success Criteria:** CI runs on every PR, coverage reported
**Current Status:** ✅ CI pipeline operational, backend tests running on every PR

### Phase 2: Unit Test Expansion (Weeks 3-4)

- [x] Achieve 85% coverage on backend (exceeded: 95%+ with healthcare-grade thresholds)
- [ ] Add extension component tests (auth, forms, API client)
- [ ] Add web page/component tests
- [ ] Add ESLint security plugins

**Success Criteria:** All coverage thresholds met
**Current Status:** Backend exceeds targets; extension and web testing not yet started

### Phase 3: Integration & Security (Weeks 5-6)

- [ ] Set up test database for integration tests (currently using mocked DB in unit tests)
- [ ] Write backend integration test suite
- [ ] Create HIPAA compliance test suite
- [ ] Configure OWASP ZAP in CI
- [ ] Add secret scanning (GitLeaks)

**Success Criteria:** Integration tests in CI, DAST scanning active
**Current Status:** Not started - security audit (pnpm audit) is in CI but DAST/secret scanning not configured

### Phase 4: E2E Testing (Weeks 7-8)

- [ ] Set up Playwright
- [ ] Write critical path E2E tests
- [ ] Add extension E2E tests
- [ ] Configure E2E in CI pipeline

**Success Criteria:** All critical user journeys have E2E coverage

### Phase 5: Performance & Ongoing (Weeks 9+)

- [ ] Set up k6 performance tests
- [ ] Schedule first external penetration test
- [ ] Document and train team on testing practices
- [ ] Establish quarterly security review cadence

**Success Criteria:** Performance baselines established, pentest scheduled

---

## Testing Tools & Frameworks

### Approved Tools

| Category | Tool | Version | Purpose | Status |
|----------|------|---------|---------|--------|
| Unit/Integration | Vitest | 4.x | Fast, TypeScript-native testing | ✅ Backend |
| React Testing | @testing-library/react | 14.x | Component testing | Not installed |
| E2E | Playwright | 1.x | Browser automation | Not installed |
| API Testing | Supertest | 6.x | HTTP assertions | Not installed |
| Mocking | vitest (built-in) | - | Mocks and spies | ✅ Backend |
| Coverage | @vitest/coverage-v8 | 4.x | Code coverage | ✅ Backend |
| Performance | k6 | 0.x | Load testing | Not installed |
| SAST | ESLint + plugins | 9.x | Static analysis | ✅ Partial |
| DAST | OWASP ZAP | 2.x | Dynamic scanning | Not configured |
| Secrets | GitLeaks | 8.x | Secret detection | Not configured |

### Installation Commands

```bash
# Backend testing - ✅ ALREADY CONFIGURED
# vitest 4.0.18 and @vitest/coverage-v8 4.0.18 installed

# Extension testing - TODO
cd extension
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/coverage-v8

# Web testing - TODO
cd web
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/coverage-v8

# E2E testing - TODO (new package)
mkdir e2e && cd e2e
pnpm init
pnpm add -D @playwright/test

# Security linting - TODO (all packages)
pnpm add -D eslint-plugin-security @microsoft/eslint-plugin-sdl
```

---

## Appendix: Test File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Unit test | `*.test.ts` | `auth-service.test.ts` |
| Component test | `*.test.tsx` | `LoginForm.test.tsx` |
| Integration test | `*.integration.test.ts` | `auth.integration.test.ts` |
| E2E test | `*.spec.ts` | `login.spec.ts` |

---

## Appendix: Running Tests Locally

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter backend test
pnpm --filter extension test
pnpm --filter web test

# Run with coverage
pnpm --filter backend test:coverage

# Run specific test file
pnpm --filter backend test auth-service.test.ts

# Run in watch mode
pnpm --filter backend test --watch

# Run E2E tests
pnpm --filter e2e test

# Run E2E tests with UI
pnpm --filter e2e test --ui
```

---

## Document History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| Jan 2026 | 1.0 | Engineering | Initial document |
| Feb 2026 | 1.1 | Engineering | Updated to reflect current state: CI/CD configured, backend at 95%+ coverage with 28 test files, updated roadmap progress |
