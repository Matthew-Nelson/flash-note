/**
 * Client-Side Instrumentation
 *
 * Initializes client-side error telemetry. Runs before React hydration
 * to capture errors that occur during the hydration process itself.
 *
 * Replaces the previous Sentry browser SDK initialization.
 */
import { initClientTelemetry } from '@/lib/telemetry';

initClientTelemetry();
