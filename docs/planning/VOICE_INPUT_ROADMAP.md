# Voice Input Feature Roadmap

**Status:** Planning (not scheduled)
**Last Updated:** February 16, 2026

---

## Overview

Add voice input to FlashNote so PTs can dictate or record sessions instead of typing shorthand. Two phases: dictation (speak a summary) and ambient recording (capture the full visit).

The transcript feeds directly into the existing Gemini SOAP generation pipeline — `aiService.generateSOAPNote()` stays untouched. Voice is just a new input method for `quickNotes`.

---

## Speech-to-Text Provider Options

### Recommended: Google Cloud Speech-to-Text (Medical Models)

**Rationale:** Platform alignment. FlashNote already runs on GCP (Cloud Run), uses Gemini via Google APIs, and will need a GCP BAA for HIPAA compliance regardless. Adding another vendor (Deepgram, AssemblyAI) means a second BAA, a second vendor relationship, and a second set of compliance documentation. Google's medical models are purpose-built for the clinical conversation use case.

**Two models available:**

| Model | Use Case | Phase |
|-------|----------|-------|
| `medical_dictation` | Single speaker recapping a session (PT speaks into mic) | Phase 1 |
| `medical_conversation` | Multi-speaker dialogue (PT + patient during visit) | Phase 2 |

**Pricing (Google Cloud Speech-to-Text V2, enhanced tier):**

| Duration | Estimated Cost | Notes |
|----------|---------------|-------|
| 2-min dictation | ~$0.05-0.07 | Phase 1 typical use |
| 15-min session | ~$0.36-0.54 | Phase 2 typical use |
| 45-min eval | ~$1.08-1.62 | Phase 2 long session |

**Comparison (for reference — not recommended, but worth knowing):**

| Provider | Cost/15-min Session | BAA | Medical Model | Why Not |
|----------|-------------------|-----|---------------|---------|
| Deepgram Nova-3 Medical | $0.15 | Yes | Yes (best accuracy: 3.45% WER) | Second vendor, second BAA |
| AssemblyAI | $0.06-0.10 | Yes | Yes | Second vendor, second BAA |
| Speechmatics | $0.06 | Yes | Yes | Less US healthcare track record |
| AWS Transcribe Medical | $1.13 | Yes | Yes | More expensive than Google, no platform alignment |
| OpenAI Whisper API | $0.09 | Conditional | No medical model | Poor medical accuracy, no streaming, conditional BAA |

Google is 3-5x more expensive than Deepgram/AssemblyAI per minute. At scale (100 PTs, 8 sessions/day, 15 min each):
- Google: ~$540-810/month for transcription
- Deepgram: ~$145/month

The delta is real but manageable within $69/month subscription margins. If cost becomes a concern at scale, switching providers later is straightforward — it's a single backend service behind an interface.

### Self-Hosted (Not Recommended)

Open-source options (Whisper, faster-whisper, Google MedASR) only make economic sense above ~2,400 hours/month. FlashNote at 100 PTs would generate ~200 hours/month. Self-hosting adds GPU infrastructure, DevOps burden, and worse medical accuracy. Revisit only if reaching thousands of concurrent users.

---

## Cost Impact Summary

**Current per-note cost:** ~$0.001 (Gemini 2.5 Flash only)

| Scenario | Transcription | SOAP Generation | Total | vs. Current |
|----------|--------------|-----------------|-------|-------------|
| Text input (current) | $0.00 | $0.001 | $0.001 | baseline |
| Phase 1: 2-min dictation | $0.05-0.07 | $0.001 | ~$0.07 | ~70x |
| Phase 2: 15-min session | $0.36-0.54 | $0.002 | ~$0.50 | ~500x |
| Phase 2: 45-min eval | $1.08-1.62 | $0.003 | ~$1.50 | ~1500x |

**Monthly cost at 100 PTs (8 sessions/day, 22 working days):**

| Scenario | Monthly Cost | Revenue (100 x $69) | Margin |
|----------|-------------|---------------------|--------|
| Text only (current) | ~$18 | $6,900 | 99.7% |
| Phase 1 dictation only | ~$1,250 | $6,900 | 81.9% |
| Phase 2 full recording | ~$8,800 | $6,900 | **-27.6%** |

