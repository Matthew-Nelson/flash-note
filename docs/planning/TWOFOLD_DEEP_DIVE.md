# Twofold Health — Product Deep Dive

**Date:** February 16, 2026
**Source:** Hands-on evaluation via 7-day free trial
**Status:** In Progress

---

## Product Sitemap / Feature Map

```
Twofold Health
├── Auth & Onboarding
│   ├── Sign up (email/password — no confirm password field)
│   ├── Sign up with Google (OAuth — skips email verification)
│   ├── Legal acceptance via passive disclaimer ("creating account = acceptance")
│   ├── Auth provider: Clerk
│   └── Onboarding flow (collects name, specialty, practice size, etc.)
│
├── Left Sidebar Navigation (6 icons)
│   ├── 🎤 Record/Voice (microphone icon — top)
│   ├── 👥 Patients
│   ├── 📄 Notes (note list with All/Unread tabs + search)
│   ├── 📋 Templates
│   ├── ⚙️ Settings
│   └── 👤 Team/Users (bottom)
│
├── Patients
│   ├── Patient list (table: name, # notes, last note date)
│   ├── Search patients
│   ├── + New Patient (minimal: pronoun + name)
│   ├── Bulk delete patients
│   ├── Patient Detail Page (6 tabs):
│   │   ├── Overview
│   │   │   ├── Profile: pronoun, name, phone (country selector), email, DOB
│   │   │   └── "Last Note Summary" card (AI-generated 4-sentence summary of most recent note)
│   │   │       └── "Is this helpful?" thumbs up/down feedback
│   │   ├── Assistant (patient-specific AI chatbot)
│   │   │   ├── "Ask me anything" free-text input
│   │   │   ├── Suggested questions (clickable chips):
│   │   │   │   ├── "Summarize patient progress in last several sessions"
│   │   │   │   ├── "Identify trends in patient care"
│   │   │   │   ├── "Generate homework based on last session"
│   │   │   │   └── "Show more" for additional suggestions
│   │   │   └── Chat responses area
│   │   ├── Patient Notes
│   │   │   ├── Note history table (Title, Duration, Date)
│   │   │   ├── "Download PDFs" (bulk export)
│   │   │   ├── "Delete notes" (bulk delete)
│   │   │   └── Filter dropdown ("All")
│   │   ├── Patient Context
│   │   │   ├── Free-text field (persisted, manually entered)
│   │   │   ├── "Used by the system when generating notes. Applies to ALL notes for this patient."
│   │   │   ├── "May include known conditions, goals or details not in conversation"
│   │   │   └── "Save Context" button
│   │   ├── Treatment Plan
│   │   │   ├── Automatic: "Generate from notes" — choose 1-3 notes to generate
│   │   │   ├── Manual: "Write your own" — paste or type treatment plan
│   │   │   └── "Future notes will take this treatment plan into consideration"
│   │   └── Reports
│   │       ├── Report table (Diagnosis, Created At, Report Period)
│   │       └── "+ New Report" button
│   └── "New Conversation" button on patient page (starts voice recording for that patient)
│
├── Notes / Note Generation
│   ├── "Text to Note" input flow:
│   │   ├── Patient selector
│   │   ├── Template selector (SOAP, others TBD)
│   │   ├── Modality selector (In person, others TBD)
│   │   ├── Session duration (minutes, optional)
│   │   ├── Session time (auto-filled, editable)
│   │   ├── Free-text input area (minimum 20 words)
│   │   └── "Generate note from text" button
│   ├── Voice-to-Note ("Capture Conversation"):
│   │   ├── Recording setup: Patient name (text field), Template, Microphone selector, Modality
│   │   ├── "Show Patient Context and Last Note Summary" expandable side panel
│   │   │   └── Tabs: Assistant, Last Note Summary, Treatment Plan (visible during setup)
│   │   ├── "Capture Conversation" button with dropdown (likely upload option)
│   │   ├── Microphone device selection dropdown
│   │   ├── Recording duration tracked and displayed in note metadata
│   │   ├── Audio failure graceful fallback: "Enter Manually" → text-to-note
│   │   ├── "How to tell my patients about Twofold?" guidance link
│   │   └── Post-recording: same processing flow → identical SOAP output format
│   ├── Processing state (non-streaming, full server-side generation, ~85% progress indicator)
│   ├── Generated Note View:
│   │   ├── Auto-generated title (e.g., "Lumbar Spine Rehabilitation Progress")
│   │   ├── Metadata bar (date, time, modality icon "In person")
│   │   ├── SOAP sections (Subjective, Objective, Assessment, Plan)
│   │   ├── Patient Instructions section (patient-facing letter, signed by provider)
│   │   ├── Per-section "Copy Text" button
│   │   ├── Per-section "Save Changes" (inline editable text areas)
│   │   ├── "Copy All" button (top bar)
│   │   ├── "Magic Edit" button (top bar + bottom)
│   │   ├── "Rate This Note" (5-star rating at bottom)
│   │   └── "Not happy with the note?" prompt → Magic Edit
│   ├── Section-level manual editing (click section → editable textarea → Save Changes)
│   ├── Magic Edit ("Refine Your Note"):
│   │   ├── Free-text instruction field
│   │   ├── 3 clickable example prompts:
│   │   │   ├── "Include the specific discussion about [e.g., treatment options]"
│   │   │   ├── "Expand on the patient's described symptoms, like [e.g., frequent headaches]"
│   │   │   └── "Add insights about [e.g. the patient's history relevant to the session]"
│   │   └── Submit button → re-generates note with instruction
│   └── Note list sidebar (chronological, shows patient name + note title + date)
│
├── Templates
│   ├── Template Library (~60+ pre-built templates)
│   │   ├── "My Templates" / "All Templates" tabs
│   │   ├── Search by template name or specialty
│   │   ├── Each card: section list, Remove/Edit/Share buttons
│   │   ├── "Added" badge for templates in user's collection
│   │   └── "+ Create New Template" button
│   ├── Template Categories (NO PT-SPECIFIC TEMPLATES):
│   │   ├── General: SOAP, SOAP Combined Assessment and Plan
│   │   ├── Mental Health: SOAP MH, Progress MH, Intake MH, BIRP, DAP, GIRP, PIRP, SIRP, DBT, EMDR
│   │   ├── Psychiatric: Evaluation, Intake, Progress, Medication Management, Forensic
│   │   ├── Therapy Platforms: Grow Therapy, Simple Practice, Headway, Therapy Notes, Barbara Griswold
│   │   ├── Primary Care: Primary Care Note, Medical Visit, Practice Fusion, Acute Medical
│   │   ├── Specialty: Allergist, OB/GYN, Prenatal, Emergency, Addiction, Surgical
│   │   ├── Pediatric: Pediatrics Note, Well-Child Visit, Sports/School Physical
│   │   └── Other: Supervision, Couples Therapy, Case Management, H&P, Discharge Summary, ADIME
│   ├── Template Section Structure (per section):
│   │   ├── Section Title (editable)
│   │   ├── Verbosity toggle (Concise / Detailed)
│   │   ├── Styling toggle (Paragraph / Bullet points)
│   │   ├── Section Content (free-text prompt instructions for AI)
│   │   ├── Advanced Settings:
│   │   │   └── "Include in 'Copy all'" toggle
│   │   ├── Reorder arrows (up/down)
│   │   └── Delete button
│   ├── Custom Template Creation:
│   │   ├── Template Name
│   │   ├── Add sections (unlimited)
│   │   ├── Configure each section (title, verbosity, styling, content instructions)
│   │   └── Save
│   ├── Edit Template → creates a copy (originals preserved)
│   └── Share Template → public URL (anyone with link can add it)
│       └── Format: https://app.trytwofold.com/templates/use-public-template/{id}
│
├── Settings / Account
│   ├── [TBD] Profile management
│   ├── [TBD] Practice/org settings
│   ├── [TBD] Subscription management
│   └── [TBD] Team/user management (group plan)
│
├── Top Bar (persistent)
│   ├── "Your trial expires in 7 days" badge
│   ├── "Special offer: First month only $19" promo
│   ├── Chat/messaging icon
│   └── User avatar/initials
│
└── [TBD] Unexplored
    ├── Patient "Assistant" tab
    ├── Patient "Patient Context" tab
    ├── Patient "Treatment Plan" tab
    ├── Patient "Reports" tab
    ├── Voice/Recording workflow details
    ├── Template detail views
    ├── Mobile app
    └── Integrations / export
```

