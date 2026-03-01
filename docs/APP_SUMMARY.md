# FlashNote — Application Summary

## What FlashNote Is

FlashNote is an AI-powered clinical documentation tool built specifically for physical therapists. It transforms shorthand clinical notes into complete, insurance-compliant SOAP documentation in seconds — eliminating the 1–2 hours per day that PTs spend on paperwork.

A therapist types their shorthand:

> reports 40% pain reduction. flex ROM 50->65. MFR lumbar paraspinals. grade III mobs L4-5. HEP bridges 2x15. tolerated well.

FlashNote returns a complete, audit-ready SOAP note — Subjective, Objective, Assessment, and Plan — written in professional clinical language with correct terminology, skilled-care justification, and medical necessity documentation.

The generated note is copied directly into any EMR system. No integrations to configure, no IT department to involve, no workflow disruption. It works on day one.

---

## The Problem

Physical therapists are drowning in documentation. The average PT spends 1–2 hours per day writing notes after their last patient leaves — unpaid time that contributes directly to the 60%+ burnout rate in the profession.

The documentation isn't optional. Medicare, Medicaid, and private payers audit PT notes aggressively. A 2018 OIG audit found 61% of PT claims failed to comply with documentation requirements. The #1 reason for claim denials isn't wrong billing codes — it's inadequate narrative quality: missing medical necessity language (68% of audited notes), incomplete progress documentation (73%), and poor functional outcome linkage (59%).

PTs don't need help picking CPT codes — they have those memorized. They need help writing notes that survive an audit.

---

## What Makes FlashNote Different

### Built Exclusively for Physical Therapy

FlashNote is not a general-purpose medical scribe adapted for PT. Every component — from the AI prompt engineering to the abbreviation handling to the output structure — is purpose-built for physical therapy documentation.

**PT-native shorthand recognition.** FlashNote understands the clinical shorthand PTs already use: `MFR` (myofascial release), `WBAT` (weight bearing as tolerated), `MMT` (manual muscle testing), `HEP` (home exercise program), `CKC/OKC` (closed/open kinetic chain), and hundreds of other abbreviations, anatomy terms, and intervention descriptors. No training period. No special syntax. Therapists type the way they already think.

**Four note types tuned to PT practice.** Daily notes, initial evaluations, progress notes, and discharge summaries each have distinct generation logic reflecting their clinical purpose — a progress note emphasizes comparison to baseline and skilled-care justification; a discharge summary compares initial and final measurements against established goals.

**Audit-survival language.** The core value isn't generating text — it's generating text that holds up under payer scrutiny. FlashNote's output emphasizes skilled language patterns, medical necessity argumentation, measurable specificity, and functional outcome connections. The difference between "did some stretching" and "Grade III+ posterior-anterior mobilizations to L4-L5 facet joints, 12 minutes" is the difference between a paid claim and a denial.

### Anti-Hallucination Guarantees

Most AI documentation tools optimize for fluent, complete-sounding output. FlashNote optimizes for clinical accuracy. The system enforces hard constraints:

- **Never fabricates ROM measurements.** If a therapist writes "ROM improved," FlashNote says "range of motion demonstrates improvement" — it does not invent "knee flexion increased from 95° to 110°."
- **Never halluccinates MMT grades.** Manual muscle testing grades appear in notes only when the clinician provides them.
- **Never estimates billing times.** Intervention durations are documented only when explicitly stated.
- **Never invents goal progress percentages.** Progress toward goals is described qualitatively unless the clinician provides a number.

The principle is simple: expansion is the product; fabrication destroys trust. FlashNote adds professional language and clinical structure — never new clinical facts.

### Two-Tier Billing Intelligence

FlashNote handles billing references with a trust-first approach:

- **Tier 1 (Confirmed charges):** When a therapist explicitly states time — "manual therapy 15 min" — FlashNote reports it as a billable unit using the 8-minute rule.
- **Tier 2 (Suggested codes):** When an intervention is mentioned without time, FlashNote flags it as a potential billable service for the therapist to confirm — never auto-populating charges.

This distinction exists because incorrect billing documentation can constitute fraud, with penalties up to $50,000 per claim. FlashNote treats billing as the therapist's decision, not the AI's.

---

## Custom Note Templates

FlashNote ships with a built-in SOAP template optimized for physical therapy, but the real power is in customization.

**Template structure.** Each template is composed of configurable sections. Every section has its own:

- **Title** — the section heading (e.g., "Subjective," "Functional Assessment")
- **Verbosity** — concise or detailed output
- **Styling** — paragraph prose or bulleted lists
- **Prompt instructions** — the specific clinical guidance that shapes AI output for that section
- **Copy control** — whether the section is included when copying the full note

