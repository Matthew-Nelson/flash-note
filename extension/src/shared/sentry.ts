/**
 * Sentry Client for Chrome Extension
 *
 * IMPORTANT: Browser extensions must NOT use Sentry.init() as it pollutes global state.
 * Instead, we create a manual BrowserClient + Scope per Sentry's recommended pattern
 * for shared environments / browser extensions.
 *
 * HIPAA COMPLIANCE:
 * - beforeSend filters out potential PHI from error payloads
 * - Request bodies are NOT captured (may contain patient data)
 * - Console breadcrumbs are excluded (may contain PHI in logs)
 * - URL query parameters are stripped from breadcrumbs
 *
 * @see https://docs.sentry.io/platforms/javascript/best-practices/shared-environments/
 */

import {
  BrowserClient,
  defaultStackParser,
  getDefaultIntegrations,
  makeFetchTransport,
  Scope,
} from '@sentry/browser';
import type { ErrorEvent, Breadcrumb } from '@sentry/browser';
import { sanitizeObject, sanitizeUrl } from './sentry-sanitization';

let sentryScope: Scope | null = null;

/**
 * Sanitize a Sentry event to remove potential PHI before sending.
 */
function sanitizeEvent(event: ErrorEvent): ErrorEvent | null {
  // Sanitize any extra data that might contain PHI
  if (event.extra) {
    event.extra = sanitizeObject(event.extra as Record<string, unknown>);
  }

  // Sanitize breadcrumb data
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map((breadcrumb): Breadcrumb | null => {
        // Don't send console breadcrumbs (may contain PHI in logs)
        if (breadcrumb.category === 'console') {
          return null;
        }

        // Sanitize HTTP breadcrumb data
        if (breadcrumb.category === 'http' && breadcrumb.data) {
          const urlValue: unknown = breadcrumb.data.url;
          if (typeof urlValue === 'string') {
            breadcrumb.data.url = sanitizeUrl(urlValue);
          }
          delete breadcrumb.data.body;
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

/**
 * Initialize the Sentry client for the extension.
 * Must be called once at app startup (sidepanel or service worker).
 *
 * Uses BrowserClient instead of Sentry.init() to avoid global state pollution,
 * which is required for browser extensions per Sentry documentation.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    if (import.meta.env.MODE === 'production') {
      console.warn(
        'WARNING: VITE_SENTRY_DSN not configured. Error monitoring is disabled.'
      );
    }
    return;
  }

  // Filter out integrations that use global state (required for browser extensions)
  const integrations = getDefaultIntegrations({}).filter(
    (defaultIntegration) =>
      !['BrowserApiErrors', 'Breadcrumbs', 'GlobalHandlers'].includes(
        defaultIntegration.name
      )
  );

  const environment = import.meta.env.MODE || 'development';

  const client = new BrowserClient({
    dsn,
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
    integrations,
    environment,
    release: chrome.runtime.getManifest().version,

    // HIPAA: Do NOT send PII by default
    sendDefaultPii: false,

    // HIPAA: Filter out potential PHI before sending
    beforeSend(event) {
      return sanitizeEvent(event);
    },
  });

  sentryScope = new Scope();
  sentryScope.setClient(client);
  client.init();

  // Tag events with extension context
  sentryScope.setTag('runtime', 'extension');

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('Sentry initialized for extension');
  }
}

/**
 * Capture an exception and send it to Sentry.
 * Clones the scope per capture to prevent extras from leaking between events.
 * Safe to call even if Sentry is not initialized (no-ops gracefully).
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!sentryScope) return;

  const scope = sentryScope.clone();
  if (context) {
    scope.setExtras(sanitizeObject(context));
  }
  scope.captureException(error);
}

/**
 * Capture a message and send it to Sentry.
 * Clones the scope per capture to prevent extras from leaking between events.
 * Safe to call even if Sentry is not initialized (no-ops gracefully).
 */
export function captureMessage(
  message: string,
  context?: Record<string, unknown>
): void {
  if (!sentryScope) return;

  const scope = sentryScope.clone();
  if (context) {
    scope.setExtras(sanitizeObject(context));
  }
  scope.captureMessage(message);
}

/**
 * Set the current user context for Sentry.
 * Only sends non-PHI user identifiers.
 */
export function setUser(userId: string | null): void {
  if (!sentryScope) return;

  if (userId) {
    sentryScope.setUser({ id: userId });
  } else {
    sentryScope.setUser(null);
  }
}