---

## Feature Comparison: Twofold vs. FlashNote

| Feature | Twofold | FlashNote | Gap? |
|---|---|---|---|
| **Auth: Google OAuth** | Yes (via Clerk) | No (custom JWT) | YES |
| **Auth: Passive legal acceptance** | Yes (disclaimer) | No (explicit checkbox) | Minor UX |
| **Auth: No confirm password** | Yes | No | Minor UX |
| **Auth: Email verification** | Skipped for OAuth; unknown for email/pw | Yes (required) | N/A |
| **Onboarding: Profile collection** | Yes (name, specialty, practice size) | No onboarding flow | YES |
| **Patient records** | Yes (stores patient info) | No (zero patient data) | **MAJOR** |
| **Note history per patient** | Yes (all past notes saved) | No (pass-through only) | **MAJOR** |
| **Note editing** | Yes (per-section inline editing) | No | **MAJOR** |
| **Note saving** | Yes (persistent, per patient) | No (pass-through only) | **MAJOR** |
| **Magic Edit (AI re-edit)** | Yes (free-text instruction + example prompts) | No | YES |
| **Patient Instructions section** | Yes (patient-facing letter, signed by provider) | No | YES |
| **Auto-generated note title** | Yes (e.g., "Lumbar Spine Rehabilitation Progress") | No | Minor |
| **Note rating** | Yes (5-star per note) | No | Minor |
| **Per-section Copy Text** | Yes (copy individual S/O/A/P sections) | Copy all only | Minor |
| **Copy All** | Yes | Yes | Parity |
| **Template library** | ~60+ pre-built, heavily MH-focused, ZERO PT-specific | Hardcoded note types | YES |
| **Template builder** | Per-section: title, verbosity, styling, prompt instructions, advanced settings | No | YES |
| **Custom templates** | Full builder + edit-creates-copy pattern | No | YES |
| **Template sharing** | Public URL link sharing | No | Minor |
| **Last Note Summary** | Auto-generated summary on patient overview | None | YES |
| **Patient-specific AI Assistant** | Chat interface with note history context; suggested clinical questions | None | **MAJOR** |
| **Patient Context (persisted)** | Free-text, manually entered, feeds into ALL future notes | Per-session only (not persisted) | **MAJOR** |
| **Treatment Plan generation** | Auto-generate from 1-3 notes OR manual; feeds into future notes | None | **MAJOR** |
| **Reports** | Generate reports by diagnosis and time period (progress/discharge) | None | YES |
| **PDF export** | Bulk download notes as PDFs | None | YES |
| **Text-to-note input** | Yes (min 20 words, session metadata) | Yes (quickNotes shorthand) | Parity |
| **Voice-to-note input** | Yes ("New Conversation" button, microphone icon) | No | YES |
| **Non-streaming generation** | Full server-side generation with progress % | Streaming response | Different approach |
| **Recording storage** | No (pass-through) | No (pass-through) | Parity |
| **Note generation** | Yes | Yes | Parity |
| **HIPAA/BAA** | Yes (Azure infrastructure) | Yes | Parity |

