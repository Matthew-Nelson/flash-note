-- 003_seed_soap_prompts.sql
--
-- Plan 04-03 Task 2: Populate SOAP template sections with actual
-- prompt_instructions content ported from the deleted
-- web/src/server/prompts/pt-prompts.ts.
--
-- Split rationale (Research §2.8 / §6.4):
--   - System-level rules (anti-hallucination meta-rules, shorthand
--     disambiguation, security rules, output format expectations) remain
--     in code: web/src/server/prompts/system.ts → getSystemPrompt().
--   - Per-section content (Subjective/Objective/Assessment/Plan guidance +
--     billing rules + goal tracking) lives here so a future template editor
--     can customize it without code changes.
--
-- Migration 002 seeded the 4 section rows with placeholder prompt_instructions
-- ("<Subjective section — prompt content ported in Plan 04-03>"). This
-- migration UPDATEs those rows with the ported content.

-- Subjective: patient-reported symptoms, pain, functional limitations,
--             response to treatment, HEP compliance.
UPDATE note_template_sections
SET prompt_instructions = $PROMPT$### SUBJECTIVE Section
- Patient's reported symptoms, pain levels (0-10 scale)
- Functional limitations described by patient
- Response to previous treatment
- Changes since last visit
- Compliance with home exercise program$PROMPT$
WHERE id = '00000000-0000-0000-0000-000000000011';

-- Objective: measurable findings + interventions + billing (two-tier rules).
-- Includes the CPT code reference, the 8-minute rule, and the two-tier
-- billing output contract. Anti-hallucination meta-rules ("NEVER HALLUCINATE
-- TIMES") stay in the system prompt — we reference them here without
-- duplicating the full rule text.
UPDATE note_template_sections
SET prompt_instructions = $PROMPT$### OBJECTIVE Section
- Measurable clinical findings
- ROM measurements in degrees (active/passive)
- Strength using MMT grades (0/5 to 5/5)
- Special tests performed and results
- Palpation findings
- Gait analysis observations
- Treatment provided with specific parameters:
  - Manual therapy: technique, duration, area
  - Therapeutic exercise: specific exercises, sets, reps
  - Modalities: type, duration, parameters
  - Patient education: topics covered

## Billing Documentation
When documenting interventions in this section:
- Include time spent for each timed service (e.g., "Therapeutic exercise (23 min)")
- Use skilled language that supports medical necessity (e.g., "Grade III patellar mobilizations")
- Document specific parameters for each intervention

Common CPT codes for reference:
- 97110: Therapeutic Exercise
- 97140: Manual Therapy
- 97530: Therapeutic Activities
- 97116: Gait Training
- 97535: Self-Care/Home Management Training
- 97542: Wheelchair Management

The 8-minute rule for billing units:
- 8-22 minutes = 1 unit
- 23-37 minutes = 2 units
- 38-52 minutes = 3 units
- 53-67 minutes = 4 units

## CRITICAL: Two-Tier Billing Output Rules

To maintain clinician trust, billing output uses a two-tier system:

**Tier 1 - Full Charges (ONLY with explicit times):**
Use the "charges" array ONLY when the clinician explicitly states times in their notes.
- Example input: "manual therapy 15 min, ther ex 20 min"
- Output: charges with cptCode, description, minutes, and calculated units

**Tier 2 - Suggested Codes (when interventions mentioned without times):**
Use the "suggestedCodes" array when interventions are mentioned but times are NOT provided.
- Example input: "worked on manual therapy and therapeutic exercises"
- Output: suggestedCodes with cptCode and description ONLY (no minutes or units)

Remember: the system prompt's "NEVER HALLUCINATE TIMES" rule applies here — if the clinician does not explicitly state how many minutes were spent on an intervention, DO NOT include it in the charges array. Only include it in suggestedCodes.

Examples:
- Input: "manual therapy to lumbar spine 15 min, ther ex including bridges and squats 25 min"
  -> charges: [{cptCode: "97140", minutes: 15, units: 1}, {cptCode: "97110", minutes: 25, units: 2}]

- Input: "performed manual therapy and therapeutic exercises"
  -> suggestedCodes: [{cptCode: "97140", description: "Manual Therapy"}, {cptCode: "97110", description: "Therapeutic Exercise"}]
  -> Do NOT include charges (no times provided)

- Input: "manual therapy 10 min, also did gait training"
  -> charges: [{cptCode: "97140", minutes: 10, units: 1}] (only for timed intervention)
  -> suggestedCodes: [{cptCode: "97116", description: "Gait Training"}] (no time provided)

## Alerts to Include in the Objective/Assessment context
Flag potential documentation issues:
- Time barely meeting thresholds (e.g., 8 min exactly - risky for audits)
- Multiple procedures to same region (may need modifier 59)
- Medicare patients needing GP modifier
- Missing documentation elements for the note type$PROMPT$
WHERE id = '00000000-0000-0000-0000-000000000012';

-- Assessment: clinical interpretation + goal tracking (percentages rules).
UPDATE note_template_sections
SET prompt_instructions = $PROMPT$### ASSESSMENT Section
- Clinical interpretation of findings
- Progress toward established goals
- Treatment effectiveness
- Barriers to progress (if any)
- Clinical reasoning for plan

## Goal Tracking

When the clinician mentions progress toward goals (for the top-level `goals` field):
- **Status**: Can be inferred from language ("making progress" -> progressing, "achieved goal" -> met)
- **percentComplete**: ONLY include if explicitly stated (e.g., "75% toward goal")
- Distinguish between short-term goals (2-4 weeks) and long-term/discharge goals

Remember: the system prompt's "NEVER HALLUCINATE PERCENTAGES" rule applies here. If the clinician does not state a specific percentage, omit the percentComplete field entirely. Do not estimate.

Examples:
- Input: "progressing well toward flexion goal, about 75% there"
  -> status: "progressing", percentComplete: 75

- Input: "making good progress on ROM goal"
  -> status: "progressing", NO percentComplete field (not stated)

- Input: "achieved ambulation goal"
  -> status: "met", percentComplete: 100 (100% implied by "achieved")$PROMPT$
WHERE id = '00000000-0000-0000-0000-000000000013';

-- Plan: continuation + frequency + HEP + patient education + short-term goals.
UPDATE note_template_sections
SET prompt_instructions = $PROMPT$### PLAN Section
- Continuation or modification of treatment plan
- Frequency and duration of future visits
- Home exercise program updates
- Patient education provided
- Short-term goals for next visit
- Any referrals or coordination needed$PROMPT$
WHERE id = '00000000-0000-0000-0000-000000000014';
