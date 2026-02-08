# App Gating Strategy: Beta Rollout & Clinic Seat Management

> **Status: PLANNING**
>
> This document covers the strategy for gating FlashNote from closed → beta → public launch, and how that same mechanism extends to enterprise/clinic seat management.

---

## Overview

FlashNote needs two related access-control mechanisms:

1. **Launch gating** - Control who can register as we move from closed to beta to public
2. **Clinic seat management** - Allow clinics to buy a multi-seat package and invite/remove therapists

These share a core primitive: **invite codes**. Rather than building two separate systems, we design one invite code system that handles both use cases. The code's `type` field determines whether it's a standalone beta invite or a clinic seat assignment.

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
| Beta | **Unlisted** (direct link only, not discoverable in store) |
| Public | **Public** (discoverable in store search) |

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
- **8-character alphanumeric**: Short enough to share verbally, long enough to avoid collisions (36^8 = ~2.8 trillion combinations)

### Code Generation

```
Format: XXXX-XXXX (e.g., "AB3K-M7RN")
Alphabet: A-Z, 0-9 (no lowercase, no ambiguous chars like 0/O, 1/I/L)
Effective alphabet: ~30 chars → ~30^8 = 656 billion combinations
```

---

## Clinic / Enterprise Seat Management

### New Tables

**organizations**
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  max_seats INT NOT NULL,
  stripe_customer_id TEXT,
  subscription_id TEXT,
  subscription_status TEXT DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**organization_members**
```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  UNIQUE(organization_id, user_id)
);
```

**users table addition**
```sql
ALTER TABLE users ADD COLUMN invited_by_code UUID REFERENCES invite_codes(id);
```

### Seat Counting

```
Active seats   = COUNT(*) FROM organization_members
                 WHERE organization_id = X AND removed_at IS NULL

Available seats = organizations.max_seats - active_seats

Can generate invite code = available_seats > 0
```

The clinic admin (who uses the product themselves) counts as a seat.

### Subscription Middleware Change

The existing `requireActiveSubscription` middleware checks `users.subscription_status`. It needs one additional check:

```
Current flow:
  1. User has active/trialing subscription? → allow
  2. Otherwise → deny

New flow:
  1. User has active/trialing individual subscription? → allow
  2. User is active member of an org with active subscription? → allow
  3. Otherwise → deny
```

```typescript
// Pseudocode for the new check (step 2)
const orgAccess = await db.query(`
  SELECT o.subscription_status, o.trial_ends_at
  FROM organization_members om
  JOIN organizations o ON o.id = om.organization_id
  WHERE om.user_id = $1 AND om.removed_at IS NULL
  LIMIT 1
`, [userId]);

if (orgAccess.rows.length > 0) {
  const org = orgAccess.rows[0];
  if (org.subscription_status === 'active') { next(); return; }
  if (org.subscription_status === 'trialing' && new Date() < org.trial_ends_at) {
    next(); return;
  }
}
```

This is a single additional query. It can be optimized later with caching if needed, but at the scale of 5-50 clinics it's negligible.

---

## Onboarding Flows

### Flow 1: Individual PT (Beta)

```
1. PT receives beta invite code (email, social media, etc.)
2. PT visits web app → registration page shows invite code field
3. PT enters code + email + password → backend validates:
   - Code exists, is_active = true, not expired, not already used
   - type = 'beta' → create user normally
   - Set invite_codes.used_by, used_at
   - Set users.invited_by_code
4. PT gets 14-day trial → standard subscription flow
5. PT installs Chrome extension → logs in → uses product
```

### Flow 2: Clinic Admin Purchases Plan

```
1. Clinic admin signs up as individual PT (beta code or open registration)
2. Admin visits pricing page → selects "Clinic Plan" (e.g., 5 seats)
3. Stripe checkout with seat quantity selector
4. Webhook fires → backend creates:
   - Organization (name, max_seats = 5, stripe subscription info)
   - Organization member (admin user, role = 'admin')
5. Admin now sees "Team" tab in web dashboard
```

### Flow 3: Clinic Admin Invites a PT