### Gap Priority

**Critical (core product gaps — architectural decisions needed):**
1. Note persistence — saving generated notes for future reference and longitudinal context
2. Patient records — storing patient info, tying notes to patients
3. Persisted patient context — stored context that feeds into ALL future note generation
4. Treatment plan generation — auto-generate from notes, feeds into future notes
5. Note editing — per-section inline editing + AI re-editing ("Magic Edit")

**High (significant competitive features):**
6. Patient-specific AI Assistant — chat interface with full note history context
7. Reports — progress/discharge report generation by diagnosis and time period
8. PDF export — bulk download notes as PDFs
9. Google OAuth — reduces signup friction significantly
10. Template system — structured, customizable, shareable templates
11. Patient Instructions section — patient-facing plain-language summary in note output
12. Voice-to-note input — "New Conversation" recording workflow

**Important (competitive polish):**
13. Onboarding flow — collects specialty/practice context upfront
14. Last Note Summary — auto-generated summary on patient overview
15. Auto-generated note titles
16. Note rating (5-star feedback system)
17. Per-section Copy Text

**Minor UX:**
18. Passive legal acceptance (disclaimer vs. checkbox)
19. Remove confirm password field

---

## Strategic Analysis

### The Note Storage Question

**Current FlashNote architecture:** Zero PHI storage. Notes are generated via LLM and returned to the user. Nothing persists.

**What Twofold does:** Stores patient info, stores all generated notes per patient, allows editing and review of past notes. Recordings are NOT stored (same as FlashNote).

