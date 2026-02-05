/**
 * Sentry Server Configuration (Node.js)
 *
 * This file configures Sentry for the server-side (Node.js) runtime.
 * It runs in API routes, Server Components, and SSR.
 *
 * HIPAA COMPLIANCE:
 * - sendDefaultPii is disabled
 * - beforeSend filters potential PHI from error payloads
 * - Request bodies are NOT captured (may contain patient data)
 */

import * as Sentry from '@sentry/nextjs';
import { sanitizeObject } from '@/lib/sentry-sanitization';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // HIPAA: Do NOT send PII by default
  sendDefaultPii: false,

  environment: process.env.NODE_ENV || 'development',

  // HIPAA: Filter potential PHI before sending
  beforeSend(event) {
    if (event.extra) {
      event.extra = sanitizeObject(event.extra as Record<string, unknown>);
    }

    // Remove request body entirely (may contain patient data)
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.query_string;
    }

    return event;
  },
});
