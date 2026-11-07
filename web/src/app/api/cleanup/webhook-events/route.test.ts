import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// --- vi.hoisted mocks ---

const mockCleanupOldWebhookEvents = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
}));
const mockConfig = vi.hoisted((): { CLEANUP_SECRET: string | undefined } => ({
  CLEANUP_SECRET: 'a-32-character-minimum-secret-key',
}));

vi.mock('@/server/dal/webhooks', () => ({
  cleanupOldWebhookEvents: mockCleanupOldWebhookEvents,
}));

vi.mock('@/server/db/config', () => ({
  config: mockConfig,
}));

vi.mock('@/server/lib/logger', () => ({ logger: mockLogger }));

// Import after mocking
const { POST } = await import('./route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_SECRET = 'a-32-character-minimum-secret-key';

function makeRequest(options: {
  authorization?: string | null;
} = {}): NextRequest {
  const headers: Record<string, string> = {};

  if (Object.hasOwn(options, 'authorization')) {
    if (options.authorization !== null) {
      headers['authorization'] = options.authorization as string;
    }
    // null = omit the header
  } else {
    headers['authorization'] = `Bearer ${VALID_SECRET}`;
  }

  return new NextRequest('http://localhost/api/cleanup/webhook-events', {
    method: 'POST',
    headers,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/cleanup/webhook-events', () => {
  beforeEach(() => {
    mockConfig.CLEANUP_SECRET = 'a-32-character-minimum-secret-key';
  });

  it('returns 401 when authorization header is missing', async () => {
    const request = makeRequest({ authorization: null });

    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('Unauthorized');
    expect(mockCleanupOldWebhookEvents).not.toHaveBeenCalled();
  });

  it('returns 401 when wrong secret is provided', async () => {
    const request = makeRequest({ authorization: 'Bearer wrong-secret' });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mockCleanupOldWebhookEvents).not.toHaveBeenCalled();
  });

  it('returns 401 when no Bearer prefix', async () => {
    const request = makeRequest({ authorization: VALID_SECRET });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mockCleanupOldWebhookEvents).not.toHaveBeenCalled();
  });

  it('returns 401 for a same-length wrong secret, not only a length mismatch', async () => {
    const sameLengthWrong = `Bearer ${'b'.repeat(VALID_SECRET.length)}`;
    const request = makeRequest({ authorization: sameLengthWrong });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mockCleanupOldWebhookEvents).not.toHaveBeenCalled();
  });

  it('fails closed with 401 when CLEANUP_SECRET is unset', async () => {
    // Without the !expectedSecret guard, the template `Bearer ${undefined}` would
    // accept this header, so it is the case that proves the guard exists.
    mockConfig.CLEANUP_SECRET = undefined;
    const request = makeRequest({ authorization: 'Bearer undefined' });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mockCleanupOldWebhookEvents).not.toHaveBeenCalled();
  });

  it('returns 200 with deleted count on success', async () => {
    mockCleanupOldWebhookEvents.mockResolvedValue(42);

    const request = makeRequest();
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json() as { deleted: number };
    expect(body).toEqual({ deleted: 42 });
  });

  it('calls cleanupOldWebhookEvents with 7 days retention', async () => {
    mockCleanupOldWebhookEvents.mockResolvedValue(0);

    const request = makeRequest();
    await POST(request);

    expect(mockCleanupOldWebhookEvents).toHaveBeenCalledWith(7);
  });

  it('returns 500 and logs at error level when cleanupOldWebhookEvents throws', async () => {
    mockCleanupOldWebhookEvents.mockRejectedValue(new Error('DB error'));

    const request = makeRequest();
    const response = await POST(request);

    expect(response.status).toBe(500);
    const body = await response.json() as { error: string };
    expect(body).toEqual({ error: 'Cleanup failed' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'cleanup_webhook_events', errorType: 'cleanup_failed' }),
      'Webhook event cleanup failed'
    );
  });
});
