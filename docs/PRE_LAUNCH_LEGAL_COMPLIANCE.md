# Pre-Launch Legal Compliance Requirements

**Created:** 2026-02-02
**Last Updated:** 2026-02-14

> **This is a reference document** — legal background, HIPAA/HITECH context, and compliance requirements. For remaining task status, see [ROADMAP.md](./ROADMAP.md) (create `/baa` page) and [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) (attorney review, LLC formation).

---

## Executive Summary

FlashNote processes Protected Health Information (PHI) and is legally classified as a **Business Associate** under HIPAA. The core technical implementation is complete — the web signup flow includes BAA acceptance checkboxes, confirm password fields, legal links, and backend storage of acceptance records.

**Remaining items:**
- `/baa` web page is live but showing "PENDING LEGAL REVIEW" — awaiting legal counsel to finalize
- Legal documents need attorney review before production use
- LLC formation needed to fill template placeholders

---

## Legal Background

### HIPAA and the HITECH Act

FlashNote's compliance obligations arise from two federal laws:

1. **HIPAA (1996)** — The Health Insurance Portability and Accountability Act established the Privacy and Security Rules governing Protected Health Information (PHI).
2. **HITECH Act (2009)** — The Health Information Technology for Economic and Clinical Health Act, part of the American Recovery and Reinvestment Act, **extended HIPAA's reach to business associates** and made them directly liable for compliance. Before HITECH, business associates had only a contractual obligation with no direct enforcement.

**What HITECH changed for companies like FlashNote:**
- Business associates are **directly liable** for HIPAA violations (not just the covered entity)
- FlashNote can be **directly audited** by HHS Office for Civil Rights (OCR), independent of any complaint or breach
- **Tiered penalties** with significantly higher fines (up to $2.1M/year per violation category)
- **Breach Notification Rule** requiring notification within 60 days of discovery
- **Reversed burden of proof** — if an incident occurs, *we* must prove PHI wasn't compromised

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

### HITECH Penalty Tiers

The HITECH Act introduced tiered penalties based on culpability (amounts adjusted for inflation as of 2025):

| Level of Culpability | Min per Violation | Max per Violation | Annual Limit |
|---|---|---|---|
| Lack of Knowledge | $141 | $35,581 | $35,581 |
| Lack of Oversight | $1,424 | $71,162 | $142,355 |
| Willful Neglect (corrected ≤30 days) | $14,232 | $71,162 | $355,808 |
| Willful Neglect (not corrected) | $71,162 | $2,134,831 | $2,134,831 |

**For a startup**, the "Lack of Oversight" tier is the primary risk — this covers situations where you *should have known* you weren't compliant but didn't have proper processes in place.

### Breach Notification Obligations (HITECH Act)

If FlashNote discovers a breach of unsecured PHI, the following obligations apply:

1. **FlashNote → Covered Entity:** Notify without unreasonable delay (our BAA specifies 72 hours)
2. **Covered Entity → Affected Individuals:** Within 60 days of discovery, via first-class mail
3. **Covered Entity → HHS:** Within 60 days for breaches of 500+ records; within 60 days of year-end for smaller breaches
4. **Covered Entity → Media:** Breaches of 500+ records in a state/jurisdiction require notice to a prominent media outlet

**Burden of proof is reversed:** When a potential breach occurs, FlashNote must prove PHI was *not* compromised — HHS does not need to prove it was.

### Subcontractor BAA Chain

HITECH extended business associate obligations to subcontractors. Google (Vertex AI / Gemini API) is our subcontractor for PHI processing. We must:
1. Verify that **Google has a BAA in place** covering Vertex AI usage
2. Disclose in our BAA with clinics that we use a subprocessor for AI processing
3. Ensure subcontractor arrangements are covered by valid BAAs (see Exhibit A of our BAA template)

### The Problem: Terms of Service ≠ BAA

- **Terms of Service:** General contract for using the service (pricing, refunds, liability)
- **Business Associate Agreement:** Specific HIPAA-required contract with PHI safeguards

