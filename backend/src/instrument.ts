/**
 * Sentry Instrumentation
 *
 * IMPORTANT: This file must be imported AFTER env-loader.js but BEFORE other
 * application modules. The env-loader ensures environment variables are available.
 *
 * HIPAA COMPLIANCE:
 * - beforeSend filters out potential PHI from error payloads
 * - Request bodies are NOT captured (may contain patient data)
 * - Sensitive headers are excluded
 */

import * as Sentry from '@sentry/node';
import {
  sanitizeObject,
  filterSafeHeaders,
  sanitizeUrl,
} from './utils/sentry-sanitization.js';

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
          event.request.headers = filterSafeHeaders(event.request.headers);
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
        const urlValue: unknown = breadcrumb.data.url;
        if (typeof urlValue === 'string') {
          breadcrumb.data.url = sanitizeUrl(urlValue);
        }
        delete breadcrumb.data.body;
      }

      return breadcrumb;
    },
  });

  // eslint-disable-next-line no-console
  console.log('Sentry initialized successfully');
} else if (process.env.NODE_ENV === 'production') {
  console.warn(
    'WARNING: SENTRY_DSN not configured. Error monitoring is disabled.'
  );
}

export { Sentry };
