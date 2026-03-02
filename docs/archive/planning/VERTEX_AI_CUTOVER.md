# Vertex AI Cutover Plan

**Purpose:** Migrate from consumer Gemini API to HIPAA-compliant Vertex AI endpoint before any PHI flows through the LLM.

**Roadmap location:** Phase 0 — HIPAA Infrastructure (items 1a-1c)

**Prerequisite:** Google Cloud BAA signed (Phase 0 item 1)

---

## Why This Is Required

The consumer Gemini API (`generativelanguage.googleapis.com`) is **not covered by any BAA**. Google's HIPAA compliance for Gemini requires Vertex AI — the enterprise endpoint covered under the Google Cloud BAA. Until this cutover is complete, PHI cannot legally flow through the LLM.

Reference: [PRE_LAUNCH_CHECKLIST.md §2](../PRE_LAUNCH_CHECKLIST.md) — "Must use Vertex AI endpoint (not consumer Gemini API)"

---

## Scope of Change

The Vertex AI Gemini API uses the **same request and response format** as the consumer API. The two differences are:

| | Consumer Gemini API (current) | Vertex AI (target) |
|---|---|---|
| **Endpoint** | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | `https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{REGION}/publishers/google/models/{MODEL_ID}:generateContent` |
| **Auth** | `x-goog-api-key` header (API key) | `Authorization: Bearer {token}` (OAuth2 access token from Application Default Credentials) |

Request body (`contents`, `systemInstruction`, `generationConfig`) and response body (`candidates`, `usageMetadata`) are identical. No prompt or schema changes needed.

---

## Cutover Checklist

### Stage 1: GCP Project Setup (Ops)

> These are one-time GCP console operations. No code changes.

- [ ] **1a. Sign Google Cloud BAA**
  - Google Cloud Console → Compliance → BAA
  - Free, self-serve — covers Cloud Run, Cloud SQL, Vertex AI under one agreement
  - **This is the legal gate.** Nothing else proceeds without it.

- [ ] **1b. Enable Vertex AI API**
  - Google Cloud Console → APIs & Services → Enable `aiplatform.googleapis.com`
  - Requires a GCP project with billing enabled

- [ ] **1c. Create service account for LLM access**
  - Role: `roles/aiplatform.user` (Vertex AI User)
  - Download JSON key for local/CI use (key file stays out of git — `.gitignore` + Secret Manager in production)
  - In Cloud Run (Phase 1.0): use Workload Identity Federation instead of key file (keyless, automatic)

- [ ] **1d. Choose GCP region**
  - Must support `gemini-2.5-flash` on Vertex AI
  - Recommended: `us-central1` (broadest model availability, lowest latency to Cloud SQL if co-located)
  - Document chosen region — used in endpoint URL and Cloud Run deployment

### Stage 2: Code Changes

> Framework-agnostic. These changes apply to the current Express backend and transfer unchanged to the Next.js migration.

#### 2a. Update `backend/src/config.ts`

Add new environment variables, make API key conditional:

```
# New env vars
GCP_PROJECT_ID=your-project-id        # Required for Vertex AI
GCP_REGION=us-central1                 # Required for Vertex AI
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json  # Local/CI only; Cloud Run uses ADC automatically

# Existing — now optional (only needed if VERTEX_AI disabled for local dev)
GEMINI_API_KEY=...                     # Falls back to consumer API when set without Vertex AI config
```

Config validation logic:
- If `GCP_PROJECT_ID` AND `GCP_REGION` are set → use Vertex AI endpoint
- If only `GEMINI_API_KEY` is set → use consumer API (local dev fallback)
- If neither → fail startup with clear error
- In production (`NODE_ENV=production`): **require** Vertex AI config, reject consumer API

#### 2b. Update `backend/src/services/llm/gemini-provider.ts`

Changes to `GeminiProvider`:

1. **Constructor**: Accept `projectId`, `region`, and optional `apiKey`. Build endpoint URL based on which config is provided.

