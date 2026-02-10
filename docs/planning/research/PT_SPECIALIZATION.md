# PT Specialization: Abbreviation Libraries & Domain Knowledge Injection

> **Parent doc**: [Prompt Engineering Research](../PROMPT_ENGINEERING_RESEARCH.md)

---

## The Core Question

Do we need to provide the model with PT-specific abbreviation libraries, short codes, or reference information? Or can we rely on the model's training data?

## Answer: Yes, But Strategically

The model (Gemini 2.5 Flash) has general medical knowledge from training, but PT-specific shorthand varies significantly by clinic, region, and individual therapist. We should inject a **curated reference library** - not a massive dump, but targeted knowledge that fills gaps.

---

## Why the Model Needs Help

### 1. PT Shorthand Is Highly Variable

The same concept can be written dozens of ways:

| Concept | Possible Shorthand |
|---------|-------------------|
| Manual therapy | MT, man ther, man tx, manual tx, mob, mobs |
| Therapeutic exercise | ther ex, TX, t-ex, exercises, ex program |
| Range of motion | ROM, AROM, PROM, rom, R.O.M. |
| Home exercise program | HEP, home ex, home program, HP |
| Patient | pt, pat, patient, Pt |
| Assessment | ax, assess, A/ |
| Left/Right | L, R, lt, rt, left, right, (L), (R) |
| With/Without | w/, w/o, c̄, s̄ |
| Times/Repetitions | x, reps, rep, times |
| Before/After | pre, post, b4 |

### 2. Clinical Abbreviations Overlap With Common Words

- "PT" = physical therapy OR physical therapist OR patient (context-dependent)
- "OT" = occupational therapy OR overtime
- "ROM" without context could be misinterpreted
- "mod" = moderate OR modified OR modality
- "WB" = weight bearing (not a common abbreviation outside PT)

### 3. Billing-Specific Shorthand

PTs use very specific shorthand for billing that the model may not reliably know:

| Shorthand | Meaning |
|-----------|---------|
| 97110 | Therapeutic Exercise |
| 97140 | Manual Therapy |
| 97530 | Therapeutic Activities |
| 97116 | Gait Training |
| 97535 | Self-Care/Home Management Training |
| 97150 | Group Therapy |
| 97542 | Wheelchair Management |
| 97112 | Neuromuscular Re-Education |
| 97161-97163 | PT Evaluation (low/mod/high complexity) |
| 97164 | PT Re-Evaluation |

### 4. Body Region Shorthand

| Shorthand | Meaning |
|-----------|---------|
| LS, L/S, lx | Lumbar spine |
| CS, C/S, cx | Cervical spine |
| TS, T/S, tx | Thoracic spine (also "tx" = treatment) |
| LE, LLE, RLE | Lower extremity, left LE, right LE |
| UE, LUE, RUE | Upper extremity, left UE, right UE |
| B, bilat, B/L | Bilateral |
| ant, post, lat, med | Anterior, posterior, lateral, medial |
| prox, dist | Proximal, distal |
| TKR, TKA | Total knee replacement/arthroplasty |
| THR, THA | Total hip replacement/arthroplasty |
| RTC, RC | Rotator cuff |
| ACL, MCL, PCL, LCL | Knee ligaments |

### 5. Measurement and Grading Shorthand

| Shorthand | Meaning |
|-----------|---------|
| MMT | Manual muscle testing |
| 0/5 to 5/5 | MMT grades |
| 3+/5, 4-/5 | Plus/minus grades |
| WNL | Within normal limits |
| WFL | Within functional limits |
| SLR | Straight leg raise |
| FABER | Flexion, abduction, external rotation test |
| (+), (-) | Positive/negative test result |
| NWB, TTWB, PWB, WBAT, FWB | Weight bearing statuses |
| CKC, OKC | Closed/open kinetic chain |
| TheraBand, TB | Resistance band exercises |

---

## Injection Strategy

### Option A: Full Reference Table in System Prompt (NOT recommended)

Dumping a complete abbreviation table into the system prompt would:
- Consume ~500-1000 tokens per request
- Increase cost and latency on every call
- Include many abbreviations the model already knows
- Dilute the prompt's focus on important rules

### Option B: Curated "Tricky" Abbreviations (Recommended for v1)

Include only abbreviations where the model is likely to make mistakes - the ambiguous or clinic-specific ones:

