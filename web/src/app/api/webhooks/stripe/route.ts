import { NextRequest, NextResponse } from 'next/server';

// Stripe webhook handler
// This endpoint receives events from Stripe when subscription events occur

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Forward the webhook to the backend API
    // SECURITY: Forward raw body without modifying Content-Type to preserve signature integrity
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';

    const response = await fetch(`${backendUrl}/billing/webhook`, {
      method: 'POST',
      headers: {
        // Forward the original content-type from Stripe for proper signature verification
        'Content-Type': request.headers.get('content-type') || 'application/json',
        'Stripe-Signature': signature,
      },
      body,
    });

    if (!response.ok) {
      const errorBody: unknown = await response.json();
      console.error('Backend webhook error:', errorBody);
      return NextResponse.json(
        { error: 'Webhook processing failed' },
        { status: response.status }
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
