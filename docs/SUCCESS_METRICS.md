# FlashNote Success Metrics & Quality Gates

**Created:** February 2026
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
| Web test coverage | ≥80% | ✅ 99%+ line, 95%+ branch (764 tests) |
| Security vulnerabilities | 0 critical, 0 high | ✅ 0 CRITICALs; ✅ 16/18 HIGHs resolved (H-5 resolved by architecture, H-12 fixed in Phase 1.1) — see [ROADMAP.md Phase 0](./ROADMAP.md#phase-0-pre-migration-foundations) |
| HIPAA checklist complete | 100% | ~85% (infra items pending deployment) |
| Lighthouse performance score | ≥90 | Not measured |
| API response time (p95) | <500ms | Not measured |

---

## Quality Gates by Phase

### Phase 1: MVP Foundation (Current → Functional)

These items must be complete before any user testing.

| ID | Requirement | Domain | Priority | Status |
|----|-------------|--------|----------|--------|
| MVP-01 | All TypeScript strict mode enabled | Web | P0 | ✅ Done |
| MVP-02 | Web compiles without errors | Web | P0 | ✅ Done |
| MVP-03 | Database migrations run successfully | Web | P0 | ✅ Done |
| MVP-04 | Web app auth with session management | Web | P0 | ✅ Done |
| MVP-05 | Note generation returns valid SOAP | Web | P0 | ✅ Done (manually verified) |
| MVP-06 | Zod validation on all inputs | Web | P0 | ✅ Done |
| MVP-07 | Error Boundary in web app | Web | P0 | ✅ Done |
| MVP-08 | ESLint config exists and passes | Web | P1 | ✅ Done |

### Phase 2: Beta Ready

These items must be complete before beta testing with real PTs.

| ID | Requirement | Domain | Priority | Status |
|----|-------------|--------|----------|--------|
| BETA-01 | Web unit tests ≥60% coverage | Web | P0 | ✅ 764 tests, 99%+ coverage |
| BETA-02 | Auth flow fully tested (manual) | Web | P0 | ✅ Done (manually verified) |
| BETA-03 | Stripe checkout flow works end-to-end | Web | P0 | ✅ Done (live Stripe configured) |
| BETA-04 | Trial expiration enforced | Web | P0 | ✅ Done (manually verified) |
| BETA-05 | Rate limiting works (verified) | Web | P0 | ✅ Done (Upstash Redis limits enforced) |
| BETA-06 | Password validation matches spec | Web | P0 | ✅ Done |
| BETA-07 | Web dashboard shows real data | Web | P0 | ✅ Done (Server Component with real DAL data since Phase 1.4) |
| BETA-08 | Privacy policy page exists | Web | P0 | ✅ Done |
| BETA-09 | Terms of service page exists | Web | P0 | ✅ Done |

### Phase 3: Production Ready

These items must be complete before public launch.

| ID | Requirement | Domain | Priority | Status |
|----|-------------|--------|----------|--------|
| PROD-01 | Web unit tests ≥80% coverage | Web | P0 | ✅ 764 tests, 99%+ coverage |
| PROD-02 | Security headers configured | Web | P0 | ✅ Done |
| PROD-03 | All secrets in env vars (no hardcoding) | Web | P0 | ✅ Done |
| PROD-04 | Database encrypted at rest | Infra | P0 | ❌ Not deployed |
| PROD-05 | TLS 1.2+ enforced | Infra | P0 | ❌ Not deployed |
| PROD-06 | Vertex AI BAA signed (HIPAA) | Infra | P0 | ✅ Done (signed Feb 2026 via GCP Console) |
| PROD-07 | Audit logs retained 6 years | Web | P0 | ⚠️ Partial — DB immutability protections done (migration 012), Cloud Logging sink for 6-year retention not yet configured |
| PROD-08 | Error monitoring configured | Web | P1 | ⚠️ Transitioning — Sentry active, replacing with GCP-native monitoring (Pino + Cloud Logging). See [Deployment Readiness](./ROADMAP.md#deployment-readiness) Steps 1+5. |
| PROD-09 | BAA template available for customers | Docs | P0 | ⚠️ Partial — template exists at `docs/legal/BAA_TEMPLATE.md`; `/baa` page live but pending legal review |
| PROD-10 | Incident response plan documented | Docs | P1 | ✅ Done — see [INCIDENT_RESPONSE_PLAN.md](./compliance/INCIDENT_RESPONSE_PLAN.md) |
| PROD-11 | WCAG 2.1 AA accessibility | Web | P2 | ❌ Not done |
| PROD-12 | Audit logging workflow complete | Web | P0 | ⚠️ Partial — audit logging implemented (DAL, immutability via migration 012, all auth/billing events logged). Remaining: 6-year retention automation (Cloud Logging sink), admin export API. |

> **PROD-12 Details:** Database-level immutability protections are done (migration 012). Audit events are logged for auth, billing, and access control. Remaining: Cloud Logging sink for 6-year retention (see [Deployment Readiness](./ROADMAP.md#deployment-readiness)), admin API for viewing/exporting logs.

---

## Domain-Specific Requirements

### Web Core Requirements

| Category | Requirement | Spec Reference | Status |
|----------|-------------|----------------|--------|
| **Auth** | bcrypt password hashing (12 rounds) | CLAUDE.md | ✅ Done |
| **Auth** | Opaque session tokens (httpOnly cookie) | CLAUDE.md | ✅ Done |
| **Auth** | Session expiry (7 days) | CLAUDE.md | ✅ Done |
| **Auth** | Session tokens hashed in DB | HIPAA | ✅ Done |
| **Auth** | Password: min 8 chars | CLAUDE.md | ✅ Done |
| **Auth** | Password: 1 uppercase | CLAUDE.md | ✅ Done |
| **Auth** | Password: 1 lowercase | CLAUDE.md | ✅ Done |
| **Auth** | Password: 1 number | CLAUDE.md | ✅ Done |
| **Auth** | Login rate limit: 5/15min | CLAUDE.md | ✅ Done |
| **Auth** | Register rate limit: 3/hr | CLAUDE.md | ✅ Done |
| **API** | Consistent response format | CLAUDE.md | ✅ Done |
| **API** | Standard error codes | CLAUDE.md | ✅ Done |
| **API** | Zod validation all inputs | CLAUDE.md | ✅ Done |
| **DB** | 11 tables (users, sessions, audit_logs, usage, organizations, organization_members, legal_acceptances, invite_codes, processed_webhook_events, email_tokens, migrations) | CLAUDE.md | ✅ Done |
| **DB** | UUID primary keys | CLAUDE.md | ✅ Done |
| **DB** | Audit logs table | HIPAA | ✅ Done |
| **DB** | No PHI stored | HIPAA | ✅ Done |
| **AI** | Gemini 2.5 Flash | CLAUDE.md | ✅ Done |
| **AI** | SOAP section parsing | CLAUDE.md | ✅ Done |
| **AI** | Token usage tracking | CLAUDE.md | ✅ Done |
| **Billing** | Stripe webhook verification | CLAUDE.md | ✅ Done |
| **Billing** | Subscription status update | CLAUDE.md | ✅ Done |
| **Billing** | 14-day trial | CLAUDE.md | ✅ Done |
| **Testing** | Vitest configured | Best practice | ✅ Done |
| **Testing** | Auth service tests | Critical | ✅ Done |
| **Testing** | API endpoint tests | Critical | ✅ Done (Phase 1.7 integration tests) |

### Web Requirements

| Category | Requirement | Spec Reference | Status |
|----------|-------------|----------------|--------|
| **Framework** | Next.js 16 App Router | CLAUDE.md | ✅ Done |
| **TypeScript** | Strict mode | CLAUDE.md | ✅ Done |
| **Pages** | Landing page | Handoff §5 | ✅ Done |
| **Pages** | Pricing page | Handoff §5 | ✅ Done |
| **Pages** | Login page | Handoff §5 | ✅ Done |
| **Pages** | Signup page | Handoff §5 | ✅ Done |
| **Pages** | Dashboard | Handoff §5 | ✅ Done (Server Component with real DAL data) |
| **Pages** | Privacy policy | Legal | ✅ Done |
| **Pages** | Terms of service | Legal | ✅ Done |
| **Auth** | Session-based authentication | Core | ✅ Done |
| **Auth** | Session management | Core | ✅ Done |
| **Billing** | Stripe checkout redirect | Handoff §13 | ✅ Done |
| **Billing** | Customer portal link | Handoff §13 | ✅ Done |
| **Components** | Reusable button | Best practice | ✅ Done |
| **Components** | Reusable input | Best practice | ✅ Done |
| **Components** | Navigation | Best practice | ✅ Done |
| **Config** | .env.example | Best practice | ✅ Done |
| **Config** | Security headers | Best practice | ✅ Done (next.config.ts + CSP proxy) |
| **Error** | Error boundary | Best practice | ✅ Done |

---

## Security & HIPAA Checklist

> **Note on "Tested" column:** "Tested" below means formal external verification (e.g., penetration test, manual QA protocol). Most security behaviors are exercised by the 764-test unit/integration suite (Phase 1.7), but have not been formally verified by an external party.

### Authentication Security

| Requirement | Implemented | Tested | Notes |
|-------------|-------------|--------|-------|
| bcrypt password hashing (12 rounds) | ✅ | ❌ | |
| Opaque session tokens | ✅ | ❌ | httpOnly cookie, database-backed |
| Session expiry (7 days) | ✅ | ❌ | Validated on every request |
| Session tokens hashed in DB | ✅ | ❌ | |
| Rate limiting on login | ✅ | ❌ | 5 attempts/15 min |
| Rate limiting on register | ✅ | ❌ | 3 attempts/hour |
| Session invalidation on logout | ✅ | ❌ | Session row deleted from DB |
| Password complexity enforced | ✅ | ❌ | Zod validation (min 8, uppercase, lowercase, digit) |

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
| Security headers | ✅ | ❌ | next.config.ts + CSP proxy |
| CORS restricted to known origins | ✅ | ❌ | ALLOWED_ORIGINS env var |
| Stripe webhook signature verification | ✅ | ❌ | |
| Environment variables for secrets | ✅ | ❌ | |
| No secrets in code/git | ✅ | ❌ | .gitignore configured |

---

## Testing Requirements

### Web Test Coverage Targets

| Module | Target | Current | Priority |
|--------|--------|---------|----------|
| `server/dal/auth.ts` | 90% | ✅ Tested | P0 |
| `server/services/ai.ts` | 80% | ✅ Tested | P0 |
| `server/services/billing.ts` | 85% | ✅ Tested | P0 |
| `server/dal/audit.ts` | 70% | ✅ Tested | P1 |
| `server/dal/usage.ts` | 70% | ✅ Tested | P1 |
| `actions/auth.ts` | 85% | ✅ Tested | P0 |
| `actions/notes.ts` | 80% | ✅ Tested | P0 |
| `actions/billing.ts` | 80% | ✅ Tested | P0 |
| `app/api/webhooks/stripe/route.ts` | 85% | ✅ Tested | P0 |
| **Overall** | **≥80%** | **764 tests, 99%+ line coverage** | **P0** |

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
