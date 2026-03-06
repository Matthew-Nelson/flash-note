# FlashNote

AI-powered SOAP note generation for Physical Therapists. HIPAA-compliant healthcare software deployed on Google Cloud Run.

## What It Is

FlashNote is a web application that helps Physical Therapists generate complete, insurance-compliant SOAP notes from shorthand input. Therapists enter abbreviated clinical notes, and the AI expands them into structured documentation.

Single Next.js 16 application with an integrated server-side backend — no separate API server or browser extension.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL on Google Cloud SQL |
| Auth | Cookie-based sessions (opaque tokens, bcryptjs) |
| Validation | Zod |
| Rate Limiting | Upstash Redis (`@upstash/ratelimit`) |
| LLM | Google Gemini 2.5 Flash via Vertex AI |
| Payments | Stripe |
| Styling | Tailwind CSS |
| Error Tracking | Sentry (`@sentry/nextjs`) |
| Deployment | Google Cloud Run (containerized) |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- pnpm

### Setup

```bash
git clone git@github.com:Matthew-Nelson/flash-note.git
cd flash-note/web
pnpm install
cp .env.example .env.local   # Edit with your values
pnpm db:migrate
pnpm dev
```

### Commands

```bash
cd web
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm test         # Run tests
pnpm db:migrate   # Run database migrations
```

## Project Structure

```
web/src/
  app/              # Next.js App Router (pages, layouts, API routes)
  components/       # React components (ui/, auth/, notes/)
  lib/              # Shared utilities, Zod schemas, types (client + server safe)
  server/           # Server-only code (DAL, services, DB, prompts)
  actions/          # Server Actions (auth, notes, billing)
  test/             # Test setup, helpers, factories
```

## Engineering Guide

See [CLAUDE.md](./CLAUDE.md) for the full engineering guide including:
- Architecture decisions and rationale
- HIPAA compliance requirements
- Mandatory engineering rules
- Security requirements
- Database schema
- Code patterns and conventions

## License

Proprietary - All rights reserved
