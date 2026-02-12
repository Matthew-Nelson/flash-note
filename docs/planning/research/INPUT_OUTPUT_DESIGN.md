# Input/Output Design: What Therapists Provide and What They Get Back

> **Parent doc**: [Prompt Engineering Research](../PROMPT_ENGINEERING_RESEARCH.md)

---

## The Core Question

Should we be changing what we ask therapists to input, or what the model outputs?

**Short answer**: Yes to both, but carefully. The input side benefits from **structured hints** (not rigid forms). The output side benefits from **uncertainty signals** and **a review-friendly format**.

---

## Part 1: Input Design

### Current State
Therapists provide:
- `quickNotes` (freeform text) - their shorthand clinical notes
- `patientContext` (optional freeform text) - patient background
- `noteType` (enum) - daily_note, initial_eval, progress_note, discharge

### The Problem With Pure Freeform

Pure freeform input has two issues:
1. **Garbage in, garbage out** - If the therapist writes very little, the model can't generate a good note
2. **Missing critical elements** - Therapists in a rush skip billing times, measurements, or compliance info

But the alternative (rigid structured forms) defeats the purpose of the tool. PTs want to type fast shorthand, not fill out forms.

### Recommendation: Structured Hints, Not Structured Forms

**Option A: Section prompts in the text input** (Recommended for v1)

Instead of one big text box, show light placeholder text that suggests structure:

```
┌─────────────────────────────────────────────┐
│ Subjective: pt reports...                   │
│                                             │
│ Objective: ROM, strength, interventions...  │
│                                             │
│ Plan: continue, freq, HEP...               │
└─────────────────────────────────────────────┘
```

The therapist can ignore these or type in any order - it's just a hint. But it reminds them to include key elements.

**Option B: Smart prompting for missing elements** (Recommended for v2)

After the therapist submits, before generating the full note, do a quick check:
- Did they mention interventions without times? → "Want to add times for billing?"
- Is this a progress note without measurements? → "Any ROM/strength to compare to initial eval?"
- No HEP mention on a daily note? → "Include HEP compliance?"

This is the "Guided Mode" from our Trust Building Strategy, simplified to 1-2 targeted questions.

**Option C: Template starters** (Good for new users)

Pre-populate with a template the therapist can fill in:

```
Subjective: Pain __/10, location: ___, aggravating factors: ___
Objective: ROM: ___, Strength: ___, Special tests: ___
Interventions: ___ (__ min), ___ (__ min)
Assessment: Progress toward goals: ___
Plan: Continue ___, freq ___x/wk, HEP: ___
```

Experienced PTs would skip this, but new users or new grads would benefit.

### What Should We Ask For That We Don't Currently?

| Field | Why It Helps | Implementation |
|-------|-------------|----------------|
| **Clinical setting** | Outpatient vs. home health vs. SNF changes documentation focus | Dropdown in user profile (already have `ClinicalSetting` type) |
| **Payer type** | Medicare needs different language than commercial insurance | Optional dropdown: Medicare, Medicaid, WC, Auto/PI, Commercial |
| **Visit number** | "Visit 10" triggers progress note reminders, "Visit 1" adjusts expectations | Optional numeric input |
| **Post-surgical status** | Affects precautions, expected ROM, protocol awareness | Optional: procedure + weeks post-op |

These are **profile-level or session-level settings**, not per-note inputs. Set once, used for every note.

### What We Should NOT Ask For

- **Patient demographics** - We don't need name, DOB, MRN (PHI we don't want)
- **Detailed medical history** - Too much input friction, model can work with what's provided
- **Insurance details** - Payer type is enough; specific plan details add no value
- **Diagnostic codes** - Out of scope for documentation generation

---

## Part 2: Output Design

### Current Output Structure
```typescript
{
  subjective: string,     // Narrative text
  objective: string,      // Narrative text
  assessment: string,     // Narrative text
  plan: string,           // Narrative text
  billing?: {
    charges?: [...],      // Tier 1: with explicit times
    suggestedCodes?: [...], // Tier 2: without times
    suggestedModifiers?: [...]
  },
  goals?: {
    shortTerm?: [...],
    longTerm?: [...]
  },
  alerts?: string[]       // Documentation warnings
}
```

### What Should Change in the Output?

