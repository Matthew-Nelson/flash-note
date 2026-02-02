# FlashNote - Claude Code Instructions

## ⚠️ CRITICAL: Healthcare Software Standards

**This is healthcare software. Patient safety and data protection are non-negotiable.**

FlashNote operates in clinical environments where code quality directly impacts patient care and privacy. Every line of code must meet the highest standards:

- **HIPAA compliance is mandatory** - Violations carry penalties up to $1.5M per incident and potential criminal charges
- **MVP-quality code is NOT acceptable** - We do not ship "good enough" code. All code must be production-ready, thoroughly tested, and security-hardened
- **Protect patient data at all costs** - PHI (Protected Health Information) exposure is catastrophic for patients and the business
- **When in doubt, be more secure** - Always err on the side of caution with security decisions
- **No shortcuts on validation or sanitization** - Every input is potentially malicious; treat it accordingly
- **Audit everything security-relevant** - If it touches auth, PHI, or access control, it gets logged

**Before writing any code, ask yourself:**
1. Could this leak PHI in logs, errors, or responses?
2. Is every input validated and sanitized?
3. Are authentication and authorization properly enforced?
4. Would this code survive a security audit?
5. Is this defensive enough for a healthcare environment?

---

## Project Overview

FlashNote is an AI-powered browser extension that helps Physical Therapists generate SOAP notes from shorthand input. The architecture consists of three main components:

1. **Backend API** (`/backend`) - Node.js + Express REST API
2. **Browser Extension** (`/extension`) - Chrome extension with React + Vite
3. **Web App** (`/web`) - Next.js landing page and dashboard

## Key Architecture Decisions

- **LLM Provider**: Google Gemini (gemini-2.5-flash) - chosen for cost efficiency
- **Auth**: Custom JWT implementation (third-party OAuth under review - see [docs/OAUTH_ANALYSIS.md](docs/OAUTH_ANALYSIS.md))
- **Database**: PostgreSQL with raw SQL queries (no ORM)
- **EMR Integration**: Copy/paste only (v1) - no direct EMR integrations
- **PHI Storage**: We do NOT store patient notes - pass-through to LLM only

## Tech Stack

### Backend
- Node.js 20+ with TypeScript (strict mode)
- Express for routing
- PostgreSQL with `pg` driver (raw SQL, no ORM)
- Zod for validation
- bcryptjs for password hashing
- jsonwebtoken for JWT

### Extension
- React 18+ with TypeScript
- Vite for bundling
- Tailwind CSS for styling
- Chrome Extension Manifest V3
- chrome.storage.local for token persistence

### Web
- Next.js 14+ with App Router
- Tailwind CSS
- Deployed to Vercel

## Database Schema

Only 4 tables needed:
- `users` - User accounts and subscription info
- `sessions` - Refresh token storage
- `audit_logs` - HIPAA-required action logging
- `usage` - Monthly usage tracking for billing

## Important Patterns

### API Responses
Use consistent response structure:
```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: { code: string, message: string } }
```

### Validation
Always use Zod schemas for input validation:
```typescript
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
```

### HIPAA Compliance (MANDATORY)

**PHI Protection:**
- NEVER log PHI (patient names, dates of birth, medical record numbers, note content, diagnosis, treatment details)
- NEVER include PHI in error messages, stack traces, or API responses beyond what's necessary
- NEVER store PHI in local storage, cookies, or client-side state longer than the active session
- NEVER transmit PHI without TLS encryption
- ALWAYS sanitize data before logging - assume any user-provided content may contain PHI

**Audit Requirements:**
- Log ALL authentication events (login, logout, token refresh, failed attempts)
- Log ALL authorization failures (access denied events)
- Log note generation metadata (timestamp, user ID, success/failure) but NEVER content
- Audit logs must be immutable and retained per HIPAA requirements

**Security Controls:**
- All connections MUST use TLS 1.2+
- Implement proper session timeout and invalidation
- Enforce principle of least privilege on all data access
- Validate and sanitize ALL inputs without exception

