# Signup Form Standardization Plan

**Status:** 🔴 **LAUNCH BLOCKER**
**Created:** 2026-02-02
**Related:** `docs/PRE_LAUNCH_LEGAL_COMPLIANCE.md`
**Priority:** P0 - Must complete before beta

---

## Problem Statement

Current signup flows between web app and browser extension are inconsistent:

| Feature | Web | Extension | Status |
|---------|-----|-----------|--------|
| Email field | ✅ | ✅ | ✅ Consistent |
| Password field | ✅ | ✅ | ✅ Consistent |
| Confirm Password field | ✅ | ❌ | ❌ **INCONSISTENT** |
| Password hint | ✅ | ✅ | ✅ Consistent |
| Terms of Service link | ✅ | ❌ | ❌ **MISSING** |
| Privacy Policy link | ✅ | ❌ | ❌ **MISSING** |
| BAA acceptance | ❌ | ❌ | ❌ **MISSING BOTH** |
| Legal checkboxes | ❌ | ❌ | ❌ **MISSING BOTH** |
| Validation schema | registerSchema + confirmPassword | registerSchema (no confirm) | ❌ **INCONSISTENT** |

**Risk:** Users could sign up through extension without agreeing to legal terms, creating HIPAA compliance gaps.

---

## Current Implementation

### Web Signup (`web/src/app/signup/page.tsx`)

**Fields:**
1. Email (required, validated)
2. Password (required, min 8 chars, uppercase, lowercase, number)
3. Confirm Password (required, must match)

**Legal:**
- Passive text: "By creating an account, you agree to..."
- Links to Terms and Privacy
- NO checkbox required
- NO BAA mention

**Validation:**
```typescript
// web/src/lib/schemas.ts
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
```

### Extension Signup (`extension/src/sidepanel/components/LoginForm.tsx`)

**Fields:**
1. Email (required, validated)
2. Password (required, min 8 chars, placeholder shows requirements)

**Legal:**
- NO mention of Terms, Privacy, or BAA
- NO links to legal documents
- NO checkboxes
- NO acceptance mechanism

**Validation:**
```typescript
// extension/src/shared/schemas.ts
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
});
// NO confirmPassword field!
```

---

## Target State: Unified Signup Experience

### Required Fields (All Platforms)

1. **Email** - `type="email"`, required, validated
2. **Password** - `type="password"`, required, validated with policy
3. **Confirm Password** - `type="password"`, required, must match password
4. **Terms/BAA Checkbox** - required, links to Terms of Service (with embedded BAA)
5. **HIPAA Acknowledgment Checkbox** - required, confirms user is covered entity

### Visual Layout (Consistent)

```
┌─────────────────────────────────────────┐
│          [FlashNote Logo]                │
│      Create your account                 │
│    Start your 14-day free trial         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Email address                            │
│ [you@clinic.com________________]         │
│                                          │
│ Password                                 │
│ [***************************]            │
│ Min 8 chars, 1 uppercase, 1 number      │
│                                          │
│ Confirm Password                         │
│ [***************************]            │
│                                          │
│ ☐ I agree to the Terms of Service       │
│   (including Business Associate          │
│   Agreement) and Privacy Policy          │
│                                          │
│ ☐ I confirm I am a healthcare provider   │
│   or covered entity under HIPAA          │
│                                          │
│      [Create Account]                    │
│                                          │
│ Already have an account? Sign in         │
└─────────────────────────────────────────┘
```

---

## Implementation Tasks

### Task 1: Update Shared Schema

**File:** `extension/src/shared/schemas.ts`

**Current:**
```typescript
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
});
```

**Required:**
```typescript
export const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Add validation helper for signup with legal acceptance
export const signupSchema = registerSchema.extend({
  acceptedTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the Terms of Service and Business Associate Agreement',
  }),
  acknowledgedHIPAA: z.boolean().refine(val => val === true, {
    message: 'You must confirm you are a healthcare provider or covered entity',
  }),
});
```

