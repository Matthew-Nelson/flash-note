# Style Matching Analysis: Feasibility, Value, and Risks

> **Parent doc**: [Prompt Engineering Research](../PROMPT_ENGINEERING_RESEARCH.md)

---

## The Core Question

Is matching each therapist's individual tone and writing style a realistic or "good" proposal? Will it be a selling point, or does it feel creepy?

---

## The Honest Technical Assessment

### What Research Says

| Study | Finding |
|-------|---------|
| arXiv 2025 ("Catch Me If You Can") | LLMs can mimic public figures but **struggle with everyday users** due to insufficient writing samples |
| PNAS 2025 | Instruction-tuned LLMs have a **distinctive noun-heavy style that persists** even when prompted to match informal writing |
| arXiv 2024 (Controllable Text Generation) | Supervised fine-tuning is more effective than prompting for style, but persona variables account for **less than 10% of output variance** |
| EMNLP 2025 | LLM performance **varies 15-80% across writing styles** for a single model |

### What This Means

**True per-user style matching via prompting alone is not reliable with current technology.**

The model has a strong "default voice" that bleeds through regardless of style instructions. You can nudge it (more concise, more narrative, use "pt" instead of "patient") but you can't make it sound like a specific individual.

### The Approaches, Ranked by Feasibility

| Approach | Feasibility | Cost | Quality |
|----------|------------|------|---------|
| **1. Template-level style preferences** | High | None | Good |
| **2. Explicit preference injection** | High | ~50 tokens/request | Good |
| **3. Few-shot style examples** | Medium | 500-1000+ tokens/request | Moderate |
| **4. Per-user fine-tuning (QLoRA)** | Low (at current scale) | High infrastructure | Potentially best |

---

## Approach 1: Template-Level Style Preferences (Recommended for v1)

Let clinicians choose from 2-3 predefined documentation styles:

### Style Options

**Concise (Bullet-focused)**
```
S: Pt reports 6/10 L knee pain, worse with stairs. Good HEP compliance.
O: ROM: improved per observation. Interventions: MT lumbar spine 15 min,
   ther ex (bridges 3x10, squats 3x10) 20 min.
A: Pt making progress toward goals. Responding well to current POC.
P: Continue PT 2x/wk. Progress HEP. Reassess ROM next visit.
```

**Standard (Narrative)**
```
SUBJECTIVE: Patient reports pain at 6/10 in the left knee, exacerbated
with stair navigation. Patient reports good compliance with home exercise
program and notes gradual improvement since last visit.

OBJECTIVE: Range of motion demonstrates improvement compared to previous
session. Treatment today included manual therapy to the lumbar spine for
15 minutes and therapeutic exercise including bridges (3 sets of 10),
squats (3 sets of 10) for 20 minutes total.
...
```

**Detailed (Comprehensive)**
```
SUBJECTIVE:
Chief Complaint: Left knee pain
Pain Level: 6/10 on numeric pain rating scale
Aggravating Factors: Stair navigation (both ascending and descending)
HEP Compliance: Patient reports good compliance with prescribed home
exercise program including quad sets, heel slides, and standing hip
abduction exercises. Patient performed exercises 5/7 days this week.
...
```

### Implementation

Add to user preferences/profile:
```typescript
documentationStyle: 'concise' | 'standard' | 'detailed'
```

Inject into prompt:
```
## Documentation Style Preference

The clinician prefers a {{style}} documentation style:
- concise: Use abbreviated language, bullet points, minimal narrative
- standard: Professional narrative paragraphs with appropriate detail
- detailed: Comprehensive documentation with sub-sections and thorough detail

Match this preference in your output.
```

**This is implementable today with ~30 tokens of prompt addition.**

---

## Approach 2: Explicit Preference Injection (Recommended for v1-v2)

Let clinicians set specific preferences that get injected into prompts:

```typescript
userPreferences: {
  patientReference: 'pt' | 'patient' | 'Patient',  // How to refer to patient
  sectionHeaders: 'abbreviated' | 'full',  // "S:" vs "SUBJECTIVE:"
  measurementStyle: 'inline' | 'listed',   // "ROM 110° flexion" vs "ROM:\n- Flexion: 110°"
  useFirstPerson: boolean,  // "I performed" vs "Therapist performed" vs passive voice
  includeSectionDividers: boolean,  // Visual separators between SOAP sections
}
```

These get converted to a short prompt instruction:
```
## Clinician Preferences
- Refer to the patient as "pt"
- Use abbreviated section headers (S:, O:, A:, P:)
- List measurements inline
- Use passive voice for interventions
```

**Token cost**: ~30-50 tokens
**This gives PTs genuine control over their output format without claiming AI "learns your style."**

