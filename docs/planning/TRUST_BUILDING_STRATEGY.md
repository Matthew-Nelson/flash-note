# Building Trust with Clinicians: A Strategic Framework

> **Status**: Discovery/Planning
> **Created**: January 2025
> **Context**: This document captures insights from a deep discussion about how FlashNote can build and maintain trust with physical therapists using our AI-powered documentation tool.

---

## Executive Summary

FlashNote's success depends entirely on clinician trust. Physical therapists will only adopt our tool if they believe the AI-generated content is accurate, safe, and enhances rather than replaces their clinical judgment.

This document outlines:
1. Why trust is the foundational requirement
2. The problems with current AI approaches
3. Our implemented solutions (two-tier billing, goal guardrails)
4. Future proposals (interactive/conversational mode)
5. Open questions for further exploration

---

## Part 1: Why Trust is Non-Negotiable

### The Stakes Are High

Physical therapy documentation isn't like generating marketing copy or summarizing articles. The stakes include:

- **Patient Safety**: Inaccurate documentation can lead to inappropriate treatment decisions
- **Legal Liability**: Notes are legal medical records that may be used in court
- **Billing Compliance**: Incorrect CPT codes or times can constitute fraud (penalties up to $50K per claim)
- **Audit Survival**: Medicare, Medicaid, and private payers audit PT documentation heavily
- **Career Risk**: A therapist's license can be jeopardized by fraudulent documentation

### The Trust Equation

```
Trust = Accuracy + Transparency + Consistency + Control
```

- **Accuracy**: The AI doesn't make things up
- **Transparency**: The clinician understands what the AI did and why
- **Consistency**: The AI behaves predictably
- **Control**: The clinician remains the authority, not the AI

### The Adoption Barrier

Clinicians are inherently skeptical of AI in healthcare—and rightfully so. A single bad experience (hallucinated measurement, wrong billing code, fabricated clinical detail) can permanently destroy trust, not just with that clinician but through word-of-mouth to their colleagues.

**Key insight**: It's better to do less and be right than to do more and be wrong.

---

## Part 2: The Problem with Current AI Approaches

### The Hallucination Problem

Large language models are trained to produce fluent, confident text. They don't have a concept of "I don't know." This creates a fundamental tension:

| What the AI does | What it should do |
|------------------|-------------------|
| Generates "Knee flexion 110°" | Say "ROM improved" if no degrees provided |
| Invents "Manual therapy 15 min" | Ask for times or omit billing |
| Estimates "75% toward goal" | Only include if clinician stated percentage |

### The Expansion vs. Fabrication Distinction

We identified a critical distinction:

**Expansion (Good)**:
- Input: "ROM improved"
- Output: "Range of motion demonstrates improvement compared to previous session"
- *This adds professional language but no new facts*

**Fabrication (Bad)**:
- Input: "ROM improved"
- Output: "Knee flexion increased from 95° to 110°"
- *This invents specific data that wasn't provided*

**The rule**: Expansion is the product. Fabrication destroys trust.

### What Looks Authoritative

Not all generated content carries equal risk:

| Content Type | Risk Level | Why |
|--------------|------------|-----|
| Narrative expansion | Low | Obviously a draft, therapist will review |
| Specific measurements (ROM, MMT) | **High** | Looks like a measured fact |
| Billing times/units | **High** | Directly affects money, audits |
| Goal percentages | **High** | Looks like tracked data |
| CPT codes | Medium | Can be verified quickly |

**Insight**: The problem isn't that we need to mark everything as "suggested"—it's that we need to prevent fabrication of specific data points that look authoritative.

---

## Part 3: Implemented Solutions

### Solution 1: Two-Tier Billing System

**Problem**: The AI was generating billing times even when the clinician didn't provide them.

**Solution**: Split billing into two tiers:

```typescript
billing: {
  // Tier 1: ONLY when clinician provides explicit times
  charges?: [{
    cptCode: "97110",
    description: "Therapeutic Exercise",
    minutes: 20,  // Only if clinician said "20 min"
    units: 2
  }],

  // Tier 2: ALWAYS when interventions are mentioned
  suggestedCodes?: [{
    cptCode: "97110",
    description: "Therapeutic Exercise"
    // NO minutes, NO units - clinician fills these in
  }]
}
```

**Behavior**:
| Clinician Input | Output |
|-----------------|--------|
| "manual therapy 15 min, ther ex 20 min" | Full `charges` + `suggestedCodes` |
| "did manual therapy and exercises" | Only `suggestedCodes` (no times) |
| "MT 10 min, also did gait training" | `charges` for MT only, `suggestedCodes` for both |

**Why this works**:
- Clinicians still get value (CPT code suggestions)
- No fabricated times that could cause audit issues
- Clear visual distinction between "verified" and "suggested"

### Solution 2: Goal Percentage Guardrails

