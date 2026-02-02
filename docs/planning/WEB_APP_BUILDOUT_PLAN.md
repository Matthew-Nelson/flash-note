# Web App Buildout Plan

> **Status: Phases 1-4 Complete** (February 2, 2026)
>
> This plan has been implemented. Remaining work: Phase 5 (Marketing Enhancement) is nice-to-have, and the `/usage/stats` backend endpoint is needed for real usage data on the dashboard.

## Current State Summary

The web app is a Next.js 14+ application that now includes:
- ✅ Marketing landing page with FlashNote design system
- ✅ Authentication flow fully connected to backend
- ✅ User dashboard with real auth/subscription data (usage still mock)
- ✅ Stripe checkout and customer portal integration
- ✅ Legal pages (Privacy Policy, Terms of Service)
- ✅ Consistent UI component library
- ✅ Session management and protected routes
- ✅ Account settings page

**What's remaining:**
- Backend `/usage/stats` endpoint (for real usage data on dashboard)
- Phase 5: Marketing Enhancement (nice-to-have)

---

## Theming Strategy

### Source of Truth Hierarchy

The extension already has a well-defined design system that should be the source:

```
1. /shared/design-tokens.css     ← CSS custom properties (colors, spacing, etc.)
2. /shared/tailwind-preset.js    ← Tailwind integration layer
3. /extension/src/sidepanel/index.css  ← Component-level classes
```

### Recommendation: Create Shared Component Styles

Create a new file `/shared/components.css` that extracts the reusable component classes from the extension's `index.css`. This allows both apps to use consistent:

- `.btn-primary`, `.btn-secondary`
- `.input-field`, `.label`
- `.card`, `.card-header`
- `.link`, `.error-message`
- Animation utilities (`.animate-fade-in-up`, `.stagger-*`)

