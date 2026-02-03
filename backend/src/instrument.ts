/**
 * Sentry Instrumentation
 *
 * IMPORTANT: This file must be imported BEFORE any other modules.
 * It initializes Sentry error monitoring and performance tracing.
 *
 * HIPAA COMPLIANCE:
 * - beforeSend filters out potential PHI from error payloads
 * - Request bodies are NOT captured (may contain patient data)
 * - Sensitive headers are excluded
 */

// Load environment variables FIRST (before Sentry init)
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import * as Sentry from '@sentry/node';

// PHI-sensitive field patterns that should never be sent to Sentry
const PHI_FIELD_PATTERNS = [
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
 * Check if a key name potentially contains PHI
 */
function isPHIField(key: string): boolean {
  return PHI_FIELD_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Recursively sanitize an object by removing PHI fields
 */
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isPHIField(key)) {
      sanitized[key] = '[REDACTED - PHI]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
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

// Only initialize if DSN is provided
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version,

    // Performance monitoring - adjust in production based on traffic
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // HIPAA: Do NOT send PII by default
    sendDefaultPii: false,

    // HIPAA: Filter out potential PHI before sending to Sentry
    beforeSend(event) {
      // Sanitize any extra data that might contain PHI
      if (event.extra) {
        event.extra = sanitizeObject(event.extra as Record<string, unknown>);
      }

      // Sanitize breadcrumb data
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
          if (breadcrumb.data) {
            breadcrumb.data = sanitizeObject(
              breadcrumb.data as Record<string, unknown>
            );
          }
          return breadcrumb;
        });
      }

      // Remove request body entirely (may contain patient notes)
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;

        // Keep only safe headers
        if (event.request.headers) {
          const safeHeaders: Record<string, string> = {};
          const allowedHeaders = [
            'content-type',
            'content-length',
            'user-agent',
            'accept',
            'accept-encoding',
            'host',
          ];

          for (const header of allowedHeaders) {
            if (event.request.headers[header]) {
              safeHeaders[header] = event.request.headers[header];
            }
          }
          event.request.headers = safeHeaders;
        }
      }

      return event;
    },

    // HIPAA: Filter breadcrumbs to prevent PHI leakage
    beforeBreadcrumb(breadcrumb) {
      // Don't capture console breadcrumbs (may contain PHI in logs)
      if (breadcrumb.category === 'console') {
        return null;
      }

      // Sanitize HTTP breadcrumb data
      if (breadcrumb.category === 'http' && breadcrumb.data) {
        // Remove URL query params and body that might contain PHI
        if (breadcrumb.data.url) {
          try {
            const url = new URL(breadcrumb.data.url);
            url.search = '';
            breadcrumb.data.url = url.toString();
          } catch {
            // If URL parsing fails, redact entirely
            breadcrumb.data.url = '[REDACTED]';
          }
        }
        delete breadcrumb.data.body;
      }

      return breadcrumb;
    },
  });

  console.log('Sentry initialized successfully');
} else if (process.env.NODE_ENV === 'production') {
  console.warn(
    'WARNING: SENTRY_DSN not configured. Error monitoring is disabled.'
  );
}

export { Sentry };
