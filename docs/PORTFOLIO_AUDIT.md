# FlashNote — Portfolio Hardening Audit (Phase 0)

**Date:** 2026-08-13
**Scope:** Assess the repo against an AI-Engineer-portfolio bar; produce a prioritized plan inside a 20–30h budget.
**Status:** Awaiting approval. No implementation work started.

---

## 1. Honest assessment

### The headline

The engineering underneath is stronger than the brief assumes. This is not a thin
wrapper around a `fetch` call — it's 34,834 lines of strict-mode TypeScript with
1,504 passing tests across 99 files, green CI (lint + test + coverage + build +
Terraform plan), a real provider abstraction, schema-constrained output, and
audit logging with database-enforced immutability.

**The problem is not depth. The problem is that none of the depth is legible, and
the one thing that would prove AI-engineering competence — an evaluation harness —
does not exist in any form.**

The README (2 KB) sells this as "AI-powered SOAP note generation." A hiring manager
reading it learns the tech stack and nothing about the hard parts. Every claim in
the brief about safety and anti-hallucination work is true at the *prompt* level and
completely unmeasured.

### What already exists (verified by reading it)

**LLM layer — genuinely good**
- Provider abstraction with two implementations: `gemini-provider.ts` (JSON mode +
  `responseSchema`) and `claude-provider.ts` (tool-use + `input_schema`), behind a
  common `LLMProvider` interface (`src/server/services/llm/provider.ts:27`).
- Structured output is real, not prompt-begging: Zod schema → JSON Schema
  (`schemas.ts:245`) → provider-native constrained decoding → Zod `.parse()` on the
  way back (`schemas.ts:260`). Validation failure raises `ParseError`.
- Retries with exponential backoff + 25% jitter + `Retry-After` header support
  (`provider.ts:86-127`), with an explicit retryable-error allowlist
  (`types.ts:49-60`).
- Per-request timeout via `AbortController` that covers body parsing, not just
  headers (`gemini-provider.ts:153-180`).
- **Fail-closed `finishReason` handling** (`gemini-provider.ts:198-211`): only `STOP`
  is accepted. `SAFETY`, `MAX_TOKENS`, `RECITATION`, `OTHER` all raise rather than
  returning partial clinical text. This is the kind of detail that reads senior, and
  the comment explaining *why* is already there.
- ADC token caching against the GCP metadata server with 60s refresh margin
  (`gemini-provider.ts:276-306`).

**Anti-hallucination — designed, undemonstrated**
- Two-tier billing output (`pt-prompts.ts:105-131`, `schemas.ts:100-137`): a `charges`
  array requiring explicit clinician-stated minutes, and a `suggestedCodes` array
  (code + description only) when interventions are mentioned without times. This is a
  legitimately thoughtful piece of product-safety design — it makes the *schema*
  structurally incapable of carrying a fabricated billing time in the trusted field.
- `percentComplete` on goals is optional with "NEVER estimate" instructions
  (`schemas.ts:72-82`).
- `uncertainAreas` array for model-flagged ambiguity (`schemas.ts:211-221`).
- Explicit fabrication rules with positive/negative examples in the system prompt
  (`pt-prompts.ts:133-151`).

**Prompt injection defense**
- XML delimiter wrapping with tag-stripping to prevent boundary breakout
  (`prompt-sanitization.ts:84-108`), sandwich-defense reminder after user content
  (`pt-prompts.ts:257-259`), system prompt via the provider's native system field.
- 22 suspicious-pattern heuristics, **monitoring-only with the rationale documented**
  (`prompt-sanitization.ts:110-135`) — false positives in a clinical workflow being
  worse than the attack, since the blast radius is the attacker's own note. Correct
  call, well argued.

**HIPAA / security posture**
- Every generation is audit-logged with token counts, duration, note type, and the
  injection-detection flag — and no content (`actions/notes.ts:121-136`).
- `audit_logs` immutability enforced by database triggers on UPDATE/DELETE/TRUNCATE
  (`001_initial_schema.sql:96-127`), not just application convention.
- PHI-free logging is enforced by convention *and* commented at each risk point
  (`gemini-provider.ts:309`, `:332`).
