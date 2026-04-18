/**
 * Curated client-facing strings for patient Server Action error codes.
 *
 * CLAUDE.md Rule 2: never display server `err.message`. Always map by code.
 * Unknown codes fall back to the generic `internal_error` copy so the UI
 * never leaks server internals.
 *
 * Keep this table in sync with 04-UI-SPEC.md §Error states when adding new
 * codes — the executor/verifier compares these strings against the UI-SPEC
 * copy matrix.
 */
export const PATIENT_ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: 'Please sign in to continue.',
  session_expired: 'Your session has expired. Please sign in again.',
  validation_error: 'Please check the highlighted fields and try again.',
  patient_not_found:
    "This patient no longer exists or you don't have access to it.",
  archive_failed: "We couldn't archive this patient. Please try again.",
  context_save_failed: "We couldn't save the patient context. Please try again.",
  rate_limit_exceeded: 'Too many requests. Please wait a moment and try again.',
  internal_error: 'Something went wrong. Please try again.',
};

export const PATIENT_ERROR_FALLBACK = 'Something went wrong. Please try again.';

/** Map an error code to a curated client string; fall back for unknown codes. */
export function mapPatientError(code: string | undefined | null): string {
  if (!code) return PATIENT_ERROR_FALLBACK;
  return PATIENT_ERROR_MESSAGES[code] ?? PATIENT_ERROR_FALLBACK;
}
