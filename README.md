# FlashNote

AI-powered SOAP note generation for Physical Therapists.

## Overview

FlashNote is a browser extension that helps physical therapists write documentation faster using AI. Therapists enter shorthand notes, and the AI expands them into complete, insurance-compliant SOAP notes.

## Project Structure

```
flashnote/
├── backend/        # Node.js + Express API
├── extension/      # Chrome Extension (React + Vite)
├── web/            # Landing page + dashboard (Next.js)
└── docs/           # Legal documents (Privacy Policy, ToS, BAA)
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js 20+, Express, TypeScript |
| Database | PostgreSQL |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| LLM | Google Gemini API |
| Extension | React 18+, Vite, Tailwind CSS |
| Web | Next.js, Tailwind CSS |
| Payments | Stripe |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- pnpm (recommended) or npm

### Development Setup

1. **Clone the repository**
   ```bash
   git clone git@github.com:Matthew-Nelson/flash-note.git
   cd flash-note
   ```

2. **Install dependencies**
   ```bash
   # Install all workspace dependencies
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your values
   ```

4. **Start the database**
   ```bash
   # Run migrations
   cd backend && pnpm db:migrate
   ```

5. **Start development servers**
   ```bash
   # Terminal 1: Backend API
   cd backend && pnpm dev

   # Terminal 2: Extension (for development)
   cd extension && pnpm dev

   # Terminal 3: Web (landing page)
   cd web && pnpm dev
   ```

### Building for Production

```bash
# Build all packages
pnpm build

# Build individual packages
cd backend && pnpm build
cd extension && pnpm build
cd web && pnpm build
```

## Documentation

- [Handoff Document](./FLASHNOTE_HANDOFF.md) - Complete project specification
- [API Documentation](./docs/API.md) - API endpoints and usage
- [Extension Architecture](./docs/EXTENSION.md) - Browser extension details

## License

Proprietary - All rights reserved