**Why this matters competitively:**
- **Continuity of care:** A PT seeing a patient 2x/week for 8 weeks generates 16 notes. Being able to reference past notes when writing new ones is a significant workflow advantage.
- **Context for AI:** Past notes can feed into future note generation, improving accuracy over time ("patient previously presented with..." or "continued progress toward goals established on...").
- **Audit trail:** Clinicians need to reference past documentation for insurance audits, peer review, and legal protection.
- **Switching cost / retention:** Once a clinician's note history lives in Twofold, switching to FlashNote means losing that history. Note storage is a powerful retention mechanism.

**HIPAA implications of storing notes:**
- Notes contain PHI — storing them requires encryption at rest, access controls, audit trails, data retention policies
- Requires BAA with hosting provider (already have for current infra)
- Requires data backup and disaster recovery plan
- Requires breach notification procedures for stored data
- Requires user-facing data deletion/export capabilities
- Increases compliance surface area significantly

**The tradeoff:**
- Pass-through model = simpler compliance, lower risk, but weaker product
- Storage model = harder compliance, higher risk, but much stronger product and retention

**Recommendation:** This needs a deliberate decision. The competitive gap is real — every competitor in this space stores notes. The pass-through model was a smart v1 de-risking decision, but it's now a product limitation that competitors exploit.

---

## Open Questions (Need More Exploration)

### Product Questions
- [x] What input methods does Twofold support? → Text-to-Note confirmed; Voice ("New Conversation") exists but unexplored
- [x] How does note generation actually work? → Type shorthand in text area (min 20 words), select template/modality/duration → server-side generation → full note returned
- [x] What does "Magic Edit" actually do? → Free-text instruction sent with the note for AI re-generation; 3 example prompt suggestions
- [x] What PT-specific templates exist? → **NONE.** Zero PT templates in 60+ template library. PT uses generic SOAP. Library is overwhelmingly mental health/behavioral health focused.
- [ ] What does patient progress tracking look like? (Patient "Reports" tab?)
- [ ] Treatment plan generation — does it exist? (Patient "Treatment Plan" tab exists)
- [ ] What does the mobile app look like?
- [x] How does template customization work? → Section-based builder: title, verbosity (concise/detailed), styling (paragraph/bullets), content instructions (AI prompt), advanced settings (include in copy all). Edit creates a copy. Share via public URL.
- [x] What is the "Assistant" tab? → Patient-specific AI chatbot with note history context; suggested questions include progress summaries, trend identification, homework generation
- [x] What is the "Patient Context" tab? → Free-text field, manually entered, persisted, explicitly injected into ALL future note generation for that patient
- [x] What does the voice/recording workflow look like? → "Capture Conversation" ambient recording; mic selection; patient context side panel during setup; audio failure falls back to "Enter Manually" (text-to-note); duration tracked in note metadata; identical SOAP output
- [ ] What modalities are available beyond "In person"? (dropdown exists but unexplored)
- [x] What templates are available beyond "SOAP"? → ~60+ templates in library, see Template Library section
- [ ] Does generating a second note for a patient auto-include context from previous notes?

### Technical Questions
- [x] What's their API structure? → **tRPC** with batching, hosted at `api.trytwofold.com`, Azure infrastructure
- [x] Auth system? → **Clerk** (RS256 JWT, 60s lifetime, custom domain `clerk.trytwofold.com`)
- [ ] What LLM are they using? (no clues yet — opaque server-side processing)
- [ ] Note generation latency? (need timing measurements)
- [ ] How does "personal writing style learning" work?
- [ ] What data do they send to the LLM? (just current input? past notes too?)

### Business Questions
- [ ] What are the actual free plan limitations?
- [ ] How does the group/practice plan work?
- [ ] What does their billing/subscription flow look like?

---

## Observations Log

### Session 1 — February 16, 2026

**Onboarding:**
- Signup via Google OAuth — no email verification required
- Passive legal acceptance (no checkbox)
- No confirm password field
- Onboarding collects: name, specialty, practice size
- Auth provider: Clerk
- Two pre-loaded sample patients ([Sample] Sarah Brown, Michael Brown) with sample notes

**Core Workflow (Phase 1 — Screenshots captured):**

1. **Viewed sample note** (Michael Brown — "Physical Therapy Follow-Up Progress")
   - Full SOAP note with S/O/A/P sections plus "Patient Instructions" (patient-facing letter)
   - Each section has individual "Copy Text" and "Save Changes" buttons
   - "Copy All" and "Magic Edit" in top bar
   - "Rate This Note" (5-star) at bottom
   - Note signed "Matthew Nelson, PT" (pulled from onboarding profile)

