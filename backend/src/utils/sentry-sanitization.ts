/**
 * Sentry PHI Sanitization Utilities
 *
 * HIPAA COMPLIANCE:
 * These functions sanitize data before it's sent to Sentry to prevent
 * Protected Health Information (PHI) from being transmitted to external services.
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
 *
 * @param key - The field name to check
 * @returns true if the field name matches any PHI pattern
 */
export function isPHIField(key: string): boolean {
  return PHI_FIELD_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Recursively sanitize an object by redacting PHI fields.
 * Fields with names matching PHI patterns are replaced with '[REDACTED - PHI]'.
 *
 * @param obj - The object to sanitize
 * @returns A new object with PHI fields redacted
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
 * List of HTTP headers that are safe to send to Sentry.
 * All other headers are stripped to prevent PHI leakage.
 */
export const SAFE_HEADERS: string[] = [
  'content-type',
  'content-length',
  'user-agent',
  'accept',
  'accept-encoding',
  'host',
];

/**
 * Filter headers to only include safe ones.
 *
 * @param headers - Original headers object
 * @returns Object containing only safe headers
 */
export function filterSafeHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const safeHeaders: Record<string, string> = {};

  for (const header of SAFE_HEADERS) {
    if (headers[header]) {
      safeHeaders[header] = headers[header];
    }
  }

  return safeHeaders;
}

/**
 * Sanitize a URL by removing query parameters that might contain PHI.
 *
 * @param urlString - The URL to sanitize
 * @returns The URL without query parameters, or '[REDACTED]' if parsing fails
 */
export function sanitizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    url.search = '';
    return url.toString();
  } catch {
    // If URL parsing fails, redact entirely
    return '[REDACTED]';
  }
}
