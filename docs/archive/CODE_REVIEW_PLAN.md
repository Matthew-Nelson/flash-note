# FlashNote Systematic Code Review Plan

This plan is designed for AI agents with limited context windows. Each task is scoped to ~10-20 files maximum and produces structured findings.

---

## How to Use This Plan

1. **Execute tasks sequentially within each phase** - Phase 1 is highest priority
2. **Each task is self-contained** - Provide the task description and file list to an AI agent
3. **Collect findings in structured format** - Each task outputs JSON or markdown tables
4. **Aggregate after each phase** - Review findings before proceeding to next phase
5. **Expected time**: Each task should take 5-15 minutes for an AI agent

---

## Output Format for All Tasks

Each review task should output findings in this format:

```json
{
  "task_id": "1.1",
  "task_name": "Authentication Middleware Review",
  "files_reviewed": ["path/to/file.ts"],
  "findings": [
    {
      "severity": "critical|high|medium|low|info",
      "category": "security|hipaa|validation|error-handling|type-safety|code-quality",
      "file": "path/to/file.ts",
      "line": 42,
      "title": "Short description",
      "description": "Detailed explanation of the issue",
      "recommendation": "How to fix it",
      "effort": "trivial|small|medium|large"
    }
  ],
  "summary": "Brief overall assessment",
  "passed_checks": ["List of things that looked good"]
}
```

---

## Phase 1: Security-Critical (HIGHEST PRIORITY)

These tasks review authentication, authorization, and data protection. Execute all Phase 1 tasks before proceeding.

### Task 1.1: JWT Authentication & Token Validation

**Files to review:**
- `/backend/src/middleware/auth.ts`
- `/backend/src/middleware/auth.test.ts`
- `/backend/src/services/token-service.ts`
- `/backend/src/services/token.test.ts`

**Checklist:**
- [ ] JWT algorithm is explicitly specified (not "none", not RS256 with HS256 key)
- [ ] Token expiry is validated
- [ ] Token version is checked against database (for immediate invalidation)
- [ ] Bearer token extraction handles edge cases (missing, malformed)
- [ ] Timing-safe comparison used where appropriate
- [ ] No sensitive data in JWT payload (no PHI, no passwords)
- [ ] Refresh token is hashed before storage
- [ ] Access token expiry is reasonable (≤1 hour)
- [ ] Refresh token expiry is reasonable (≤7 days)
- [ ] Token refresh doesn't extend refresh token lifetime indefinitely
- [ ] Failed auth attempts are audit logged

**Questions to answer:**
1. Can an attacker forge a valid token?
2. Can an attacker use an expired token?
3. Can an attacker reuse a revoked token?
4. Is there token confusion between access/refresh tokens?

---

### Task 1.2: Password Security & Account Lockout

**Files to review:**
- `/backend/src/services/auth-service.ts`
- `/backend/src/services/auth.test.ts`
- `/backend/src/services/lockout-service.ts`
- `/backend/src/services/lockout.test.ts`
- `/backend/src/routes/auth.ts` (password-related schemas only)

**Checklist:**
- [ ] Bcrypt rounds ≥ 12
- [ ] Password policy enforced (8+ chars, uppercase, lowercase, number)
- [ ] Timing-safe comparison for password verification
- [ ] Dummy hash used for non-existent users (prevents enumeration)
- [ ] Account lockout after failed attempts (≤5 attempts)
- [ ] Lockout duration is reasonable (15+ minutes)
- [ ] Lockout applies per-account, not per-IP only
- [ ] Password reset invalidates all existing sessions
- [ ] Password not logged anywhere
- [ ] Old password not required for reset (only reset token)

**Questions to answer:**
1. Can an attacker enumerate valid usernames?
2. Can an attacker brute-force passwords?
3. Is there a DoS vector via account lockout?
4. Can an attacker bypass lockout?

---

### Task 1.3: Session Management & CSRF Protection

**Files to review:**
- `/backend/src/middleware/csrf.ts`
- `/backend/src/middleware/csrf.test.ts`
- `/backend/src/db/queries/users.ts` (session-related functions)
- `/backend/src/services/auth-service.ts` (session limits section)

**Checklist:**
- [ ] CSRF token is cryptographically random
- [ ] CSRF token is bound to session
- [ ] CSRF validation on all state-changing endpoints
- [ ] Session limit enforced (MAX_SESSIONS_PER_USER)
- [ ] Old sessions cleaned up properly
- [ ] Session invalidation works (logout clears session)
- [ ] Refresh token rotation on use (optional but good)
- [ ] Session fixation not possible

**Questions to answer:**
1. Can an attacker perform CSRF attacks?
2. Can an attacker maintain unlimited sessions?
3. Can an attacker hijack an existing session?

---

### Task 1.4: Rate Limiting Configuration