```
1. Admin opens Team page → sees seat usage (e.g., "2 of 5 seats used")
2. Admin clicks "Generate Invite Code"
   - Backend checks: active_seats < max_seats
   - Creates invite_code with type = 'clinic', organization_id set
   - Returns code (e.g., "AB3K-M7RN")
3. Admin shares code with PT via email, Slack, text, etc.
   (We don't send the email - the admin handles distribution.
    This avoids us collecting non-user email addresses.)
4. PT visits web app → enters clinic code → registers
   - Backend validates code, sees type = 'clinic'
   - Creates user account (NO individual subscription needed)
   - Creates organization_member (role = 'member')
   - Marks code as used
5. PT installs extension → logs in → subscription check passes via org
```

### Flow 4: Clinic Admin Removes a PT

```
1. Admin opens Team page → sees list of active members
2. Admin clicks "Remove" on a therapist
3. Backend sets organization_members.removed_at = NOW()
4. Seat is freed (available_seats increases by 1)
5. Admin can generate a new invite code for replacement PT

What happens to the removed PT:
- Their user account remains (no data loss)
- Next API call: middleware checks org membership → removed → falls through
- No individual subscription either → gets 402 "subscription_required"
- They see a message: "Your clinic access has ended. Subscribe individually to continue."
- They can convert to an individual plan at any time
```

### Flow 5: PT Leaves a Clinic Voluntarily

```
1. PT opens Settings → sees "Clinic: Acme Physical Therapy"
2. PT clicks "Leave Clinic"
3. Backend sets organization_members.removed_at = NOW()
4. Seat is freed for the clinic
5. PT can subscribe individually or join another clinic
```

---

## Stripe Integration for Clinic Plans

### Product Structure

| Product | Price | Model |
|---------|-------|-------|
| FlashNote Individual | $30/mo | Per-user subscription |
| FlashNote Clinic | $25/seat/mo | Quantity-based subscription |

The clinic plan offers a per-seat discount as incentive. Stripe handles quantity-based billing natively.

### Seat Changes (Future Enhancement)

When a clinic admin wants to add more seats:
1. Admin clicks "Add Seats" → selects new total
2. Backend updates Stripe subscription quantity
3. Backend updates `organizations.max_seats`
4. Stripe prorates the billing automatically

When a clinic downsizes:
1. Admin must first remove PTs to get below new seat count
2. Admin clicks "Reduce Seats" → selects new total
3. Backend validates `active_seats <= new_max_seats`
4. Updates Stripe subscription quantity and `organizations.max_seats`

### Webhook Events to Handle

| Event | Action |
|-------|--------|
| `checkout.session.completed` (clinic plan) | Create organization + assign admin |
| `customer.subscription.updated` | Sync `organizations.subscription_status` |
| `customer.subscription.deleted` | Set org status to `canceled`, all members lose access |
| `invoice.payment_failed` | Set org status to `past_due`, notify admin |

---

## Access Control Summary

### Who Can Do What

| Action | Individual PT | Clinic Admin | Clinic Member |
|--------|--------------|--------------|---------------|
| Generate notes | Yes (own sub) | Yes (org sub) | Yes (org sub) |
| View own usage | Yes | Yes | Yes |
| View team usage | N/A | Yes | No |
| Generate invite codes | N/A | Yes (up to seat limit) | No |
| Remove team members | N/A | Yes | No |
| Manage billing | Own only | Clinic billing | No |
| Leave clinic | N/A | No (must transfer admin) | Yes |

### Constraint: One Organization Per User

A user can belong to at most one organization at a time. This simplifies:
- Billing (no question about which org is "paying" for a given usage)
- The subscription middleware (one org lookup, not many)
- Usage tracking (usage attributed to one org or individual, never ambiguous)

If a PT works at two clinics, they pick one clinic affiliation and use an individual plan for the other. This matches the real-world pattern where PTs typically have one primary employer.

---

## Rollout Phases

### Phase 1: Closed (Current → Pre-Beta)
- `REGISTRATION_MODE=closed`
- Staging environment only
- Extension in Chrome developer mode
- Internal testing and bug fixes
- Complete HIPAA critical path items