### Error Codes
Standard error codes:
- `missing_token` - No auth header
- `invalid_token` - Token expired/malformed
- `invalid_credentials` - Wrong email/password
- `trial_expired` - Free trial ended
- `subscription_required` - Payment needed
- `rate_limit_exceeded` - Too many requests

## File Naming Conventions

- TypeScript files: `kebab-case.ts`
- React components: `PascalCase.tsx`
- Test files: `*.test.ts` or `*.spec.ts`

## Commands

### Backend
```bash
cd backend
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm test         # Run tests
pnpm db:migrate   # Run migrations
```

### Extension
```bash
cd extension
pnpm dev          # Start dev with hot reload
pnpm build        # Build for production
pnpm package      # Create .zip for Chrome Web Store
```

### Web
```bash
cd web
pnpm dev          # Start Next.js dev server
pnpm build        # Build for production
pnpm start        # Start production server
```

## Security Requirements

- Passwords: bcrypt with 12 rounds minimum
- JWT access tokens: 1 hour expiry
- JWT refresh tokens: 7 days expiry, stored hashed in DB
- Rate limiting: 5 login attempts per 15 minutes
- All endpoints require authentication except /auth/* and /health

### Password Policy (Source of Truth: `backend/src/routes/auth.ts`)

Password requirements are enforced by Zod schemas in the backend:
- Minimum 8 characters
- At least one uppercase letter (`/[A-Z]/`)
- At least one lowercase letter (`/[a-z]/`)
- At least one number (`/[0-9]/`)

**When updating password policy, sync changes to:**
1. `backend/src/routes/auth.ts` - `registerSchema` and `resetPasswordSchema` (SOURCE OF TRUTH)
2. `web/src/app/reset-password/page.tsx` - client-side validation
3. `extension/src/shared/schemas.ts` - client-side validation

## Code Quality Standards

**This is not an MVP. We do not accept shortcuts.**

- **Type Safety**: TypeScript strict mode is mandatory. No `any` types without explicit justification
- **Input Validation**: Every external input (API requests, user input, URL params) must be validated with Zod schemas
- **Error Handling**: All errors must be caught and handled appropriately. No unhandled promise rejections. No leaked stack traces to clients
- **SQL Injection Prevention**: Always use parameterized queries. Never concatenate user input into SQL
- **XSS Prevention**: Sanitize all user-provided content before rendering. Use appropriate encoding
- **Testing**: Security-critical code paths require tests. Auth, authorization, and data handling must have coverage
- **Code Review Mindset**: Write code as if it will be audited by a security firm and reviewed by regulators
- **Fail Secure**: When something goes wrong, fail closed. Deny access by default. Never expose data in error states

## Reference Document

See `docs/reference/FLASHNOTE_HANDOFF.md` for complete project specification including:
- Full API documentation
- Database schema details
- PT-specific AI prompts
- HIPAA compliance checklist
- Deployment strategy

## Documentation Guidelines

**Before starting a task:**
1. Check `docs/ROADMAP.md` to understand current priorities
2. Review relevant docs in `docs/` that may inform your approach:
   - `docs/guides/` - API reference and operational procedures
   - `docs/planning/` - Future feature designs (don't implement unless asked)
   - `docs/compliance/` - Security and testing requirements
   - `docs/reference/` - Project specifications

**After completing a task:**
1. Update documentation that was affected by your changes
2. Mark completed items in `docs/ROADMAP.md` or `docs/SUCCESS_METRICS.md`
3. Move fully-implemented planning docs to `docs/archive/`
4. Update `docs/guides/API.md` if you added/changed endpoints

**Documentation principles:**
- Keep docs current - outdated docs are worse than no docs
- Don't over-document - only document what provides ongoing value
- Single source of truth - information should live in one place
- Prefer updating existing docs over creating new ones
- Archive completed work rather than deleting (for historical reference)

**What NOT to document:**
- Trivial implementation details obvious from the code
- Temporary debugging notes
- Duplicate information already in another doc
- Speculative features not discussed with the user

## Additional Rules
- Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.