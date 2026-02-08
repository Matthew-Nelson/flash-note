# Pre-Launch Legal Compliance Requirements

**Status:** 🔴 **LAUNCH BLOCKER**
**Created:** 2026-02-02
**Priority:** P0 - Must complete before any user signups

---

## Executive Summary

FlashNote processes Protected Health Information (PHI) and is legally classified as a **Business Associate** under HIPAA. Current signup flows DO NOT adequately obtain Business Associate Agreement (BAA) acceptance from users, creating significant legal risk for both FlashNote and our customers.

**Risk Level:** HIGH - HIPAA violations can result in fines up to $50,000 per violation.

**Action Required:** Implement BAA acceptance in signup flow and embed BAA terms in Terms of Service BEFORE accepting any user signups.

---

## Legal Background

### Why FlashNote is a Business Associate

FlashNote qualifies as a Business Associate because we:
1. ✅ Receive PHI from covered entities (PTs input patient data)
2. ✅ Transmit PHI to third parties (Google Gemini API)
3. ✅ Process PHI on behalf of covered entities (generate SOAP notes)

**It does not matter that we don't store PHI** - receiving and processing PHI makes us a Business Associate under 45 CFR § 164.308(b).

### HIPAA Requirement

Per **45 CFR § 164.308(b)(1)**:

> A covered entity may permit a business associate to create, receive, maintain, or transmit electronic protected health information on the covered entity's behalf **only if** the covered entity obtains satisfactory assurances [...] that the business associate will appropriately safeguard the information.

**Key phrase: "only if"** - A BAA must be in place BEFORE PHI flows to us.

### The Problem: Terms of Service ≠ BAA

- **Terms of Service:** General contract for using the service (pricing, refunds, liability)
- **Business Associate Agreement:** Specific HIPAA-required contract with PHI safeguards

Both serve different legal purposes under different laws:
- ToS: General business/consumer protection law
- BAA: Federal HIPAA regulations

**You cannot substitute one for the other.**

---

## Current State Assessment

### Web Signup Flow (`web/src/app/signup/page.tsx`)

**What exists:**
```tsx
<p className="text-center text-xs text-fn-text-muted">
  By creating an account, you agree to our{' '}
  <Link href="/terms" className="link">Terms of Service</Link>{' '}
  and{' '}
  <Link href="/privacy" className="link">Privacy Policy</Link>
</p>
```

**Problems:**
- ❌ No mention of Business Associate Agreement
- ❌ No checkbox - just passive text
- ❌ No explicit acceptance mechanism
- ❌ User can create account without reading legal docs

**Compliance Status:** ⚠️ Partial - Terms exist but BAA not included

### Extension Signup Flow (`extension/src/sidepanel/components/LoginForm.tsx`)

**What exists:**
- Simple login/signup toggle
- Email and password fields only

**Problems:**
- ❌ NO mention of Terms of Service
- ❌ NO mention of Privacy Policy
- ❌ NO mention of Business Associate Agreement
- ❌ NO legal acceptance mechanism whatsoever

**Compliance Status:** ❌ Non-compliant - No legal agreements presented

### Form Field Inconsistencies

| Feature | Web | Extension |
|---------|-----|-----------|
| Confirm Password Field | ✅ Yes | ❌ No |
| Password requirements hint | ✅ Yes | ✅ Yes (placeholder) |
| Terms of Service link | ✅ Yes | ❌ No |
| Privacy Policy link | ✅ Yes | ❌ No |
| BAA mention | ❌ No | ❌ No |
| Explicit checkbox | ❌ No | ❌ No |

---

## Required Changes

### Priority 1: BAA Acceptance Mechanism (P0)

**Option A: Embed BAA in Terms of Service** (RECOMMENDED)

1. Add BAA as Section 9 of Terms of Service
2. Update signup language to reference BAA
3. Add checkbox for explicit acceptance
4. Store acceptance timestamp in database

**Implementation:**
```tsx
// Both web and extension
<div className="space-y-2">
  <label className="flex items-start gap-2">
    <input
      type="checkbox"
      required
      checked={acceptedTerms}
      onChange={(e) => setAcceptedTerms(e.target.checked)}
    />
    <span className="text-xs text-fn-text-muted">
      I agree to the{' '}
      <Link href="/terms" className="link">Terms of Service</Link>
      {' '}(including the Business Associate Agreement in Section 9) and{' '}
      <Link href="/privacy" className="link">Privacy Policy</Link>
    </span>
  </label>

  <label className="flex items-start gap-2">
    <input
      type="checkbox"
      required
      checked={acknowledgedHIPAA}
      onChange={(e) => setAcknowledgedHIPAA(e.target.checked)}
    />
    <span className="text-xs text-fn-text-muted">
      I confirm that I am a healthcare provider or covered entity under HIPAA
    </span>
  </label>
</div>
```

