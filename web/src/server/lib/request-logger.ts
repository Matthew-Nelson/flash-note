import 'server-only';

import type { NextRequest } from 'next/server';

import { logger } from './logger';

/**
 * Create a request-scoped child logger with Cloud Trace correlation.
 *
 * On Cloud Run, the GCP load balancer injects `X-Cloud-Trace-Context` with
 * format: `TRACE_ID/SPAN_ID;o=TRACE_TRUE`. Including the trace and span IDs
 * in log entries causes Cloud Logging to nest app logs under the parent
 * request log entry, enabling per-request log correlation.
 *
 * Returns the base logger when either the trace header or GOOGLE_CLOUD_PROJECT
 * env var is missing (e.g., local development).
 */
export function createRequestLogger(request: NextRequest): typeof logger {
  const traceHeader = request.headers.get('x-cloud-trace-context');
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;

  if (!traceHeader || !projectId) return logger;

  const [traceId, spanAndOptions] = traceHeader.split('/');
  const spanId = spanAndOptions?.split(';')[0];

  return logger.child({
    'logging.googleapis.com/trace': `projects/${projectId}/traces/${traceId}`,
    ...(spanId ? { 'logging.googleapis.com/spanId': spanId } : {}),
  });
}
