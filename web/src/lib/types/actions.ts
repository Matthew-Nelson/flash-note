/**
 * Discriminated union for Server Action results.
 *
 * Used by all Server Actions to return either:
 * - { success: true, data?: T }  — operation succeeded
 * - { success: false, error: string, fieldErrors?: ... } — expected error (validation, auth, etc.)
 *
 * Unexpected errors throw and are caught by error.tsx boundaries.
 */
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };
