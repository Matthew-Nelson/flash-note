import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

// Stripe webhook handler
// This endpoint receives events from Stripe when subscription events occur

export async function POST(request: NextRequest) {
  try {
    // CRITICAL: Read body as ArrayBuffer to preserve exact bytes for signature verification
    // Using request.text() could modify encoding and break signature validation
    const bodyBuffer = await request.arrayBuffer();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Forward the webhook to the backend API
    // SECURITY: Forward raw bytes without modifying Content-Type to preserve signature integrity
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';

    const response = await fetch(`${backendUrl}/billing/webhook`, {
      method: 'POST',
      headers: {
        // Forward the original content-type from Stripe for proper signature verification
        'Content-Type': request.headers.get('content-type') || 'application/json',
        'Stripe-Signature': signature,
      },
      body: bodyBuffer,
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      // Capture to Sentry - critical payment infrastructure failure
      Sentry.captureException(new Error('Backend webhook error'), {
        extra: {
          source: 'stripe_webhook_proxy',
          statusCode: response.status,
          errorBody,
        },
      });
      console.error('Backend webhook error:', errorBody);
      return NextResponse.json(
        { error: 'Webhook processing failed' },
        { status: response.status }
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // Capture to Sentry - critical payment infrastructure failure
    Sentry.captureException(error, {
      extra: {
        source: 'stripe_webhook_proxy',
      },
    });
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