### Phase 2: Beta (5-10 Individual PTs)
- `REGISTRATION_MODE=invite`
- Production infrastructure live (HIPAA BAA signed)
- Generate beta invite codes, share directly with PTs
- Extension published as **unlisted** on Chrome Web Store
- Individual subscriptions only (no clinic plans yet)
- Monitor Sentry, collect feedback, watch usage

### Phase 3: Clinic Pilot (1-2 Clinics)
- Still `REGISTRATION_MODE=invite`
- Build clinic plan Stripe product + team dashboard
- Onboard 1-2 clinics with direct support
- Validate seat management flow end-to-end
- Clinic admins generate invite codes for their PTs

### Phase 4: Public Launch
- `REGISTRATION_MODE=open`
- Extension republished as **public**
- Both individual and clinic plans available on pricing page
- Invite code field becomes optional (for clinic invites / referral tracking)
- Self-serve clinic signup

---

## API Endpoints (New)

### Invite Code Endpoints

```
POST   /api/invite-codes          Create an invite code (admin only)
GET    /api/invite-codes           List invite codes (admin: org codes, super: all)
DELETE /api/invite-codes/:id       Deactivate an invite code
POST   /api/invite-codes/validate  Check if a code is valid (public, pre-registration)
```

### Organization Endpoints

```
GET    /api/organization              Get current user's org details + seat usage
POST   /api/organization/members      List org members (admin only)
DELETE /api/organization/members/:id   Remove a member (admin only)
POST   /api/organization/leave         Leave org (member only, not admin)
```

### Registration Change

```
POST /api/auth/register
  Body: { email, password, inviteCode? }
  - If REGISTRATION_MODE=closed → 403 regardless
  - If REGISTRATION_MODE=invite → inviteCode required
  - If REGISTRATION_MODE=open → inviteCode optional
```

---

## Audit Logging

All organization and invite code actions must be logged (HIPAA requirement for access control changes):

| Action | Logged Data |
|--------|-------------|
| Invite code generated | userId, orgId, codeId, type |
| Invite code redeemed | userId, orgId, codeId |
| Member removed | adminUserId, removedUserId, orgId |
| Member left voluntarily | userId, orgId |
| Org created | adminUserId, orgId, maxSeats |
| Org subscription changed | orgId, oldStatus, newStatus |

Never log the invite code value itself in plain text (treat as a credential).

---

## Security Considerations

1. **Invite code brute force**: Rate-limit the validate and register endpoints. 8-char codes with 30-char alphabet = 656B combinations, but rate limiting is still essential.

2. **Clinic admin impersonation**: Only users with `role = 'admin'` in `organization_members` can generate codes or remove members. Verified server-side on every request.

3. **Removed member access window**: When a member is removed, their existing JWT access token (up to 1 hour) still works. This is acceptable given the 1-hour expiry. For immediate revocation, the token version system already exists - increment the removed user's token version to invalidate all their tokens instantly.

4. **Invite code leakage**: Codes are single-use and expire. Even if leaked, the damage is limited to one unauthorized registration (which still requires email verification). Clinic admins can see who redeemed each code.

5. **Org deletion**: Do not support org deletion. Instead, cancel the subscription. The org record and membership history are retained for audit purposes.

---

## What NOT to Build (Yet)

- **Admin transfers**: If an admin needs to leave, handle manually (DB update) for now
- **Multiple admins per org**: One admin per org is sufficient initially
- **Org name changes**: Not worth building UI for; handle via support
- **Seat auto-scaling**: Manual seat changes only; no automatic scaling
- **Invite via email**: We don't send invite emails - admin shares codes directly
- **Referral tracking / affiliate codes**: Same table could support this later, but don't build it now

---

## Implementation Order

If/when this moves from planning to implementation:

1. **Database migrations**: `invite_codes` table, `organizations` table, `organization_members` table, `users.invited_by_code` column
2. **`REGISTRATION_MODE` env var** + registration endpoint changes
3. **Invite code CRUD** (generate, validate, redeem, deactivate)
4. **Subscription middleware update** (org-based access check)
5. **Web dashboard: Team page** (admin view: seat usage, invite code generation, member removal)
6. **Stripe clinic plan** (product, checkout, webhooks)
7. **Extension: Settings** (show clinic affiliation, "Leave Clinic" option)
8. **Audit logging** for all new actions