The web app's `globals.css` would then:
```css
@import '../../shared/design-tokens.css';
@import '../../shared/components.css';
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## Buildout Phases

### Phase 1: Foundation & Theming Consistency ✅ COMPLETE

**Goal:** Establish consistent theming between extension and web app

**Tasks:**
1. Extract reusable component classes from extension's `index.css` into `/shared/components.css`
2. Update web app's `globals.css` to import shared components
3. Create a basic UI component library in `/web/src/components/ui/`:
   - `Button.tsx` (primary, secondary, ghost variants)
   - `Input.tsx` (text input with label support)
   - `Card.tsx` (container with optional header)
   - `Alert.tsx` (success, error, warning, info variants)
   - `Badge.tsx` (status indicators)
   - `Spinner.tsx` (loading states)

**Deliverables:**
- Shared CSS that both apps import
- Type-safe React components for the web app
- Consistent visual language across both apps

---

### Phase 2: Authentication Integration ✅ COMPLETE

**Goal:** Connect auth pages to backend API

**Tasks:**
1. Create authentication context/provider (`/web/src/lib/auth-context.tsx`):
   - Store user state, tokens, loading states
   - Handle token refresh logic
   - Provide login/logout/register functions

2. Create API client (`/web/src/lib/api.ts`):
   - Centralized fetch wrapper with error handling
   - Automatic token attachment
   - CSRF token management
   - Response type definitions

3. Connect existing auth pages to backend:
   - `/login` - POST to `/auth/login`, store tokens, redirect to dashboard
   - `/signup` - POST to `/auth/register`, redirect to verify-email notice
   - Update `/forgot-password`, `/reset-password`, `/verify-email` (already partially connected)

4. Add protected route wrapper (`/web/src/components/ProtectedRoute.tsx`):
   - Check auth state before rendering
   - Redirect to login if unauthenticated
   - Handle loading states

5. Add session persistence:
   - Store refresh token securely
   - Implement token refresh on app load
   - Handle session expiry gracefully

**Deliverables:**
- Fully functional auth flow
- Protected routes for dashboard
- Persistent sessions across page reloads

---

### Phase 3: Dashboard Implementation ✅ MOSTLY COMPLETE

**Goal:** Replace mock data with real user data from backend

> **Note:** Auth and subscription data are live. Usage data still uses mock data pending backend `/usage/stats` endpoint.

**Tasks:**
1. Dashboard data fetching:
   - Fetch user profile from `/auth/me` or token
   - Fetch usage stats from `/usage/stats` (or similar endpoint)
   - Fetch subscription status

2. Dashboard sections:
   - **Account Overview Card**
     - Email address
     - Email verification status
     - Account creation date

   - **Subscription Status Card**
     - Current plan (Trial/Active/Expired)
     - Trial days remaining or renewal date
     - Upgrade/Manage subscription buttons

   - **Usage Statistics Card**
     - Notes generated this month
     - Notes remaining (if limited)
     - Usage history chart (stretch goal)

   - **Getting Started Guide** (for new users)
     - Install extension link
     - Quick tutorial steps
     - Link to support

3. Account settings page (`/dashboard/settings`):
   - Change password
   - Update email (with re-verification)
   - Delete account (with confirmation)

4. Connect to Stripe billing:
   - "Upgrade" button → POST `/billing/checkout` → redirect to Stripe
   - "Manage Subscription" → POST `/billing/portal` → redirect to portal

**Deliverables:**
- Dashboard with real-time data
- Subscription management
- Account settings

---

### Phase 4: Legal Pages & Compliance ✅ COMPLETE

**Goal:** Add required legal pages before launch

**Tasks:**
1. Create Privacy Policy page (`/privacy`):
   - Import content from `docs/legal/PRIVACY_POLICY_TEMPLATE.md`
   - Style consistently with site design
   - Add last updated date

2. Create Terms of Service page (`/terms`):
   - Import content from `docs/legal/TERMS_OF_SERVICE_TEMPLATE.md`
   - Style consistently with site design
   - Add effective date

3. Add legal links to:
   - Footer on all pages
   - Signup page (checkbox acknowledgment)
   - Dashboard footer

4. Cookie consent banner (if needed for analytics):
   - Simple banner component
   - Respect user preference

**Deliverables:**
- Privacy Policy page
- Terms of Service page
- Legal links throughout site

---

### Phase 5: Marketing Enhancement

**Goal:** Improve landing page conversion

**Tasks:**
1. Enhance landing page sections:
   - Social proof section (testimonials, user count)
   - Feature comparison vs manual note-writing
   - Trust indicators (HIPAA compliance badge, security messaging)
   - Better CTA placement

2. Add demo/preview section:
   - Interactive demo or video walkthrough
   - Before/after example (shorthand → full SOAP note)

3. Improve pricing page:
   - Highlight recommended plan
   - Add testimonials
   - FAQ expansion

4. SEO optimization:
   - Meta tags for all pages
   - Structured data (JSON-LD)
   - Sitemap generation

**Deliverables:**
- Enhanced marketing content
- Better conversion optimization
- SEO-ready pages

---

## Component Architecture

```
/web/src/
├── app/
│   ├── (auth)/              # Auth pages (grouped for layout)
│   │   ├── login/
│   │   ├── signup/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   ├── verify-email/
│   │   └── layout.tsx       # Shared auth layout
│   ├── (marketing)/         # Public pages
│   │   ├── page.tsx         # Landing
│   │   ├── pricing/
│   │   ├── privacy/
│   │   └── terms/
│   ├── dashboard/
│   │   ├── page.tsx         # Main dashboard
│   │   ├── settings/
│   │   └── layout.tsx       # Dashboard layout with nav
│   └── api/
│       └── webhooks/stripe/
├── components/
│   ├── ui/                  # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Alert.tsx
│   │   ├── Badge.tsx
│   │   └── Spinner.tsx
│   ├── layout/              # Layout components
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── DashboardNav.tsx
│   ├── auth/                # Auth-specific components
│   │   ├── LoginForm.tsx
│   │   ├── SignupForm.tsx
│   │   └── ProtectedRoute.tsx
│   └── dashboard/           # Dashboard-specific components
│       ├── UsageCard.tsx
│       ├── SubscriptionCard.tsx
│       └── AccountCard.tsx
├── lib/
│   ├── api.ts               # API client
│   ├── auth-context.tsx     # Auth state management
│   └── utils.ts             # Utility functions
└── types/
    └── index.ts             # Shared type definitions