- Config-level production guards (`db/config.ts:82-107`): `USE_MOCK_AI` is a hard
  startup failure in production ("could generate fake clinical notes that harm
  patients"), and `LLM_PROVIDER=claude` is **blocked in production because there is
  no Anthropic BAA**. That second one is the single most interview-ready line of code
  in the repo and it is currently invisible to any reader.
- Rate limiting is Redis-backed with a documented `TRUSTED_PROXY_COUNT` story for
  Cloud Run's XFF behavior.
- PHI storage is pass-through only — nothing clinical is persisted today. This is the
  strongest possible data-protection answer and the README never mentions it.

### What is stubbed or weak

| Item | Reality |
|---|---|
| `parse_error` is non-retryable (`types.ts:46,53-59`) | One malformed response = hard user-facing failure. **No repair loop**, which the brief explicitly asks for. Real gap, cheap fix. |
| No fallback model path | `getConfiguredProvider` resolves exactly one provider (`provider-factory.ts:96`). `ClaudeProvider` is fully built and tested but unreachable in production by config guard. If Vertex is down, generation fails. |
| Prompt "versioning" | Prompts live in a dedicated module (better than string literals in a handler) but carry **no version identifier**, so nothing can attribute a result to a prompt revision. |
| `uncertainAreas` | Model self-report. Nothing verifies it, and an unflagged fabrication is invisible. |
| Mock mode | Returns one hardcoded fixture (`note-generation.ts:77-104`) — fine for tests, useless as a demo. |
| Patient selector, context panel | UI stubs labeled "Coming soon" (`NoteGenerationForm.tsx:161-174`, `:344-353`). Honest, but a reader sees dead controls. |
| `gemini-provider.ts:179` | `response.json()` runs before the `!response.ok` check, so a non-JSON error body (LB 502 returning HTML) surfaces as `NetworkError` instead of `ProviderError`. Minor — retryable either way. |

### What is absent entirely

- **Any evaluation harness.** No golden dataset, no scorers, no judge, no baseline,
  no regression diff, no CI hook. Zero files. This is the whole differentiator.
- **Any programmatic groundedness check.** Fabrication prevention is 100% prompt
  instructions. Nothing verifies output against input at runtime or in tests.
- **Adversarial test set.** None.
- **Refusal / escalation on thin input.** No threshold, no refusal path in the schema.
  Feed it three words and it will write a full SOAP note.
- **Cost and latency measurement.** No cost calculation anywhere in the repo, no
  percentile aggregation, no metrics endpoint. `generationTimeMs` is captured per
  request and thrown away.
- **De-identification boundary.** Raw clinician notes go to Vertex AI verbatim.
  Defensible under a BAA — arguably correct, since de-identifying PT shorthand would
  destroy the clinical signal — but it is an *undocumented* architectural decision
  where the brief expects a deliberate one.
- **Retrieval.** Nothing. (Recommend keeping it that way — see §4.)
- **Streaming.** Nothing.
- **Hosted demo.** Roadmap shows 0/7 deployment steps done. Nothing is deployed, and
  every meaningful route sits behind session + email verification + subscription gate.
- **Pre-commit PHI check.** No git hooks installed at all.

---

## 2. Capability scorecard

| # | Capability | Score | Evidence / gap |
|---|---|---|---|
| **1** | **Evaluation harness** | **Absent** | No golden dataset, scorers, judge, baseline, regression diff, or CI wiring. |
| 2 | Hallucination guardrails, measurable | **Partial** | Prompt rules + two-tier billing schema are real and good. No span attribution, no programmatic groundedness gate, no adversarial set, no refusal path, no measured pass rates. Design present; *measurement* absent. |
| 3 | PHI / safety architecture as artifact | **Partial** | Implementation is strong (audit immutability, PHI-free logging, BAA-aware config guards, pass-through-only PHI). Undocumented as a design artifact; no de-id boundary decision recorded; no zero-retention config documented; no standards mapping. |
| 4 | Retrieval layer | **Absent** | *Recommend cutting.* No corpus exists to retrieve from. |
| 5 | Production engineering signals | **Partial** | Schema-constrained generation ✅, validation ✅, timeouts ✅, retries+backoff ✅, tests+green CI ✅, prompts as module ✅. Repair loop ❌, fallback model ❌, tracing ❌, cost/latency metrics ❌, streaming ❌, prompt versioning ❌. |
| 6 | Cost & latency engineering | **Absent** | Nothing measured. No routing, no caching, no numbers. |
| **A** | **README as primary deliverable** | **Absent** | 2 KB tech-stack table. No diagram, eval table, tradeoffs, metrics, or limitations. |
| **B** | **Hosted demo** | **Absent** | Nothing deployed; all routes gated. |
| C | Interview / resume material | Absent | Generate last, from measured results only. |

---

## 3. Prioritized plan — ranked by interview impact per hour

Budget: **20–30h.** The core below is **~26h**. Item 5 is the flex.

### P0 — Evaluation harness · ~13h · highest impact

The one thing that separates "I use LLM APIs" from "I do AI engineering."

| Task | Est. | Notes |
|---|---|---|
| 1.1 Golden dataset: 32 synthetic encounters (8 per note type) | 4h | Each case = source input + **structured expected-facts annotations** (numbers, interventions, times, required sections), not expected prose. Scoring against expected *facts* rather than expected text is the correct design and is itself a talking point. Synthetic only. |
| 1.2 Deterministic scorers (no API key needed) | 3h | (a) **Numeric fidelity** — every measurement in the output must appear in the input. This directly measures the anti-hallucination claim and needs no judge. (b) Format validity via Zod. (c) Completeness vs. expected facts. (d) Section-placement checks. (e) Billing-tier correctness — a time in `charges` that isn't in the input is a hard fail. |
| 1.3 LLM-as-judge for groundedness + section placement | 2.5h | Judge prompts as version-controlled files with explicit version IDs. Judge only where deterministic scoring can't reach. |
| 1.4 Runner + versioned results | 2.5h | `pnpm eval` → `evals/results/<ts>-<promptVersion>.json`, appends to `evals/RESULTS.md`, diffs vs. baseline, non-zero exit on regression. |
| 1.5 Judge/human agreement | 1.5h | Hand-label ~40 judgments, report Cohen's κ in one short doc. Bounded scope — do not build a labeling tool. |
| 1.6 CI wiring | 1h | Workflow on PRs touching `prompts/**`/`evals/**`. **Record/replay fixtures** so deterministic scorers run free and offline on every PR; judge runs only when an API key secret is present. This is what makes eval-in-CI actually sustainable, and it's a strong senior signal on its own. |

### P0 — Guardrails made measurable · ~6h

| Task | Est. | Notes |
|---|---|---|
| 2.1 Runtime groundedness gate | 3h | Promote the numeric-fidelity verifier from §1.2 into the request path: extract measurements/times from the generated note, verify each against the source, return unsupported ones as structured warnings. Surface as a warning band in the UI. **This is the honest, measurable version of "attribution"** — see §4 on why full span highlighting is cut. |
| 2.2 Adversarial set + reported pass rate | 2h | ~20 inputs engineered to induce fabrication: vague input inviting numbers, explicit "estimate the ROM," contradictory times, thin input, injection attempts. Runs in the harness; pass rate lands in the README table. |
| 2.3 Insufficient-input refusal | 1h | Threshold + refusal path in the schema, with a test proving it triggers and a test proving it does *not* fire on legitimately terse notes. |

### P1 — Instrumentation + the README · ~7h

| Task | Est. | Notes |
|---|---|---|
| 3.1 Prompt versioning | 0.5h | Version constant derived from the prompt file's content hash; stamped into every trace and eval result. Unblocks meaningful regression diffs. |
| 3.2 Per-request trace + cost | 2h | Prompt version, model, token counts, computed USD cost, latency → structured log + in-process percentile aggregation. `/api/metrics` returning p50/p95 latency and cost-per-note. |
| 3.3 JSON repair loop | 1h | On `ParseError`, one repair attempt feeding the validation error back. Fixes a real reliability gap and satisfies the brief. |
| 3.4 README rewrite | 3h | Brief's exact ordering: problem → Mermaid architecture diagram → **eval results table** → safety/PHI architecture → tradeoffs with rejected alternatives → measured latency/cost/groundedness → limitations. Written last, after real numbers exist. |
| 3.5 Pre-commit PHI check | 0.5h | Blocks committing anything under a `phi/` path, plausible MRN/DOB patterns, or eval fixtures lacking a synthetic marker. Required by the rules of engagement. |

### P1 — Safety architecture doc · ~1.5h

`docs/SAFETY_ARCHITECTURE.md`: the de-identification boundary decision (including
*why* PT shorthand is not de-identified, and what that costs), what crosses the
inference boundary, BAA-covered path + Vertex zero-retention config, key/secret
handling, audit trail, retention/deletion, and a short honest mapping to the HIPAA
Security Rule with ISO 14971 / FDA AI-ML framing marked clearly as "how I would
approach this if it were a regulated device," not as a claim of compliance. Much of
this can be lifted and condensed from the existing `docs/compliance/` material,
which is why it's cheap.

### P1 — Hosted demo · ~5h · highest risk, flex item

Public `/demo` route: no auth, own IP rate limit, prefilled synthetic examples, real
Gemini calls, prominent synthetic-data-only banner, groundedness warnings visible.

**The risk is deployment, not the route.** Nothing is currently deployed and the
production path needs a GCP project, Cloud SQL, Secret Manager, ALB, and DNS — that
could eat 10h alone and produce zero interview signal. Recommendation: deploy the
demo as a **standalone no-database path** (demo route only, no auth, no Postgres),
which sidesteps the entire provisioning chain. Because the demo never touches PHI, it
doesn't need the BAA-covered path — and *that* tradeoff is itself worth a paragraph in
the README.

**Decision needed from you:** confirm the standalone demo deploy, or defer the demo
and reallocate those 5h into a deeper golden dataset.

### P2 — Interview material · ~1.5h

Resume bullets, the two-minute walkthrough script, and five deep-dive Q&As —
generated **after** the work, populated only with numbers we actually measured.

---

## 4. What I recommend cutting, and why

**Retrieval (brief §4) — cut entirely.**
There is no corpus. Prior visit notes don't exist (PHI storage isn't built — notes are
pass-through only). Treatment protocols aren't in the repo. An ICD/CPT reference is a
lookup table, not a retrieval problem, and wrapping a 200-row table in an embedding
index would be indefensible under questioning. You already suspected this; it's
correct. A staff engineer spots decorative RAG in about thirty seconds, and "I
considered retrieval and rejected it because there's no corpus that isn't better
served by a lookup" is a *better* answer than a bolted-on vector store. Put that in the
tradeoffs section.