This means a therapist can build a template where the Objective section uses detailed bullet points while the Assessment section uses concise paragraphs — matching exactly how their clinic documents.

**Template tiers:**

- **Built-in templates** — professionally crafted, available to all users. The default SOAP template is tuned for outpatient orthopedic PT with anti-hallucination guardrails and audit-survival language baked into every section.
- **Personal templates** — created by individual therapists for their specific practice patterns. A home health PT documents differently than an outpatient ortho PT; a pediatric specialist has different section needs than a sports rehab clinic.
- **Organization templates** — shared across a clinic. When the clinic director builds a documentation standard, every therapist on the team gets it automatically. New hires inherit the clinic's documentation style from day one.

Templates are where workflow investment creates switching costs. A therapist with 5 custom templates tuned to their caseload, or a clinic with a shared template library built over months, has a reason to stay that has nothing to do with price.

---

## Clinic & Organization Management

FlashNote scales from solo practitioners to multi-location clinics.

**Role-based team structure:**

- **Owner** — the clinic purchaser. Manages billing, sets seat limits, controls the subscription.
- **Admin** — delegated management. Can invite and remove members, manage shared templates, view team usage.
- **Member** — individual therapist. Generates notes, manages personal templates, uses the clinic subscription.

**Centralized billing.** The clinic pays one invoice. Individual therapists don't manage subscriptions — they join via an invite code shared by their admin. When a PT leaves the clinic, the admin removes them and frees the seat. No per-user billing coordination.

**Pricing that rewards scale:**

| Plan | Monthly Price | Seats | Per-Seat Cost |
|------|-------------|-------|---------------|
| Individual | $29 | 1 | $29.00 |
| Clinic Small | $99 | 5 | $19.80 |
| Clinic Medium | $179 | 10 | $17.90 |
| Clinic Large | $299 | 20 | $14.95 |

**Why clinics stick.** Switching away from FlashNote when 8 therapists share billing, templates, and workflow patterns requires group consensus, manager approval, budget reallocation, and rebuilding everything in a new tool. The switching cost compounds with every team member and every shared template.

---

## HIPAA Compliance — Not a Feature, a Foundation

FlashNote is built for healthcare from the ground up, not retrofitted with a compliance layer.

- **BAA-covered infrastructure.** The entire stack — application hosting, database, and AI model — runs on Google Cloud under a single Business Associate Agreement.
- **No stored patient notes (v1).** Generated notes pass through FlashNote and are copied to the EMR. No PHI is persisted in the FlashNote database, minimizing breach surface.
- **Immutable audit logging.** Every authentication event, authorization decision, and note generation action is logged with structured metadata — timestamp, user ID, success/failure — but never clinical content. Audit logs are retained per HIPAA requirements with a 6-year locked retention policy.
- **Session security.** Cookie-based sessions with opaque tokens, httpOnly/Secure/SameSite flags, 7-day expiry, and server-side session validation on every request. Account lockout after repeated failed attempts.
- **Input sanitization everywhere.** Every form field, URL parameter, webhook payload, and cookie value is validated at runtime. No trust-casting, no assumptions.

---

## Market Position

The AI medical scribe market is projected to reach $153M by 2031 and is highly fragmented. Enterprise players (Abridge, DAX Copilot) charge $300–600/month. Mid-market tools (Freed, Heidi) run $90–150/month. PT-specific competitors (ScribePT, Comprehend, Prediction Health) range from $19–99/month.

**FlashNote's positioning is distinct in two ways:**

1. **Shorthand text input vs. ambient recording.** Nearly every PT competitor uses microphone-based ambient recording. FlashNote takes shorthand text — the way therapists already think and jot notes between patients. No recording devices, no transcription errors, no patient consent for audio capture, no background noise problems in busy clinics.

2. **Audit survival vs. code suggestion.** Competitors emphasize billing code recommendation. FlashNote focuses on the actual driver of claim denials: narrative quality. The value proposition is not "we suggest your billing codes" — it's "your notes will survive an audit."

At $29/month for individuals and $15–20/seat for clinics, FlashNote is priced aggressively against both PT-specific tools and general-purpose scribes, while delivering purpose-built PT value that generalist tools cannot match.

---

## Summary

FlashNote eliminates the documentation burden that costs physical therapists hours of unpaid work every day. It does this with an AI system that understands PT shorthand natively, generates audit-ready clinical narratives, refuses to hallucinate clinical data, and works with any EMR through simple copy-paste.

Custom templates let individual therapists and clinics shape documentation to match their exact practice patterns. Organization management lets clinics centralize billing and share documentation standards across their team. And the entire system is built on HIPAA-compliant infrastructure with the security controls that healthcare demands.

The result is a tool that saves time, reduces claim denials, and gets better the more a therapist or clinic invests in it.