```

---

## Implementation Priority

Based on ROADMAP.md blockers and launch requirements:

| Priority | Phase | Reason |
|----------|-------|--------|
| 1 | Phase 1 (Foundation) | Required for consistent UX |
| 2 | Phase 2 (Auth) | MVP-08 blocker - needed for beta |
| 3 | Phase 3 (Dashboard) | BETA-07 - users need real data |
| 4 | Phase 4 (Legal) | MVP-08/09 - legal requirement for launch |
| 5 | Phase 5 (Marketing) | Nice-to-have for launch, can iterate |

---

## Decisions Made

### 1. Auth Storage Strategy

**Decision:** Use `sessionStorage` with consideration for HTTP-only cookies in a future iteration.

**Rationale from Extension Analysis:**
The extension uses `chrome.storage.local` (encrypted at rest, isolated from web pages). For the web app, we need a different approach:

| Option | Pros | Cons | HIPAA |
|--------|------|------|-------|
| HTTP-only cookies | XSS-proof, auto-sent | Requires backend changes | Best |
| sessionStorage | Cleared on tab close, simple | XSS vulnerable if attacked | Good |
| localStorage | Persistent | XSS vulnerable, persists | Risky |

**Recommendation:** Start with `sessionStorage` (simpler, cleared on close). Plan for HTTP-only cookies as a security hardening iteration before launch if needed.

**Key patterns to port from extension:**
- 55-minute refresh buffer (before 1hr token expiry)
- CSRF token in `X-CSRF-Token` header on all state-changing requests
- `AUTH_INVALIDATED_EVENT` pattern for forced logout handling
- Token version checking for password reset invalidation

---

### 2. Route Structure

**Decision:** Adopt Next.js route groups for better organization.

```
app/
├── (auth)/              # Shared auth layout (centered, minimal)
│   ├── login/
│   ├── signup/
│   ├── forgot-password/
│   ├── reset-password/
│   ├── verify-email/
│   └── resend-verification/
├── (marketing)/         # Public pages with full header/footer
│   ├── page.tsx         # Landing
│   ├── pricing/
│   ├── privacy/
│   └── terms/
└── (dashboard)/         # Authenticated pages with dashboard nav
    ├── page.tsx         # Dashboard home
    └── settings/
```

---

### 3. Component Library Strategy

**Decision:** Share CSS classes + create thin React wrappers. No external library needed.

**Analysis from extension:**
- Extension uses **CSS class-based components** (`.btn-primary`, `.input-field`, `.card`)
- No React component library - just Tailwind + custom CSS
- Validation uses **Zod schemas** (already shared-ready)

**Implementation Plan:**

1. **Extract shared CSS** from `extension/src/sidepanel/index.css` to `shared/components.css`
2. **Create React wrappers** in `web/src/components/ui/` that apply the CSS classes
3. **Share these modules directly:**
   - `shared/schemas.ts` → Zod validation (already exists)
   - `shared/types.ts` → TypeScript interfaces (already exists)
   - Create `shared/hooks/useApi.ts` → Generic API call hook
4. **Adapt these modules:**
   - `useAuth` hook needs storage abstraction (extension uses chrome.storage, web uses sessionStorage)
   - API client needs platform-aware storage injection

**Example Component Pattern:**
```tsx
// web/src/components/ui/Button.tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  isLoading?: boolean;
}

export function Button({ variant = 'primary', isLoading, children, ...props }: ButtonProps) {
  const className = variant === 'primary' ? 'btn-primary' : 'btn-secondary';
  return (
    <button className={`${className} ${props.className}`} disabled={isLoading} {...props}>
      {isLoading ? <Spinner /> : children}
    </button>
  );
}
```

This approach:
- Ensures pixel-perfect consistency with extension
- Keeps bundle size small (no external library)
- Maintains single source of truth for styling
- Type-safe with proper React props

---

### 4. Analytics & Monitoring

**Decision:** Follow `docs/planning/MONITORING_SETUP.md` - Sentry for errors, Axiom for logs.

**HIPAA-Safe Logging Rules (from documentation):**

**Never log:**
- Patient names, DOBs, MRNs
- Note content or clinical data
- Diagnosis or treatment details

**Safe to log:**
- User ID (not email in logs)
- Timestamps
- Error types and codes
- Request paths
- Response status codes
- Duration (ms)
- Feature usage metadata

**Implementation:**
1. Add `@sentry/nextjs` to web app
2. Configure Sentry to scrub PHI from events
3. Use structured logging for debug (dev only)
4. Audit events go to backend (not client-side logging)

---

### 5. Phase Priorities

**Decision:** Run Phase 2 (Auth) and Phase 4 (Legal) in parallel.

Both are launch blockers:
- MVP-08: Connect web app auth to backend
- BETA-08/09: Privacy policy and terms pages

Legal pages are straightforward (templates exist in `docs/legal/`), while auth is more complex. Running them in parallel maximizes efficiency.

---

## Estimated Scope

- **Phase 1**: ~15 files (shared CSS + UI components)
- **Phase 2**: ~10 files (auth context, API client, page updates)
- **Phase 3**: ~12 files (dashboard components, settings page)
- **Phase 4**: ~4 files (legal pages, footer updates)
- **Phase 5**: ~5-10 files (landing page enhancements)

**Total new/modified files**: ~45-50 files