**Impact:** Breaking change for extension - must update LoginForm component

---

### Task 2: Update Web Signup Component

**File:** `web/src/app/signup/page.tsx`

**Changes needed:**

1. **Add state for checkboxes:**
```typescript
const [acceptedTerms, setAcceptedTerms] = useState(false);
const [acknowledgedHIPAA, setAcknowledgedHIPAA] = useState(false);
```

2. **Add validation:**
```typescript
// Before API call
if (!acceptedTerms) {
  setError('You must accept the Terms of Service and Business Associate Agreement');
  return;
}
if (!acknowledgedHIPAA) {
  setError('You must confirm you are a healthcare provider');
  return;
}
```

3. **Replace passive text with checkboxes:**
```tsx
<div className="space-y-3 mt-6">
  <label className="flex items-start gap-3 cursor-pointer group">
    <input
      type="checkbox"
      required
      checked={acceptedTerms}
      onChange={(e) => setAcceptedTerms(e.target.checked)}
      className="mt-0.5 h-4 w-4 rounded border-fn-border-primary
                 focus:ring-2 focus:ring-fn-accent"
    />
    <span className="text-xs text-fn-text-secondary group-hover:text-fn-text-primary">
      I agree to the{' '}
      <Link
        href="/terms"
        target="_blank"
        className="link font-medium"
      >
        Terms of Service
      </Link>
      {' '}(including the Business Associate Agreement in Section 9) and{' '}
      <Link
        href="/privacy"
        target="_blank"
        className="link font-medium"
      >
        Privacy Policy
      </Link>
    </span>
  </label>

  <label className="flex items-start gap-3 cursor-pointer group">
    <input
      type="checkbox"
      required
      checked={acknowledgedHIPAA}
      onChange={(e) => setAcknowledgedHIPAA(e.target.checked)}
      className="mt-0.5 h-4 w-4 rounded border-fn-border-primary
                 focus:ring-2 focus:ring-fn-accent"
    />
    <span className="text-xs text-fn-text-secondary group-hover:text-fn-text-primary">
      I confirm that I am a licensed healthcare provider or covered entity under HIPAA
    </span>
  </label>
</div>
```

4. **Pass to API:**
```typescript
const response = await register(email, password, {
  acceptedTerms: true,
  acknowledgedHIPAA: true,
});
```

---

### Task 3: Update Extension Signup Component

**File:** `extension/src/sidepanel/components/LoginForm.tsx`

**Major changes required:**

1. **Add confirmPassword field:**
```tsx
// After password field
<div>
  <label htmlFor="confirm-password" className="label block text-sm mb-1">
    Confirm Password
  </label>
  <input
    id="confirm-password"
    type="password"
    value={confirmPassword}
    onChange={(e) => setConfirmPassword(e.target.value)}
    required={viewMode === 'signup'}
    className="input-field w-full px-3 py-2"
    placeholder="Re-enter password"
  />
</div>
```

2. **Add state:**
```typescript
const [confirmPassword, setConfirmPassword] = useState('');
const [acceptedTerms, setAcceptedTerms] = useState(false);
const [acknowledgedHIPAA, setAcknowledgedHIPAA] = useState(false);
```

3. **Update validation:**
```typescript
const validation = viewMode === 'signup'
  ? validateRegister({ email, password, confirmPassword })
  : validateLogin({ email, password });
```