2. **Tested Magic Edit on sample note**
   - Modal: "Refine Your Note — Something missing or wrong in this note? Tell our AI what to fix:"
   - Free-text instruction field
   - 3 clickable example prompts (treatment options, symptoms, patient history)
   - Submit button to re-generate

3. **Viewed Patients list**
   - Table with columns: Patient, Number of notes, Last note
   - Search, "+ New Patient", "Delete patients" (bulk), overflow menu
   - Pagination controls
   - Row selection checkboxes

4. **Created new patient ("New Patient")**
   - Minimal creation modal: pronoun dropdown + name field only
   - Cancel / Create buttons
   - Low friction — no required fields beyond name

5. **Patient detail page revealed 6 tabs:**
   - **Overview**: Pronoun, Name, Phone (with country selector), Email, DOB
   - **Assistant**: Unexplored
   - **Patient Notes**: Note history for this patient
   - **Patient Context**: Unexplored (likely stored context for AI)
   - **Treatment Plan**: Unexplored
   - **Reports**: Unexplored
   - "New Conversation" button (microphone icon) for voice recording

6. **Text to Note form (empty)**
   - Patient selector, Template (SOAP), Modality (In person)
   - Session duration in minutes (optional), Session time (auto-filled)
   - Large text area with placeholder examples (behavioral-health-leaning, not PT-specific)
   - Minimum 20 words required, word counter shown
   - "Generate note from text" button (disabled until min words met)

7. **Text to Note form (filled with PT shorthand)**
   - Entered 144 words of real PT shorthand:
     - S: Pain levels, HEP compliance, functional changes
     - O: ROM values with prior comparisons, strength grades, gait observations, treatment delivered
     - A: Progress summary with arrows (↑↓→)
     - P: Frequency, progressions, HEP updates, STG
   - Session duration: 60 minutes

8. **Processing state**
   - Non-streaming: full page spinner with "Processing... This may take a few seconds."
   - Sidebar shows progress percentage (85) in a circular indicator
   - No partial/streaming output — note delivered complete

9. **Generated note: "Lumbar Spine Rehabilitation Progress"**
   - Auto-generated descriptive title
   - Well-structured Objective with clear subheadings:
     - Lumbar Spine Range of Motion (ROM)
     - Straight Leg Raise (SLR)
     - Hip Abduction Strength
     - Gait Analysis
     - Palpation Findings
     - Therapeutic Interventions Administered
   - Assessment organized by clinical problems (not just numbered)
   - Plan organized by same problems with specific interventions
   - Patient Instructions: full letter to patient in plain language
   - Rated 3 stars

10. **Second generation variant: "Lumbar Pain Progress and Therapy Update"**
    - Different title and slightly different structure from same input
    - Suggests non-deterministic generation (expected with LLMs)
    - Patient Instructions section highlighted with blue border when clicked (inline editing)

11. **Section-level manual editing**
    - Each section (S/O/A/P/Instructions) is independently editable
    - Click → textarea with blue border → edit → "Save Changes"
    - Granular control vs. editing the entire note

12. **Used Magic Edit with custom instruction: "I want it to be more technical"**
    - Free-text instruction approach (not predefined options)
    - Sends note + instruction back through LLM for re-generation

**Key observations from note output quality:**
- PT shorthand was correctly expanded (ROM values, strength grades, abbreviations)
- Objective section well-organized with clinical subheadings
- Assessment uses problem-oriented format (good for PT)
- Plan includes specific, actionable items
- Patient Instructions is a standout feature — patient-facing plain-language summary
- Note title auto-generated from content
- Provider signature pulled from user profile
- Placeholder examples in text input are NOT PT-specific (generic/behavioral health)

**Templates:**
- Structured templates per specialty
- Custom template creation
- Template sharing between users
- Likely practice-level templates (TBD)

---

## Next Exploration Rounds

### Round 2: Patient Tabs — COMPLETED
All 6 tabs explored. Key findings:
- [x] **Overview** — Profile fields + "Last Note Summary" (AI-generated 4-sentence summary with feedback)
- [x] **Assistant** — Patient-specific AI chatbot; suggested questions: progress summaries, trend identification, homework generation
- [x] **Patient Notes** — Note history table with PDF download and bulk delete
- [x] **Patient Context** — Free-text field that feeds into ALL future note generation
- [x] **Treatment Plan** — Auto-generate from 1-3 notes OR manual; feeds into future notes
- [x] **Reports** — Report generation by Diagnosis + Report Period; empty state with "+ New Report"