#### 1. Add `uncertainAreas` (P1)
Already detailed in [Implementation Recommendations](./IMPLEMENTATION_RECOMMENDATIONS.md#change-4-add-uncertainty-signaling-to-schema-p1).

When the model is unsure about an interpretation, it flags it rather than guessing silently. This builds trust and creates a feedback loop.

#### 2. Consider Structured Objective Section (P3 - Future)

Right now, `objective` is a single string. Some clinicians might prefer structured sub-sections:

```typescript
objective: {
  findings: string,        // ROM, strength, special tests
  interventions: string,   // What was done today
  patientResponse: string  // How patient tolerated treatment
}
```

**Pros**: Easier to edit specific parts, clearer separation of findings vs. treatment
**Cons**: More rigid, may not match all EMR formats, increases schema complexity

**Recommendation**: Keep as single string for v1. Consider structured option as a user preference in v2.

#### 3. Add Quick Summary/Keywords (P3 - Future)

Research on the K-SOAP format suggests adding a keyword section for quick scanning:

```typescript
keywords?: string[]  // e.g., ["L knee", "s/p TKA", "ROM improving", "week 4"]
```

Low priority but useful for:
- Quick identification when reviewing multiple notes
- Search/filter functionality in the extension
- Patient context for the next visit

#### 4. Output Length Control

Different PTs want different levels of detail:
- **Concise**: Minimum viable documentation for billing
- **Standard**: Professional documentation with appropriate detail
- **Detailed**: Comprehensive documentation for complex cases or audits

This maps to the style preferences feature (see [Style Matching Analysis](./STYLE_MATCHING_ANALYSIS.md)). The model should receive a "verbosity" instruction based on user preference.

---

## Part 3: The Feedback Loop

### Why Corrections Matter

Every time a therapist edits the AI output, that's signal about:
- **What the model got wrong** (accuracy feedback)
- **What the therapist prefers** (style feedback)
- **What's missing from the input** (input design feedback)

### What We Can Learn Without Storing PHI

We can track (without storing note content):
- **Which SOAP sections are edited most** → That section's prompt needs work
- **Average edit percentage per section** → Overall accuracy metric
- **Whether billing charges are modified** → Billing accuracy metric
- **Whether `uncertainAreas` flags were helpful** → Calibration metric
- **Time spent reviewing before accepting** → Trust/confidence metric

### How This Feeds Back Into Prompts

If data shows:
- Assessment section edited 60% of the time → Improve assessment prompt instructions
- Billing times frequently corrected → Tighten billing validation
- Subjective rarely edited → Prompt is working well here
- Users always change "Patient reports" to "Pt reports" → Add to style preferences

---

## Part 4: Workflow Considerations

### Speed Is Critical

PTs document between patients (5-10 minute gaps) or at end of day. The tool must:
- Accept input in < 10 seconds of typing
- Generate output in < 5 seconds (ideally < 3)
- Allow copy-to-clipboard in one click
- Allow quick edits before copying

**Any input friction (extra fields, required selections, multi-step forms) must be justified by proportional output improvement.**

### The "Just Type" Principle

The lowest-friction input is "just type what you'd write on a sticky note." Everything else should be optional enhancement. A PT should be able to type:

```
pt c/o 6/10 L knee pain worse w stairs. ROM improving. MT 15min LS, ther ex bridges squats 20min. cont 2x/wk
```

And get a complete SOAP note. No dropdowns, no selections, no required fields beyond the text.

### Progressive Enhancement

| Tier | Input | Output Quality |
|------|-------|---------------|
| **Minimum** | Just quickNotes text | Good SOAP note, billing suggestions only |
| **Better** | quickNotes + patientContext | Better subjective section, goal tracking |
| **Best** | quickNotes + patientContext + clinical setting + payer type | Setting-appropriate language, payer-specific documentation |

Each tier is optional. The tool works at Minimum; it gets better with more context.

---

## Recommendations Summary

### Input Changes
1. **Now**: Add placeholder text hints in the quickNotes input (frontend only)
2. **Soon**: Add clinical setting as a profile preference (enables setting-specific prompts)
3. **Later**: Add optional payer type, visit number fields
4. **Later**: Implement 1-2 targeted smart questions for missing critical info

### Output Changes
1. **Now**: Add `uncertainAreas` to schema
2. **Soon**: Add verbosity preference (concise/standard/detailed)
3. **Later**: Add keywords/summary field
4. **Later**: Consider structured objective sub-sections as a preference
