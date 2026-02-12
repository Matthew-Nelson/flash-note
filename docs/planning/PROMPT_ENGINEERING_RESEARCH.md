# Prompt Engineering Research: FlashNote PT Documentation

> **Status**: Research/Discovery
> **Created**: February 2025
> **Context**: Deep dive into prompt engineering strategy for PT SOAP note generation

---

## Executive Summary

This research covers five core questions about how FlashNote should approach prompt engineering for physical therapy documentation. Each topic has a dedicated deep-dive document linked below.

**Key Findings:**

1. **PT-specific specialization** - We should inject a PT abbreviation/shortcode reference library into our prompts, but strategically (not a massive dump). The model needs to understand PT shorthand to expand it correctly. See [PT Specialization Deep Dive](./research/PT_SPECIALIZATION.md).

2. **Prompt engineering best practices** - Our current prompt is strong but has specific architectural improvements available: use Gemini's `systemInstruction` field, lower temperature from 0.7 to 0.2-0.3, add sandwich defense for injection protection. See [Prompt Best Practices Deep Dive](./research/PROMPT_BEST_PRACTICES.md).

3. **Specific changes to our prompts** - Concrete code-level changes we should make, including context injection strategy, schema improvements, and post-generation validation. See [Implementation Recommendations](./research/IMPLEMENTATION_RECOMMENDATIONS.md).

4. **Input/output design** - What we ask therapists to input and what the model outputs needs refinement. Research shows structured input hints outperform freeform, and our output should include uncertainty signals. See [Input Output Design](./research/INPUT_OUTPUT_DESIGN.md).

5. **Tone/style matching** - Technically limited and potentially counterproductive for v1. Template-level style preferences (concise vs. narrative vs. detailed) are the practical path. True per-user style matching is an unsolved research problem. See [Style Matching Analysis](./research/STYLE_MATCHING_ANALYSIS.md).

---

## Priority Action Items

Ranked by impact and implementation effort:

| Priority | Change | Effort | Impact |
|----------|--------|--------|--------|
| **P0** | Lower temperature from 0.7 → 0.2-0.3 | Config change | Reduces hallucination, improves consistency |
| **P0** | Move system prompt to Gemini `systemInstruction` field | Moderate refactor | Better prompt isolation and priority |
| **P1** | Add sandwich defense (repeat security rules after user content) | Small prompt edit | Stronger injection resistance |
| **P1** | Inject PT abbreviation reference into prompts | Prompt addition | Better shorthand expansion accuracy |
| **P1** | Add `needsReview` / `uncertainAreas` to output schema | Schema + prompt update | Builds clinician trust |
| **P2** | Add input length limits for quickNotes/patientContext | Zod validation | Prevents attention window attacks |
| **P2** | Configure Gemini safety settings explicitly | Small API change | Prevents legitimate medical content blocking |
| **P2** | Post-generation validation for hallucinated numbers | New validation fn | Programmatic anti-hallucination guardrail |
| **P3** | Template-level style preferences (concise/narrative/detailed) | Feature work | Style customization without per-user fine-tuning |
| **P3** | Structured input hints in extension UI | Frontend work | Better input quality → better output quality |

---

## Current State Assessment

### What We're Doing Well
- **Two-tier billing system** - Research confirms this is an innovative trust-building approach
- **Anti-hallucination rules with examples** - Exactly what clinical AI literature recommends
- **XML delimiter isolation** - Standard prompt injection defense
- **Structured JSON output via Gemini schema** - Best practice for consistent output
- **Goal percentage guardrails** - Prevents the most damaging type of fabrication

### What Needs Improvement
- **Temperature too high** (0.7 vs. recommended 0.2-0.3 for clinical docs)
- **System prompt not separated** from user content in Gemini API call
- **No PT abbreviation library** injected - model relies on training data alone
- **No uncertainty signaling** - model can't flag when it's unsure about an interpretation
- **No post-generation validation** - we trust the model to follow rules without verification
- **No explicit Gemini safety settings** - relying on defaults that changed in 2.5

---

