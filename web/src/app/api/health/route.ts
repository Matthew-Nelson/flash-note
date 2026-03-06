import { checkDbHealth } from '@/server/dal/health';

export async function GET() {
  const dbHealthy = await checkDbHealth();

  if (!dbHealthy) {
    return Response.json(
      { status: 'degraded', db: 'unreachable' },
      { status: 503 },
    );
  }

  return Response.json({ status: 'ok', db: 'connected' });
}
