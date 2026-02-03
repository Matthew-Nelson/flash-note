/**
 * Sentry Client Configuration (Browser)
 *
 * This file configures Sentry for the client-side (browser) runtime.
 * It runs in the user's browser for all pages.
 *
 * HIPAA COMPLIANCE:
 * - sendDefaultPii is disabled (no automatic IP/cookie collection)
 * - beforeSend filters potential PHI from error payloads
 * - Console breadcrumbs are excluded (may contain PHI in logs)
 * - Request bodies are NOT captured (may contain patient data)
 * - URL query parameters are stripped from breadcrumbs
 * - Session Replay is NOT enabled (captures DOM which may contain PHI)
 */

import * as Sentry from '@sentry/nextjs';
import type { ErrorEvent, Breadcrumb } from '@sentry/nextjs';
import { sanitizeObject, sanitizeUrl } from '@/lib/sentry-sanitization';

/**
 * Sanitize a Sentry event to remove potential PHI before sending.
 */
function sanitizeEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.extra) {
    event.extra = sanitizeObject(event.extra as Record<string, unknown>);
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map((breadcrumb): Breadcrumb | null => {
        // Don't send console breadcrumbs (may contain PHI in logs)
        if (breadcrumb.category === 'console') {
          return null;
        }

        // Sanitize HTTP breadcrumb data
        if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
          if (breadcrumb.data) {
            const urlValue: unknown = breadcrumb.data.url;
            if (typeof urlValue === 'string') {
              breadcrumb.data.url = sanitizeUrl(urlValue);
            }
            delete breadcrumb.data.body;
          }
        }

        // Sanitize any other breadcrumb data
        if (breadcrumb.data) {
          breadcrumb.data = sanitizeObject(
            breadcrumb.data as Record<string, unknown>
          );
        }

        return breadcrumb;
      })
      .filter((b): b is Breadcrumb => b !== null);
  }

  // Remove request body entirely (may contain patient notes)
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
  }

  return event;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // HIPAA: Do NOT send PII by default
  sendDefaultPii: false,

  environment: process.env.NODE_ENV || 'development',

  // HIPAA: Filter potential PHI before sending
  beforeSend(event) {
    return sanitizeEvent(event);
  },

  // No Session Replay - it captures DOM content which may contain PHI
  // No tracing - not needed for error monitoring MVP
});