## Deep-Dive Documents

| Document | Covers |
|----------|--------|
| [PT Specialization](./research/PT_SPECIALIZATION.md) | Abbreviation libraries, PT-specific knowledge injection, clinical setting context |
| [Prompt Best Practices](./research/PROMPT_BEST_PRACTICES.md) | Temperature, few-shot vs zero-shot, chain-of-thought, hallucination prevention, Gemini-specific tips |
| [Implementation Recommendations](./research/IMPLEMENTATION_RECOMMENDATIONS.md) | Concrete code changes, prompt restructuring, schema updates |
| [Input Output Design](./research/INPUT_OUTPUT_DESIGN.md) | What to ask therapists, what the model should produce, workflow optimization |
| [Style Matching Analysis](./research/STYLE_MATCHING_ANALYSIS.md) | Feasibility assessment, research findings, practical alternatives |

---

## Additional Thoughts

Beyond the five core questions, this research surfaced several strategic insights:

### 1. The "Write on Paper, Wrong in Practice" Problem
A 2025 study tested LLMs for PT SOAP notes specifically and found that even well-engineered prompts had **formatting mismatches, user distrust, and workflow misalignment** in real deployments. The gap between "looks good in testing" and "works in a clinic" is significant. We should plan for clinician feedback loops early.

### 2. The SpecialtyScribe Pipeline Approach
A WSDM 2025 paper demonstrated that breaking note generation into stages (Information Extractor → Context Retriever → Note Writer) **outperformed single-prompt approaches by 32%**. This is worth considering for v2 - particularly separating "understand the shorthand" from "write the note."

### 3. APTA Published AI Guidance in September 2025
The APTA published a practice advisory on AI-enabled ambient scribe technology, acknowledging the technology's emergence while emphasizing clinician responsibility. This means PTs are aware of AI documentation tools and there's professional body support for the concept - but with clear expectations about clinician oversight.

### 4. Trust Is Measurable
Research shows AI clinical decision support systems had **override rates of just 1.7% for transparent, well-calibrated systems** vs. **over 73% for opaque ones**. Transparency directly predicts adoption. Our "show your work" ideas from the Trust Building Strategy doc are backed by hard data.

### 5. Competitors Are Claiming Style Matching
ScribePT claims "adaptive note generation that learns your preferred phrasing and documentation style." Whether this actually works well is unclear (no published mechanism), but it's a market expectation we need to address - even if our approach is different (template-based vs. per-user fine-tuning).

---

## Research Sources

### Clinical AI & Prompt Engineering
- JMIR 2025 - Prompt Engineering in Clinical Practice Tutorial
- npj Digital Medicine 2024 - ROT Prompting Pattern for Medical Guidelines
- SpecialtyScribe (WSDM 2025) - Modular Pipeline for Clinical Notes
- "Write on Paper, Wrong in Practice" (2025) - PT SOAP Note LLM Study

### Hallucination & Safety
- MedRxiv 2025 - Five Categories of Medical Hallucinations
- Stanford 2024 - RAG + RLHF Achieving 96% Hallucination Reduction
- OWASP 2025 - Prompt Injection as #1 AI Security Risk

### Temperature & Parameters
- MedRxiv 2024 - Temperature Effects Across Clinical Tasks
- PMC 2024 - Clinical Text Mining Stability Across Temperatures

### Trust & Adoption
- AMA 2024 - Physician AI Usage Nearly Doubled to 66%
- JMIR 2025 - Trust Systematic Review (1.7% vs 73% Override Rates)
- APTA 2025 - Practice Advisory on AI-Enabled Ambient Scribe Technology

### Style Matching
- arXiv 2025 - "Catch Me If You Can" (Style Replication Limitations)
- PNAS 2025 - LLMs Have Distinctive Style That Persists Despite Prompting
- EMNLP 2025 - 15-80% Performance Variance Across Writing Styles

### Google Gemini
- Google AI - Prompt Design Strategies & Structured Output Docs
- Phil Schmid 2025 - Gemini 3 Prompting Best Practices
