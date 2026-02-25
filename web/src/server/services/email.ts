/* eslint-disable no-console -- Dev mode email logging (when Resend not configured) is intentional */
import 'server-only';

import { Resend } from 'resend';

import { config } from '@/server/db/config';

/**
 * Module-level Resend client singleton.
 * null when RESEND_API_KEY not configured (dev/test — emails logged to console).
 */
const resend = config.RESEND_API_KEY ? new Resend(config.RESEND_API_KEY) : null;

/**
 * Send email verification email to a new user.
 */
export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const verificationUrl = `${config.WEB_URL}/verify-email?token=${encodeURIComponent(token)}`;

  const subject = 'Verify your email to start saving hours on documentation';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1c1917; margin: 0; padding: 0; background-color: #fdfcfb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header with Logo -->
    <div style="text-align: center; margin-bottom: 32px;">
      <span style="font-size: 28px; font-weight: 700; background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">FlashNote</span>
    </div>

    <!-- Main Card -->
    <div style="background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(28, 25, 23, 0.08), 0 2px 4px -2px rgba(28, 25, 23, 0.06);">
      <h1 style="color: #1c1917; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">Welcome to FlashNote!</h1>

      <p style="margin: 0 0 24px 0; color: #57534e; font-size: 16px;">You're one click away from transforming how you write PT documentation. Verify your email to start generating complete SOAP notes in seconds.</p>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Verify Email Address</a>
      </div>

      <p style="margin: 24px 0 0 0; font-size: 14px; color: #78716c;">This link expires in 24 hours for security.</p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px; padding-top: 24px;">
      <p style="font-size: 13px; color: #a8a29e; margin: 0 0 8px 0;">Didn't create a FlashNote account? You can safely ignore this email.</p>
      <p style="font-size: 12px; color: #a8a29e; margin: 16px 0 0 0;">If the button doesn't work, copy this link:</p>
      <p style="font-size: 12px; color: #a8a29e; word-break: break-all; margin: 4px 0 0 0;">${verificationUrl}</p>
    </div>

    <!-- Company Footer -->
    <div style="text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid #e7e5e4;">
      <p style="font-size: 12px; color: #a8a29e; margin: 0;">FlashNote - AI-powered documentation for physical therapists</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Welcome to FlashNote!

You're one click away from transforming how you write PT documentation.

Verify your email to start generating complete SOAP notes in seconds:
${verificationUrl}

This link expires in 24 hours for security.

---

Didn't create a FlashNote account? You can safely ignore this email.

FlashNote - AI-powered documentation for physical therapists
  `.trim();

  await sendEmail(email, subject, html, text);
}

/**
 * Send password reset email.
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${config.WEB_URL}/reset-password?token=${encodeURIComponent(token)}`;

  const subject = 'Reset your FlashNote password';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1c1917; margin: 0; padding: 0; background-color: #fdfcfb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header with Logo -->
    <div style="text-align: center; margin-bottom: 32px;">
      <span style="font-size: 28px; font-weight: 700; background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">FlashNote</span>
    </div>

    <!-- Main Card -->
    <div style="background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(28, 25, 23, 0.08), 0 2px 4px -2px rgba(28, 25, 23, 0.06);">
      <h1 style="color: #1c1917; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">Reset Your Password</h1>

      <p style="margin: 0 0 24px 0; color: #57534e; font-size: 16px;">We received a request to reset your FlashNote password. Click the button below to create a new password and get back to your documentation.</p>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Reset Password</a>
      </div>

      <!-- Security Warning -->
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 24px 0;">
        <p style="margin: 0; font-size: 14px; color: #92400e; font-weight: 500;">This link expires in 15 minutes for your security.</p>
      </div>

      <p style="margin: 16px 0 0 0; font-size: 14px; color: #78716c;">If you didn't request this reset, no action is needed. Your password will remain unchanged.</p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px; padding-top: 24px;">
      <p style="font-size: 12px; color: #a8a29e; margin: 0;">If the button doesn't work, copy this link:</p>
      <p style="font-size: 12px; color: #a8a29e; word-break: break-all; margin: 4px 0 0 0;">${resetUrl}</p>
    </div>

    <!-- Company Footer -->
    <div style="text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid #e7e5e4;">
      <p style="font-size: 12px; color: #a8a29e; margin: 0;">FlashNote - AI-powered documentation for physical therapists</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Reset Your Password

We received a request to reset your FlashNote password.

Click this link to create a new password:
${resetUrl}

IMPORTANT: This link expires in 15 minutes for your security.

If you didn't request this reset, no action is needed. Your password will remain unchanged.

---

FlashNote - AI-powered documentation for physical therapists
  `.trim();

  await sendEmail(email, subject, html, text);
}

/**
 * Internal: send email via Resend, or log to console in dev mode.
 */
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<void> {
  if (!resend) {
    console.log('='.repeat(60));
    console.log('EMAIL SERVICE: Resend not configured, logging email:');
    console.log('To: [redacted]');
    console.log(`Subject: ${subject}`);
    console.log('-'.repeat(60));
    console.log(text);
    console.log('='.repeat(60));
    return;
  }

  const from = `${config.EMAIL_FROM_NAME} <${config.EMAIL_FROM_ADDRESS}>`;

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    const emailError = new Error(`Failed to send email: ${error.message}`, { cause: error });
    // TODO: Replace with Pino structured logger when available:
    //   logger.error({ err: emailError, source: 'email_service', errorType: 'send_failed' },
    //     'Email send failed');
    console.error('Email send error:', error);
    throw emailError;
  }
}
