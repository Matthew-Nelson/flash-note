/**
 * Sentry Edge Configuration (Edge Runtime)
 *
 * This file configures Sentry for the Edge runtime.
 * It runs in middleware and edge API routes.
 *
 * HIPAA COMPLIANCE:
 * - sendDefaultPii is disabled
 * - beforeSend filters potential PHI from error payloads
 * - Request bodies are NOT captured
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

    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.query_string;
    }

    return event;
  },
});
