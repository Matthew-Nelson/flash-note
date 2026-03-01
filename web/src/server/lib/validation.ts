import 'server-only';

/**
 * Sanitize Zod validation errors to prevent schema detail leaks (Rule L-3).
 *
 * Zod error messages expose validation logic details that can inform attack strategies.
 * This helper strips those details while preserving field-to-error mapping for UI display.
 *
 * Input: Zod flattened field errors with Zod-internal messages
 *   { quickNotes: ["Please provide more detail"], noteType: ["Invalid enum value"] }
 *
 * Output: Client-safe error format with field names and generic message
 *   { quickNotes: ["Validation failed"], noteType: ["Validation failed"] }
 *
 * Why allowlist approach (not generic field_N indices):
 * - Preserves field-to-input mapping so forms can display errors next to correct fields
 * - Strips Zod messages that reveal validation logic
 * - Allows Phase 1.5 D (Dashboard UI) to show per-field error styling
 */
export function sanitizeFieldErrors(
  fieldErrors: Record<string, string[]>,
  allowedFields: string[] = ['noteType', 'quickNotes', 'patientContext']
): Record<string, string[]> {
  const sanitized: Record<string, string[]> = {};

  for (const field of allowedFields) {
    if (field in fieldErrors && fieldErrors[field].length > 0) {
      sanitized[field] = ['Validation failed'];
    }
  }

  return sanitized;
}