**Files to review:**
- `/backend/src/middleware/rate-limit.ts`
- `/backend/src/middleware/rate-limit.test.ts`

**Checklist:**
- [ ] Login endpoint rate limited (≤5 per 15 min)
- [ ] Registration endpoint rate limited
- [ ] Password reset endpoint rate limited
- [ ] Email verification endpoint rate limited
- [ ] Note generation endpoint rate limited
- [ ] Rate limits apply in production (not just dev)
- [ ] Rate limit headers exposed (X-RateLimit-*)
- [ ] Rate limit key includes IP (not just user)
- [ ] Rate limit bypass not possible via headers

**Questions to answer:**
1. Can an attacker brute-force any endpoint?
2. Can an attacker DoS the service?
3. Are rate limits too permissive?

---

### Task 1.5: SQL Injection Prevention

**Files to review:**
- `/backend/src/db/queries/users.ts`
- `/backend/src/db/queries/webhooks.ts`
- `/backend/src/db/index.ts`

**Checklist:**
- [ ] All queries use parameterized statements ($1, $2, etc.)
- [ ] No string concatenation in queries
- [ ] No template literals with user input in queries
- [ ] Column/table names not derived from user input
- [ ] ORDER BY clauses don't use raw user input
- [ ] LIMIT/OFFSET values are integers
- [ ] No raw SQL execution from user input

**Questions to answer:**
1. Can an attacker inject SQL via any parameter?
2. Are there any dynamic query builders that could be exploited?

---

### Task 1.6: Input Validation - Auth Endpoints

**Files to review:**
- `/backend/src/routes/auth.ts`

**Checklist:**
- [ ] All inputs validated with Zod schemas
- [ ] Email format validated
- [ ] Password requirements enforced
- [ ] Token format validated (for reset/verification)
- [ ] No extra fields accepted (strict schemas)
- [ ] Validation errors don't leak sensitive info
- [ ] Unicode handling is correct (normalization)

**Questions to answer:**
1. Can malformed input bypass validation?
2. Can validation errors leak information?

---

### Task 1.7: Input Validation - Note Generation

**Files to review:**
- `/backend/src/routes/notes.ts`
- `/backend/src/utils/prompt-sanitization.ts`
- `/backend/src/utils/prompt-sanitization.test.ts`

**Checklist:**
- [ ] Input length limits enforced (patientContext ≤500, quickNotes ≤5000)
- [ ] Note type is enum-validated
- [ ] Prompt injection patterns detected and logged
- [ ] User content wrapped in XML delimiters
- [ ] PT notation not falsely flagged (5/10, 3+/5, <90°)
- [ ] Suspicious content logged but not necessarily blocked
- [ ] No PHI in error responses

**Questions to answer:**
1. Can an attacker perform prompt injection?
2. Can oversized input cause issues?
3. Is PT-specific content handled correctly?

---

## Phase 2: HIPAA Compliance

These tasks verify PHI protection and audit logging requirements.

### Task 2.1: Audit Logging Completeness

**Files to review:**
- `/backend/src/services/audit-service.ts`
- `/backend/src/services/audit.test.ts`
- `/backend/src/types/index.ts` (AuditAction enum)

**Checklist:**
- [ ] All auth events logged (LOGIN, LOGOUT, LOGIN_FAILED, REGISTER)
- [ ] All auth failures logged (AUTH_FAILED, ACCESS_DENIED, CSRF_FAILED)
- [ ] Account lockout events logged
- [ ] Note generation logged (metadata only)
- [ ] Password reset events logged
- [ ] Email verification events logged
- [ ] Subscription changes logged
- [ ] IP address captured for all events
- [ ] User agent captured for all events
- [ ] Timestamp is accurate and timezone-aware
- [ ] Audit logs are immutable (no UPDATE/DELETE)
- [ ] Audit failures don't break application flow

**Questions to answer:**
1. Are all HIPAA-required events captured?
2. Can audit logs be tampered with?
3. Is there sufficient context for incident investigation?

---

### Task 2.2: PHI Protection in Logs & Errors

**Files to review:**
- `/backend/src/middleware/error-handler.ts`
- `/backend/src/middleware/error-handler.test.ts`
- `/backend/src/utils/request-utils.ts`
- `/backend/src/services/ai-service.ts`

**Checklist:**
- [ ] No PHI in error messages (patient names, DOB, MRN, diagnoses)
- [ ] No PHI in stack traces
- [ ] No PHI in audit logs (note content never logged)
- [ ] Stack traces hidden in production
- [ ] Generic error messages for clients
- [ ] Note content not stored in database
- [ ] Note content not logged by AI service
- [ ] Request bodies not logged
- [ ] Response bodies not logged

