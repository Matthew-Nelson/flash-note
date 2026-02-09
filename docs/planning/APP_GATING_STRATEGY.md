# App Gating Strategy: Beta Rollout & Clinic Management

> **Status: PLANNING**
>
> This document covers:
> 1. Gating FlashNote from closed → beta → public launch
> 2. Full clinic-level management: roles, permissions, seat lifecycle, usage dashboards
> 3. How the usage endpoint design changes for org-level reporting
> 4. How existing systems (legal acceptance, subscription middleware, audit logging) adapt

---

## Table of Contents

- [Overview](#overview)
- [Environment Strategy](#environment-strategy)
- [Registration Gating](#registration-gating)
- [Invite Code Design](#invite-code-design)
- [Data Model: All New Tables & Changes](#data-model-all-new-tables--changes)
- [Roles & Permissions](#roles--permissions)
- [Clinic Admin Capabilities](#clinic-admin-capabilities)
- [Seat Lifecycle Management](#seat-lifecycle-management)
- [Onboarding Flows](#onboarding-flows)
- [Legal Acceptance & Clinic Onboarding](#legal-acceptance--clinic-onboarding)
- [Subscription Middleware Changes](#subscription-middleware-changes)
- [Usage Endpoint Design](#usage-endpoint-design)
- [Stripe Integration for Clinic Plans](#stripe-integration-for-clinic-plans)
- [API Endpoints](#api-endpoints)
- [Audit Logging](#audit-logging)
- [Security Considerations](#security-considerations)
- [Rollout Phases](#rollout-phases)
- [Known Edge Cases & Implementation Notes](#known-edge-cases--implementation-notes)
- [What NOT to Build Yet](#what-not-to-build-yet)
- [Implementation Order](#implementation-order)

---

## Overview

FlashNote needs two related access-control mechanisms:

1. **Launch gating** - Control who can register as we move from closed to beta to public
2. **Clinic seat management** - Allow clinics to buy a multi-seat package and manage their therapists

These share a core primitive: **invite codes**. One invite code system handles both use cases. The code's `type` field determines whether it's a standalone beta invite or a clinic seat assignment.

**Key insight: a clinic IS a beta test environment.** When we onboard a clinic during beta, the clinic admin becomes our distribution channel. They manage their PTs, we manage the clinics. This reduces our direct support burden from N therapists down to 1-2 clinic admins.

---

## Environment Strategy

Two environments, not three. Beta is production with access controls, not a separate environment.

| Environment | Purpose | Backend | Web | Extension |
|-------------|---------|---------|-----|-----------|
| **Staging** | Internal QA, pre-deploy testing | Render (separate instance) | Vercel preview branch | Chrome developer mode |
| **Production** | Beta AND general availability | Render (production) | Vercel main branch | Chrome Web Store |

Each environment gets its own: PostgreSQL database, Stripe keys (test vs. live mode), Gemini API key, JWT secrets, Sentry environment tag, and `ALLOWED_ORIGINS`.

**Why not a separate beta environment?** Beta users must hit the real infrastructure to surface real issues. A separate beta env creates false confidence - you'd re-test everything on "real" prod anyway.

---

## Registration Gating

A single environment variable controls who can register:

| `REGISTRATION_MODE` | Who Can Register | When |
|---------------------|------------------|------|
| `closed` | Nobody | Pre-launch, maintenance windows |
| `invite` | Only users with a valid invite code | Beta period, clinic onboarding |
| `open` | Anyone | Public launch |

This is a single knob. No code deploys needed to transition between phases.

### Chrome Extension Distribution (Parallel Gate)

| Phase | Chrome Web Store Setting |
|-------|------------------------|
| Closed | Developer mode only (not published) |
| Beta | **Unlisted** or **Trusted Testers** (see note below) |
| Public | **Public** (discoverable in store search) |

> **Note:** Google has been restricting the "unlisted" visibility option for new Chrome Web Store submissions. If unlisted is unavailable, use the **Trusted Testers** feature instead — you add beta users' Google accounts to a tester group, and only they can install the extension. This achieves the same gating effect. Verify current CWS policies before publishing.

---

## Invite Code Design

### The Unified Model

A single `invite_codes` table serves both beta gating and clinic seat management:

```sql
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('beta', 'clinic')),
  organization_id UUID REFERENCES organizations(id),  -- NULL for beta codes
  created_by UUID REFERENCES users(id),               -- Admin who generated it
  used_by UUID REFERENCES users(id),                   -- PT who redeemed it
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

The registration form has one invite code field regardless of code type. The backend inspects the code's `type` to determine what happens next:

- **`beta`** code: User registers as an individual. Normal trial/subscription flow.
- **`clinic`** code: User registers and is auto-joined to the code's organization. No individual payment required - subscription comes from the clinic.

### Code Properties

- **Single-use**: Each code is redeemed by exactly one user (audit trail)
- **Expirable**: Codes have an `expires_at` timestamp (e.g., 30 days for clinic invites)
- **Revocable**: `is_active` can be set to `false` before redemption
- **8-character alphanumeric**: Short enough to share verbally, long enough to avoid collisions

### Code Generation

```
Format: XXXX-XXXX (e.g., "AB3K-M7RN")
Alphabet: A-Z minus O/I/L = 23 letters, plus 2-9 = 8 digits
Effective alphabet: 31 chars → 31^8 = ~852 billion combinations
```

---

## Data Model: All New Tables & Changes

### New Table: `organizations`

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  max_seats INT NOT NULL CHECK (max_seats > 0),

  -- Billing (mirrors user-level Stripe fields)
  stripe_customer_id TEXT,
  subscription_id TEXT,
  subscription_status TEXT DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'canceled', 'past_due', 'unpaid')),
  trial_ends_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### New Table: `organization_members`

```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ
);

-- Partial unique index: prevents duplicate ACTIVE memberships
-- while allowing re-addition after removal (new row with removed_at = NULL).
-- A plain UNIQUE(organization_id, user_id) would block re-adds.
CREATE UNIQUE INDEX idx_org_members_active_unique
  ON organization_members(organization_id, user_id)
  WHERE removed_at IS NULL;

CREATE INDEX idx_org_members_user ON organization_members(user_id)
  WHERE removed_at IS NULL;

CREATE INDEX idx_org_members_org ON organization_members(organization_id)
  WHERE removed_at IS NULL;
```

### New Table: `invite_codes`

(See [Invite Code Design](#invite-code-design) above for full DDL)

```sql
CREATE INDEX idx_invite_codes_code ON invite_codes(code);
CREATE INDEX idx_invite_codes_org ON invite_codes(organization_id)
  WHERE used_by IS NULL AND is_active = TRUE;
```

### Modified Table: `users`

```sql
ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id);
```

This is a denormalized convenience column. The source of truth is `organization_members`, but having `organization_id` on the user allows the subscription middleware to do a single query instead of a JOIN. It's set on join, cleared on removal.

### No Changes Needed

- **`usage`** - Already per-user, per-month. Org-level aggregation done via JOINs, no schema change.
- **`legal_acceptances`** - Already per-user. Each PT must individually accept terms (HIPAA requirement). No change.
- **`audit_logs`** - Already flexible via JSONB `metadata`. New audit actions added to the enum, but table schema unchanged.
- **`sessions`** - No change. Sessions are per-user regardless of org membership.

---

## Roles & Permissions

### Three Roles

| Role | Who | How They Get It |
|------|-----|-----------------|
| **`owner`** | The person who purchased the clinic plan | Automatically assigned at org creation |
| **`admin`** | Delegated manager (e.g., lead PT, office manager) | Promoted by owner |
| **`member`** | Therapist using the product | Joins via invite code |

### Permission Matrix

| Action | Owner | Admin | Member | Individual PT |
|--------|-------|-------|--------|---------------|
| Generate notes | Yes | Yes | Yes | Yes (own sub) |
| View own usage stats | Yes | Yes | Yes | Yes |
| View clinic usage dashboard | Yes | Yes | No | N/A |
| View per-member usage breakdown | Yes | Yes | No | N/A |
| Generate invite codes | Yes | Yes | No | N/A |
| Revoke unused invite codes | Yes | Yes | No | N/A |
| Remove members | Yes | Yes (not owner) | No | N/A |
| Promote member → admin | Yes | No | No | N/A |
| Demote admin → member | Yes | No | No | N/A |
| Manage billing (add/reduce seats) | Yes | No | No | N/A |
| Access Stripe portal | Yes | No | No | Own billing |
| View team legal compliance | Yes | Yes | No | N/A |
| Leave clinic voluntarily | No* | Yes | Yes | N/A |
| Transfer ownership | Yes | No | No | N/A |

*Owner cannot leave without transferring ownership first.

### Why Three Roles (Not Two)

The `admin` role exists for a common real-world scenario: the clinic **owner** (practice manager, business owner) purchases the plan but delegates day-to-day management to a **lead PT** or **office manager**. The admin can handle team management without access to billing.

Without this, the owner would have to handle every invite code generation and member removal personally, which doesn't scale even for a 5-person clinic.

---

## Clinic Admin Capabilities

### 1. Team Dashboard (`/dashboard/team`)

What admins and owners see:

```
┌─────────────────────────────────────────────────┐
│ Acme Physical Therapy              5 of 8 seats │
│ Plan: Clinic (8 seats) · Active                 │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ [Generate Invite Code]  [Manage Billing*]   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Team Members                                    │
│ ┌─────────────────────────────────────────────┐ │
│ │ Sarah Johnson (you)      Owner   12 notes  ↗│ │
│ │ Mike Chen                Admin    8 notes  ✕│ │
│ │ Lisa Park                Member  22 notes  ✕│ │
│ │ James Wilson             Member  15 notes  ✕│ │
│ │ Emily Rodriguez          Member   3 notes  ✕│ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Pending Invites                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ AB3K-M7RN  Created Feb 5  Expires Mar 7  ✕ │ │
│ │ QW9P-2XKL  Created Feb 8  Expires Mar 10 ✕ │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ * Billing management visible to owner only      │
└─────────────────────────────────────────────────┘
```

### 2. Invite Code Generation

- Click "Generate Invite Code" → backend checks `active_seats < max_seats`
- Returns a code like `AB3K-M7RN` with a copy button
- Admin shares the code however they want (email, text, Slack, sticky note)
- Admin can see all pending (unused) codes and revoke them
- We do NOT send invite emails - this avoids collecting non-user PII

### 3. Member Removal

- Click the `✕` next to a member's name
- Confirmation dialog: "Remove [Name] from Acme Physical Therapy? They will lose access to FlashNote under this clinic's plan."
- Backend: sets `organization_members.removed_at = NOW()`, clears `users.organization_id`
- **Immediate revocation**: increments the removed user's `token_version` and deletes their sessions, using the existing infrastructure in `auth-service.ts`
- Seat is freed instantly for reuse

### 4. Role Management (Owner Only)

- Owner can promote a member to admin or demote an admin to member
- Simple role update on `organization_members`
- Logged to audit trail

### 5. Billing Management (Owner Only)

- "Manage Billing" opens the Stripe customer portal (same pattern as individual billing)
- Owner can add seats (updates Stripe subscription quantity → webhook updates `max_seats`)
- Owner can reduce seats (only if `active_seats <= new_max_seats`)

### 6. Legal Compliance View

- Admin/owner can see which team members have accepted the current legal document versions
- Surfaces members who registered under an older ToS/BAA version (when we bump `LEGAL_DOCUMENT_VERSIONS`)
- Does NOT show the acceptance details (IP, user agent) - that's audit-level data, not admin data

---

## Seat Lifecycle Management

### States

```
                 ┌─────────────┐
    Invite code  │   INVITED   │  Code generated, not yet redeemed
    generated    │  (pending)  │
                 └──────┬──────┘
                        │ PT redeems code + registers
                        ▼
                 ┌─────────────┐
                 │   ACTIVE    │  Seat occupied, PT using product
                 │             │
                 └──────┬──────┘
                        │
              ┌─────────┼─────────┐
              │                   │
     Admin removes PT      PT leaves voluntarily
              │                   │
              ▼                   ▼
       ┌─────────────┐    ┌─────────────┐
       │   REMOVED   │    │    LEFT     │
       │ (by admin)  │    │(voluntarily)│
       └─────────────┘    └─────────────┘
              │                   │
              └─────────┬─────────┘
                        │
                   Seat freed
                  (can be reused)
```

### Seat Counting

```sql
-- Active seats (occupied)
SELECT COUNT(*) FROM organization_members
WHERE organization_id = $1 AND removed_at IS NULL;

-- Pending invites (codes generated but not yet redeemed)
SELECT COUNT(*) FROM invite_codes
WHERE organization_id = $1 AND used_by IS NULL AND is_active = TRUE AND expires_at > NOW();

-- Available seats
available = max_seats - active_seats
-- Note: pending invites do NOT reserve seats. If the code expires unused, no seat was wasted.
-- If two codes are out and only one seat remains, the first to register gets it. The second
-- code fails at redemption time ("no seats available").
```

**Design decision: pending invites don't reserve seats.** This avoids "phantom seat" problems where an admin generates codes that never get used, blocking the org from reaching capacity. The tradeoff is that two simultaneous redemptions could race for the last seat. The loser gets a clear error: "This clinic has no available seats. Contact your clinic administrator."

**Concurrency control for seat allocation:** The registration transaction must use `SELECT ... FOR UPDATE` on the `organizations` row to serialize concurrent seat claims. Without this, two simultaneous registrations could both read `active_seats = 4, max_seats = 5`, both proceed, and end up with 6 active seats. The implementation:

```sql
BEGIN;
  -- Lock the org row to prevent concurrent over-allocation
  SELECT max_seats FROM organizations WHERE id = $1 FOR UPDATE;

  -- Count active seats (safe because org row is locked)
  SELECT COUNT(*) AS active_seats FROM organization_members
  WHERE organization_id = $1 AND removed_at IS NULL;

  -- If active_seats < max_seats → proceed with INSERT into organization_members
  -- Otherwise → ROLLBACK and return "no seats available"
COMMIT;
```

### What Happens to Removed Members

1. `organization_members.removed_at` set to `NOW()`
2. `users.organization_id` cleared to `NULL`
3. `users.token_version` incremented (instantly invalidates all JWTs)
4. All rows in `sessions` for this user deleted (kills refresh tokens)
5. User account persists (email, password, audit trail all intact)
6. User's next action: sees 402 `subscription_required`
7. User can: subscribe individually, or accept an invite to another clinic

### Re-adding a Previously Removed Member

If a PT was removed but needs to come back:
1. Admin generates a new invite code
2. PT uses it to re-join
3. Since the user already exists, the registration flow detects the existing account
4. Instead of creating a new user, the PT logs in and "redeems" the code from a dedicated join flow
5. New `organization_members` row created (the old one with `removed_at` stays for audit trail)

This is a future flow - for v1, the PT would need to contact support or the admin could re-add them via a direct "Add existing user" feature.

---

## Onboarding Flows

### Flow 1: Individual PT (Beta)

```
1. PT receives beta invite code (email, social media, etc.)
2. Visits web app → registration page shows invite code field
3. Enters code + email + password + accepts legal terms → backend:
   a. Validates code (exists, active, not expired, not used)
   b. type = 'beta' → create user in transaction:
      - Create user
      - Record legal acceptances (BAA, ToS, Privacy Policy)
      - Mark invite code as used
   c. Send verification email
4. PT gets 14-day trial → standard subscription flow
5. Installs Chrome extension → logs in → uses product
```

### Flow 2: Clinic Admin Purchases Plan

```
1. Admin signs up as individual (with beta code or after open registration)
2. Visits pricing page → selects "Clinic Plan" (e.g., 5 seats)
3. Enters clinic name during checkout flow
4. Stripe checkout with seat quantity selector
5. Webhook fires → backend (in transaction):
   a. Create organization (name, max_seats = quantity from Stripe)
   b. Link Stripe subscription to organization
   c. Create organization_member (role = 'owner')
   d. Set users.organization_id
   e. Audit log: ORG_CREATED
6. Admin returns to dashboard → "Team" tab now visible
7. Individual subscription (if any) remains for billing continuity,
   but the owner's access now comes from the org subscription
```

### Flow 3: Clinic Admin Invites a PT

```
1. Admin opens Team page → sees seat usage (e.g., "2 of 5 seats used")
2. Clicks "Generate Invite Code"
   - Backend checks: active_seats < max_seats
   - Creates invite_code with type = 'clinic', organization_id set
   - Returns code (e.g., "AB3K-M7RN") with copy button
3. Admin shares code with PT however they prefer
4. PT visits web app → enters clinic code → registers:
   a. Backend validates code, sees type = 'clinic'
   b. Checks seat availability (active_seats < max_seats)
   c. In transaction:
      - Create user
      - Record legal acceptances (PT must accept individually - HIPAA)
      - Create organization_member (role = 'member')
      - Set users.organization_id
      - Mark invite code as used
   d. Send verification email
5. PT does NOT need to pay - org subscription covers access
6. Installs extension → logs in → subscription check passes via org
```

### Flow 4: Clinic Admin Removes a PT

```
1. Admin opens Team page → clicks "Remove" on a therapist
2. Confirmation dialog with therapist name
3. Backend (in transaction):
   a. Set organization_members.removed_at = NOW()
   b. Clear users.organization_id = NULL
   c. Increment users.token_version (immediate JWT invalidation)
   d. Delete all sessions for this user
   e. Audit log: ORG_MEMBER_REMOVED
4. Seat freed immediately
5. Removed PT experiences:
   - Current browser/extension session fails on next API call
   - Sees: "Your clinic access has ended. Subscribe individually to continue."
   - Can purchase individual plan at any time
```

### Flow 5: PT Leaves Voluntarily

```
1. PT opens Settings → sees "Clinic: Acme Physical Therapy"
2. Clicks "Leave Clinic" → confirmation dialog
3. Backend:
   a. Validates user is not the owner (owners must transfer first)
   b. Set organization_members.removed_at = NOW()
   c. Clear users.organization_id = NULL
   d. Audit log: ORG_MEMBER_LEFT
4. Seat freed for the clinic
5. PT's access immediately changes to individual subscription check
   - If they have no individual sub → 402
   - They can subscribe individually
```

---

## Legal Acceptance & Clinic Onboarding

### Why Every PT Must Individually Accept Terms

HIPAA requires that each individual who accesses PHI through the system has personally acknowledged the BAA and privacy obligations. A clinic admin cannot accept on behalf of their therapists.

**Current system (already built):**
- Registration requires `acceptedLegalTerms: true`
- Backend atomically records acceptance of BAA v1.0, ToS v1.0, Privacy Policy v1.0 in `legal_acceptances` table
- Each record includes IP address and user agent for audit trail

**What changes for clinic members: Nothing.** The same legal acceptance flow fires whether the user registered with a beta code or a clinic code. The invite code type only affects subscription/billing, not legal consent.

### Clinic-Level BAA

In addition to individual PT acceptance, the **clinic itself** (as a Covered Entity) may want to sign a separate BAA with FlashNote. This is a business/legal process, not a software feature:

- We already have `docs/legal/BAA_TEMPLATE.md` for this
- Clinic admin downloads/signs the BAA during sales process
- Stored in our business records (not in the database)
- The `legal_acceptances` table tracks individual user consent, not entity-level agreements

### Admin Compliance View

Admins can view which team members have accepted current document versions:

```sql
-- For each org member, get their latest acceptance per document type.
-- Uses DISTINCT ON to pick the most recent acceptance per (user, document_type).
SELECT
  u.id, u.email,
  la.document_type, la.document_version, la.accepted_at
FROM organization_members om
JOIN users u ON u.id = om.user_id
LEFT JOIN LATERAL (
  SELECT DISTINCT ON (document_type)
    document_type, document_version, accepted_at
  FROM legal_acceptances
  WHERE user_id = u.id
  ORDER BY document_type, accepted_at DESC
) la ON true
WHERE om.organization_id = $1 AND om.removed_at IS NULL;
```

This surfaces: "Mike Chen accepted BAA v1.0 on Feb 3, but we're now on v1.1" — useful when we update terms and need re-acceptance.

---

## Subscription Middleware Changes

### Current Flow (`requireActiveSubscription`)

```
1. Get user's subscription_status and trial_ends_at from users table
2. If 'trialing' and trial not expired → allow
3. If 'active' → allow
4. Otherwise → 402
```

### New Flow

```
1. Get user's subscription_status, trial_ends_at, AND organization_id from users table
   (single query, no extra round trip since organization_id is on the users table)
2. If user has active/trialing individual subscription → allow
3. If user has organization_id set:
   a. Query organizations table for subscription_status
   b. If org subscription is 'active' → allow
   c. If org subscription is 'trialing' and trial not expired → allow
4. Otherwise → 402 with appropriate error code:
   - 'trial_expired' if individual trial ran out
   - 'subscription_required' if no subscription at all
   - 'clinic_subscription_expired' if org sub lapsed (new code)
```

```typescript
// Step 3 pseudocode - only runs if user has org_id but no individual sub.
// IMPORTANT: Verify active membership, not just the presence of organization_id.
// If the removal transaction partially failed (set removed_at but didn't clear
// organization_id), this JOIN prevents the user from retaining access.
const orgResult = await db.query<OrgSubscriptionRow>(
  `SELECT o.subscription_status, o.trial_ends_at
   FROM organizations o
   JOIN organization_members om ON om.organization_id = o.id
   WHERE o.id = $1 AND om.user_id = $2 AND om.removed_at IS NULL`,
  [user.organization_id, user.userId]
);

if (orgResult.rows.length > 0) {
  const org = orgResult.rows[0]!;
  if (org.subscription_status === 'active') { next(); return; }
  if (org.subscription_status === 'trialing' && new Date() < org.trial_ends_at) {
    next(); return;
  }
}
```

**Performance note:** The denormalized `users.organization_id` means we already have the org ID from the first query. The second query joins `organizations` (PK lookup) with `organization_members` (covered by `idx_org_members_active_unique`) — effectively free. The JOIN on `organization_members` is the defense-in-depth check that `organization_id` wasn't left stale.

---

## Usage Endpoint Design

### Current State

- `usageService.incrementUsage(userId, tokensUsed)` called after note generation (works, non-blocking)
- `usageService.getMonthlyUsage(userId)` returns `{notesGenerated, tokensUsed}`
- **No API endpoint exists** - dashboard shows hardcoded mock data

### New Endpoints

#### `GET /usage/me` - Individual Usage Stats

For any authenticated user (individual or org member). Returns their personal usage.

```typescript
// Response
{
  success: true,
  data: {
    currentMonth: "2026-02",
    notesGenerated: 42,
    tokensUsed: 18500,
    // Include org context if applicable
    organization: {                   // null for individual users
      name: "Acme Physical Therapy",
      role: "member"
    }
  }
}
```

**Implementation:** Calls existing `usageService.getMonthlyUsage(userId)`, adds org context from `users.organization_id` JOIN.

#### `GET /organization/usage` - Clinic Usage Dashboard (Admin/Owner Only)

Aggregated clinic-level usage. This is the admin dashboard data.

```typescript
// Response
{
  success: true,
  data: {
    organization: {
      name: "Acme Physical Therapy",
      maxSeats: 8,
      activeSeats: 5,
      subscriptionStatus: "active"
    },
    currentMonth: "2026-02",
    totals: {
      notesGenerated: 87,
      tokensUsed: 42000
    },
    members: [
      {
        userId: "uuid",
        email: "sarah@clinic.com",
        role: "owner",
        joinedAt: "2026-01-15T...",
        usage: { notesGenerated: 12, tokensUsed: 5200 }
      },
      {
        userId: "uuid",
        email: "mike@clinic.com",
        role: "admin",
        joinedAt: "2026-01-20T...",
        usage: { notesGenerated: 8, tokensUsed: 3800 }
      },
      {
        userId: "uuid",
        email: "lisa@clinic.com",
        role: "member",
        joinedAt: "2026-02-01T...",
        usage: { notesGenerated: 22, tokensUsed: 10100 }
      }
      // ...
    ],
    pendingInvites: 2
  }
}
```

**Implementation:**

```sql
-- Aggregated org usage for current month
SELECT
  u.id AS user_id,
  u.email,
  om.role,
  om.joined_at,
  COALESCE(us.notes_generated, 0) AS notes_generated,
  COALESCE(us.tokens_used, 0) AS tokens_used
FROM organization_members om
JOIN users u ON u.id = om.user_id
LEFT JOIN usage us ON us.user_id = om.user_id AND us.month = $2
WHERE om.organization_id = $1 AND om.removed_at IS NULL
ORDER BY om.role ASC, us.notes_generated DESC NULLS LAST;
```

#### `GET /organization/usage/history` - Month-over-Month (Future)

For trend charts. Returns last N months of aggregated org usage. Not needed for v1 but the schema supports it since `usage` already has per-month rows.

### Usage Service Changes

The existing `UsageService` class needs two new methods:

```typescript
// New method: Org-level aggregated usage
async getOrganizationUsage(organizationId: string): Promise<OrgUsageStats>

// New method: Org usage per member
async getOrganizationMemberUsage(organizationId: string): Promise<MemberUsageStats[]>
```

No changes to `incrementUsage()` - it already tracks per-user, which is the right granularity. Org-level numbers are derived via aggregation, not stored separately. This avoids dual-write consistency issues.

---

## Stripe Integration for Clinic Plans

### Product Structure

| Product | Price | Model |
|---------|-------|-------|
| FlashNote Individual | $30/mo or $288/yr | Per-user subscription |
| FlashNote Clinic | $25/seat/mo | Quantity-based subscription |

Stripe handles quantity-based billing natively. The per-seat discount incentivizes clinic plans over individual purchases.

### New Environment Variables

```
STRIPE_PRICE_CLINIC_MONTHLY=price_xxx   # Clinic per-seat monthly price
```

Added to `config.ts` env schema:
```typescript
STRIPE_PRICE_CLINIC_MONTHLY: z.string().optional(),
```

### Checkout Flow Changes

The existing `/billing/checkout` endpoint gets a new `plan` parameter:

```typescript
// Existing: individual checkout
POST /billing/checkout
{ priceId: "price_monthly_xxx" }

// New: clinic checkout
POST /billing/checkout
{ priceId: "price_clinic_monthly_xxx", quantity: 5, clinicName: "Acme PT" }
```

The webhook handler for `checkout.session.completed` checks whether the price is a clinic plan and, if so, creates the organization.

**Webhook disambiguation:** The current webhook handler correlates events via `metadata.userId` on the subscription. Clinic subscriptions must use a different correlation path. During clinic checkout, set `subscription_data.metadata.organizationId` (or `userId` + `planType: 'clinic'`). The webhook handler then branches:

```typescript
// In checkout.session.completed handler:
const sub = await stripe.subscriptions.retrieve(session.subscription);
if (sub.metadata.planType === 'clinic') {
  // Create org, assign owner — correlate via sub.metadata.userId
} else {
  // Existing individual flow — update users table
}

// In customer.subscription.updated handler:
if (sub.metadata.organizationId) {
  // Update organizations.subscription_status + sync max_seats from sub.items.data[0].quantity
} else {
  // Existing individual flow — update users.subscription_status
}
```

### Webhook Event Handling

| Event | Individual | Clinic |
|-------|-----------|--------|
| `checkout.session.completed` | Update user subscription | Create org + assign owner |
| `customer.subscription.updated` | Update `users.subscription_status` | Update `organizations.subscription_status` + sync `max_seats` with quantity |
| `customer.subscription.deleted` | Set user status to `canceled` | Set org status to `canceled` (all members lose access) |
| `invoice.payment_failed` | Set user status to `past_due` | Set org status to `past_due`, all members affected |

### Seat Changes via Stripe

When admin adds seats:
1. Admin clicks "Add Seats" → selects new total
2. Backend calls Stripe: update subscription quantity
3. Stripe webhook fires `customer.subscription.updated` with new quantity
4. Backend updates `organizations.max_seats` from the webhook (single source of truth)

When admin reduces seats:
1. Backend validates `active_seats <= requested_new_max` before calling Stripe
2. If valid, updates Stripe subscription quantity
3. Webhook syncs `organizations.max_seats`

**Stripe is the source of truth for `max_seats`.** The backend never sets `max_seats` directly - it always flows through Stripe webhooks. This prevents billing/access desync.

---

## API Endpoints

### Registration Change

```
POST /auth/register
  Body: { email, password, acceptedLegalTerms: true, inviteCode? }
  - If REGISTRATION_MODE=closed → 403 "registration_closed"
  - If REGISTRATION_MODE=invite → inviteCode required, 400 if missing
  - If REGISTRATION_MODE=open → inviteCode optional (for clinic codes)
  - If code type=clinic → auto-join org, no trial needed
  - If code type=beta or no code → normal trial flow
```

### Usage Endpoints

```
GET /usage/me                      Own usage stats (any authenticated user)
```

### Organization Endpoints

```
GET    /organization                Org details + seat count (any org member)
GET    /organization/usage          Org usage dashboard (owner/admin only)
GET    /organization/members        List active members (owner/admin only)
DELETE /organization/members/:id    Remove a member (owner/admin only, not self, not owner)
PATCH  /organization/members/:id    Change role (owner only)
POST   /organization/leave          Leave org (admin/member only, not owner)
POST   /organization/transfer       Transfer ownership (owner only)
```

### Invite Code Endpoints

```
POST   /organization/invites           Generate invite code (owner/admin, checks seat limit)
GET    /organization/invites           List pending invite codes (owner/admin)
DELETE /organization/invites/:id       Revoke an unused invite code (owner/admin)
POST   /invite-codes/validate          Check if a code is valid (public, pre-registration)
```

### Middleware Stack for Org Endpoints

```
Organization read endpoints:
  requireAuth → requireCsrf → requireOrgMembership

Organization admin endpoints:
  requireAuth → requireCsrf → requireOrgRole(['owner', 'admin'])

Organization owner endpoints:
  requireAuth → requireCsrf → requireOrgRole(['owner'])
```

New middleware:

- **`requireOrgMembership`**: Checks `users.organization_id` is set and membership is active
- **`requireOrgRole(roles)`**: Checks `organization_members.role` is in the allowed list

---

## Audit Logging

### New Audit Actions

Add to `AuditAction` enum in `types/index.ts`:

```typescript
// Organization lifecycle
ORG_CREATED = 'ORG_CREATED',
ORG_SUBSCRIPTION_CHANGED = 'ORG_SUBSCRIPTION_CHANGED',

// Membership changes
ORG_MEMBER_INVITED = 'ORG_MEMBER_INVITED',         // Invite code generated
ORG_MEMBER_JOINED = 'ORG_MEMBER_JOINED',           // Code redeemed, member added
ORG_MEMBER_REMOVED = 'ORG_MEMBER_REMOVED',         // Admin removed a member
ORG_MEMBER_LEFT = 'ORG_MEMBER_LEFT',               // Member left voluntarily
ORG_MEMBER_ROLE_CHANGED = 'ORG_MEMBER_ROLE_CHANGED',
ORG_OWNERSHIP_TRANSFERRED = 'ORG_OWNERSHIP_TRANSFERRED',

// Invite code lifecycle
INVITE_CODE_GENERATED = 'INVITE_CODE_GENERATED',
INVITE_CODE_REDEEMED = 'INVITE_CODE_REDEEMED',
INVITE_CODE_REVOKED = 'INVITE_CODE_REVOKED',
```

### What Gets Logged (and What Doesn't)

| Action | Logged Metadata | NOT Logged |
|--------|----------------|------------|
| Invite code generated | userId, orgId, codeId, type, expiresAt | The code value itself |
| Code redeemed | newUserId, orgId, codeId | The code value |
| Member removed | adminUserId, removedUserId, orgId, reason | |
| Member left | userId, orgId | |
| Org created | ownerUserId, orgId, maxSeats, clinicName | |
| Org sub changed | orgId, oldStatus, newStatus | |
| Role changed | adminUserId, targetUserId, orgId, oldRole, newRole | |
| Ownership transferred | oldOwnerId, newOwnerId, orgId | |

**Never log invite code values** - they are credentials. Log the `codeId` (UUID) for cross-referencing.

---

## Security Considerations

### 1. Invite Code Brute Force

Rate-limit the `/invite-codes/validate` and `/auth/register` endpoints. The existing rate limits cover registration (3/hour in prod). Add a dedicated rate limit for code validation: 10/minute per IP.

### 2. Privilege Escalation

All org management endpoints validate role server-side. The `requireOrgRole` middleware checks `organization_members.role` on every request - never trust client-side role claims. The role check queries the DB, not the JWT (JWTs don't carry role info).

### 3. Immediate Access Revocation

When a member is removed:
1. `users.token_version` incremented → all existing JWTs fail on next use (checked in `requireAuth` middleware, already built)
2. All `sessions` rows deleted → refresh tokens destroyed
3. `users.organization_id` cleared → subscription middleware check fails

This means a removed member is locked out within seconds, not hours. The infrastructure for this is already in place in `auth-service.ts` and `auth.ts` middleware.

### 4. Cross-Org Data Isolation

- Usage data is per-user, not per-org. Org aggregation happens via JOINs scoped to `organization_id`.
- A user can only be in one org at a time (`users.organization_id` is singular).
- Org endpoints always scope queries to the authenticated user's `organization_id`.
- No endpoint accepts an `organization_id` parameter - it's always derived from the authenticated user's membership.

### 5. Owner Account Security

The owner account is the highest-privilege role and controls billing. Additional protections:
- Ownership transfer requires re-authentication (password confirmation)
- Owner cannot be removed by admins
- Owner cannot leave without transferring first
- If the owner account is compromised, the lockout system (5 failed attempts → 15 min lock) still applies

### 6. Org Deletion

**Not supported.** Canceling the subscription sets `subscription_status = 'canceled'` but preserves all records. The org, membership history, and audit trail are retained indefinitely (HIPAA audit requirement). If needed in the future, implement soft-delete with a retention period.

---

## Rollout Phases

### Phase 1: Closed (Current → Pre-Beta)
- `REGISTRATION_MODE=closed`
- Staging environment only
- Extension in Chrome developer mode
- Internal testing and bug fixes
- Complete HIPAA critical path items
- **Build:** `REGISTRATION_MODE` support, invite code table, `/usage/me` endpoint

### Phase 2: Beta - Individual PTs (5-10 PTs)
- `REGISTRATION_MODE=invite`
- Production infrastructure live (HIPAA BAA signed)
- Generate `beta` invite codes, share directly with PTs
- Extension published as **unlisted** on Chrome Web Store
- **Individual subscriptions only** (no clinic plans yet)
- Monitor Sentry, collect feedback, watch usage patterns
- Dashboard shows real usage data via `/usage/me`

### Phase 3: Beta - Clinic Pilot (1-2 Clinics)
- Still `REGISTRATION_MODE=invite`
- **Build:** organizations, org_members, clinic checkout, team dashboard, org usage endpoint
- Onboard 1-2 clinics with direct support
- Clinic admin purchases plan → generates invite codes for PTs
- Validate full seat management lifecycle end-to-end
- Watch for: seat counting edge cases, removed-member UX, usage reporting accuracy

### Phase 4: Public Launch
- `REGISTRATION_MODE=open`
- Extension republished as **public**
- Both individual and clinic plans on pricing page
- Invite code field optional on registration (only for clinic codes)
- Self-serve clinic signup

---

## Platform Operations: How You (the App Owner) Oversee Everything

This section addresses a fundamentally different question from the clinic admin dashboard above. Clinic admins manage *their team*. You need to manage *the entire platform* -- all users, all clinics, all billing, all compliance. These are two completely separate concerns with different tools.

### The Core Principle: Don't Build an Admin Panel

**Building a custom admin dashboard inside FlashNote is a trap.** It sounds appealing ("god mode!") but it's a massive surface area to build, secure, and maintain -- and better tools already exist for every single thing you'd put in it.

Here's why:

1. **Security liability**: An in-app super-admin account is a single point of compromise. If that account is breached, the attacker has access to everything through a purpose-built UI. This is categorically worse than compromising a database credential (which is scoped and audited at the infrastructure level).

2. **HIPAA scope creep**: Every admin feature you build that touches user data needs the same PHI sanitization, audit logging, and access control as the rest of the app. You'd be doubling your compliance surface area.

3. **Opportunity cost**: Every hour building admin tooling is an hour not spent on the product PTs are paying for. At your stage, this is the wrong tradeoff.

4. **Purpose-built tools are better**: Stripe's dashboard is better at billing management than anything you'd build. Sentry is better at error tracking. Axiom is better at log analysis. PostgreSQL queries are more flexible than any admin UI.

### What You Actually Need (and Where to Get It)

#### Layer 1: Business Metrics (Stripe Dashboard)

This is your primary business operations view. Stripe already gives you:

| What You Need | Where You Get It |
|---------------|-----------------|
| MRR, ARR, revenue trends | Stripe Dashboard → Revenue |
| Active subscriptions by plan | Stripe Dashboard → Subscriptions |
| Churn rate | Stripe Dashboard → Revenue → Churn |
| Failed payments and retries | Stripe Dashboard → Payments → Failed |
| Individual customer details | Stripe Dashboard → Customers → Search |
| Refund management | Stripe Dashboard → Payments → Refund |
| Clinic plan seat counts | Stripe Dashboard → Subscriptions → Quantity |
| Invoice history | Stripe Dashboard → Invoices |

**You're already paying Stripe 2.9% + $0.30 per transaction. Use their dashboard -- it's world-class.**

For your revenue target of $3K/mo MRR (100 users at $30/mo), the Stripe dashboard tells you exactly where you stand without writing a line of code.

#### Layer 2: Error Visibility (Sentry)

Already implemented across all three components. This is your "is the product working?" view.

| What You Need | Where You Get It |
|---------------|-----------------|
| Are there production errors? | Sentry → Issues (already configured) |
| Which users are affected? | Sentry → Issue → Tags → userId |
| Is it getting worse? | Sentry → Issue → Frequency graph |
| Did a deploy break something? | Sentry → Releases (configure in CI) |
| What's the stack trace? | Sentry → Issue → Event detail |

You already have PHI-safe `beforeSend` hooks on all three components. Sentry is ready to use as-is.

#### Layer 3: Operational Logs (Axiom)

This is the piece you're missing. Axiom fills the gap between "Sentry shows errors" and "I need to understand what's happening in the system."

**What Axiom gives you that Sentry doesn't:**

| Concern | Sentry | Axiom |
|---------|--------|-------|
| Errors and exceptions | Yes | Also, but Sentry is better |
| Request volume and latency | No | Yes -- how many notes/day, P95 response time |
| User activity patterns | No | Yes -- who's active, who churned, peak usage times |
| Audit log queries | No | Yes -- "show me all logins for user X this week" |
| Business dashboards | No | Yes -- "notes generated per clinic per month" |
| Security anomaly detection | Partial | Yes -- "show me all failed logins from this IP range" |
| Webhook delivery monitoring | No | Yes -- "are Stripe webhooks processing successfully?" |

**Axiom setup is already spec'd in your MONITORING_SETUP.md** (winston + @axiomhq/winston transport). The free tier gives you 500GB/month which is more than enough.

**What to log to Axiom (HIPAA-safe):**

```typescript
// Every API request (in middleware)
logger.info('api_request', {
  method: req.method,
  path: req.path,
  statusCode: res.statusCode,
  durationMs: elapsed,
  userId: req.user?.userId,   // Safe: just a UUID
  orgId: req.user?.orgId,     // Safe: just a UUID
});

// Note generation events (already tracked, just pipe to Axiom)
logger.info('note_generated', {
  userId, noteType, durationMs, tokensUsed, model, success: true
});

// Auth events (already in audit_logs, mirror to Axiom for querying)
logger.info('auth_event', {
  action: 'LOGIN', userId, success: true
});
```

**What Axiom is NOT:** It's not a replacement for your PostgreSQL `audit_logs` table. Audit logs are your HIPAA-mandated source of truth (6-year retention, immutability). Axiom is for operational queries -- "what happened in the last 2 hours" not "prove to an auditor what happened 3 years ago."

#### Layer 4: Uptime (UptimeRobot)

Already planned in MONITORING_SETUP.md. Free tier, 5-minute intervals, alerts via email/Slack.

#### Splunk, Datadog, etc.?

**No. Not at your scale.** Splunk starts at ~$1,800/year. Datadog starts at ~$15/host/month and grows fast. These are enterprise tools for teams with dedicated SRE staff. Axiom's free tier does everything you need for the next 12-18 months. Revisit when you're past $10K MRR and have operational complexity that warrants the cost.

### How You Manage Users and Clinics Day-to-Day

**Use direct database queries + Stripe dashboard, not an admin panel.**

```bash
# How many users do I have?
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# Who signed up this week?
psql $DATABASE_URL -c "
  SELECT id, email, subscription_status, created_at
  FROM users WHERE created_at > NOW() - INTERVAL '7 days'
  ORDER BY created_at DESC;"

# How many notes were generated this month?
psql $DATABASE_URL -c "
  SELECT SUM(notes_generated) as total_notes, COUNT(DISTINCT user_id) as active_users
  FROM usage WHERE month = '2026-02';"

# Which clinics exist and how many seats are used?
psql $DATABASE_URL -c "
  SELECT o.name, o.max_seats, o.subscription_status,
    COUNT(om.id) FILTER (WHERE om.removed_at IS NULL) as active_members
  FROM organizations o
  LEFT JOIN organization_members om ON om.organization_id = o.id
  GROUP BY o.id ORDER BY o.created_at DESC;"

# What did user X do recently? (audit trail)
psql $DATABASE_URL -c "
  SELECT action, status, metadata, created_at
  FROM audit_logs WHERE user_id = 'uuid-here'
  ORDER BY created_at DESC LIMIT 20;"
```

At 5-50 clinics, this is faster than any admin UI and infinitely more flexible. When you're running these queries daily and getting annoyed, *that's* when you consider automation -- but likely through Axiom dashboards, not custom code.

### Onboarding a Clinic: Self-Serve vs. High-Touch

#### Phase 3 (Beta - 1-2 Clinics): High-Touch Onboarding

At this stage, you onboard clinics personally. The process:

1. **Sales conversation** -- you talk to the clinic owner/manager
2. **Clinic-level BAA** -- they sign your BAA template (PDF/DocuSign, stored in business records)
3. **You create beta invite codes** -- via CLI script or direct DB insert:
   ```bash
   # Generate a beta code for the clinic admin
   node scripts/generate-invite-code.js --type=beta --expires=30d
   ```
4. **Clinic admin registers** -- uses the beta code, gets an account
5. **Clinic admin purchases plan** -- Stripe checkout creates the org automatically
6. **Clinic admin generates invite codes for PTs** -- self-serve from the Team dashboard
7. **PTs register and start using** -- each accepts legal terms individually

Steps 5-7 are fully self-serve. You're only involved in 1-4, and only because you want direct feedback during beta.

#### Phase 4 (Public Launch): Self-Serve Onboarding

The entire flow becomes self-serve:

1. Clinic admin visits pricing page → selects "Clinic Plan"
2. Enters clinic name + seat count during checkout
3. Stripe checkout → webhook creates org → admin becomes owner
4. Admin generates invite codes from Team dashboard
5. PTs register with codes

**The clinic-level BAA is the one part that's hard to fully automate.** Options:

| Approach | Effort | When |
|----------|--------|------|
| Manual (email PDF, DocuSign) | Zero code | Beta, up to ~20 clinics |
| Clickwrap in checkout flow ("I represent [Clinic] and accept the BAA") | Medium | When manual becomes a bottleneck |
| Full e-signature integration (DocuSign API, PandaDoc) | High | Enterprise, $50K+ deals |

For now, manual is fine. The individual per-user legal acceptance (already built) covers the HIPAA requirement for individual users. The entity-level BAA is a business agreement, not a per-click obligation.

### What You Should Build (and When)

| Tool | When | Why |
|------|------|-----|
| CLI script: `generate-invite-code.js` | Wave 1 (now) | You need this to create beta codes |
| Axiom integration (winston transport) | Before beta launch | Operational visibility |
| UptimeRobot monitors | Before beta launch | Know when things are down |
| Axiom dashboard: "FlashNote Overview" | First month of beta | Business metrics at a glance |
| CLI script: `manage-user.js` (disable, reset) | When you need it | Ad-hoc user management |
| Internal Retool/Metabase dashboard | $10K+ MRR | When psql queries feel slow |

### Your Daily Operations Workflow (Beta)

```
Morning:
  1. Open Stripe Dashboard → check revenue, failed payments
  2. Open Sentry → check for new errors, triage
  3. Open Axiom → glance at notes generated, active users
  4. Open UptimeRobot → confirm everything's green

When a support request comes in:
  1. Get user email → look up in Stripe Dashboard (billing)
  2. Get userId → search in Sentry (errors they've hit)
  3. Get userId → query audit_logs in psql (what they did)
  4. Get userId → query Axiom (recent activity)

When onboarding a new clinic:
  1. Sales conversation → agree on plan/seats
  2. Generate invite code → share with clinic admin
  3. Monitor their first week in Axiom → proactive support
```

---

## Known Edge Cases & Implementation Notes

Issues identified during planning review that must be addressed during implementation.

### 1. Removed Member Usage Disappears from Org Dashboard

The org usage query (in [Usage Endpoint Design](#usage-endpoint-design)) filters `WHERE om.removed_at IS NULL`. This means if a PT generated 50 notes before being removed mid-month, those notes vanish from the org's usage totals — misleading for billing reconciliation.

**Resolution:** The org usage query should include members who were active during the queried month, not just currently active members. Either:
- **Option A (recommended):** Always include removed members in the usage response with a `removedAt` field, so the dashboard can display them separately (e.g., "Former members: 50 notes"). This preserves billing accuracy.
- **Option B:** Use `WHERE om.removed_at IS NULL OR (om.removed_at >= date_trunc('month', NOW()))` to include members removed during the current month.

### 2. Org Subscription Canceled — Member State Limbo

When an org's Stripe subscription is canceled, the webhook sets `organizations.subscription_status = 'canceled'`, and the subscription middleware blocks all members. But `users.organization_id` stays set. This creates an awkward state:

- Members still "belong" to the org in the data model but can't use the product.
- If a member tries to subscribe individually, the middleware would check their org first (which is canceled), then fall through to individual check. **This path works correctly** — but the UI needs to handle it cleanly. The member should see "Your clinic's subscription has ended" with a clear CTA to subscribe individually, not a generic 402.
- The clinic admin should see a "Reactivate" prompt, not just a dead dashboard.

**Resolution:** No schema change needed. The frontend must handle the `clinic_subscription_expired` error code distinctly from `subscription_required` or `trial_expired`. Add this to the extension error handling as well (currently the extension has no concept of org-level errors).

### 3. Owner's Dual Subscription Ambiguity

Flow 2 step 7 says the owner's individual subscription "remains for billing continuity." This creates confusion:

- The owner could have both an active $30/mo individual sub AND be on the org's $25/seat/mo plan — double-paying.
- If the individual sub lapses but the org sub is active, the owner still has access. Fine. But the Stripe dashboard shows a "canceled" individual subscription, which looks like a problem.
- If the org sub lapses but the individual sub is still active, the owner retains access but their PTs don't.

**Resolution:** When an org is created and the owner is assigned, the checkout flow should prompt the owner to cancel their individual subscription (or we cancel it automatically as part of the org creation webhook). Document this in the checkout UX spec. The middleware already handles the fallback correctly (check individual first, then org), so no backend change needed — this is purely a billing hygiene concern.

### 4. `/invite-codes/validate` Response Must Be Minimal

This is a public endpoint (pre-registration). If it returns the code type (`beta` vs `clinic`) and organization name, an attacker can:
- Enumerate valid codes to identify customer organizations
- Learn which clinics are FlashNote customers (competitive intelligence, or social engineering)

**Resolution:** The response should return only `{ valid: true/false }`. If the code is valid and of type `clinic`, the organization name is revealed *after* the user enters their registration details (email + password) but *before* the final submit — so they can confirm they're joining the right clinic. This keeps the enumeration cost high (must attempt full registration) while still giving the PT confirmation.

### 5. Rate Limiting on Invite Code Generation

A compromised admin account could generate thousands of invite codes. The doc specifies rate limits for `/invite-codes/validate` (10/min per IP) and registration (3/hour), but not for `POST /organization/invites`.

**Resolution:** Add a rate limit of 10 invite codes per hour per organization. This is generous for legitimate use (no clinic onboards 10 PTs per hour) but prevents abuse. Use the `organization_id` as the rate limit key, not the user ID or IP.

### 6. Existing User Migration

When `REGISTRATION_MODE` is deployed, existing users (internal test accounts, early signups) need a clear path:
- Users created before invite codes exist are grandfathered — they already have accounts and don't need codes.
- The `REGISTRATION_MODE` check only gates *new* registrations, not existing logins.
- The `ALTER TABLE users ADD COLUMN organization_id` migration defaults to `NULL`, which is correct — existing users are individual users.

No migration script needed, but this should be verified in staging before the `REGISTRATION_MODE=invite` switch.

### 7. Webhook Idempotency for Org Creation

The existing `processed_webhook_events` table handles individual subscription webhooks. The same idempotency pattern must apply to org-creating webhooks (`checkout.session.completed` for clinic plans). If the webhook fires twice, we must not create two organizations. The existing pattern (check `processed_webhook_events` before processing) handles this, but the org creation code must be inside the idempotency guard.

---

## What NOT to Build Yet

| Feature | Why Not Yet |
|---------|-------------|
| Multiple admins per org | One owner + one admin is enough for 5-20 seat clinics |
| Org name changes | Handle via support request |
| Seat auto-scaling | Manual seat management via Stripe portal |
| Invite-via-email (we send the email) | Avoids collecting non-user PII; admin shares codes directly |
| Referral/affiliate codes | Same table could support it later; don't add the code paths now |
| Usage history charts | The data's there (per-month rows); build the UI when clinics ask for it |
| Usage export (CSV) | Same - data exists, build when needed |
| Multi-org membership | One org per user is sufficient. Revisit only if PTs working at multiple clinics becomes a real pattern |
| SSO/SAML for clinics | Way too early. Custom JWT auth is fine for 5-50 clinics |

---

## Implementation Order

When this moves from planning to implementation:

### Wave 1: Individual Gating + Usage Endpoint (Beta prep)
1. Add `REGISTRATION_MODE` to `config.ts` env schema
2. Migration 009: `invite_codes` table
3. Modify `/auth/register` to enforce registration mode + accept invite codes
4. Invite code generation utility (for us to create beta codes manually or via script)
5. `POST /invite-codes/validate` public endpoint
6. `GET /usage/me` endpoint (expose existing `usageService.getMonthlyUsage`)
7. Web dashboard: replace mock usage with real `/usage/me` data

### Wave 2: Clinic Infrastructure
8. Migration 010: `organizations` table, `organization_members` table, `users.organization_id` column
9. Modify `requireActiveSubscription` middleware for org-based access
10. `requireOrgMembership` and `requireOrgRole` middleware
11. New audit actions in `AuditAction` enum
12. Organization service (create, query, member management)
13. Modify registration flow: clinic invite code → auto-join org

### Wave 3: Clinic Admin Dashboard
14. `GET /organization` endpoint (org details + seat count)
15. `GET /organization/members` endpoint
16. `GET /organization/usage` endpoint (aggregated + per-member)
17. `POST /organization/invites` (generate clinic invite code)
18. `GET /organization/invites` (list pending invites)
19. `DELETE /organization/invites/:id` (revoke)
20. `DELETE /organization/members/:id` (remove member + revoke access)
21. Web: Team dashboard page (`/dashboard/team`)

### Wave 4: Clinic Billing
22. Stripe clinic product + price setup
23. Modify `/billing/checkout` for clinic plans (quantity + clinic name)
24. Modify webhook handler for org-level subscription events
25. `max_seats` sync from Stripe webhook
26. Web: clinic plan on pricing page
27. Owner billing management (Stripe portal link)

### Wave 5: Polish
28. `PATCH /organization/members/:id` (role changes)
29. `POST /organization/leave` (voluntary departure)
30. `POST /organization/transfer` (ownership transfer)
31. Extension: show org affiliation in settings
32. Admin compliance view (legal acceptance status per member)
