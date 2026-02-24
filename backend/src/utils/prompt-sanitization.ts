/**
 * Prompt Sanitization Utilities (MEDIUM-005)
 *
 * This module provides defense-in-depth against prompt injection attacks:
 * 1. XML delimiter wrapping - isolates user content from system instructions
 * 2. Suspicious pattern detection - heuristics for monitoring (not blocking)
 *
 * SECURITY DESIGN:
 * - Detection is for monitoring only; we do NOT block requests
 * - False positives in clinical environment are unacceptable
 * - PT notation like "5/10", "3+/5", "<90°" must not trigger detection
 * - XML delimiters + LLM instructions provide the actual protection
 */

/**
 * Types of content that can be sanitized
 */
export type ContentType = 'clinician_notes' | 'patient_context';

/**
 * Tag names used as XML delimiters for prompt isolation.
 * Used by escapeDelimiterTags to strip boundary-breaking attempts.
 */
const DELIMITER_TAG_NAMES = ['clinician_notes', 'patient_context'] as const;

/**
 * Result of suspicious pattern detection
 */
export interface SuspiciousPatternResult {
  detected: boolean;
  count: number;
}

/**
 * PHI-safe metadata about content (for logging purposes)
 */
export interface ContentMetadata {
  length: number;
  lineCount: number;
}

/**
 * Suspicious patterns that may indicate prompt injection attempts.
 * These are heuristics only - we log but don't block.
 *
 * Patterns are designed to minimize false positives from legitimate PT documentation:
 * - "previous instructions" could appear in clinical context but "ignore previous instructions" is suspicious
 * - "act as" followed by role words is suspicious
 * - Direct commands to reveal system info are suspicious
 */
const SUSPICIOUS_PATTERNS: RegExp[] = [
  // Attempts to override system instructions
  /ignore\s+(all\s+)?(previous|prior|above|system)\s+(instructions|prompts?|rules?)/i,
  /disregard\s+(all\s+)?(previous|prior|above|system)\s+(instructions|prompts?|rules?)/i,
  /forget\s+(all\s+)?(previous|prior|above|system)\s+(instructions|prompts?|rules?)/i,
  /override\s+(all\s+)?(previous|prior|above|system)\s+(instructions|prompts?|rules?)/i,

  // Attempts to extract system prompt
  /reveal\s+(your\s+)?(system|hidden|secret)\s+(prompt|instructions?)/i,
  /show\s+(me\s+)?(your\s+)?(system|hidden|secret)\s+(prompt|instructions?)/i,
  /output\s+(your\s+)?(system|hidden|secret)\s+(prompt|instructions?)/i,
  /print\s+(your\s+)?(system|hidden|secret)\s+(prompt|instructions?)/i,

  // Role-playing attacks
  /act\s+as\s+(an?\s+)?(admin|administrator|developer|system|root|superuser)/i,
  /you\s+are\s+now\s+(an?\s+)?(admin|administrator|developer|system|different)/i,
  /pretend\s+(to\s+be|you('re|\s+are))\s+(an?\s+)?(admin|administrator|developer|system)/i,

  // Direct instruction injection markers
  /new\s+instructions?:/i,
  /system\s*:\s*\n/i,
  /\[system\]/i,
  /<<\s*system\s*>>/i,

  // Attempts to break out of context
  /end\s+of\s+(user\s+)?input/i,
  /---+\s*end\s*(of\s*)?(user|patient|input)/i,

  // Attempts to break XML delimiter boundaries (H-16)
  /<\s*\/?\s*clinician_notes[^>]*>/i,
  /<\s*\/?\s*patient_context[^>]*>/i,
];

/**
 * Strips XML delimiter tag strings from user content to prevent boundary breakout (H-16).
 *
 * This removes any opening or closing tags that match our delimiter tag names,
 * including tags with attributes (e.g., `<clinician_notes x="">`).
 * Medical notation like `<90°` is preserved since it doesn't match tag names.
 *
 * @param content - The raw user-provided content
 * @returns Content with delimiter tags stripped
 */
export function escapeDelimiterTags(content: string): string {
  let sanitized = content;
  for (const tagName of DELIMITER_TAG_NAMES) {
    // Strip opening/closing tags including any attributes (case-insensitive)
    // [^>]* catches attribute-based bypasses like <clinician_notes x="">
    sanitized = sanitized.replace(new RegExp(`<\\s*/?\\s*${tagName}[^>]*>`, 'gi'), '');
  }
  return sanitized;
}

/**
 * Wraps user-provided content in XML delimiters for prompt isolation.
 *
 * This is the primary defense against prompt injection. The XML tags
 * clearly mark boundaries between user content and system instructions,
 * and the LLM is instructed to treat content within these tags as
 * literal data only.
 *
 * Content is sanitized for delimiter tags before wrapping to prevent
 * boundary breakout attacks (H-16). Medical notation like "<90°" or
 * "3+/5" is preserved since it doesn't match delimiter tag names.
 *
 * @param content - The raw user-provided content
 * @param type - The type of content (determines tag name)
 * @returns Content wrapped in appropriate XML delimiters
 */
export function wrapWithDelimiters(content: string, type: ContentType): string {
  const sanitized = escapeDelimiterTags(content);
  return `<${type}>\n${sanitized}\n</${type}>`;
}

/**
 * Detects suspicious patterns that may indicate prompt injection attempts.
 *
 * IMPORTANT: This is for MONITORING ONLY. We do NOT block based on these results.
 * The detection is logged for security analysis but requests proceed normally.
 *
 * Rationale for not blocking:
 * 1. False positives would prevent legitimate clinical documentation
 * 2. PT staff need reliable note generation; blocking is unacceptable
 * 3. Even if injection succeeds, it only affects that user's own note
 * 4. XML delimiters + LLM instructions provide the actual protection
 *
 * @param content - The content to scan for suspicious patterns
 * @returns Detection result with count of matched patterns
 */
export function detectSuspiciousPatterns(content: string): SuspiciousPatternResult {
  let count = 0;

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      count++;
    }
  }

  return {
    detected: count > 0,
    count,
  };
}

/**
 * Extracts PHI-safe metadata about content for logging purposes.
 *
 * SECURITY: This function ONLY returns non-PHI metadata.
 * Never log the actual content - only these safe statistics.
 *
 * @param content - The content to analyze
 * @returns PHI-safe metadata suitable for audit logs
 */
export function getContentMetadata(content: string): ContentMetadata {
  return {
    length: content.length,
    lineCount: content.split('\n').length,
  };
}
