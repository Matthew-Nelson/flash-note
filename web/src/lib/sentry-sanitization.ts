/**
 * Sentry PHI Sanitization Utilities
 *
 * HIPAA COMPLIANCE:
 * These functions sanitize data before it's sent to Sentry to prevent
 * Protected Health Information (PHI) from being transmitted to external services.
 *
 * NOTE: This mirrors the sanitization logic in:
 * - backend/src/utils/sentry-sanitization.ts
 * - extension/src/shared/sentry-sanitization.ts
 * If you update patterns here, update the other versions too.
 */

/**
 * PHI-sensitive field patterns that should never be sent to Sentry.
 * These patterns match common field names that might contain patient data.
 */
export const PHI_FIELD_PATTERNS: RegExp[] = [
  /patient/i,
  /diagnosis/i,
  /treatment/i,
  /medical/i,
  /health/i,
  /dob|date.?of.?birth/i,
  /ssn|social.?security/i,
  /mrn|medical.?record/i,
  /note/i,
  /soap/i,
  /assessment/i,
  /subjective/i,
  /objective/i,
  /plan/i,
  /shorthand/i,
  /input/i,
  /content/i,
  /body/i,
  /message/i,
];

/**
 * Check if a key name potentially contains PHI based on field name patterns.
 */
export function isPHIField(key: string): boolean {
  return PHI_FIELD_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Recursively sanitize an object by redacting PHI fields.
 * Fields with names matching PHI patterns are replaced with '[REDACTED - PHI]'.
 */
export function sanitizeObject(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isPHIField(key)) {
      sanitized[key] = '[REDACTED - PHI]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item): unknown =>
        item && typeof item === 'object'
          ? sanitizeObject(item as Record<string, unknown>)
          : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize a URL by removing query parameters that might contain PHI.
 */
export function sanitizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    url.search = '';
    return url.toString();
  } catch {
    return '[REDACTED]';
  }
}
