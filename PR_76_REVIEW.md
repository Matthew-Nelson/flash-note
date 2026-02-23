# Code Review: PR #76 — Prompt Engineering P0

**Overall: Approve.** This is a well-scoped, security-meaningful PR. The three changes (temperature, system prompt isolation, H-16 fix) are cleanly implemented with thorough test coverage. No blocking issues.

---

## What this PR does

1. **Lowers LLM temperature from 0.7 to 0.2** (both Gemini and Claude) — correct for medical documentation where deterministic, consistent output matters more than creativity.

2. **Separates system prompt from user content** — System prompt now uses the provider's dedicated field (`systemInstruction` for Gemini, `system` for Claude) instead of being concatenated into the user message. This is the single most impactful prompt injection defense available at the API level.

3. **Fixes H-16: XML delimiter tag escaping** — `escapeDelimiterTags()` strips `<clinician_notes>`, `</clinician_notes>`, `<patient_context>`, `</patient_context>` from user input before wrapping. Prevents boundary breakout where an attacker injects `</clinician_notes>` to escape the XML delimiter and inject arbitrary instructions.

4. **Adds sandwich defense** — Security reminder repeated after user content in the user prompt, reinforcing that delimited content is data-only.

5. **Expands detection patterns** — `SUSPICIOUS_PATTERNS` now catches delimiter tag injection attempts for monitoring/alerting.

---

## Strengths

- **Clean API refactor**: `buildSOAPPrompt` split into `getSystemPrompt()` + `buildUserPrompt()` is the right decomposition. The `LLMProvider.generatePTNote` signature change to `(systemPrompt, userPrompt, config)` pushes isolation down to the provider level where it belongs.

- **Defense-in-depth on H-16**: Three layers — (1) `escapeDelimiterTags` strips delimiter tags from content, (2) `detectSuspiciousPatterns` logs the attempt for monitoring, (3) sandwich defense reminds the LLM to treat delimited content as data. Good layering.

- **Test coverage is thorough**: `escapeDelimiterTags` tested with case variations, whitespace, attributes, multiple tags, and the critical false-positive case (medical notation `<90°` preserved). Provider tests verify system prompt goes to the right API field and user content does NOT contain system prompt.

- **Regex is correct**: `<\s*/?s*${tagName}[^>]*>` handles the relevant attack surface — whitespace padding, attribute injection, case variations. Medical angle-bracket notation (e.g., `<90°`) is preserved since the character after `<` doesn't match tag name patterns.

---

## Issues

### Minor

1. **Stale doc references to `buildSOAPPrompt`** — 5 documentation files still reference the old function name:
   - `docs/reference/FLASHNOTE_HANDOFF.md:1533`
   - `docs/compliance/SENTRY_PHI_HARDENING.md:26`
   - `docs/planning/research/PROMPT_BEST_PRACTICES.md:36,61`
   - `docs/planning/research/IMPLEMENTATION_RECOMMENDATIONS.md:39`
   - `docs/planning/VOICE_INPUT_ROADMAP.md:308`

   Per CLAUDE.md: "Update any other docs affected by the changes." The planning/research docs describe exactly the refactoring this PR implements, so `PROMPT_BEST_PRACTICES.md` and `IMPLEMENTATION_RECOMMENDATIONS.md` could be moved to `docs/archive/` since their recommendations are now implemented.

2. **`generateCompletion` still uses single-prompt signature** — `generatePTNote` now takes `(systemPrompt, userPrompt, config)` but `generateCompletion` still takes `(prompt, config)`. Not necessarily wrong (it's for raw/debug usage), but the interface is now asymmetric. Worth a note if `generateCompletion` is ever used with user-provided content.

### Nit

3. **`getSystemPrompt()` is trivially thin** — It just returns `PT_SYSTEM_PROMPT`. This is fine as an API boundary and allows future extensibility (e.g., per-note-type system prompts), but `ai-service.ts` could also just import `PT_SYSTEM_PROMPT` directly. No strong opinion either way.

---

## Verification

The changes are correct against both provider APIs:
- **Gemini**: `systemInstruction: { parts: [{ text }] }` is the documented field for system instructions.
- **Claude**: `system: string` is the documented field for system prompts in the Messages API.

Temperature 0.2 is within the commonly recommended range (0.0-0.3) for structured clinical output.