Both serve different legal purposes under different laws:
- ToS: General business/consumer protection law
- BAA: Federal HIPAA regulations

**You cannot substitute one for the other.**

---

## Current State Assessment

> **Updated March 2026:** All technical implementation items below are complete. The web signup flow includes BAA acceptance (PR #47). The Chrome extension was removed in the web-only architecture consolidation (PR #91).

### Web Signup Flow (`web/src/app/signup/page.tsx`) — ✅ IMPLEMENTED

**What's implemented:**
- ✅ Confirm password field with validation
- ✅ Required checkbox for legal acceptance
- ✅ Links to BAA (`/baa`), Terms of Service (`/terms`), Privacy Policy (`/privacy`)
- ✅ `acceptedLegalTerms` sent to backend and stored
- ✅ Zod validation requires acceptance before registration

**Remaining issue:** `/baa` page is live but showing "PENDING LEGAL REVIEW" — awaiting legal counsel to finalize

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

### Priority 2: Update Legal Documents (P0)

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

### Priority 3: Backend Changes (P1)

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

## Implementation Status

Technical implementation is **substantially complete**. The web signup flow includes BAA acceptance checkboxes, confirm password fields, legal links, and backend storage of acceptance records (`legal_acceptances` table, migration 008).

**Remaining items** (tracked elsewhere):
- `/baa` web page is live (pending final legal review of BAA document content)
- Customize legal doc placeholders (blocked on LLC formation) → [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) §1-2
- Attorney review ($500 budget) → [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) §2

---

## Legal Review Checklist

Before launching, verify:

- [ ] BAA language is embedded in Terms of Service
- [ ] BAA covers all required HIPAA/HITECH elements:
  - [ ] Permitted uses and disclosures
  - [ ] Safeguards obligations
  - [ ] Breach notification procedures (HITECH: 72-hour notification to covered entity)
  - [ ] Subcontractor compliance (Gemini/Vertex AI)
  - [ ] Termination procedures
  - [ ] Pass-through processing model clearly described
  - [ ] HITECH Act referenced alongside HIPAA
- [ ] Google Cloud/Vertex AI BAA signed and verified
- [ ] Breach notification / incident response procedure documented
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
| HIPAA/HITECH violation fine | Low | Catastrophic | $141–$2.1M per violation category/year (HITECH tiered penalties) |
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

### HITECH Safe Harbor (Medium-Term Goal)

The 2021 HITECH Safe Harbor amendment gives HHS discretion to **reduce penalties or skip enforcement** if we have implemented a recognized security framework and operated it for 12+ months prior to an incident.

**Recognized frameworks include:**
- NIST Cybersecurity Framework (CSF)
- SOC 2 Type II
- HITRUST CSF

**Recommendation:** Begin aligning with NIST CSF informally now. After 12 months of operation, consider formal assessment. This provides meaningful penalty protection and is also a strong sales tool for enterprise customers.

**Timeline:** Start tracking alignment Q1 post-launch, pursue formal assessment at 18-24 months.

---

---

## References

- [45 CFR § 164.308(b)](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C/section-164.308) - HIPAA Business Associate Requirements
- [HITECH Act (42 USC §§ 17901–17953)](https://www.congress.gov/bill/111th-congress/house-bill/1/text) - Health Information Technology for Economic and Clinical Health Act
- [HITECH Breach Notification Rule (45 CFR §§ 164.400–414)](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-D) - Breach Notification Requirements
- [HITECH Safe Harbor (Public Law 116-321)](https://www.congress.gov/bill/116th-congress/house-bill/7898) - 2021 HITECH Amendment for recognized security frameworks
- `docs/legal/BAA_TEMPLATE.md` - Current BAA template
- `docs/legal/TERMS_OF_SERVICE.md` - Current Terms of Service
- `docs/legal/PRIVACY_POLICY.md` - Current Privacy Policy
- `CLAUDE.md` - Healthcare software standards and HIPAA requirements

---

*This document provides legal context for FlashNote's HIPAA/HITECH compliance obligations. For actionable tasks, see [ROADMAP.md](./ROADMAP.md) and [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md).*