**Span-level attribution highlighting in the UI — cut, replaced by §2.1.**
Character-offset mapping from generated prose back to input spans, plus hover
highlighting, is 8–10h and would consume the eval budget. It also degrades badly:
generated text is a paraphrase, so offsets are approximate and a wrong highlight is
worse than none. The claim-level groundedness gate in §2.1 delivers the part that
actually matters — *unsupported assertions get caught and surfaced* — and it's
measurable, which span highlighting is not.

**Streaming (brief §5) — cut.**
The output is a schema-constrained JSON object. Streaming partial JSON means either
parsing incomplete objects or abandoning constrained decoding, which would weaken the
strongest safety property in the system. The perceived-latency win is real but it
competes directly with evals, and "I chose constrained decoding over streaming because
a malformed clinical note is worse than a slow one" is a good answer. Note it as a
limitation.

**Model routing (brief §6) — cut the implementation, keep the analysis.**
At gemini-2.5-flash pricing a cheap-extraction/strong-synthesis split saves a
rounding error per note while adding a second failure mode to the clinical path. Do
the measurement (§3.2), then document the routing decision boundary *with the real
numbers showing why single-model is correct at this scale, and at what volume that
flips.* That is a stronger interview answer than a routing layer that saves $0.0001.

**Cross-provider fallback — reframe, don't build.**
Worth stating plainly: cross-provider fallback is **blocked by the BAA**, not by
engineering effort. `ClaudeProvider` is fully built and deliberately prod-disabled
(`db/config.ts:103-107`). Fallback here can only mean a second Gemini model on
Vertex. Documenting that constraint is worth more than implementing the fallback.