4. **Add checkboxes (before submit button):**
```tsx
{viewMode === 'signup' && (
  <div className="space-y-3">
    <label className="flex items-start gap-2 cursor-pointer text-xs">
      <input
        type="checkbox"
        required
        checked={acceptedTerms}
        onChange={(e) => setAcceptedTerms(e.target.checked)}
        className="mt-0.5"
      />
      <span className="opacity-80">
        I agree to the{' '}
        <a
          href={`${API_BASE_URL}/terms`}
          target="_blank"
          rel="noopener noreferrer"
          className="link"
        >
          Terms of Service
        </a>
        {' '}(including BAA) and{' '}
        <a
          href={`${API_BASE_URL}/privacy`}
          target="_blank"
          rel="noopener noreferrer"
          className="link"
        >
          Privacy Policy
        </a>
      </span>
    </label>

    <label className="flex items-start gap-2 cursor-pointer text-xs">
      <input
        type="checkbox"
        required
        checked={acknowledgedHIPAA}
        onChange={(e) => setAcknowledgedHIPAA(e.target.checked)}
        className="mt-0.5"
      />
      <span className="opacity-80">
        I confirm I am a healthcare provider or covered entity under HIPAA
      </span>
    </label>
  </div>
)}
```

5. **Validate checkboxes before submit:**
```typescript
if (viewMode === 'signup') {
  if (!acceptedTerms) {
    setErrors(['You must accept the Terms of Service and BAA']);
    return;
  }
  if (!acknowledgedHIPAA) {
    setErrors(['You must confirm you are a healthcare provider']);
    return;
  }
}
```

6. **Reset checkboxes when switching views:**
```typescript
const handleBackToLogin = () => {
  setViewMode('login');
  setConfirmPassword('');
  setAcceptedTerms(false);
  setAcknowledgedHIPAA(false);
  setErrors([]);
};
```

---

### Task 4: Update Backend API

**File:** `backend/src/routes/auth.ts`

**Changes:**

1. **Add database columns:**
```sql
-- Migration: 00X_add_baa_acceptance.sql
ALTER TABLE users ADD COLUMN baa_accepted_at TIMESTAMP;
ALTER TABLE users ADD COLUMN baa_version VARCHAR(50) DEFAULT '1.0';
ALTER TABLE users ADD COLUMN hipaa_acknowledged BOOLEAN DEFAULT FALSE;

-- Add index for compliance queries
CREATE INDEX idx_users_baa_accepted ON users(baa_accepted_at);
```

2. **Update register validation:**
```typescript
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
  // New fields (optional for backwards compat during transition)
  acceptedTerms: z.boolean().optional(),
  acknowledgedHIPAA: z.boolean().optional(),
});
```

3. **Validate in register endpoint:**
```typescript
router.post('/register', async (req, res) => {
  // ... existing validation ...

  // Require BAA acceptance (after grace period)
  const { acceptedTerms = false, acknowledgedHIPAA = false } = req.body;

  if (!acceptedTerms) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'baa_required',
        message: 'You must accept the Terms of Service and Business Associate Agreement',
      },
    });
  }

  if (!acknowledgedHIPAA) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'hipaa_acknowledgment_required',
        message: 'You must confirm you are a healthcare provider or covered entity',
      },
    });
  }

  // ... existing user creation ...

  // Store BAA acceptance
  await pool.query(`
    INSERT INTO users (
      email, password_hash, baa_accepted_at, baa_version, hipaa_acknowledged
    ) VALUES ($1, $2, NOW(), $3, $4)
  `, [email, passwordHash, '1.0', true]);

  // Audit log
  await auditLog({
    userId: user.id,
    action: 'baa_accepted',
    metadata: { version: '1.0' },
  });
});
```

---

### Task 5: Update Auth Context/API Client

**Web:** `web/src/lib/auth-context.tsx`

```typescript
register: async (
  email: string,
  password: string,
  options?: {
    acceptedTerms?: boolean;
    acknowledgedHIPAA?: boolean;
  }
) => {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      acceptedTerms: options?.acceptedTerms ?? false,
      acknowledgedHIPAA: options?.acknowledgedHIPAA ?? false,
    }),
  });
  // ... rest of implementation
}
```

**Extension:** `extension/src/shared/api.ts`

