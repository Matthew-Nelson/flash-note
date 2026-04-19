/**
 * Curated client-facing strings for note Server Action error codes.
 *
 * CLAUDE.md Rule 2: never display server `err.message`. Always map by code.
 * Unknown codes fall back to the generic `internal_error` copy so the UI
 * never leaks server internals.
 *
 * Plan 04-03 adds: conflict, note_not_found, template_unavailable,
 * invalid_section_id, hallucination_detected, style_prefs_save_failed,
 * patient_not_found, archive_failed (note-variant), ai_content_blocked.
 *
 * Keep this table in sync with 04-UI-SPEC.md §Error states when adding new
 * codes — the executor/verifier compares these strings against the UI-SPEC
 * copy matrix.
 */
export const NOTE_ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: 'Please sign in to continue.',
  session_expired: 'Your session has expired. Please sign in again.',
  email_not_verified: 'Please verify your email before generating notes.',
  validation_error: 'Please check the highlighted fields and try again.',
  subscription_required: 'An active subscription is required to generate notes.',
  trial_expired: 'Your free trial has ended. Please subscribe to continue.',
  clinic_subscription_expired:
    "Your clinic's subscription has expired. Please contact your administrator.",
  rate_limit_exceeded: 'Too many requests. Please wait a moment and try again.',

  // Plan 04-03 additions
  note_not_found:
    "This note no longer exists or you don't have access to it.",
  patient_not_found:
    "This patient no longer exists or you don't have access to it.",
  template_unavailable:
    "The selected template isn't available. Please try again.",
  conflict:
    'This note was modified elsewhere. Refresh to see the latest version.',
  invalid_section_id:
    "We couldn't apply that edit. Please refresh and try again.",
  hallucination_detected:
    'We flagged possible inaccuracies in the generated note. Please review carefully before saving.',
  archive_failed: "We couldn't archive this note. Please try again.",
  style_prefs_save_failed:
    "We couldn't save your style preferences. Please try again.",

  // LLM-related errors
  ai_rate_limited:
    'The AI service is temporarily busy. Please try again in a moment.',
  ai_content_blocked:
    'Unable to process this content. Please revise your notes and try again.',
  ai_timeout: 'Note generation timed out. Please try again.',
  ai_unavailable:
    'The AI service is temporarily unavailable. Please try again later.',
  ai_error: 'Something went wrong generating your note. Please try again.',

  internal_error: 'Something went wrong. Please try again.',
};

export const NOTE_ERROR_FALLBACK = 'Something went wrong. Please try again.';

/** Map an error code to a curated client string; fall back for unknown codes. */
export function mapNoteError(code: string | undefined | null): string {
  if (!code) return NOTE_ERROR_FALLBACK;
  return NOTE_ERROR_MESSAGES[code] ?? NOTE_ERROR_FALLBACK;
}