**Roadmap work that is irrelevant here — skip.**
Pino migration, Sentry removal, UI Overhaul Phase E, PHI Storage Phase 2. All real
work; none of it moves an AI-engineering screen.

---

## 5. Budget summary

| Block | Hours |
|---|---|
| P0 — Eval harness | 13 |
| P0 — Measurable guardrails | 6 |
| P1 — Instrumentation + README | 7 |
| P1 — Safety architecture doc | 1.5 |
| P1 — Hosted demo (flex) | 5 |
| P2 — Interview material | 1.5 |
| **Total** | **~34h** |
| **Total without demo** | **~29h** |

Both land at or over the top of the range, so something gives. Recommended
sequencing if time runs short: **the eval harness and the README ship no matter what.**
An eval harness with no demo still passes screens. A demo with no evals is another
side project.

---

## 6. Open questions

1. **Demo:** standalone no-DB deploy (~5h, keeps scope contained), or defer and
   reinvest in the dataset?
2. **Golden dataset size:** 32 cases is credible and fits the budget. 60+ reads
   better but costs ~3h more and would have to come out of the demo. Preference?
3. **Judge model:** using Gemini to judge Gemini invites a self-preference critique.
   Using Claude as judge is methodologically cleaner and the §1.5 κ measurement makes
   the choice defensible either way — but Claude is prod-disabled by the BAA guard.
   Since evals run on synthetic data only, no BAA is required. Confirm you're
   comfortable with an eval-only Anthropic dependency; I'd recommend it.
