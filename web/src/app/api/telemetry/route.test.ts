import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// --- vi.hoisted mocks ---

const mockLoggerError = vi.hoisted(() => vi.fn());
const mockLoggerDebug = vi.hoisted(() => vi.fn());
const mockLoggerChild = vi.hoisted(() =>
  vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  }))
);
const mockCheckRateLimit = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true, limit: 20, remaining: 19, reset: 0 })
);

vi.mock('@/server/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
    debug: mockLoggerDebug,
    child: mockLoggerChild,
  },
}));

vi.mock('@/server/lib/request-logger', () => ({
  createRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  })),
}));

vi.mock('@/server/lib/rate-limit', () => ({
  telemetryRateLimit: null, // null in test (no Redis)
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock('@/server/db/config', () => ({
  config: { TRUSTED_PROXY_COUNT: 1 },
}));

// Import after mocking
const { POST } = await import('./route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown, options?: {
  contentType?: string;
  ip?: string;
}): NextRequest {
  const headers: Record<string, string> = {
    'content-type': options?.contentType ?? 'application/json',
    'x-forwarded-for': options?.ip ?? '192.168.1.1',
  };

  return new NextRequest('http://localhost/api/telemetry', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      limit: 20,
      remaining: 19,
      reset: 0,
    });
  });

  it('returns 200 { ok: true } for a valid payload and logs via Pino', async () => {
    const payload = {
      type: 'unhandled_error',
      message: 'Uncaught TypeError',
      stack: 'TypeError: x is not a function\n    at foo.js:10',
      url: 'http://localhost:3000/dashboard',
    };

    const response = await POST(makeRequest(payload));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });

    // Verify logger.error was called with structured fields
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    const [fields, message] = mockLoggerError.mock.calls[0] as [Record<string, unknown>, string];
    expect(fields.source).toBe('client');
    expect(fields.errorType).toBe('unhandled_error');
    expect(fields.stack_trace).toBe(payload.stack);
    expect(fields.url).toBe(payload.url);
    expect(message).toContain('[Client]');
    expect(message).toContain('Uncaught TypeError');
  });

  it('returns 200 { ok: true } silently for invalid payload (missing type)', async () => {
    const payload = {
      message: 'Some error without type',
    };

    const response = await POST(makeRequest(payload));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });

    // Logger should NOT be called for invalid payloads
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('returns 200 { ok: true } silently for completely invalid payload', async () => {
    const payload = 'not json at all';

    // Send as text/plain to trigger the text fallback path
    const req = new NextRequest('http://localhost/api/telemetry', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'x-forwarded-for': '192.168.1.1',
      },
      body: payload,
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('returns 200 { ok: true } without logging when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({
      success: false,
      limit: 20,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const payload = {
      type: 'unhandled_error',
      message: 'Should not be logged',
    };

    const response = await POST(makeRequest(payload));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('handles error_boundary type with digest and componentStack', async () => {
    const payload = {
      type: 'error_boundary',
      message: 'Component render failed',
      stack: 'Error: Component render failed\n    at MyComponent',
      digest: 'abc123',
      url: 'http://localhost:3000/dashboard',
      componentStack: '\n    at MyComponent\n    at Layout',
    };

    const response = await POST(makeRequest(payload));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
  });

  it('handles unhandled_rejection type', async () => {
    const payload = {
      type: 'unhandled_rejection',
      message: 'Promise rejected',
    };

    const response = await POST(makeRequest(payload));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
  });

  it('handles sendBeacon text/plain body parsing', async () => {
    const payload = {
      type: 'unhandled_error',
      message: 'From sendBeacon',
    };

    // sendBeacon with Blob of type application/json still sends as application/json,
    // but some browsers may send as text/plain. Test the text fallback.
    const req = new NextRequest('http://localhost/api/telemetry', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'x-forwarded-for': '10.0.0.1',
      },
      body: JSON.stringify(payload),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
  });

  it('truncates oversized message field via Zod max', async () => {
    const payload = {
      type: 'unhandled_error',
      message: 'x'.repeat(1001), // Exceeds max 1000
    };

    const response = await POST(makeRequest(payload));
    const data = await response.json();

    // Should return ok but silently reject due to validation
    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('rejects invalid type values', async () => {
    const payload = {
      type: 'xss_attack',
      message: 'Not a valid type',
    };

    const response = await POST(makeRequest(payload));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('logs debug when telemetry event is rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 20,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const payload = {
      type: 'unhandled_error',
      message: 'Should be rate limited',
    };

    await POST(makeRequest(payload));

    expect(mockLoggerDebug).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'telemetry', reason: 'rate_limited' }),
      'Telemetry event dropped'
    );
  });

  it('logs debug when telemetry payload fails validation', async () => {
    const payload = {
      type: 'xss_attack',
      message: 'Invalid type',
    };

    await POST(makeRequest(payload));

    expect(mockLoggerDebug).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'telemetry', reason: 'validation_failed' }),
      'Telemetry event dropped'
    );
  });
});