**Why this approach:**
- ✅ HIPAA compliant
- ✅ No extra friction
- ✅ Works for solo practitioners
- ✅ Can provide standalone BAA PDF to enterprises
- ✅ Single document to maintain

**Option B: Separate BAA Checkbox** (Alternative)

Two separate checkboxes:
1. Terms of Service acceptance
2. Business Associate Agreement acceptance

**Why consider this:**
- ✅ More explicit/clear
- ✅ Better for enterprise customers
- ⚠️ Slightly more friction
- ⚠️ Two documents to maintain

### Priority 2: Standardize Signup Forms (P0)

**Required changes:**

1. **Extension: Add confirm password field**
   - Update `extension/src/shared/schemas.ts` to include confirmPassword
   - Add confirmPassword input field to LoginForm
   - Match web validation behavior

2. **Extension: Add legal acceptance**
   - Add Terms/Privacy/BAA checkbox(es) above submit button
   - Link to web-hosted legal pages
   - Store acceptance in signup API call

3. **Web: Add explicit checkbox**
   - Replace passive text with required checkbox
   - Include BAA reference
   - Add HIPAA acknowledgment

4. **Both: Consistent styling**
   - Same field order: email, password, confirm password, checkboxes
   - Same validation messages
   - Same error handling

### Priority 3: Update Legal Documents (P0)

**Files to modify:**

1. **`docs/legal/TERMS_OF_SERVICE.md`**
   - Add Section 9: Business Associate Agreement
   - Copy full BAA language from `docs/legal/BAA_TEMPLATE.md`
   - Update Section 9 reference in text
   - Customize placeholders (dates, addresses)

2. **`docs/legal/BAA_TEMPLATE.md`**
   - Keep as standalone for enterprise customers
   - Add note: "This BAA is automatically accepted during signup per Section 9 of our Terms of Service"
   - Keep ready for custom negotiations

3. **`web/src/app/terms/page.tsx`**
   - Update to render new ToS with embedded BAA
   - Ensure Section 9 is clearly marked/styled

### Priority 4: Backend Changes (P1)

**Database:**
```sql
ALTER TABLE users ADD COLUMN baa_accepted_at TIMESTAMP;
ALTER TABLE users ADD COLUMN baa_version VARCHAR(50); -- e.g., "1.0-2026-02-02"
```

**API Changes:**
- `POST /auth/register` should accept `acceptedBAA: boolean`
- Store `baa_accepted_at` and `baa_version` on registration
- Audit log BAA acceptance

**Validation:**
- Reject registration if `acceptedBAA !== true`
- Return clear error: "You must accept the Business Associate Agreement to use FlashNote"

---

## Implementation Plan

### Phase 1: Legal Documents (1-2 hours)

- [ ] Merge BAA template into Terms of Service as Section 9
- [ ] Customize all placeholders (LLC name, addresses, dates)
- [ ] Have lawyer review combined document ($500 budget)
- [ ] Deploy updated legal pages to web app

**Owner:** Matthew
**Deadline:** Before any code changes

### Phase 2: Web Signup (2-3 hours)

- [ ] Add state for `acceptedTerms` and `acknowledgedHIPAA`
- [ ] Add two checkboxes with proper labels
- [ ] Update validation to require checkboxes
- [ ] Update error messages
- [ ] Test flow end-to-end

**Owner:** Claude Code
**Deadline:** Before beta launch

### Phase 3: Extension Signup (3-4 hours)

- [ ] Update shared schemas to include confirmPassword in register
- [ ] Add confirm password field to LoginForm
- [ ] Add Terms/Privacy/BAA checkboxes
- [ ] Link to web-hosted legal pages (open in new tab)
- [ ] Match web styling and behavior
- [ ] Test flow end-to-end

**Owner:** Claude Code
**Deadline:** Before beta launch

### Phase 4: Backend Updates (2 hours)

- [ ] Add BAA columns to users table
- [ ] Update register endpoint to validate and store BAA acceptance
- [ ] Add audit log entry for BAA acceptance
- [ ] Update API error responses
- [ ] Test with both web and extension clients

**Owner:** Claude Code
**Deadline:** Before beta launch

### Phase 5: Testing & Verification (1 hour)

- [ ] Test web signup with all validations
- [ ] Test extension signup with all validations
- [ ] Verify BAA data stored in database
- [ ] Verify audit logs captured
- [ ] Test with lawyer-reviewed documents
- [ ] Get final sign-off

**Owner:** Matthew + Claude
**Deadline:** Before beta launch

---

## Legal Review Checklist