**Problem**: The AI was estimating goal completion percentages (e.g., "75% complete") without the clinician stating any percentage.

**Solution**:
- `status` (progressing, met, etc.) CAN be inferred from language
- `percentComplete` can ONLY be included if explicitly stated

```typescript
// Clinician said "about 75% toward goal"
{ status: "progressing", percentComplete: 75 }  ✓

// Clinician said "making good progress"
{ status: "progressing" }  ✓  // NO percentComplete

// AI guesses 60% based on context
{ status: "progressing", percentComplete: 60 }  ✗  // NEVER
```

**Why this works**:
- Status inference is reasonable ("achieved goal" → "met")
- Percentage is a specific number that looks like tracked data
- Omitting uncertain data is better than fabricating it

### Solution 3: Measurement Guardrails in Prompts

**Problem**: The AI might generate specific measurements (ROM degrees, strength grades) that weren't in the input.

**Solution**: Added explicit prompt instructions:

```
What you CAN do (expansion):
- "ROM improved" → "Range of motion demonstrates improvement"

What you MUST NOT do (fabrication):
- "ROM improved" → "Knee flexion increased from 95° to 110°" ❌

Rule: If the clinician provides a number, include it.
      If they don't, use descriptive language instead.
```

**Examples**:
- Input: "knee flexion 110 degrees" → Include "knee flexion 110°" ✓
- Input: "ROM limited" → Say "ROM limited" NOT "ROM: 85°" ✓
- Input: "quad strength 4/5" → Include "quadriceps 4/5" ✓
- Input: "quad weakness" → Say "quadriceps weakness noted" NOT "quadriceps 3/5" ✓

---

## Part 4: The Trust Principle

From our analysis, we derived a core principle:

> **Specific, verifiable claims (numbers, codes, percentages) should either:**
> 1. Come directly from the clinician's input (traceable)
> 2. Be clearly marked as suggestions for the clinician to complete
> 3. Be omitted entirely
>
> **Narrative expansion is expected and doesn't need special treatment.**

### What This Means in Practice

| Data Type | Can Infer? | Can Include Numbers? | Rule |
|-----------|------------|---------------------|------|
| SOAP narrative | ✅ Expand freely | Only if in input | Professional language, no new facts |
| Goal status | ✅ From language | N/A | "making progress" → `progressing` |
| Goal percentage | ❌ Must be explicit | Only if stated | Omit if not in input |
| Billing times | ❌ Must be explicit | Only if stated | Use `suggestedCodes` otherwise |
| Measurements | ❌ Must be explicit | Only if stated | "ROM limited" not "ROM: 85°" |
| CPT codes | ✅ From interventions | N/A | Suggest based on treatment mentioned |

---

## Part 5: Future Proposal - Conversational Partner Mode

### The Current Model: "Replacement"

```
Therapist: [quick notes]
AI: [complete SOAP note] ← "Trust me, this is right"
Therapist: [copies, maybe edits]
```

The AI is a black box. The therapist inputs text and gets output. They must trust that the AI got it right.

### The Proposed Model: "Partner"

```
Therapist: [quick notes]
AI: "You mentioned manual therapy - how many minutes?"
Therapist: "15 min"
AI: "Got it. Any ROM measurements from today?"
Therapist: "Didn't measure, just observed improvement"
AI: "I'll note 'ROM improved per observation' rather than specific degrees."
AI: [generates note with full context]
```

The AI becomes a collaborative partner that asks rather than assumes.

### Why This Could Transform Trust

#### 1. The Trust Inversion
- **Current**: "The AI generated this, I hope it's right"
- **Proposed**: "I told the AI this, so I know it's right"

The therapist becomes the **source of truth**, the AI becomes the **organizer and expander**.

#### 2. Natural Solution to Billing Problem
```
AI: "You mentioned therapeutic exercises and gait training.
     Did you want to include times for billing?"

Therapist: "Ther ex 20 min, gait 10 min"

AI: "Got it. That's 2 units ther ex, 1 unit gait training."
```

No hallucinated times because the AI asked rather than guessed.

#### 3. Educational for New PTs
The questions themselves teach what good documentation includes:
- "Did you document HEP compliance?"
- "For a progress note, we typically compare to initial eval - any measurements to compare?"
- "Medicare requires homebound justification - can you provide?"

A new grad learns documentation standards just by using the tool.

#### 4. Compliance Partner
```
AI: "I notice this is visit 10 - do you need a progress note
     instead of a daily note for billing compliance?"
```

The AI catches things the therapist might miss.

### Proposed Modes

| Mode | Audience | Behavior |
|------|----------|----------|
| **Quick** | Experienced PTs, simple cases | Current behavior, minimal questions |
| **Guided** | New PTs, complex cases, thorough documentation | Interactive, asks clarifying questions |
| **Review** | Quality-focused, audit prep | Analyzes their draft, suggests improvements |

