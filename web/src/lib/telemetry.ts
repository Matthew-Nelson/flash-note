/**
 * Client-side error telemetry.
 *
 * Captures unhandled errors (window.onerror, unhandledrejection) and React
 * error boundary reports, then sends them to /api/telemetry for server-side
 * logging through Pino.
 *
 * This module is client-safe (no 'server-only' import). It is initialized
 * in instrumentation-client.ts which runs before React hydration.
 *
 * Design: Fire-and-forget via sendBeacon (survives page unloads).
 * Falls back to fetch with keepalive. Never throws -- telemetry failures
 * must not impact the user experience.
 */

const TELEMETRY_URL = '/api/telemetry';

/**
 * Send a telemetry payload to the server. Fire-and-forget.
 *
 * Uses navigator.sendBeacon for reliability during page unloads.
 * Falls back to fetch with keepalive when sendBeacon is unavailable.
 * Swallows all errors -- telemetry must never throw.
 */
export function sendTelemetry(payload: Record<string, unknown>): void {
  try {
    const body = JSON.stringify(payload);

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(TELEMETRY_URL, blob);
      return;
    }

    // Fallback: fetch with keepalive (survives page navigation)
    if (typeof fetch === 'function') {
      fetch(TELEMETRY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {
        // Intentionally swallowed -- telemetry must never throw
      });
    }
  } catch {
    // Intentionally swallowed -- telemetry must never throw
  }
}

/**
 * Initialize client-side error listeners.
 *
 * Registers handlers for:
 * - window 'error' events (uncaught exceptions)
 * - window 'unhandledrejection' events (unhandled promise rejections)
 *
 * Call once from instrumentation-client.ts.
 * Guard: no-ops on the server (typeof window === 'undefined').
 */
export function initClientTelemetry(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event: ErrorEvent) => {
    sendTelemetry({
      type: 'unhandled_error',
      message: event.message || 'Unknown error',
      stack: event.error?.stack,
      url: window.location.href,
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message =
      reason instanceof Error ? reason.message : String(reason ?? 'Unknown rejection');
    const stack = reason instanceof Error ? reason.stack : undefined;

    sendTelemetry({
      type: 'unhandled_rejection',
      message,
      stack,
      url: window.location.href,
    });
  });
}

/**
 * Report an error from a React error boundary.
 *
 * Called from error.tsx, global-error.tsx, dashboard/error.tsx, and
 * ErrorBoundary.tsx componentDidCatch.
 *
 * @param error - The caught error
 * @param digest - Next.js error digest (optional, from error.digest)
 */
export function reportErrorBoundary(error: Error, digest?: string): void {
  sendTelemetry({
    type: 'error_boundary',
    message: error.message || 'Unknown error boundary error',
    stack: error.stack,
    digest,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  });
}