```
## PT Shorthand Reference (Disambiguation)

When expanding clinician shorthand, use these interpretations:
- "pt" or "Pt" = patient (in clinical context)
- "PT" = physical therapy or physical therapist (based on context)
- "tx" = treatment (NOT thoracic spine unless clearly anatomical context)
- "mod" = moderate (unless "mod exercise" where it means modified)
- "w/" = with, "w/o" = without
- "x" after a number = times/repetitions (e.g., "3x10" = 3 sets of 10)
- "B" or "bilat" = bilateral
- "+"/"-" after test names = positive/negative result
- Weight bearing: NWB=non, TTWB=toe-touch, PWB=partial, WBAT=as tolerated, FWB=full
```

This targets ~100 tokens and addresses the highest-risk misinterpretations.

### Option C: Setting-Specific Abbreviation Packs (Recommended for v2)

Different clinical settings use different shorthand:

**Outpatient Ortho Pack**: TKA, THR, RTC, ACL, McKenzie, Mulligan, MWM
**Home Health Pack**: homebound, CMS criteria, OASIS, ADLs, IADLs, supervision level
**SNF Pack**: MDS, RUG, FIM scores, therapy cap, maintenance therapy
**Pediatric Pack**: developmental milestones, NICU, PEDI, Bayley, W-sitting
**Acute Care Pack**: ICU, ventilator, mobilization level, RASS, GCS

These get injected based on the user's selected clinical setting (the `ClinicalSetting` type already exists in our schema).

### Option D: User-Defined Custom Abbreviations (Recommended for v2+)

Let clinicians define their own shorthand mappings:

```
User settings: {
  customAbbreviations: {
    "BBS": "Berg Balance Scale",
    "TUG": "Timed Up and Go",
    "6MWT": "6-Minute Walk Test",
    "STS": "Sit-to-Stand",
    "my usual": "standard HEP with quad sets, SLR, and heel slides"
  }
}
```

This is injected into the prompt as a personalized reference. Low token cost, high value.

---

## Beyond Abbreviations: What Other PT Knowledge Should We Inject?

### 1. Common PT Protocols

When a therapist writes "s/p TKA 4 weeks" the model should know:
- Standard post-TKA ROM expectations at 4 weeks (~90-100° flexion)
- Typical precautions still in effect
- Expected weight bearing status (usually WBAT by week 4)
- Common interventions at this stage

**We should NOT inject this as hard-coded values** (they vary by surgeon protocol), but we could inject awareness:

```
When clinician mentions post-surgical status, be aware of typical protocol phases
but NEVER assume specific ROM goals, precautions, or restrictions unless stated.
Use language like "per protocol" or "per surgical precautions" when the clinician
references protocols without specifics.
```

### 2. Insurance/Payer Context

Different payers have different documentation requirements:

| Payer | Key Requirements |
|-------|-----------------|
| Medicare | GP modifier, medical necessity language, skilled care justification, homebound status (HH) |
| Medicaid | Varies by state, often similar to Medicare |
| Workers' Comp | Mechanism of injury, work restrictions, functional capacity |
| Auto/PI | Mechanism of injury, pre-injury function, causation language |
| Commercial | Varies widely, generally less strict |

This could be injected based on a "payer type" selection in the input.

### 3. Note Type Context (Already Partially Implemented)

Our `NOTE_TYPE_INSTRUCTIONS` already vary by note type. This could be enhanced:

- **Initial Eval**: Remind model to include all required elements (history, systems review, tests & measures)
- **Progress Note**: Emphasize comparison to initial eval or last progress note
- **Daily Note**: Keep it focused on today's visit only
- **Discharge**: Emphasize outcomes, goal achievement, and recommendations

---

## What We Should NOT Inject

- **Complete ICD-10 code lists** - Too large, model knows common ones, and coding is complex enough to need specialized tools
- **Full APTA guidelines** - Too many tokens, too general
- **Anatomy reference material** - Model already knows this well
- **Exercise descriptions** - Model knows common PT exercises
- **Drug interactions/contraindications** - Out of scope for documentation tool

---

## Implementation Recommendation

### Phase 1 (Now)
- Add curated disambiguation reference (~100 tokens) to system prompt
- Add "per protocol" awareness language for post-surgical contexts

### Phase 2 (With clinical settings feature)
- Inject setting-specific abbreviation packs based on `ClinicalSetting`
- Add payer-type context when available

### Phase 3 (With user preferences)
- Support user-defined custom abbreviations
- Learn from corrections (if user consistently changes "BBS" to "Berg Balance Scale")