```typescript
export async function register(
  email: string,
  password: string,
  options?: {
    acceptedTerms?: boolean;
    acknowledgedHIPAA?: boolean;
  }
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      acceptedTerms: options?.acceptedTerms ?? false,
      acknowledgedHIPAA: options?.acknowledgedHIPAA ?? false,
    }),
  });
  // ... rest
}
```

---

## Testing Checklist

### Functional Testing

**Web Signup:**
- [ ] Email validation works
- [ ] Password validation shows all requirements
- [ ] Confirm password validates match
- [ ] Cannot submit without checking Terms/BAA checkbox
- [ ] Cannot submit without checking HIPAA acknowledgment
- [ ] Links to Terms and Privacy open in new tab
- [ ] Successful signup redirects to dashboard
- [ ] Error messages are clear and specific

**Extension Signup:**
- [ ] Email validation works
- [ ] Password validation shows all requirements
- [ ] Confirm password validates match
- [ ] Cannot submit without checking Terms/BAA checkbox
- [ ] Cannot submit without checking HIPAA acknowledgment
- [ ] Links to web Terms and Privacy open in browser
- [ ] Successful signup loads authenticated state
- [ ] Error messages match web app

**Backend:**
- [ ] Register endpoint rejects missing `acceptedTerms`
- [ ] Register endpoint rejects missing `acknowledgedHIPAA`
- [ ] BAA acceptance timestamp stored correctly
- [ ] BAA version stored correctly
- [ ] Audit log captures BAA acceptance
- [ ] Error codes match documentation

### Visual Testing

- [ ] Both forms have identical field order
- [ ] Both forms have identical spacing
- [ ] Both forms have identical validation styles
- [ ] Checkboxes are accessible and keyboard-navigable
- [ ] Links are clearly distinguishable
- [ ] Mobile responsive (web only)
- [ ] Dark mode works correctly

### Compliance Testing

- [ ] Terms of Service includes embedded BAA
- [ ] BAA language is clear and complete
- [ ] Signup cannot proceed without acceptance
- [ ] Acceptance is recorded with timestamp
- [ ] Audit logs are immutable
- [ ] User can download proof of BAA acceptance (future feature)

---

## Migration Strategy

### Phase 1: Soft Launch (Backwards Compatible)

- Backend accepts but doesn't require `acceptedTerms`/`acknowledgedHIPAA`
- Allows time to update both clients
- Log warnings for signups without BAA

### Phase 2: UI Updates

- Deploy web updates
- Deploy extension updates
- Verify both clients sending flags

### Phase 3: Enforcement

- Backend rejects signups without BAA acceptance
- All new users must explicitly accept
- Existing users grandfathered (but should accept on next login)

---

## Success Criteria

This standardization is complete when:

1. ✅ Both web and extension have identical signup fields
2. ✅ Both require explicit BAA acceptance via checkbox
3. ✅ Both validate identically (same error messages)
4. ✅ Backend stores and validates BAA acceptance
5. ✅ All tests pass
6. ✅ Visual review confirms consistency
7. ✅ Lawyer has approved legal language
8. ✅ Matthew signs off

---

## Estimated Effort

| Task | Time | Owner |
|------|------|-------|
| Update shared schemas | 30 min | Claude |
| Update web signup | 1-2 hrs | Claude |
| Update extension signup | 2-3 hrs | Claude |
| Backend API changes | 1-2 hrs | Claude |
| Database migration | 30 min | Claude |
| Testing (all platforms) | 2-3 hrs | Matthew + Claude |
| **Total** | **8-11 hours** | |

---

## Related Documents

- `docs/PRE_LAUNCH_LEGAL_COMPLIANCE.md` - Legal requirements and BAA details
- `docs/legal/TERMS_OF_SERVICE.md` - To be updated with embedded BAA
- `docs/legal/BAA_TEMPLATE.md` - Source for BAA language
- `CLAUDE.md` - Healthcare software standards

---

*This plan ensures consistent, HIPAA-compliant signup experience across all FlashNote clients.*