**Questions to answer:**
1. Could PHI leak in any error scenario?
2. Could PHI leak in logs?
3. Is the pass-through model properly implemented?

---

### Task 2.3: Access Control Enforcement

**Files to review:**
- `/backend/src/middleware/email-verification.ts`
- `/backend/src/middleware/email-verification.test.ts`
- `/backend/src/middleware/subscription.ts`
- `/backend/src/middleware/subscription.test.ts`

**Checklist:**
- [ ] Email verification required before note generation
- [ ] Active subscription required for note generation
- [ ] Trial expiry properly enforced
- [ ] Cancelled subscriptions properly blocked
- [ ] Access denials are audit logged
- [ ] No bypass via parameter manipulation
- [ ] Middleware order is correct (auth → verification → subscription)

**Questions to answer:**
1. Can unverified users access protected resources?
2. Can expired trials generate notes?
3. Is the authorization chain complete?

---

## Phase 3: Error Handling & Data Flow

### Task 3.1: Backend Error Handling

**Files to review:**
- `/backend/src/middleware/error-handler.ts`
- `/backend/src/middleware/error-handler.test.ts`
- `/backend/src/routes/auth.ts` (error paths)
- `/backend/src/routes/notes.ts` (error paths)

**Checklist:**
- [ ] All routes have error handling
- [ ] Zod errors formatted consistently
- [ ] AppError class used for domain errors
- [ ] Error codes are consistent (from CLAUDE.md list)
- [ ] No unhandled promise rejections
- [ ] Async errors caught properly
- [ ] 500 errors don't leak internals
- [ ] Error responses follow API format

**Questions to answer:**
1. Can any error leak sensitive information?
2. Are errors consistent and actionable for clients?
3. Are there any unhandled error paths?

---

### Task 3.2: Extension Error Handling

**Files to review:**
- `/extension/src/sidepanel/components/ErrorBoundary.tsx`
- `/extension/src/shared/api.ts`
- `/extension/src/sidepanel/hooks/useAuth.ts`
- `/extension/src/sidepanel/hooks/useApi.ts`

**Checklist:**
- [ ] React error boundary catches component errors
- [ ] API errors handled gracefully
- [ ] Token expiry triggers refresh, not logout
- [ ] Network errors show user-friendly messages
- [ ] Auth errors redirect to login appropriately
- [ ] No sensitive data in error UI
- [ ] Loading states prevent double-submission

**Questions to answer:**
1. Does the extension fail gracefully?
2. Are error messages user-friendly?
3. Can errors leak tokens or credentials?

---

### Task 3.3: API Contract Validation

**Files to review:**
- `/backend/src/types/index.ts`
- `/extension/src/shared/types.ts`
- `/extension/src/shared/schemas.ts`

**Checklist:**
- [ ] Backend and extension types match
- [ ] Response formats consistent
- [ ] Error codes documented and consistent
- [ ] NoteType enum matches
- [ ] Password policy matches (CRITICAL)
- [ ] All required fields present

**Questions to answer:**
1. Are there type mismatches between frontend and backend?
2. Could a schema drift cause security issues?

---

## Phase 4: Configuration & Secrets

### Task 4.1: Environment & Secrets Management

**Files to review:**
- `/backend/src/config.ts`
- `/backend/src/config.test.ts`
- `/backend/src/index.ts` (environment checks)

**Checklist:**
- [ ] All secrets loaded from environment variables
- [ ] No hardcoded secrets in code
- [ ] Required variables validated at startup
- [ ] Reasonable defaults only for non-sensitive values
- [ ] NODE_ENV properly checked
- [ ] Production vs development config differences clear
- [ ] Database connection string not logged
- [ ] API keys not logged

**Questions to answer:**
1. Could secrets leak?
2. Would missing config cause clear failures?
3. Are dev/prod differences appropriate?

---

### Task 4.2: Security Headers & CORS

**Files to review:**
- `/backend/src/index.ts`

**Checklist:**
- [ ] Helmet middleware configured
- [ ] Content-Security-Policy set
- [ ] X-Frame-Options set (DENY or SAMEORIGIN)
- [ ] X-Content-Type-Options: nosniff
- [ ] Strict-Transport-Security configured
- [ ] CORS origins restricted (not *)
- [ ] CORS credentials handling correct
- [ ] Rate limit headers configured

**Questions to answer:**
1. Are security headers sufficient?
2. Is CORS too permissive?

---

## Phase 5: Type Safety & Code Quality

### Task 5.1: Backend Type Safety

**Files to review:**
- `/backend/src/types/index.ts`
- `/backend/src/types/database.ts`
- Sample of route handlers and services

**Checklist:**
- [ ] No `any` types without justification
- [ ] Database row types properly defined
- [ ] API response types enforced
- [ ] Null/undefined handled explicitly
- [ ] Type assertions minimized
- [ ] Generic types used appropriately