Phase 2 at full-session recording is margin-negative on the current $69/month plan if every session uses voice. Options:
1. **Tier voice as a premium add-on** ($20-30/month extra)
2. **Cap monthly voice minutes** per plan (e.g., 300 min/month on Personal)
3. **Raise base price** to $89-99/month (competitive with Twofold at $69/month)
4. **Offer dictation free, charge for ambient** — Phase 1 stays in current plan, Phase 2 is premium

Recommendation: Start with option 4. Dictation margins are fine. Full session recording pricing should be informed by actual usage patterns from Phase 1.

---

## Phase 1: Dictation Mode

**Goal:** PT taps a mic button, speaks a 1-3 minute recap, transcript populates the Session Notes field for review before SOAP generation.

**Why start here:**
- 80% of the value (no typing) at 20% of the complexity (no streaming, no diarization, no multi-speaker)
- Single speaker = simpler audio, higher accuracy
- PT reviews transcript before generating = safety net for errors
- Low HIPAA risk (clinician's summary, not raw patient speech)
- Manageable cost (~$0.07/use)

### Architecture

```
Extension                          Backend                         Google Cloud
┌──────────────┐                  ┌──────────────┐               ┌──────────────┐
│ MediaRecorder │  audio/webm     │ POST         │  audio bytes  │ Speech-to-   │
│ API (browser) │ ──────────────> │ /notes/      │ ────────────> │ Text V2      │
│               │                 │ transcribe   │               │ (medical_    │
│ [Record] btn  │  JSON response  │              │  transcript   │  dictation)  │
│ fills         │ <────────────── │ returns      │ <──────────── │              │
│ quickNotes    │                 │ transcript   │               │              │
└──────────────┘                  └──────────────┘               └──────────────┘
                                         │
                                  Same auth chain as
                                  POST /notes/generate
                                  (requireAuth, requireCsrf,
                                   requireEmailVerification,
                                   requireActiveSubscription)
```

### Implementation: Extension

**Files to modify:**

| File | Change |
|------|--------|
| `extension/public/manifest.json` | Potentially no change — `getUserMedia()` works in side panel context without extra permissions. Needs testing. If not, add `"permissions": ["audioCapture"]` |
| `extension/src/sidepanel/components/NoteGenerator.tsx` | Add record/stop button, recording state management, audio handling |
| `extension/src/shared/api.ts` | Add `transcribeAudio(audioBlob: Blob): Promise<string>` method using `multipart/form-data` |
| `extension/src/shared/schemas.ts` | Add `transcriptionResponseSchema` for runtime validation of backend response |

**NoteGenerator UX changes:**

The Session Notes textarea (`NoteGenerator.tsx:318-338`) gets a companion mic button:

```
┌─────────────────────────────────────────┐
│ Session Notes              [🎤 Dictate] │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │  (textarea - can type OR dictate)   │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│ 0/5,000 characters                      │
└─────────────────────────────────────────┘
```

When recording:

```
┌─────────────────────────────────────────┐
│ Session Notes          [⏹ Stop] 0:42   │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │  Recording... (pulsing indicator)   │ │
│ │  Textarea disabled during capture   │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│ Tap Stop when done speaking             │
└─────────────────────────────────────────┘
```

After transcription completes:
- Transcript populates the textarea
- PT can edit/correct before hitting "Generate Note"
- This is the critical safety step — PT reviews AI-generated transcript before it feeds into AI-generated SOAP note

**Audio recording implementation:**
- Use `navigator.mediaDevices.getUserMedia({ audio: true })` to get mic access
- Record with `MediaRecorder` API using `audio/webm;codecs=opus` (supported by Chrome, accepted by Google Cloud STT)
- Cap recording at 5 minutes (dictation, not full sessions)
- Show elapsed time during recording
- On stop: create `Blob`, upload via new API client method

**New API client method in `api.ts`:**
```
POST /notes/transcribe
Content-Type: multipart/form-data
Body: { audio: Blob (audio/webm) }
Response: { success: true, data: { transcript: string, durationMs: number, confidence: number } }
```

### Implementation: Backend

**New files:**

| File | Purpose |
|------|---------|
| `backend/src/services/transcription-service.ts` | Google Cloud STT integration, follows same singleton pattern as `ai-service.ts` |
| `backend/src/services/transcription/google-stt-provider.ts` | Google Cloud STT V2 provider (follows existing LLM provider pattern) |
| `backend/src/services/transcription/types.ts` | Types and interfaces for transcription |

**Modified files:**

| File | Change |
|------|--------|
| `backend/src/routes/notes.ts` | Add `POST /notes/transcribe` endpoint |
| `backend/src/config.ts` | Add `GCP_STT_ENABLED`, `GCP_STT_MAX_AUDIO_DURATION_SECONDS` env vars |
| `backend/src/middleware/rate-limit.ts` | Add transcription rate limit (separate from generation — e.g., 10/min) |

**`POST /notes/transcribe` endpoint:**

```
Middleware: requireAuth → requireCsrf → requireEmailVerification
           → requireActiveSubscription → transcribeRateLimit

1. Parse multipart form data (multer with memory storage, no disk writes)
2. Validate:
   - File exists and is audio/* MIME type
   - File size ≤ 10MB (~5 min of WebM/Opus at reasonable quality)
   - Duration ≤ 300 seconds (5 min cap for dictation)
3. Send audio buffer to Google Cloud STT V2:
   - Model: medical_dictation
   - Language: en-US
   - Encoding: WEBM_OPUS
4. Return transcript + metadata
5. Audit log: transcription event (userId, durationMs, success/failure — never content)
6. Usage tracking: track audio_seconds_used alongside existing token tracking
```

**HIPAA considerations for Phase 1:**
- Audio is never written to disk — `multer` memory storage only, buffer passed directly to Google STT API
- Audio is never logged or stored after the API call completes
- Transcript is returned to client and not stored on backend
- Google Cloud STT does not retain audio data when used with a BAA (data processing addendum)
- Audit logs record only metadata: userId, timestamp, durationMs, success/failure

**New dependency:** `multer` (or `busboy`) for multipart parsing. This is the only new npm package required.

**Google Cloud STT V2 integration:**
- Uses `@google-cloud/speech` Node.js client library (REST also available, matching existing Gemini pattern)
- Authentication via GCP service account (same as production Cloud Run deployment)
- The `medical_dictation` model is V1 API — check V2 availability. If V2 only has `medical_conversation`, V1 REST API for `medical_dictation` is acceptable for Phase 1.

### Implementation: Usage Tracking & Billing

**Database changes:**
- Add `audio_seconds` column to `usage` table (tracks monthly transcription usage per user)
- Migration: `ALTER TABLE usage ADD COLUMN audio_seconds integer NOT NULL DEFAULT 0;`

**Billing implications:**
- Phase 1 (dictation): absorb cost into existing plan — margins hold at ~82%
- Consider adding `audio_seconds` to `/usage/me` response so dashboard shows voice usage
- No pricing tier changes needed for Phase 1

### Testing Strategy

| Layer | Tests |
|-------|-------|
| Unit: transcription service | Mock Google STT client, verify request formatting, error mapping, retry logic |
| Unit: `/notes/transcribe` route | Mock transcription service, test auth chain, file validation, size limits, rate limiting |
| Unit: extension audio recording | Mock MediaRecorder, verify blob creation, upload formatting |
| Integration: end-to-end | Real audio file → backend → mocked STT → transcript response |
| Manual: mic permissions | Verify Chrome side panel mic access works without special extension permissions |

---

## Phase 2: Full Session Recording (Ambient)

**Goal:** PT clicks "Record" at the start of a visit. FlashNote captures the full 15-90 minute session, transcribes it with speaker diarization, and generates a SOAP note from the full transcript.

**Prerequisites:** Phase 1 complete and validated with real users. Pricing model for voice minutes decided based on Phase 1 usage data.

### Architecture Changes from Phase 1

| Concern | Phase 1 (Dictation) | Phase 2 (Ambient) |
|---------|---------------------|---------------------|
| Duration | 1-5 minutes | 15-90 minutes |
| Upload size | ≤10MB | ≤200MB+ |
| STT model | `medical_dictation` (single speaker) | `medical_conversation` (multi-speaker) |
| Speaker diarization | Not needed | Required (clinician vs. patient) |
| Upload strategy | Single POST with entire blob | Chunked/streaming upload |
| Processing model | Synchronous (wait for response) | Asynchronous (poll or webhook for result) |
| Cost per use | ~$0.07 | ~$0.50-1.50 |
| HIPAA exposure | Low (clinician summary) | High (raw patient speech) |

### Key Technical Challenges

**1. Large audio uploads**

A 45-minute session at reasonable WebM/Opus quality is ~20-40MB. Options:
- **Direct upload to GCS signed URL** — Backend generates a signed upload URL, extension uploads directly to Google Cloud Storage, backend triggers STT on the GCS object. Avoids streaming 40MB through the Express server.
- **Chunked upload through backend** — More control, but adds load to the API server.

Recommendation: Signed URL upload to GCS. The backend never touches the audio bytes for large files. This also means audio is encrypted at rest in GCS under Google's BAA.

**2. Asynchronous processing**

A 45-minute recording takes 30-120 seconds to transcribe. The extension can't hold an HTTP connection open that long. Options:
- **Polling** — Extension uploads audio, gets a `transcriptionId`, polls `GET /notes/transcribe/:id/status` every 5 seconds.
- **WebSocket/SSE** — Real-time status updates. More complex, but better UX.
- **Push notification via chrome.runtime** — Extension-specific, limited.

Recommendation: Polling. It's simple, works with the existing HTTP architecture, and the wait time (30-120s) is acceptable with a progress indicator.

**3. Speaker diarization**

Google's `medical_conversation` model natively labels clinician vs. patient speech. The transcript comes back with speaker tags. The prompt to Gemini would change to include speaker-labeled dialogue:

```
<clinician_notes>
[Clinician]: How are you feeling since our last session?
[Patient]: Much better. The exercises really helped with the morning stiffness.
[Clinician]: Great. Let me check your range of motion...
[Patient]: It still hurts a bit when I go past here.
[Clinician]: ROM improved to about 65 degrees flexion. Going to do some manual therapy on the lumbar paraspinals...
</clinician_notes>
```

The existing `buildSOAPPrompt()` in `pt-prompts.ts` handles this naturally — the system prompt already instructs the LLM to extract clinical information from the `<clinician_notes>` content regardless of format.

**4. Longer transcripts → more Gemini tokens**

A 15-minute session transcript is ~2,000-4,000 words (~3,000-6,000 tokens). A 45-minute eval could be 10,000+ tokens. Current `GEMINI_MAX_TOKENS` is 4,000 for output and the prompt input would grow significantly.

- May need to increase `GEMINI_MAX_TOKENS` or add a separate config for voice-sourced generations
- Consider a summarization step: transcript → condensed clinical summary → SOAP generation (two-pass approach, adds cost but keeps SOAP generation reliable)

**5. HIPAA: raw patient audio**

Phase 2 captures actual patient speech — this is PHI. Critical requirements:
- Audio must be encrypted in transit (TLS) and at rest (GCS default encryption)
- Audio in GCS must have a lifecycle policy — auto-delete after transcription completes (max 24 hours retention)
- Audio must never be accessible without authentication
- Signed upload URLs must have short expiry (15 minutes)
- Audit log must record: who recorded, when, duration, when audio was deleted
- Patient consent workflow may be needed (display consent notice before first recording)

### Implementation Outline

**PR 1 — Streaming upload infrastructure:**
- GCS bucket creation + lifecycle policy (auto-delete after 24 hours)
- Signed URL generation endpoint: `POST /notes/transcribe/upload-url`
- Extension: chunked upload to GCS via signed URL
- Backend: `POST /notes/transcribe/start` triggers async STT job on GCS object
- Returns `transcriptionId` for polling

**PR 2 — Async transcription + polling:**
- Backend: Google Cloud STT V2 `BatchRecognize` for long audio
- `GET /notes/transcribe/:id/status` polling endpoint
- Extension: polling UI with progress indicator
- Transcription result stored temporarily (in-memory or short-lived DB row) — transcript only, never audio
- Auto-cleanup of transcription results after 1 hour

**PR 3 — Speaker diarization + prompt adaptation:**
- Enable `medical_conversation` model with diarization config
- Format diarized transcript with `[Clinician]`/`[Patient]` labels
- Test SOAP quality with real diarized transcripts vs. current shorthand input
- Adjust system prompt if needed for conversation-style input

**PR 4 — Usage limits + billing:**
- Voice minutes cap per plan tier
- Dashboard: show voice minutes used/remaining
- Extension: warning when approaching limit
- Pricing page: updated plan comparison

**PR 5 — Patient consent + compliance:**
- First-time recording consent flow in extension
- Configurable consent notice text (for clinic admin customization in Wave 2+)
- Audit trail for consent acknowledgment
- GCS audio deletion verification (confirm lifecycle policy is working)

### Group / Multi-Patient Scenarios

**Sequential patients (typical):** No issue. Each recording is a separate session. PT stops recording after Patient A, generates note, starts new recording for Patient B.

**Concurrent patients (e.g., group therapy, overlapping appointments):**

Ambient recording does not solve this cleanly. If a PT is working with two patients in the same room:
- Audio captures both patients' speech — PHI cross-contamination
- Diarization can separate speakers but can't attribute medical content to the correct patient record
- No technical solution short of individual body-worn mics with separate recording channels (hardware problem, not software)

**How Twofold and others handle this:** They don't. Industry-wide, ambient AI scribes are designed for 1:1 encounters. Group therapy notes are typically dictated after the session.

**FlashNote approach:**
- Phase 1 (dictation) handles group scenarios naturally — PT dictates separate summaries per patient
- Phase 2 (ambient recording) shows a warning/blocker if user tries to start a second concurrent recording
- For group therapy: recommend dictation mode, not ambient recording
- Long-term: consider a "group session" note type where the PT records once but manually segments the transcript per patient (complex, post-Phase 2)

---

## Dependency on Existing Roadmap

This feature requires the GCP BAA to be signed (currently listed as a HIPAA Critical Path blocker in `ROADMAP.md`). The BAA covers both Vertex AI (Gemini) and Cloud Speech-to-Text, so signing it unblocks both the existing note generation and the new voice feature for production.

No other roadmap items are prerequisites. Phase 1 can be built in parallel with the UI Quality improvements and Wave 2-4 work.

---

## Decision Log

| Decision | Options Considered | Chosen | Rationale |
|----------|--------------------|--------|-----------|
| STT Provider | Google Cloud, Deepgram, AssemblyAI, AWS, OpenAI | Google Cloud | Platform alignment with existing GCP infrastructure. Single BAA covers STT + Gemini. Willing to absorb 3-5x cost premium over Deepgram. |
| Phase 1 model | `medical_dictation`, `medical_conversation`, general `latest_long` | `medical_dictation` | Purpose-built for single-speaker clinical dictation. Higher accuracy on medical terminology than general models. |
| Phase 2 model | `medical_conversation`, general + diarization | `medical_conversation` | Native clinician/patient role identification. Purpose-built for the exact use case. |
| Upload strategy (Phase 1) | Multipart through Express, signed URL to GCS | Multipart through Express | Files ≤10MB, simpler architecture. GCS signed URLs add unnecessary complexity for small files. |
| Upload strategy (Phase 2) | Multipart through Express, signed URL to GCS | Signed URL to GCS | Files up to 200MB+. Avoid streaming large audio through the API server. |
| Processing model (Phase 1) | Sync, async polling | Synchronous | 1-5 min audio transcribes in seconds. Sync response is fine. |
| Processing model (Phase 2) | Sync, async polling, WebSocket | Async polling | 15-90 min audio takes 30-120s to transcribe. Polling is simplest with existing HTTP architecture. |
| Self-hosted STT | Whisper, faster-whisper, MedASR | Rejected | Not cost-effective below ~2,400 hours/month. Worse medical accuracy. Adds infrastructure burden. |
| Voice pricing | Include in base, premium add-on, usage cap, separate tier | Dictation in base plan; ambient TBD | Dictation cost (~$0.07/use) is margin-safe. Ambient pricing needs real usage data from Phase 1. |
