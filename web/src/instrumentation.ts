import { type Instrumentation } from 'next';

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  // Dynamic import to avoid loading Pino during build
  const { logger } = await import('@/server/lib/logger');

  const message = err instanceof Error ? err.message : String(err);

  logger.error(
    {
      err,
      source: 'next_server',
      errorType: context.routeType,
      routePath: context.routePath,
      method: request.method,
      url: request.path,
    },
    `[${context.routeType}] ${message}`
  );
};