Users choose per session, or the system learns their preference.

### Smart Questioning (Avoiding Annoyance)

The key is asking the **right** questions at the **right** time.

**Ask when:**
- Critical info is missing (times for billing, ROM for progress notes)
- There's genuine ambiguity that affects the note
- Compliance requires it (Medicare, specific payer rules)
- It would significantly improve documentation quality

**Don't ask when:**
- It's optional detail
- We can confidently infer the answer
- They've answered this pattern before (learn their defaults)
- It would slow them down unnecessarily

### "Review Mode" - Flip the Script

Instead of generating, we could **review their draft**:

```
Therapist: [pastes their quick note or draft]

AI: "Nice documentation! A few suggestions:

     ✓ Good: Pain levels documented with scale
     ✓ Good: HEP compliance mentioned

     ⚠️ Consider: Adding specific ROM degrees would strengthen
        the objective section
     ⚠️ Consider: 'Improved' is vague - can you quantify?

     📋 For Medicare: You may want to add skilled care justification

     Would you like me to help expand any section?"
```

This is a **writing tutor** rather than a **writing replacement**. The therapist stays in control.

### Premium Feature Potential

| Tier | Features |
|------|----------|
| **Free** | Basic generation, limited uses |
| **Pro** | Interactive mode, learns your style, billing assistance |
| **Clinic** | Team templates, compliance dashboard, audit support |

The interactive/conversational mode could be the key differentiator for premium tiers.

---

## Part 6: Other Trust-Building Opportunities

### Learning From Corrections

Every time a therapist edits the output, that's feedback we're currently ignoring.

If they consistently:
- Change "patient" → "pt"
- Add "per pt report" to subjective sections
- Remove certain phrases we generate

...we could learn and adapt.

**Idea**: Personal style learning that adjusts future outputs to match their preferences.

### Transparency Features

- **"Show Your Work" mode**: Indicate which parts of the output came from their input vs. were expanded
- **Source highlighting**: Bold = from input, regular = expanded
- **Reasoning explanations**: "I used 97110 because you mentioned therapeutic exercises"

### Audit Trail

For compliance and liability protection:
- Log what the clinician input (hashed, not stored as PHI)
- Log that they viewed the output
- Log that they made edits before using
- Timestamp everything

This proves the clinician reviewed and approved the content.

---

## Part 7: Open Questions

### Product Questions
1. **Would therapists actually want conversational mode?** Or do they just want FAST?
2. **What's the right balance** between helpfulness and interruption?
3. **How do we measure trust?** NPS? Edit rates? Return usage?

### Technical Questions
1. **How do we make interactive mode feel fast?** Streaming responses?
2. **Where does conversation state live?** Extension? Backend?
3. **How do we handle interruptions?** (Patient walks in mid-documentation)

### Business Questions
1. **Is trust our competitive moat?** "The AI that doesn't make stuff up"
2. **How do we price interactive mode?** Per-conversation? Subscription tier?
3. **What's the MVP to test this?** Maybe just 2-3 smart questions before generation?

### Liability Questions
1. **What disclaimers do we need?** "AI-generated content, please review"
2. **Should we require confirmation?** "I have reviewed this note" checkbox
3. **What's our legal position** if AI-generated content causes problems?

---

## Part 8: Implementation Status

Core trust mechanisms are implemented: two-tier billing (charges vs. suggestedCodes), goal percentage guardrails, measurement guardrails, and mock service demonstrations. Conversational Mode and Review Mode are tracked as future features in [ROADMAP.md](../ROADMAP.md#future-features-not-scheduled).

---

## Conclusion

Trust isn't a feature—it's the foundation. Every decision we make should be filtered through the question: **"Does this build or erode clinician trust?"**

Our implemented solutions (two-tier billing, goal guardrails, measurement restrictions) follow a simple principle: **It's better to do less and be right than to do more and be wrong.**

The conversational partner mode represents a potential paradigm shift—from the AI as a black-box replacement to the AI as a transparent collaborator. This could be our key differentiator in a market where every EMR is adding generic AI features.

The therapist should always feel like they're in control, the AI is honest about what it knows and doesn't know, and the final documentation is something they can stand behind with confidence.

---

## Appendix: Key Quotes from Discussion

> "The problem isn't that we need more 'suggested' labels. The problem is preventing fabrication of specific data points that look authoritative."

> "A therapist reading 'Patient demonstrates improved functional mobility' knows that's an expansion of their notes. But if they see 'Knee flexion: 110°' and they never wrote that number, they lose trust immediately."

> "It's better to do less and be right than to do more and be wrong."

> "The trust inversion: Instead of 'the AI generated this, I hope it's right'—it becomes 'I told the AI this, so I know it's right.'"

> "The questions themselves teach what good documentation includes. A new grad learns documentation standards just by using the tool."