**Questions to answer:**
1. Could type unsafety cause runtime errors?
2. Could type unsafety cause security issues?

---

### Task 5.2: Extension Type Safety

**Files to review:**
- `/extension/src/shared/types.ts`
- `/extension/src/shared/schemas.ts`
- `/extension/src/sidepanel/components/*.tsx`

**Checklist:**
- [ ] Component props properly typed
- [ ] Hook return types defined
- [ ] API response types match backend
- [ ] Event handlers properly typed
- [ ] No `any` types without justification

---

### Task 5.3: Test Coverage Assessment

**Files to review:**
- All `*.test.ts` files in `/backend/src/`

**Checklist:**
- [ ] Auth service has comprehensive tests
- [ ] Token service has comprehensive tests
- [ ] Lockout service has comprehensive tests
- [ ] Rate limiting has tests
- [ ] CSRF protection has tests
- [ ] Error handler has tests
- [ ] Negative test cases (invalid input, unauthorized access)
- [ ] Edge cases covered

**Questions to answer:**
1. What critical paths lack test coverage?
2. Are security-critical functions tested?

---

## Phase 6: Dependency & Infrastructure

### Task 6.1: Dependency Vulnerability Scan

**Method:** Run `npm audit` or `pnpm audit` in each directory

**Directories:**
- `/backend`
- `/extension`
- `/web`

**Checklist:**
- [ ] No critical vulnerabilities
- [ ] No high vulnerabilities in production deps
- [ ] Dependencies reasonably up-to-date
- [ ] No abandoned packages in critical paths

---

### Task 6.2: Database Schema Review

**Files to review:**
- `/backend/src/db/migrations/*.sql`

**Checklist:**
- [ ] Primary keys on all tables
- [ ] Foreign key constraints where appropriate
- [ ] Indexes on frequently queried columns
- [ ] No sensitive defaults
- [ ] Audit logs table is append-only (no UPDATE trigger needed if app-enforced)
- [ ] Token hashes stored, not plaintext tokens
- [ ] Email uniqueness constraint
- [ ] Timestamp columns use appropriate types

---

## Aggregation Tasks

After completing each phase, run these aggregation tasks:

### Aggregation A: Phase 1 Security Summary

**Input:** All findings from Tasks 1.1-1.7

**Output:**
- Count of critical/high/medium/low findings
- Top 5 most urgent issues
- Patterns across multiple files
- Recommended remediation order

### Aggregation B: Full Review Summary

**Input:** All findings from all phases

**Output:**
- Executive summary (1 paragraph)
- Findings by severity
- Findings by category
- Recommended action plan with priorities
- List of passed security checks (what's working well)

---

## Execution Checklist

Use this to track progress:

- [ ] **Phase 1: Security-Critical**
  - [ ] 1.1 JWT Authentication & Token Validation
  - [ ] 1.2 Password Security & Account Lockout
  - [ ] 1.3 Session Management & CSRF Protection
  - [ ] 1.4 Rate Limiting Configuration
  - [ ] 1.5 SQL Injection Prevention
  - [ ] 1.6 Input Validation - Auth Endpoints
  - [ ] 1.7 Input Validation - Note Generation
  - [ ] Aggregation A: Phase 1 Summary

- [ ] **Phase 2: HIPAA Compliance**
  - [ ] 2.1 Audit Logging Completeness
  - [ ] 2.2 PHI Protection in Logs & Errors
  - [ ] 2.3 Access Control Enforcement

- [ ] **Phase 3: Error Handling & Data Flow**
  - [ ] 3.1 Backend Error Handling
  - [ ] 3.2 Extension Error Handling
  - [ ] 3.3 API Contract Validation

- [ ] **Phase 4: Configuration & Secrets**
  - [ ] 4.1 Environment & Secrets Management
  - [ ] 4.2 Security Headers & CORS

- [ ] **Phase 5: Type Safety & Code Quality**
  - [ ] 5.1 Backend Type Safety
  - [ ] 5.2 Extension Type Safety
  - [ ] 5.3 Test Coverage Assessment

- [ ] **Phase 6: Dependency & Infrastructure**
  - [ ] 6.1 Dependency Vulnerability Scan
  - [ ] 6.2 Database Schema Review

- [ ] **Aggregation B: Full Review Summary**

---

## Notes for AI Agent Execution

1. **Stay focused** - Each task has specific files and questions. Don't expand scope.
2. **Be concrete** - Cite specific line numbers and code snippets in findings.
3. **Prioritize security** - This is healthcare software. When in doubt, flag it.
4. **Use the output format** - Structured JSON makes aggregation possible.
5. **Note what's good** - Include `passed_checks` to give a balanced view.
6. **Context limits** - If a file is too large, focus on the sections relevant to the checklist.