2. **Auth**: Replace `x-goog-api-key` header with `Authorization: Bearer {token}`.
   - Use `google-auth-library` to get access tokens from ADC (Application Default Credentials)
   - ADC automatically resolves: service account key file (local) → Workload Identity (Cloud Run) → user credentials (`gcloud auth`)
   - Tokens are short-lived (1 hour) — the library handles refresh automatically

3. **Endpoint URL**:
   - Vertex AI: `https://{region}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{region}/publishers/google/models/{model}:generateContent`
   - Consumer: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` (unchanged, for local dev)

4. **Health check**: Update to use Vertex AI model metadata endpoint if on Vertex AI.

#### 2c. Update `backend/src/services/llm/provider-factory.ts`

Pass `projectId` and `region` from config to `GeminiProvider` constructor.

#### 2d. Add `google-auth-library` dependency

```bash
cd backend && pnpm add google-auth-library
```

This is Google's official auth library for Node.js. It handles:
- Reading `GOOGLE_APPLICATION_CREDENTIALS` env var
- Automatic token refresh
- Workload Identity Federation on Cloud Run (zero-config)

### Stage 3: Testing

- [ ] **3a. Unit tests**: Mock the auth library, verify correct endpoint URL construction for both Vertex AI and consumer API paths
- [ ] **3b. Integration test**: Call Vertex AI endpoint with real service account credentials, verify response format matches consumer API
- [ ] **3c. Verify no PHI in logs**: Confirm `handleHttpError` and `handleApiError` don't log request/response bodies (already the case — verify it stays that way)
- [ ] **3d. Verify error handling**: Confirm HTTP error codes from Vertex AI map correctly (same codes as consumer API: 400, 401, 403, 429, 500, 503)
- [ ] **3e. Existing test suite passes**: `pnpm test` — all LLM provider tests pass with mocked Vertex AI responses

### Stage 4: Verification

- [ ] **4a. Confirm BAA is signed** — screenshot or export from GCP Console → Compliance
- [ ] **4b. Confirm Vertex AI endpoint in use** — log the constructed URL at startup (INFO level, no secrets)
- [ ] **4c. Confirm API key is NOT used in production** — config validation rejects `GEMINI_API_KEY`-only config when `NODE_ENV=production`
- [ ] **4d. Confirm service account has minimal permissions** — only `roles/aiplatform.user`, nothing broader
- [ ] **4e. Confirm TLS** — Vertex AI endpoint is HTTPS-only (enforced by Google, no action needed)

---

## What Does NOT Change

- Prompt templates (`backend/src/services/llm/prompts/`)
- Response schema (`backend/src/services/llm/schemas.ts`)
- Retry logic (`backend/src/services/llm/provider.ts`)
- Error types (`backend/src/services/llm/errors.ts`)
- Claude provider (unaffected — separate provider)
- Token usage tracking
- Rate limiting (application-level, not provider-level)

---

## Local Development

Developers can continue using the consumer Gemini API locally by setting `GEMINI_API_KEY` without `GCP_PROJECT_ID`/`GCP_REGION`. This avoids requiring every developer to have GCP credentials for local work.

Alternatively, install `gcloud` CLI and run `gcloud auth application-default login` to use Vertex AI locally with personal credentials.

---

## Cloud Run Integration (Phase 1.0)

When the Next.js app deploys to Cloud Run in Phase 1.0:

1. Attach the LLM service account to the Cloud Run service (or use the default compute service account with `roles/aiplatform.user`)
2. ADC works automatically — no key file, no `GOOGLE_APPLICATION_CREDENTIALS` env var
3. Set `GCP_PROJECT_ID` and `GCP_REGION` as Cloud Run environment variables
4. Remove `GEMINI_API_KEY` from production config entirely

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Vertex AI model availability differs from consumer API | Low | Medium | Verify `gemini-2.5-flash` available in chosen region before committing |
| Auth token refresh fails mid-request | Very low | Low | `google-auth-library` handles refresh; tokens valid 1 hour; retry logic already exists |
| Vertex AI has different rate limits | Medium | Low | Application-level rate limiting already enforced; Vertex AI quotas are per-project and adjustable |
| Local dev breaks without GCP credentials | Medium | Low | Consumer API fallback preserved for local dev |