### Round 3: Template System
- [ ] Browse all available templates (what's available for PT?)
- [ ] Create a custom template
- [ ] Template sharing mechanics
- [ ] What fields/sections are configurable?

### Round 4: Voice/Recording Workflow
- [ ] "New Conversation" button on patient page
- [ ] Microphone icon in left sidebar
- [ ] How does voice recording → note generation work?
- [ ] Real-time vs. post-session transcription?

### Round 5: Technical Recon — IN PROGRESS
- [x] DevTools Network tab during text-to-note generation (request payload captured)
- [x] Response payload structure (versioned text system, section schema, metadata)
- [x] Voice capture type confirmed (`CAPTURE_CONVERSATION` with chunked audio upload)
- [x] Built-in template types enumerated (9 typed columns + custom)
- [x] ID prefix system mapped (n_, p_, user_, sct_, UUIDv7, NanoID)
- [x] API framework identified: **tRPC** (not raw GraphQL) with batching
- [x] API domain: `foodforthought.trytwofold.com`
- [x] Generation flow: polling via `getVisitStatusesByIds` (not streaming/SSE)
- [x] Real-time layer: SSE connections (Pusher/Ably) for other events
- [x] Clerk auth confirmed (JS v5.122.1, API version 2025-11-10)
- [x] Magic Edit mutation identified: `visits.updateUserInstructionsTextAndRegenerateNote`
- [x] tRPC procedure names cataloged
- [x] Auth header decoded: Clerk RS256 JWT, 60-second lifetime, no custom claims
- [x] Infrastructure: Azure (`20.119.0.47`), strong security headers
- [x] Architecture map: app/api/clerk domains identified
- [x] Polling response structure: lightweight `{ id, status, isRegeneratingSuccessfulNote }`
- [ ] Magic Edit request payload details
- [ ] LLM provider identification
- [ ] Latency measurements (polling interval + total generation time)
- [ ] Voice-to-note audio upload flow
- [ ] Intermediate status values during generation (what comes before `SOAP_GENERATE_SUCCESS`?)

### Round 6: Settings, Billing, Free Plan Limits
- [ ] Settings page walkthrough
- [ ] Free plan walls (what's gated?)
- [ ] Subscription management UI

---

## Technical Recon

### Session 1 — February 16, 2026

#### Text-to-Note Generation Request (Create Visit Mutation)

**Protocol:** GraphQL (not REST)

**Request payload (text-to-note):**
```json
{
  "createVisitForTextPipelineVersion": "v1",
  "visitId": "n_0sqbaMoWd5VX",
  "captureType": "TEXT_INPUT",
  "createdAtClientTime": "2026-02-16T22:57:44.812Z",
  "createdAtManualOverrideTime": "2026-02-16T22:55:00.000Z",
  "modality": "IN_PERSON",
  "patientId": null,
  "selectedNoteTemplate": {
    "type": "custom",
    "customNoteTemplateId": "sct_V9NkfNBWAv5k"
  },
  "textInput": "<full shorthand text sent as-is>",
  "visitDurationSecondsSetByUser": 2700,
  "webUserDeviceId": "IYWx36W75ks0gyNj0zuBNBdTIh"
}
```

**Key observations:**

| Finding | Detail | Implication |
|---|---|---|
| **GraphQL API** | Mutation-based, not REST | More complex API layer; single endpoint for all operations |
| **Internal model: "visits"** | Notes are `visits` with `visitId` prefix `n_` | Terminology: visit = note + session metadata |
| **Pipeline versioning** | `createVisitForTextPipelineVersion: "v1"` | Supports A/B testing or gradual prompt/pipeline rollouts |
| **Capture type enum** | `"TEXT_INPUT"` | Also `"CAPTURE_CONVERSATION"` for voice (confirmed in response) |
| **Patient is optional** | `patientId: null` allowed | Can generate notes without patient association |
| **Template discriminator** | `{ type: "custom", customNoteTemplateId: "sct_..." }` | Built-in vs custom templates are differentiated; `sct_` prefix for template IDs |
| **Raw text, no preprocessing** | Full shorthand sent verbatim | All parsing/expansion happens server-side (LLM does the work) |
| **Device tracking** | `webUserDeviceId: "IYWx36W75ks0gyNj0zuBNBdTIh"` | Analytics, session correlation, or fraud detection |
| **Dual timestamps** | `createdAtClientTime` + `createdAtManualOverrideTime` | Separates "when submitted" from "when session occurred" |
| **Duration in seconds** | `visitDurationSecondsSetByUser: 2700` (45 min) | User-reported session length, likely included in note metadata |
| **ID format** | `n_` prefix for visits, `sct_` prefix for templates | Namespaced IDs — possibly NanoID or similar with type prefixes |

#### Response Payload (Note Fetch / Batch Query)

**Protocol:** GraphQL batched response `[{ result: { data: {...} } }]`

**Two notes returned — one text, one voice:**

| Field | Text Note (`n_P1dd...`) | Voice Note (`n_5wK9...`) | Notes |
|---|---|---|---|
| `captureType` | `TEXT_INPUT` | `CAPTURE_CONVERSATION` | Voice capture type confirmed |
| `pipelineVersion` | `V3` | `V3` | Generation pipeline version (separate from API version) |
| `visitDurationSeconds` | `null` | `80` | Actual recording duration for voice; null for text |
| `allRecordingPartsUploadedAt` | `null` | `2026-02-16T22:37:48.341Z` | Chunked audio upload timestamp |
| `patientDialogFinishedAt` | `null` | `null` | Suggests optional patient dialog step in voice flow |
| `status` | `SOAP_GENERATE_SUCCESS` | `SOAP_GENERATE_SUCCESS` | Enum — likely has failure states too |
| `isRegeneratingSuccessfulNote` | `false` | `false` | Magic Edit tracking |
| `numberOfRegenerateAttempts` | `0` | `0` | Re-generation counter |
| `manualRating` | `null` | `null` | 5-star rating (null = unrated) |
| `patientVersion` | `V2` | `V2` | Patient data model version |

**Versioned text system (supports Magic Edit revision history):**
```json
{
  "sectionTitle": "Subjective",
  "includedInCopyAll": true,
  "versionedText": {
    "id": "7l29Ca2ujdPZZbN6AW525",
    "versions": [
      {
        "id": "00kelH1nclyVu0mBiW2iq",
        "version": 1,
        "text": "New Patient reports experiencing pain rated at 4 out of 10..."
      }
    ]
  }
}
```
Each section and the title have independent version arrays. Magic Edit likely appends a new version entry (version 2, 3, etc.) rather than replacing.

**Built-in template types (all null for custom template, but reveals the full set):**
- `visitTemplateContentSoap`
- `visitTemplateContentSoapAnp` (SOAP Combined Assessment & Plan)
- `visitTemplateContentBirp`
- `visitTemplateContentGirp`
- `visitTemplateContentDap`
- `visitTemplateContentMentalIntake`
- `visitTemplateContentMentalProgress`
- `visitTemplateContentMentalSoap`
- `visitTemplateContentMentalSoapAnp`

Custom templates use `customTemplateContent` with dynamic sections array. Built-in templates use the typed columns above — this means built-in templates have **fixed schemas** while custom templates are flexible.

**Patient Instructions:** `includedInCopyAll: false` — deliberately excluded from "Copy All" by default.

**ID prefix system (confirmed):**
| Prefix | Entity | Example |
|---|---|---|
| `n_` | Visit/Note | `n_P1ddxLpwqW76` |
| `p_` | Patient | `p_oqRwnOUNfRoB` |
| `user_` | User (Clerk) | `user_39l2YdwQOvvGuIJBZdyGHogPCJQ` |
| `sct_` | Custom template | `sct_V9NkfNBWAv5k` |
| NanoID | Versioned text/version entries | `7l29Ca2ujdPZZbN6AW525` |
| UUIDv7 | Template version | `019315f4-4c5c-7cb1-812c-0ebddda225e3` |

#### Network Architecture (from DevTools Network Tab)

**API framework: tRPC (not raw GraphQL)**

| Component | Detail |
|---|---|
| **API domain** | `foodforthought.trytwofold.com` |
| **Framework** | tRPC with `?batch=1` batching (multiple procedure calls per HTTP request) |
| **Auth** | Clerk JS `v5.122.1`, API version `2025-11-10`, token refresh via `/tokens` endpoint |
| **Real-time** | SSE connections via `e/?ip=0&ver=1.341.0&compression=gzip` (likely Pusher or Ably) |
| **Session tracking** | `userDevice.updateWebUserDeviceSessionPing` heartbeat |
| **Telemetry** | `userDevice.getWebUserDeviceShouldSendTelemetry` opt-in check |

**tRPC procedure names observed:**

| Procedure | Type | Purpose |
|---|---|---|
| `visits.getVisitStatusesByIds` | Query (polled) | Generation progress — called repeatedly until `SOAP_GENERATE_SUCCESS` |
| `visits.getVisit` | Query | Fetch single visit/note |
| `visits.getVisitForVisitList` | Query | Fetch visit for list view |
| `visits.updateUserInstructionsTextAndRegenerateNote` | Mutation | **Magic Edit** — sends instruction + note ID for re-generation |
| `user.getUserPersonalInformation` | Query | User profile data |
| `userDevice.getWebUserDeviceId` | Query | Device identification |
| `userDevice.updateWebUserDeviceSessionPing` | Mutation | Session keepalive heartbeat |
| `userDevice.getWebUserDeviceShouldSendTelemetry` | Query | Telemetry opt-in |

**Generation flow (confirmed: polling, not streaming):**
1. Client sends create visit mutation
2. Client immediately starts polling `visits.getVisitStatusesByIds` on interval
3. Server processes asynchronously (likely queued to LLM)
4. Each poll response includes status (drives progress indicator)
5. When status = `SOAP_GENERATE_SUCCESS`, client fetches the full note

**Why requests look "monstrously large":**
tRPC batching (`?batch=1`) combines multiple procedure calls into a single HTTP request. Input parameters are URL-encoded JSON in the query string, making URLs very long. Response bodies contain arrays of results matching each batched call.

#### Infrastructure & Auth Details

**Architecture map:**
| Service | Domain | Notes |
|---|---|---|
| Web app | `https://app.trytwofold.com` | React SPA (tRPC client) |
| API | `https://api.trytwofold.com/trpc/{procedure}` | tRPC server, Azure-hosted |
| Auth | `https://clerk.trytwofold.com` | Clerk custom domain |
| Hosting | Azure (`20.119.0.47`) | Confirms HIPAA/Azure claim |

**Clerk JWT structure (RS256, 60-second lifetime):**
```
Header: { alg: RS256, kid: "ins_2dGUcvg2Bb8sTWarq7Xr0c78xW5" }
Payload: {
  azp: "https://app.trytwofold.com",    // authorized party
  iss: "https://clerk.trytwofold.com",   // issuer (custom Clerk domain)
  sub: "user_39l2YdwQ...",              // user ID
  sid: "sess_39l2YfZI...",              // session ID
  sts: "active",                         // session status
  metadata: {},                          // no custom claims
  exp/iat delta: 60 seconds              // extremely short-lived, constant refresh
}
```

Key auth observations:
- **60-second token lifetime** — much shorter than typical (FlashNote uses 1 hour). Forces frequent `/tokens` refresh calls but limits exposure window.
- **No custom claims** — subscription status, user profile, etc. are NOT in the JWT. All fetched server-side via `user.getUserPersonalInformation`. This means every API call must do a DB lookup.
- **RS256** — asymmetric signing. Backend needs only the public key to verify.
- **`sess_` prefix** — Clerk session IDs.

**Security headers (response):**
- CSP: `default-src 'self'` with strict policy
- HSTS: `max-age=15552000; includeSubDomains` (~180 days)
- CORS: strict single-origin (`https://app.trytwofold.com`), not wildcard
- COEP: `require-corp`, COOP: `same-origin`, CORP: `same-origin`
- `x-xss-protection: 0` (correct modern approach — rely on CSP, not broken XSS auditor)
- Full anti-clickjacking suite (X-Frame-Options, X-Content-Type-Options, etc.)

**Polling response (lightweight):**
```json
[{ "result": { "data": [{ "id": "n_0sqbaMoWd5VX", "status": "SOAP_GENERATE_SUCCESS", "isRegeneratingSuccessfulNote": false }] } }]
```

#### Still Needed
- [ ] Generation latency measurement (first poll → success poll timing)
- [ ] Polling interval (how frequently does `getVisitStatusesByIds` fire?)
- [ ] Magic Edit request payload (`updateUserInstructionsTextAndRegenerateNote`)
- [ ] LLM provider clues (check response headers from generation endpoint, error messages)
- [ ] Voice capture: audio upload mechanism (chunked POST? separate endpoint?)
- [ ] What status values exist besides `SOAP_GENERATE_SUCCESS`? (in-progress status names)