Before launching, verify:

- [ ] BAA language is embedded in Terms of Service
- [ ] BAA covers all required HIPAA elements:
  - [ ] Permitted uses and disclosures
  - [ ] Safeguards obligations
  - [ ] Breach notification procedures
  - [ ] Subcontractor compliance (Gemini/Vertex AI)
  - [ ] Termination procedures
  - [ ] Pass-through processing model clearly described
- [ ] Signup flow explicitly requires BAA acceptance
- [ ] Acceptance is timestamped and versioned
- [ ] Standalone BAA available for enterprise customers
- [ ] Lawyer has reviewed final documents ($500 budget allocated)

---

## Cost Estimate

| Item | Cost | Notes |
|------|------|-------|
| Lawyer review (1 hour) | $500 | Review combined ToS+BAA |
| Development time | $0 | Your time |
| Database migration | $0 | Trivial change |
| **Total** | **$500** | One-time cost |

---

## Risk Assessment

### If We Launch Without BAA Acceptance

| Risk | Likelihood | Impact | Notes |
|------|------------|--------|-------|
| HIPAA violation fine | Low | Catastrophic | $100-$50k per violation |
| Customer HIPAA violation | Medium | High | They're at risk too |
| Customer refuses to pay | Medium | Medium | "You didn't have BAA in place" |
| Lawsuit from customer | Low | High | If they get fined, they sue us |
| Reputation damage | Medium | High | "FlashNote isn't HIPAA compliant" |
| Enterprise sales blocked | High | Medium | They WILL ask for proof of BAA |

### If We Implement BAA Acceptance

| Risk | Likelihood | Impact | Notes |
|------|------------|--------|-------|
| Increased signup friction | Low | Low | Healthcare users expect legal docs |
| Lawyer finds issues | Medium | Low | Fixable before launch |
| Some users don't understand BAA | Low | Low | We can educate |

**Recommendation:** The risk of NOT implementing BAA acceptance far outweighs any implementation challenges.

---

## Post-Launch Considerations

### Dashboard Feature: Download BAA

Add to user dashboard:
```tsx
<button onClick={downloadBAA}>
  Download Business Associate Agreement (PDF)
</button>
```

Generates PDF with:
- Full BAA text
- User's name and email
- Acceptance timestamp
- FlashNote signature block
- Useful for customer's compliance records

### Enterprise Custom BAAs

Some large customers will request:
1. Separate negotiation of BAA terms
2. Paper signature (not electronic)
3. Custom addendums

**Process:**
1. Start with our BAA template
2. Negotiate specific changes (their lawyer → our lawyer)
3. Both parties sign PDF
4. Store in secure location
5. Flag account as "custom BAA" in database

**Budget:** $500-1,500 per custom BAA negotiation

---

## Success Criteria

This issue is resolved when:

1. ✅ Terms of Service includes embedded BAA (Section 9)
2. ✅ Lawyer has reviewed and approved legal documents
3. ✅ Web signup requires explicit BAA checkbox acceptance
4. ✅ Extension signup requires explicit BAA checkbox acceptance
5. ✅ Both signup forms are functionally identical (same fields, same validation)
6. ✅ Backend stores BAA acceptance timestamp and version
7. ✅ Audit logs capture BAA acceptance events
8. ✅ Standalone BAA PDF available for enterprise customers
9. ✅ All changes tested end-to-end
10. ✅ Matthew signs off on legal compliance

---

## References

- [45 CFR § 164.308(b)](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C/section-164.308) - HIPAA Business Associate Requirements
- `docs/legal/BAA_TEMPLATE.md` - Current BAA template
- `docs/legal/TERMS_OF_SERVICE.md` - Current Terms of Service
- `docs/legal/PRIVACY_POLICY.md` - Current Privacy Policy
- `CLAUDE.md` - Healthcare software standards and HIPAA requirements

---

## Questions for Matthew

Before implementing:

1. **LLC Name:** What is the exact legal name of your LLC? (for BAA signature block)
2. **Business Address:** What address should appear on legal documents?
3. **Lawyer:** Do you have a healthcare/tech lawyer identified for review? Need recommendation?
4. **Timeline:** Can we delay beta until this is complete? (RECOMMENDED)
5. **Standalone BAA:** Do you anticipate enterprise customers needing separate BAA PDFs soon?

---

**Next Steps:**
1. Matthew reviews this document
2. Matthew approves approach (Option A: Embedded BAA)
3. Matthew provides LLC details for legal docs
4. Matthew arranges lawyer review ($500)
5. Claude implements technical changes
6. Launch blocked until complete

---

*This document was created as part of pre-launch compliance review. All changes must be completed before accepting any user signups to avoid HIPAA violations.*
