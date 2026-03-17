# Feature Landscape

**Domain:** AI-powered Physical Therapy clinical documentation (SOAP notes) with patient records, note management, and clinic administration
**Researched:** 2026-03-16
**Overall confidence:** HIGH (based on direct competitor evaluation, existing competitive analysis, web research across 15+ sources, and existing project planning documents)

---

## Table Stakes

Features users expect. Missing = product feels incomplete.

These are features that every credible PT documentation platform offers. FlashNote's pass-through model (generate and forget) was a smart v1 de-risking decision, but for the next phase these become non-negotiable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Patient records** | Every competitor stores patient info tied to notes. Without this, there is no continuity of care, no audit trail, no switching cost. Twofold, ScribePT, Freed, Heidi -- all store patients. | Medium | Already designed in PHI_STORAGE_PLAN.md. Minimal patient creation (name + pronoun, like Twofold) reduces friction. Add DOB, phone, email on patient detail page. |
| **Note persistence** | PTs see patients 2-3x/week for 6-12 weeks. They need to reference past notes for insurance audits, progress tracking, and legal protection. No competitor operates as pass-through only. | Medium | Core of PHI_STORAGE_PLAN.md. Ties notes to patients with timestamps, session metadata (duration, modality). |
| **Note history per patient** | Chronological list of all notes for a patient. Insurance auditors review 3-6 years of documentation. PTs need this for re-evaluations and discharge summaries. | Low | Table view: title/date/duration/modality. Flows naturally from note persistence. |
| **Inline note editing** | PTs always need to correct or augment AI output. Per-section editing (S, O, A, P independently) is standard. Twofold, Freed, and Heidi all offer this. FlashNote already has this in the current UI (Phase B). | Low | Already implemented in Phase B UI overhaul. Extend to persisted notes. |
| **Note versioning / amendment trail** | HIPAA requires that clinical note modifications are tracked, not silently overwritten. Insurance auditors and compliance reviews demand immutable amendment history. | Medium | Append-only version model (Twofold uses per-section versioned text arrays). Every edit creates a new version; original is never deleted. Already designed in PHI_STORAGE_PLAN.md. |
| **Patient context persistence** | Free-text field stored per patient that feeds into ALL future note generation. Twofold has this. Without it, PTs re-type context every session. Critical for note quality. | Low | Already in PHI_STORAGE_PLAN.md as `patient_context` field. Injected into LLM prompt alongside session input. |
| **PDF export** | PTs need to print/export notes for insurance audits, legal proceedings, patient transfers, and EMR manual entry. Twofold offers bulk PDF download. APTA documentation standards expect printable records. | Low | Single note and bulk export. Include patient name, provider signature, date, all SOAP sections. Use server-side PDF generation (avoid client-side libraries). |
| **Copy per section** | PTs pasting into EMRs often need individual sections, not the whole note. Twofold has per-section copy buttons. FlashNote only has Copy All currently. | Low | Add copy button to each SOAP card. Low effort, meaningful UX improvement. |
| **Note search** | With hundreds of notes per provider, search across note content, patient name, and date is essential. Every EMR and documentation tool offers this. | Low-Med | Full-text search across note content + patient name + date range filtering. PostgreSQL `tsvector` or `ILIKE` sufficient at initial scale. |
| **Time-saved tracking** | Users need to see value to justify the subscription. Retention strategy (RETENTION_STRATEGY.md) identifies this as the cheapest, highest-impact retention lever. Display per-note and cumulative. | Low | Already have `usage` table tracking note counts. Add time estimation multiplier. Show on dashboard KPI cards and in note generation success state. |
| **Note templates (basic)** | Configurable note structure -- at minimum SOAP with section-level verbosity/style preferences. Twofold has 60+ templates with per-section customization. WebPT, Prompt EMR, SPRY all have specialty templates. | Medium | Start with SOAP built-in template + user-configurable section preferences (concise/detailed, paragraph/bullets). Custom template builder is a differentiator (see below). |

---

## Differentiators

