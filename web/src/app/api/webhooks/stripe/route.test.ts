import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// --- vi.hoisted mocks ---

const mockHandleWebhook = vi.hoisted(() => vi.fn());

// Hoist WebhookSignatureError so it's the same class instance used in both
// the mock factory and test assertions — instanceof checks require same class ref.
const { WebhookSignatureError } = vi.hoisted(() => {
  class WebhookSignatureError extends Error {
    constructor() {
      super('Webhook signature verification failed');
      this.name = 'WebhookSignatureError';
    }
  }
  return { WebhookSignatureError };
});

vi.mock('@/server/services/billing', () => ({
  getBillingService: () => ({
    handleWebhook: mockHandleWebhook,
  }),
  WebhookSignatureError,
}));

// Import after mocking
const { POST } = await import('./route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_BODY = '{"type":"test.event"}';

function makeRequest(options: {
  signature?: string | null;
  body?: string;
} = {}): NextRequest {
  const body = options.body ?? DEFAULT_BODY;
  const hasSignature = !Object.hasOwn(options, 'signature') || options.signature !== null;
  const signature = hasSignature ? (options.signature ?? 'valid-stripe-signature') : undefined;

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (signature !== undefined) {
    headers['stripe-signature'] = signature;
  }

  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers,
    body,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns 400 when stripe-signature header is missing, without verifying', async () => {
    const request = makeRequest({ signature: null });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body).toEqual({ error: 'Missing stripe-signature header' });
    expect(mockHandleWebhook).not.toHaveBeenCalled();
  });

  it('returns 400 when billingService throws WebhookSignatureError (not 500)', async () => {
    // Rule 6: Signature verification must result in 400 — not 500 — so Stripe doesn't retry
    mockHandleWebhook.mockRejectedValue(new WebhookSignatureError());

    const request = makeRequest({ signature: 'bad-signature' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body).toEqual({ error: 'Invalid signature' });
    // Signature verification itself runs in billingService; the route must hand it the raw bytes and header
    expect(mockHandleWebhook).toHaveBeenCalledWith(Buffer.from(DEFAULT_BODY), 'bad-signature');
  });

  it('returns 200 with { received: true } on success and forwards raw bytes and signature', async () => {
    mockHandleWebhook.mockResolvedValue(undefined);

    const request = makeRequest();
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json() as { received: boolean };
    expect(body).toEqual({ received: true });
    expect(mockHandleWebhook).toHaveBeenCalledWith(Buffer.from(DEFAULT_BODY), 'valid-stripe-signature');
  });

  it('returns 500 when billingService throws non-signature error (Stripe retries)', async () => {
    mockHandleWebhook.mockRejectedValue(new Error('Database connection failed'));

    const request = makeRequest();
    const response = await POST(request);

    expect(response.status).toBe(500);
    // Exact match also proves the internal error message is not echoed to the caller
    const body = await response.json() as { error: string };
    expect(body).toEqual({ error: 'Webhook processing failed' });
  });
});