---

## Approach 3: Few-Shot Style Examples (v2+ consideration)

Allow clinicians to paste 1-3 example notes they've written. Include one as a few-shot example:

```
## Reference: Clinician's Example Note Style

The following is an example of this clinician's preferred documentation style.
Match the tone, verbosity, formatting, and terminology choices:

<style_example>
[clinician's pasted example note]
</style_example>

Adapt your output to match this style while following all other documentation rules.
```

### Pros
- Most natural form of "style matching"
- Clinician provides their own reference
- No fine-tuning infrastructure needed

### Cons
- 500-1000+ tokens per request (cost/latency impact)
- Research shows only ~10% style alignment improvement
- Model's default voice still bleeds through
- Must be careful not to store PHI in the example notes (they contain patient data)

### PHI Concern
Example notes from real patients contain PHI. Options:
- Ask clinicians to redact before pasting (friction, may not comply)
- Only store structural/formatting patterns, not content (complex to implement)
- Process in-memory only, never persist (safest, but clinician re-enters each session)

**Recommendation**: If we pursue this, examples are processed per-session and never persisted. The clinician pastes an example note, we use it for that session's prompts, and it's discarded.

---

## Approach 4: Per-User Fine-Tuning (Not Recommended for Now)

Using QLoRA adapters to fine-tune per user:
- Requires 50-100+ example notes per user for meaningful adaptation
- Infrastructure cost for hosting per-user adapters
- Ongoing training pipeline
- Gemini fine-tuning API availability uncertain

**Not feasible at FlashNote's current scale.** Revisit if/when we have thousands of users generating hundreds of notes each.

---

## The "Creepy" Question

### When Style Matching Feels Good
- "It knows I prefer 'pt' instead of 'patient'" → Respecting preference
- "It uses the same section format as my clinic" → Being compatible
- "It matches how concise/detailed I like to be" → Saving my editing time

### When Style Matching Feels Creepy
- "It sounds exactly like me and I can't tell the difference" → Uncanny valley
- "It's learning from everything I type" → Surveillance feeling
- "It mimics my writing tics and verbal patterns" → Too personal
- "Other people might think I wrote this" → Authenticity concern

### The Key Insight

**PTs don't want the AI to "sound like them." They want the AI to produce notes they don't have to edit much.**

These are different things:
- "Sounding like me" = mimicking personal writing tics (creepy, technically hard)
- "Producing what I want" = matching preferences for format, verbosity, terminology (useful, straightforward)

The first is a party trick. The second is genuine product value.

### Marketing Angle

**Don't sell "AI that learns your writing style."**
**Do sell "AI that matches your documentation preferences."**

The first implies surveillance and mimicry. The second implies customization and control.

Concrete messaging:
- "Configure your documentation style - concise, standard, or detailed"
- "Set your preferred terminology and formatting"
- "Your preferences are saved and applied to every note"
- "Spend less time editing, more time with patients"

---

## Competitor Landscape

### ScribePT
Claims "adaptive note generation that learns your preferred phrasing and documentation style." No published mechanism. Likely using some combination of:
- Few-shot examples from user history
- Preference extraction from edit patterns
- Template selection based on usage patterns

### Generic AI Scribes (Ambient)
Tools like Freed, DeepScribe, and Nabla use audio transcription + note generation. Style matching is less relevant because they're working from spoken language, not shorthand.

### Our Differentiator
Rather than claiming style matching (which is technically limited), differentiate on:
1. **Trust** - "The AI that doesn't make stuff up" (our anti-hallucination approach)
2. **PT-specific** - Built specifically for physical therapy, not generic medical
3. **Speed** - Type shorthand, get a complete note in seconds
4. **Control** - Configurable preferences, not a black box

---

## Recommendation Summary

### For v1 (Now)
- Implement **template-level style preferences** (concise/standard/detailed)
- Add **explicit preference injection** (patient reference, section format, etc.)
- Market as "documentation preferences" not "style learning"

### For v2 (Later)
- Consider **session-level few-shot examples** (paste a note, match that style)
- Track edit patterns to **suggest preference adjustments** ("You often change 'patient' to 'pt' - want to set that as default?")
- Add more granular preferences as user feedback reveals what matters

### Avoid (For Now)
- Per-user fine-tuning (infrastructure not justified)
- Claims of "AI learning your style" (technically overpromising)
- Storing example notes with PHI (compliance risk)

### The Bottom Line

Style matching is a **nice-to-have preference feature, not a core differentiator.** Trust, accuracy, and PT specialization are where we win. Template preferences solve 80% of the style problem at 5% of the complexity.
