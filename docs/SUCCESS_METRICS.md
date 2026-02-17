# FlashNote Success Metrics & Quality Gates

**Created:** January 2025
**Purpose:** Define measurable pass/fail criteria for production readiness

> **Note:** This document defines *what must be true* (quality gates). For *what to work on next* (task tracking), see [ROADMAP.md](./ROADMAP.md). For business/ops tasks, see [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md).

---

## Table of Contents

1. [Success Criteria Summary](#success-criteria-summary)
2. [Quality Gates by Phase](#quality-gates-by-phase)
3. [Domain-Specific Requirements](#domain-specific-requirements)
4. [Security & HIPAA Checklist](#security--hipaa-checklist)
5. [Testing Requirements](#testing-requirements)

---

## Success Criteria Summary

| Metric | Target | Current |
|--------|--------|---------|
| Backend test coverage | 95% lines, 90% branches | ✅ Enforced in CI |
| Extension test coverage | ≥80% | ✅ ~93% (14 files, ~233 tests) |
| Web test coverage | ≥80% | ✅ ~92% (19 files, ~224 tests) |
| Security vulnerabilities | 0 critical, 0 high | ❌ 4 CRITICALs open — see [CONSOLIDATED_AUDIT](./compliance/CONSOLIDATED_AUDIT_2026_02.md) |
| HIPAA checklist complete | 100% | ~80% |
| Lighthouse performance score | ≥90 | Not measured |
| API response time (p95) | <500ms | Not measured |

---

## Quality Gates by Phase

### Phase 1: MVP Foundation (Current → Functional)

These items must be complete before any user testing.

| ID | Requirement | Domain | Priority | Status |
|----|-------------|--------|----------|--------|
| MVP-01 | All TypeScript strict mode enabled | All | P0 | ✅ Done |
| MVP-02 | Backend compiles without errors | Backend | P0 | ✅ Done |
| MVP-03 | Extension compiles without errors | Extension | P0 | ✅ Done |
| MVP-04 | Web compiles without errors | Web | P0 | ✅ Done |
| MVP-05 | Database migrations run successfully | Backend | P0 | ✅ Done |
| MVP-06 | API health endpoint responds | Backend | P0 | ✅ Done |
| MVP-07 | Extension icon assets exist (all 4 sizes) | Extension | P0 | ✅ Done |
| MVP-08 | Web app auth connects to backend | Web | P0 | ✅ Done |
| MVP-09 | Extension auth connects to backend | Extension | P0 | ✅ Done (manually verified) |
| MVP-10 | Note generation returns valid SOAP | Backend | P0 | ✅ Done (manually verified) |
| MVP-11 | Zod validation on all backend inputs | Backend | P0 | ✅ Done |
| MVP-12 | Zod validation on extension inputs | Extension | P0 | ✅ Done |
| MVP-13 | Error Boundary in extension | Extension | P0 | ✅ Done |
| MVP-14 | Error Boundary in web app | Web | P0 | ✅ Done |
| MVP-15 | ESLint config exists and passes | All | P1 | ✅ Done |

### Phase 2: Beta Ready

These items must be complete before beta testing with real PTs.

| ID | Requirement | Domain | Priority | Status |
|----|-------------|--------|----------|--------|
| BETA-01 | Backend unit tests ≥60% coverage | Backend | P0 | ✅ 31 test files, ~683 tests |
| BETA-02 | Auth flow fully tested (manual) | All | P0 | ✅ Done (manually verified) |
| BETA-03 | Stripe checkout flow works end-to-end | All | P0 | ✅ Done (local override; live Stripe deferred to post-beta) |
| BETA-04 | Trial expiration enforced | Backend | P0 | ✅ Done (manually verified) |
| BETA-05 | Rate limiting works (verified) | Backend | P0 | ✅ Done (dev mode uses relaxed limits; prod limits confirmed correct) |
| BETA-06 | Password validation matches spec | All | P0 | ✅ Done |
| BETA-07 | Web dashboard shows real data | Web | P0 | ⚠️ Auth/subscription live, usage mock |
| BETA-08 | Privacy policy page exists | Web | P0 | ✅ Done |
| BETA-09 | Terms of service page exists | Web | P0 | ✅ Done |
| BETA-10 | API request timeout handling | Extension | P1 | ✅ Done |
| BETA-11 | Retry logic with backoff | Extension | P1 | ✅ Done |
| BETA-12 | ~~Offline detection~~ | Extension | P2 | Dropped — deferred to post-launch polish |

### Phase 3: Production Ready

These items must be complete before public launch.

| ID | Requirement | Domain | Priority | Status |
|----|-------------|--------|----------|--------|
| PROD-01 | Backend unit tests ≥80% coverage | Backend | P0 | ✅ 31 test files, ~683 tests |
| PROD-02 | Extension unit tests ≥70% coverage | Extension | P0 | ✅ Done |
| PROD-03 | Web unit tests ≥60% coverage | Web | P1 | ✅ Done |
| PROD-04 | Security headers configured | All | P0 | ✅ Done |
| PROD-05 | CORS locked to production domains | Backend | P0 | ✅ Done |
| PROD-06 | All secrets in env vars (no hardcoding) | All | P0 | ✅ Done |
| PROD-07 | Database encrypted at rest | Infra | P0 | ❌ Not deployed |
| PROD-08 | TLS 1.2+ enforced | Infra | P0 | ❌ Not deployed |
| PROD-09 | Vertex AI BAA signed (HIPAA) | Infra | P0 | ❌ Not done |
| PROD-10 | Audit logs retained 6 years | Backend | P0 | ❌ Not implemented |
| PROD-11 | Error tracking (Sentry) configured | All | P1 | ✅ Done |
| PROD-12 | Chrome Web Store listing complete | Extension | P0 | ❌ Not done |
| PROD-13 | BAA template available for customers | Docs | P0 | ❌ Not done |
| PROD-14 | Incident response plan documented | Docs | P1 | ❌ Not done |
| PROD-15 | WCAG 2.1 AA accessibility | Web/Ext | P2 | ❌ Not done |
| PROD-16 | Audit logging workflow complete | Backend | P0 | ❌ Not done |

> **PROD-16 Details:** Implement admin API for viewing/exporting audit logs, add database-level immutability protections, and document retention policy. See [compliance/AUDIT_LOGGING_REQUIREMENTS.md](./compliance/AUDIT_LOGGING_REQUIREMENTS.md) for full requirements.

---

## Domain-Specific Requirements

### Backend Requirements

| Category | Requirement | Spec Reference | Status |
|----------|-------------|----------------|--------|
| **Auth** | bcrypt 12 rounds | CLAUDE.md | ✅ Done |
| **Auth** | JWT access token 1hr expiry | CLAUDE.md | ✅ Done |
| **Auth** | JWT refresh token 7d expiry | CLAUDE.md | ✅ Done |
| **Auth** | Refresh tokens hashed in DB | HIPAA | ✅ Done |
| **Auth** | Password: min 8 chars | Handoff §11 | ✅ Done |
| **Auth** | Password: 1 uppercase | Handoff §11 | ✅ Done |
| **Auth** | Password: 1 number | Handoff §11 | ✅ Done |
| **Auth** | Login rate limit: 5/15min | Handoff §8 | ✅ Done |
| **Auth** | Register rate limit: 3/hr | Handoff §8 | ✅ Done |
| **API** | Consistent response format | CLAUDE.md | ✅ Done |
| **API** | Standard error codes | CLAUDE.md | ✅ Done |
| **API** | Zod validation all inputs | CLAUDE.md | ✅ Done |
| **API** | Health endpoint | Handoff §8 | ✅ Done |
| **DB** | 10 tables (users, sessions, audit_logs, usage, organizations, organization_members, legal_acceptances, invite_codes, webhook_events, migrations) | Handoff §7 | ✅ Done |
| **DB** | UUID primary keys | Handoff §7 | ✅ Done |
| **DB** | Audit logs table | HIPAA | ✅ Done |
| **DB** | No PHI stored | HIPAA | ✅ Done |
| **AI** | Gemini 2.5 Flash | Handoff §10 | ✅ Done |
| **AI** | SOAP section parsing | Handoff §10 | ✅ Done |
| **AI** | Token usage tracking | Handoff §10 | ✅ Done |
| **Billing** | Stripe webhook verification | Handoff §13 | ✅ Done |
| **Billing** | Subscription status update | Handoff §13 | ✅ Done |
| **Billing** | 14-day trial | Handoff §13 | ✅ Done |
| **Testing** | Vitest configured | Best practice | ✅ Done |
| **Testing** | Auth service tests | Critical | ✅ Done |
| **Testing** | API endpoint tests | Critical | ⚠️ Partial |

### Extension Requirements

| Category | Requirement | Spec Reference | Status |
|----------|-------------|----------------|--------|
| **Manifest** | Version 3 | Handoff §9 | ✅ Done |
| **Manifest** | Storage permission | Handoff §9 | ✅ Done |
| **Manifest** | Host permissions | Handoff §9 | ✅ Done |
| **Assets** | icon-16.png | Chrome Store | ✅ Done |
| **Assets** | icon-32.png | Chrome Store | ✅ Done |
| **Assets** | icon-48.png | Chrome Store | ✅ Done |
| **Assets** | icon-128.png | Chrome Store | ✅ Done |
| **Auth** | Token storage in chrome.storage | Handoff §9 | ✅ Done |
| **Auth** | Token refresh logic | Handoff §9 | ✅ Done |
| **Auth** | Token expiry handling | Handoff §9 | ✅ Done |
| **Validation** | Zod schemas | CLAUDE.md | ✅ Done |
| **Validation** | Password strength check | Handoff §11 | ✅ Done |
| **UI** | Login form | Handoff §9 | ✅ Done |
| **UI** | Note generator | Handoff §9 | ✅ Done |
| **UI** | Result display | Handoff §9 | ✅ Done |
| **UI** | Copy functionality | Handoff §9 | ✅ Done |
| **UI** | Settings/logout | Handoff §9 | ✅ Done |
| **Error** | Error boundary | Best practice | ✅ Done |
| **Error** | API timeout handling | Best practice | ✅ Done (backend timeout + retry logic) |
| **Error** | ~~Offline detection~~ | Nice-to-have | Dropped — deferred to post-launch polish |

### Web Requirements

| Category | Requirement | Spec Reference | Status |
|----------|-------------|----------------|--------|
| **Framework** | Next.js 14+ App Router | CLAUDE.md | ✅ Done |
| **TypeScript** | Strict mode | CLAUDE.md | ✅ Done |
| **Pages** | Landing page | Handoff §5 | ✅ Done |
| **Pages** | Pricing page | Handoff §5 | ✅ Done |
| **Pages** | Login page | Handoff §5 | ✅ Done |
| **Pages** | Signup page | Handoff §5 | ✅ Done |
| **Pages** | Dashboard | Handoff §5 | ⚠️ Usage data mock |
| **Pages** | Privacy policy | Legal | ✅ Done |
| **Pages** | Terms of service | Legal | ✅ Done |
| **Auth** | Backend integration | Core | ✅ Done |
| **Auth** | Session management | Core | ✅ Done |
| **Billing** | Stripe checkout redirect | Handoff §13 | ✅ Done |
| **Billing** | Customer portal link | Handoff §13 | ✅ Done |
| **Components** | Reusable button | Best practice | ✅ Done |
| **Components** | Reusable input | Best practice | ✅ Done |
| **Components** | Navigation | Best practice | ✅ Done |
| **Config** | .env.example | Best practice | ✅ Done |
| **Config** | Security headers | Best practice | ❌ Missing |
| **Error** | Error boundary | Best practice | ✅ Done |

---

## Security & HIPAA Checklist

### Authentication Security

| Requirement | Implemented | Tested | Notes |
|-------------|-------------|--------|-------|
| bcrypt password hashing (12 rounds) | ✅ | ❌ | |
| JWT secrets ≥32 characters | ✅ | ❌ | Validated in config |
| Access token expiry (1 hour) | ✅ | ❌ | |
| Refresh token expiry (7 days) | ✅ | ❌ | |
| Refresh tokens hashed in DB | ✅ | ❌ | |
| Rate limiting on login | ✅ | ❌ | 5 attempts/15 min |
| Rate limiting on register | ✅ | ❌ | 3 attempts/hour |
| Session invalidation on logout | ✅ | ❌ | |
| Password complexity enforced | ⚠️ | ❌ | Backend only |

### Data Protection

| Requirement | Implemented | Tested | Notes |
|-------------|-------------|--------|-------|
| No PHI stored in database | ✅ | ❌ | Pass-through only |
| No PHI in logs | ✅ | ❌ | Audit metadata only |
| No PHI in error messages | ✅ | ❌ | Generic errors |
| TLS 1.2+ for all connections | ❌ | ❌ | Pending deployment |
| Database encryption at rest | ❌ | ❌ | Pending deployment |

### Audit Requirements (HIPAA)

| Requirement | Implemented | Tested | Notes |
|-------------|-------------|--------|-------|
| Log all authentication events | ✅ | ❌ | LOGIN, LOGOUT, REGISTER |
| Log all note generations | ✅ | ❌ | NOTE_GENERATED |
| Log subscription changes | ✅ | ❌ | SUBSCRIPTION_* events |
| Include user ID in logs | ✅ | ❌ | |
| Include timestamp in logs | ✅ | ❌ | |
| Include IP address in logs | ✅ | ❌ | |
| Log retention (6 years) | ❌ | ❌ | No retention automation implemented |

### Infrastructure Security

| Requirement | Implemented | Tested | Notes |
|-------------|-------------|--------|-------|
| HTTPS enforced | ❌ | ❌ | Pending deployment |
| Security headers (Helmet) | ✅ | ❌ | CSP + HSTS configured |
| CORS restricted to known origins | ✅ | ❌ | ALLOWED_ORIGINS env var |
| Stripe webhook signature verification | ✅ | ❌ | |
| Environment variables for secrets | ✅ | ❌ | |
| No secrets in code/git | ✅ | ❌ | .gitignore configured |

---

## Testing Requirements

### Backend Test Coverage Targets

| Module | Target | Current | Priority |
|--------|--------|---------|----------|
| `auth-service.ts` | 90% | ✅ Tested | P0 |
| `ai-service.ts` | 80% | ✅ Tested | P0 |
| `billing-service.ts` | 85% | ✅ Tested | P0 |
| `audit-service.ts` | 70% | ✅ Tested | P1 |
| `usage-service.ts` | 70% | ✅ Tested | P1 |
| Auth middleware | 90% | ✅ Tested | P0 |
| Subscription middleware | 85% | ✅ Tested | P0 |
| Rate limit middleware | 80% | ✅ Tested | P1 |
| Auth routes | 85% | ⚠️ Partial | P0 |
| Notes routes | 80% | ⚠️ Partial | P0 |
| Billing routes | 80% | ⚠️ Partial | P0 |
| **Overall** | **≥80%** | **31 test files, ~683 tests** | **P0** |

### Required Test Scenarios

#### Authentication Tests
- [ ] Register with valid credentials creates user
- [ ] Register with existing email returns 409
- [ ] Register with weak password returns 400
- [ ] Register sends verification email
- [ ] Login with valid credentials returns tokens
- [ ] Login with invalid password returns 401
- [ ] Login rate limiting after 5 attempts
- [ ] Token refresh with valid refresh token
- [ ] Token refresh with expired token returns 401
- [ ] Logout invalidates session

#### Email Verification Tests
- [ ] Verify email with valid token succeeds
- [ ] Verify email with expired token returns 400
- [ ] Verify email with invalid token returns 400
- [ ] Resend verification for existing user sends email
- [ ] Resend verification for non-existent email returns success (no enumeration)
- [ ] Resend verification rate limiting after 3 attempts

#### Password Reset Tests
- [ ] Request reset for existing user sends email
- [ ] Request reset for non-existent email returns success (no enumeration)
- [ ] Request reset rate limiting after 3 attempts
- [ ] Validate reset token returns valid: true for valid token
- [ ] Validate reset token returns valid: false for expired token
- [ ] Reset password with valid token succeeds
- [ ] Reset password invalidates all existing sessions
- [ ] Reset password with expired token returns 400
- [ ] Reset password with weak password returns 400
- [ ] Reset password rate limiting after 5 attempts

#### Authorization Tests
- [ ] Protected route without token returns 401
- [ ] Protected route with expired token returns 401
- [ ] Protected route with valid token succeeds
- [ ] Subscription middleware allows trial users
- [ ] Subscription middleware blocks expired trial
- [ ] Subscription middleware allows active subscription

#### Note Generation Tests
- [ ] Generate daily note with valid input
- [ ] Generate initial eval with valid input
- [ ] Generate progress note with valid input
- [ ] Generate discharge note with valid input
- [ ] Reject input < 10 characters
- [ ] Reject input > 5000 characters
- [ ] Parse SOAP sections correctly
- [ ] Handle AI timeout gracefully
- [ ] Track usage correctly

#### Billing Tests
- [ ] Create checkout session for user
- [ ] Webhook handles checkout.session.completed
- [ ] Webhook handles subscription.updated
- [ ] Webhook handles subscription.deleted
- [ ] Webhook rejects invalid signature

---

**End of Document**
