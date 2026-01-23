# FlashNote - Claude Code Instructions

## Project Overview

FlashNote is an AI-powered browser extension that helps Physical Therapists generate SOAP notes from shorthand input. The architecture consists of three main components:

1. **Backend API** (`/backend`) - Node.js + Express REST API
2. **Browser Extension** (`/extension`) - Chrome extension with React + Vite
3. **Web App** (`/web`) - Next.js landing page and dashboard

## Key Architecture Decisions

- **LLM Provider**: Google Gemini (gemini-2.0-flash) - chosen for cost efficiency
- **Auth**: Custom JWT implementation (no third-party auth to avoid expensive BAAs)
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

### HIPAA Compliance
- Never log PHI (patient names, notes content)
- Log all authentication events
- Log note generation metadata (NOT content)
- All connections must use TLS

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

## Reference Document

See `FLASHNOTE_HANDOFF.md` for complete project specification including:
- Full API documentation
- Database schema details
- PT-specific AI prompts
- HIPAA compliance checklist
- Deployment strategy
