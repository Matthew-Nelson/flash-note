import { NextRequest, NextResponse } from 'next/server';
import { getBillingService, WebhookSignatureError } from '@/server/services/billing';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // CRITICAL: Must read body as ArrayBuffer to preserve exact bytes
  // for Stripe signature verification. Stripe signs the raw bytes.
  const bodyBuffer = await request.arrayBuffer();
  const body = Buffer.from(bodyBuffer);
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  try {
    await getBillingService().handleWebhook(body, signature);
    return NextResponse.json({ received: true });
  } catch (error) {
    // Signature verification failure -> 400 (tells Stripe not to retry invalid signatures)
    if (error instanceof WebhookSignatureError) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handler failure -> 500 (tells Stripe to retry — idempotency record deleted in service).
    // Error is already logged with structured context in billingService.handleWebhook().
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