Features that set FlashNote apart from competitors. Not expected, but highly valued -- and in some cases, represent FlashNote's core competitive advantage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Shorthand-first input model** | Nearly all PT competitors (ScribePT, Twofold, Freed, Heidi, Sunoh) lead with ambient voice recording. FlashNote's text shorthand approach is genuinely different and preferred by PTs who document between patients rather than during sessions. No mic setup, no patient consent, no noise concerns. This is FlashNote's origin story -- protect and amplify it. | Already built | Current core. Enhance with macro library and clinical vocabulary learning over time. |
| **Custom shorthand/macro library** | PTs define personal abbreviation expansions (`mtjm` -> `manual therapy -- joint mobilization grade III/IV`). Over time they build 30-50+ macros that represent invested effort. No PT documentation competitor offers this. Identified in RETENTION_STRATEGY.md as a day-1 differentiator. | Low-Med | Text expansion with user-managed dictionary. Server-stored for persistence across devices. Clinic-shareable in Phase 3. |
| **EMR-specific output formatting** | PT selects their EMR (WebPT, TheraOffice, Net Health, Jane, SimplePractice) and FlashNote produces notes formatted for that system's field structure, character limits, and conventions. Eliminates 2-3 minutes of reformatting per note. No competitor does output-side EMR intelligence without API integration. | Medium | Prompt engineering + output post-processing per EMR profile. Research top 5-8 EMR formatting requirements from user feedback. Build after initial launch. |
| **AI re-edit ("Magic Edit")** | Free-text instruction sent with the note for targeted re-generation ("make it more technical", "expand the assessment", "add HEP details"). Twofold and Freed have this. It is rapidly becoming expected. | Medium | Send current note + user instruction + original input back through LLM. Append new version (not replace). Include suggested prompts for discoverability ("Expand objective measurements", "Add billing justification"). |
| **Patient instructions section** | Patient-facing plain-language summary of the session, generated alongside the SOAP note. Signed by provider. Twofold includes this and it is a standout feature during their evaluation. Valuable for patient education and compliance. | Low-Med | Additional LLM output section. Template-configurable (include/exclude). Excluded from "Copy All" by default (following Twofold's pattern). |
| **Treatment plan generation** | Auto-generate treatment plan from 1-3 recent notes, or manual entry. Persisted and fed into future note generation for continuity. Twofold has this. Builds clinical context over time. | Medium-High | Requires patient records + note history as prerequisites. LLM generates plan from selected notes. Stored per patient. Injected into note generation prompt. |
| **Last note summary** | AI-generated 4-sentence summary on patient overview page. Gives PT instant context before starting a new session. Twofold shows this on the patient overview tab. | Low | LLM call on patient page load (cached). Generated from most recent note. Lightweight but high-value UX feature. |
| **Auto-generated note titles** | Descriptive titles like "Lumbar Spine Rehabilitation Progress" instead of "Note - 2026-03-16". Twofold does this. Small touch that makes note history scannable. | Low | LLM generates title as part of SOAP generation. Store in note metadata. |
| **Condition-specific templates** | PT builds templates for conditions they treat frequently ("ACL Reconstruction Post-Op Week 2-6") with typical interventions, expected measurements, and goals. Templates compound in value with use and create switching cost. | Medium | Template CRUD with condition tagging. Variables/placeholders for measurements. Clinic-shareable. Builds on basic template system. |
| **Custom template builder** | Per-section configuration: title, verbosity (concise/detailed), styling (paragraph/bullets), content instructions (AI prompt per section), include-in-copy toggle. Twofold has this. | Medium | Section-based builder UI. Custom templates stored per user. Edit-creates-copy pattern (originals preserved). |
| **CPT/ICD-10 code suggestions** | AI suggests billing codes based on note content. 75% reduction in coding time per research. WebPT, SPRY, and PatientNotes.ai offer this. Directly impacts revenue for practices. | Medium-High | Requires mapping clinical content to PT-specific CPT codes. Start with common PT CPT codes (97110, 97140, 97530, 97542, etc.). ICD-10 from diagnosis in Assessment section. Flag as suggestions, not authoritative. |
| **Documentation quality scoring** | Score each note on completeness (all SOAP sections filled, billing codes present, goals addressed, HEP mentioned). Show quality trends over time. Shifts value prop from "saves time" to "saves time AND improves quality". | Medium | Define PT-specific completeness rubric. Score output against it. Display per-note and trending on dashboard. Valuable for Medicare-heavy practices. |
| **Clinic admin dashboard** | Organization management: member list, seat management, usage analytics per therapist, shared templates/macros. Multi-provider practices are the primary growth market. | Medium-High | Already have org/member infrastructure. Build admin views for usage, member management, and shared resource administration. Seat-based billing via Stripe. |

---

## Anti-Features

Features to explicitly NOT build. Each represents a deliberate decision based on evidence.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Direct EMR API integration** | Requires per-EMR BAAs, API contracts, and ongoing maintenance. The integration surface area is enormous (WebPT, TheraOffice, Net Health, Jane, SimplePractice, Prompt EMR, ClinicSource -- each with different APIs or none at all). Twofold does not have direct EMR integration either. Risk of data sync bugs creating compliance issues. | EMR-specific output formatting via prompt engineering. One-click copy to clipboard optimized per EMR's paste behavior. This captures 80% of the integration value at 5% of the complexity. |
| **Ambient voice recording (Phase 2)** | Cost per use ($0.50-1.50 for 15-45 min sessions) makes it margin-negative at current $69/month pricing without caps or upsells. HIPAA exposure increases dramatically (raw patient speech is PHI). Requires patient consent workflows, speaker diarization, chunked audio upload infrastructure, async processing. Every competitor leads with voice -- competing on their turf is a losing strategy. | Protect and amplify the shorthand-first input model. Offer dictation mode (Phase 1 from VOICE_INPUT_ROADMAP.md) as a lightweight complement at ~$0.07/use with safe margins. Shorthand is FlashNote's differentiator, not a limitation. |
| **Scheduling / appointment management** | Every full EMR already handles scheduling. Building scheduling means competing with WebPT, Jane, SimplePractice on their core functionality. PTs will not switch schedulers for a documentation tool. | Stay focused on documentation. Let EMR handle scheduling. If users need session time tracking, use manual time entry in the note form (already exists). |
| **Full practice management (billing, RCM, claims)** | Revenue cycle management is a massive domain requiring clearinghouse integrations, ERA processing, patient statements, collections workflows. WebPT, SPRY, TheraOffice, and Clinicient own this space. Building this dilutes focus without differentiation. | CPT/ICD-10 code suggestions in notes (a documentation feature, not a billing platform). Let PTs transfer codes to their billing system. |
| **Patient portal / patient-facing app** | PTs communicate with patients through their EMR's patient portal or direct messaging. Building a separate patient portal fragments the experience. Patients will not adopt another app for one PT. | Patient instructions section in notes (provider can share via their existing channels). HEP generation (future) can be exported as PDF for patient. |
| **Dark mode** | Explicitly cut during UI overhaul. Not worth the complexity -- doubles the design/test surface for a clinical tool used primarily in well-lit clinical settings. | Maintain the professional teal design system with WCAG AA compliance. |
| **Chrome extension** | Sunset during migration. Web app is the only client. Extension added maintenance burden without differentiation. | Continue investing in the web app. Responsive design covers all device form factors. |
| **Real-time collaboration / co-editing** | PTs write notes individually. Multi-user editing of a single note has no clinical workflow justification. Adds significant complexity (CRDTs, conflict resolution, WebSocket infrastructure). | Clinic-shared templates and macro libraries cover the team collaboration need. Notes are authored by one provider. |
| **Gamification (streaks, badges, leaderboards)** | PTs are healthcare professionals, not mobile app users. Gamification is patronizing in a clinical context and does not drive retention for professional tools. | Value visibility through time-saved tracking and quality analytics provides meaningful engagement metrics without gamification. |
| **Tone/style matching as primary differentiator** | Evaluated and rejected in RETENTION_STRATEGY.md. PT SOAP notes have narrow style variance. Any LLM with style prompts produces comparable results. A competitor achieves 80% parity from a single example note paste. | Offer explicit preference toggles (verbosity, abbreviation level, clinical setting) as table stakes. Invest in clinical vocabulary learning (understanding what PTs *mean*, not how they *write*) as the real moat. |
| **HEP builder with exercise library** | WebPT, Prompt EMR, EmpowerEMR, HEP2go, and PtEverywhere already have extensive exercise libraries with images/videos. Building and maintaining a PT exercise database is a massive content creation effort with no differentiation. | Generate HEP text in the note output (AI-generated from treatment plan). Let PTs use their existing HEP tool for the exercise library/printout. |

---

## Feature Dependencies

```
Patient Records -----> Note Persistence (notes require patients to link to)
    |                      |
    |                      |---> Note History per Patient
    |                      |---> Note Versioning / Amendment Trail
    |                      |---> Note Search
    |                      |---> PDF Export
    |                      |---> Auto-generated Note Titles
    |                      |---> AI Re-edit ("Magic Edit") [needs persisted note to re-edit]
    |                      |---> Last Note Summary (needs note history)
    |                      |---> Treatment Plan Generation (needs multiple notes)
    |                      |---> Documentation Quality Scoring (needs persisted notes to score)
    |                      |---> CPT/ICD-10 Code Suggestions (needs note content to analyze)
    |
    |---> Patient Context Persistence (stored per patient)
    |---> Patient Instructions Section (needs patient identity for signing)

Note Templates (basic) ---> Custom Template Builder (extends basic templates)
                       ---> Condition-specific Templates (extends basic templates)

Organization Infrastructure (existing) ---> Clinic Admin Dashboard
                                       ---> Shared Templates/Macros (clinic-level)
                                       ---> Seat-based Billing

Custom Shorthand/Macro Library (standalone -- no dependencies)
Time-saved Tracking (standalone -- uses existing usage table)
Copy per Section (standalone -- UI-only change)
EMR-specific Output Formatting (standalone -- prompt engineering)
```

---

## MVP Recommendation

### Phase 2 (PHI Storage) -- The Competitive Pivot

Prioritize (already designed in PHI_STORAGE_PLAN.md):

1. **Patient records** -- minimal creation (name + pronoun), detail page with profile fields
2. **Note persistence** -- save generated notes linked to patients with session metadata
3. **Note history per patient** -- chronological table with date/title/duration
4. **Patient context persistence** -- free-text field per patient, injected into all future note generation
5. **Note versioning** -- append-only amendment trail for HIPAA compliance
6. **Inline editing of persisted notes** -- extend existing Phase B editing to saved notes

These six features transform FlashNote from a disposable generation tool into a clinical documentation platform with real switching cost.

### Immediate post-PHI (high value, low effort):

7. **PDF export** -- single note + bulk download
8. **Copy per section** -- per-SOAP-section copy buttons
9. **Auto-generated note titles** -- LLM generates descriptive title
10. **Time-saved tracking** -- display on dashboard KPI cards
11. **Custom shorthand/macro library** -- day-1 differentiator for retention

### Defer:

- **AI re-edit ("Magic Edit")**: Medium complexity, high value, but requires solid note persistence foundation first. Build after core PHI storage is stable.
- **Treatment plan generation**: Medium-high complexity, depends on having meaningful note history per patient. Build after PTs have accumulated notes.
- **CPT/ICD-10 code suggestions**: Medium-high complexity, requires PT-specific code mapping. Valuable but not blocking adoption.
- **Clinic admin dashboard**: Medium-high complexity. Individual PTs are the initial market. Clinic features follow PMF validation.
- **Custom template builder**: Medium complexity. Basic template preferences (verbosity/style) cover the initial need. Full builder is a Phase 3 feature.
- **Documentation quality scoring**: Medium complexity, requires rubric development with PT clinical input. Post-PMF feature.
- **EMR-specific output formatting**: Needs real user feedback on which EMRs to target. Build after launch with user data.

---

## Competitive Context

### Landscape Summary

The PT documentation space has 6+ AI-specific competitors plus generalist tools. No single dominant leader for PT-specific AI documentation.

| Competitor | Input Model | Patient Records | Note Storage | Voice | Templates | Pricing |
|------------|-------------|-----------------|--------------|-------|-----------|---------|
| **Twofold** | Text + Voice | Yes | Yes | Yes | 60+ (no PT-specific) | ~$69/mo |
| **ScribePT** | Voice + Dictation | Yes | Yes (via EMR) | Yes | Clinic-trainable AI | ~$99/mo |
| **Freed** | Voice + Text | Via EHR push | Via EHR | Yes | Learned format | $149/mo |
| **Heidi** | Voice + Text | Context linking | Via EHR | Yes | Specialty templates | ~$100/mo |
| **SPRY** | Text + Voice | Full EMR | Full EMR | Yes | PT-specific | Custom |
| **WebPT** | Manual + AI assist | Full EMR | Full EMR | AI scribe | PT-specific | ~$99/mo |
| **FlashNote** | Text shorthand | **Not yet** | **Not yet** | No | Basic SOAP | $69/mo |

### Where FlashNote Wins

1. **Shorthand-first**: Unique input model that is faster than voice for between-patient documentation
2. **PT-specific prompts**: Purpose-built for PT abbreviations, ROM values, strength grades, gait analysis
3. **Price**: $69/mo is competitive to low-end for the feature set
4. **HIPAA architecture**: Google Cloud BAA, DAL authorization pattern, immutable audit logs -- purpose-built, not bolted on

### Where FlashNote Loses (Today)

1. **No patient records**: Every competitor has this. The single biggest product gap.
2. **No note persistence**: Lose-and-forget model eliminates continuity of care
3. **No voice input**: Competitive table stakes, though FlashNote deliberately differentiates on text
4. **No template customization**: Basic SOAP only vs. 60+ templates in competitors
5. **No billing code suggestions**: Growing expectation in the market

The PHI storage milestone directly addresses gaps #1 and #2, which are the only truly critical gaps. Gaps #3-5 are meaningful but not adoption-blocking for PTs who prefer the shorthand workflow.

---

## Sources

- Direct competitor evaluation: Twofold Health (hands-on 7-day trial, February 2026) -- `docs/planning/TWOFOLD_DEEP_DIVE.md`
- Competitive analysis: 15+ competitors mapped -- `docs/planning/COMPETITIVE_ANALYSIS.md`
- Retention strategy: 4-layer switching cost framework -- `docs/planning/RETENTION_STRATEGY.md`
- PHI storage design: Database schema + implementation plan -- `docs/planning/PHI_STORAGE_PLAN.md`
- Voice input research: Provider comparison + cost analysis -- `docs/planning/VOICE_INPUT_ROADMAP.md`
- [APTA Documentation Standards](https://www.apta.org/your-practice/documentation)
- [Net Health: PT Documentation Software Guide](https://www.nethealth.com/blog/physical-therapy-documentation-software-comprehensive-guide/)
- [Netsmart: Top 5 PT Documentation Features](https://www.ntst.com/blog/2024/top-5-physical-therapy-documentation-features)
- [WebPT: AI Tools for PT Documentation](https://www.webpt.com/rehab-ai)
- [ScribePT: AI Scribe Features](https://www.scribept.com/best-ai-scribe-features/)
- [Freed: AI Medical Scribe](https://www.getfreed.ai/resources/best-ai-scribes)
- [Heidi Health: AI Care Partner](https://www.heidihealth.com/)
- [SPRY: PT Software](https://www.sprypt.com/)
- [Noterro: AI SOAP Notes for PT](https://www.noterro.com/blog/ai-soap-notes-software-for-physical-therapists)
- [Medicare Documentation Requirements for PT](https://www.webpt.com/blog/medicare-part-b-documentation-requirements-physical-and-occupational-therapy)
- [Roving Health: AI Medical Coding Automation](https://www.rovinghealth.com/articles/medical-coding-automation-ai-icd10-cpt-clinical-notes)
- [OT Potential: AI Scribes Compared](https://otpotential.com/blog/rehab-ai-scribes-compared-for-ot-pt-and-slp)
