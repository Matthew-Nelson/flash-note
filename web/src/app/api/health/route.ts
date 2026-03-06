import { checkDbHealth } from '@/server/dal/health';

/**
 * Health check endpoint used by Cloud Run liveness and startup probes.
 *
 * Always returns 200 so liveness probes don't restart containers during
 * transient DB outages. DB connectivity status is reported in the response
 * body for observability.
 */
export async function GET() {
  const dbHealthy = await checkDbHealth();

  return Response.json({
    status: dbHealthy ? 'ok' : 'degraded',
    db: dbHealthy ? 'connected' : 'unreachable',
  });
}
