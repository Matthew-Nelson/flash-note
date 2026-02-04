# Billing Codes Research: What Matters for FlashNote

**Date:** 2026-02-04
**Context:** Research into whether suggesting billing codes (ICD-10, CPT) is valuable for physical therapists

---

## Key Question

Is it actually useful for FlashNote to suggest billing codes? Or is this not a meaningful differentiator?

---

## Research Findings

### The Numbers

| Code Type | Total Relevant | Daily Use | Memorized? |
|-----------|---------------|-----------|------------|
| **CPT codes** (what you did) | ~40 | 5-10 | Yes, for experienced PTs |
| **ICD-10 codes** (diagnosis) | ~11,000 | 8-15 | No — lookup required |

### The Referral Reality

**Initial assumption:** Patients arrive with a diagnosis from the referring physician, so ICD-10 codes are already provided.

**Actual reality:** This is partially true but misses critical nuance:
- Referral scripts often have **no ICD-10 code at all** — just a written diagnosis like "low back pain"
- When codes are provided, they're frequently **unspecified codes** (the generic version)
- Physicians send the **medical diagnosis** (the disease/injury), but PTs must code the **treatment diagnosis** (movement dysfunction they're treating) — these are different codes
- PTs are **legally required** to select their own ICD-10 codes based on their evaluation
- Blindly copying referral codes is explicitly warned against by APTA, WebPT, and every billing authority

### Where Codes Actually Live in the EMR

**Critical insight:** Neither ICD-10 nor CPT codes live inside the SOAP note text fields.

A PT's documentation screen is NOT four text boxes. It's a hybrid form:

| Element | Entry Method |
|---------|--------------|
| **ICD-10 codes** | Searchable dropdown selector in Assessment area |
| **CPT codes** | Auto-populated from structured exercise flowsheet |
| **Exercise details** | Selected from library + structured fields (sets, reps, time) |
| **SOAP narrative** | Free text for clinical reasoning and justification |

**The workflow:** PT picks exercises from library → enters structured parameters → EMR auto-links to CPT codes → narrative text provides *justification* for those codes

### What Actually Causes Claim Denials

The problem is NOT code selection — it's **narrative quality**.

| Documentation Problem | Found in % of Audits |
|----------------------|---------------------|
| Incomplete progress notes | 73% |
| **Missing medical necessity language** | 68% |
| Inadequate plan of care | 61% |
| Poor functional outcomes documentation | 59% |

A 2018 OIG audit found **61% of PT claims** didn't comply with documentation requirements.

### What Auditors Look For (Section by Section)

**Subjective** — establishes *why treatment is needed*
- Strong: "Patient reports inability to climb stairs at home, limiting independence in ADLs"
- Weak: "Patient doing okay" (no justification)

**Objective** — proves *what was done* with *skilled language* (most billing-critical)
- Strong: "Grade III+ posterior-anterior mobilizations to L4-L5 facet joints, 12 minutes"
- Weak: "Did some stretching" (supports nothing)
- Must include actual measurements (ROM in degrees, MMT grades, outcome scores)

**Assessment** — justifies *continued care* (medical necessity)
- Must answer: Why does this patient need a *licensed therapist* vs. a home exercise program?
- Strong: "Patient demonstrates 15-degree improvement in knee flexion ROM (95 to 110 degrees) over 4 visits. Continued skilled manual therapy required to address persistent quadriceps inhibition limiting stair negotiation."
- Weak: "Patient tolerated session well. Continue POC." (top denial trigger)

**Plan** — documents *future treatment intent*
- Must have specifics: frequency, duration, modifications
- Not just "continue PT"

---

## Strategic Decision

### What FlashNote Should NOT Focus On

**Code suggestion is low-value:**
- CPT codes: Experienced PTs have these memorized
- ICD-10 codes: Entered via EMR dropdowns, not typed into notes
- The codes themselves are a solved problem in modern EMRs (searchable selectors, auto-population from flowsheets)

### What FlashNote SHOULD Focus On

**Narrative quality is high-value:**

1. **Skilled language** — the difference between a note that survives an audit and one that gets denied
2. **Medical necessity justification** — the "why skilled PT and not a home program" argument that 68% of audited notes fail to include
3. **Measurable, specific objective findings** — actual numbers, not vague descriptions
4. **Functional outcome linkage** — connecting impairments to real-life activities

### The Value Proposition Reframe

| Old framing | New framing |
|-------------|-------------|
| "We suggest your billing codes" | "Your notes will survive an audit" |
| Feature parity with EMR dropdowns | Differentiated value EMRs don't provide |
| Moderate usefulness | High-value, measurable outcome (denial reduction) |

---

## Implications for Product

1. **Keep billing codes as reference only** — the current architecture (showing codes in a summary for visual reference while the PT clicks checkboxes in their EMR) is correct

2. **Double down on narrative coaching** — the prompts should emphasize:
   - Skilled language patterns
   - Medical necessity argumentation
   - Measurable specificity
   - Functional outcome connections

3. **The trust angle** — suggesting accurate billing codes *does* demonstrate FlashNote understands PT workflows, but the real trust-builder is generating notes that the PT recognizes as defensible and audit-ready

4. **Potential future feature** — if we wanted to add billing value, it would be **validation/alerting** (flagging when note content doesn't support the codes the PT selects), not code suggestion

---

## Sources

Research compiled from APTA guidelines, WebPT documentation, Net Health guides, OIG audit reports, and PT billing compliance resources. Full source list available in research session.
