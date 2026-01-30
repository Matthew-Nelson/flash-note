import { Resend } from 'resend';
import { config } from '../config.js';

/**
 * EmailService handles sending transactional emails for email verification
 * and password reset flows using Resend.
 *
 * HIPAA COMPLIANCE:
 * - No PHI is included in email content
 * - Email addresses are the only personal data transmitted
 * - All emails use TLS encryption via Resend's infrastructure
 */
class EmailService {
  private resend: Resend | null = null;

  constructor() {
    // Only initialize Resend if API key is configured
    if (config.RESEND_API_KEY) {
      this.resend = new Resend(config.RESEND_API_KEY);
    }
  }

  /**
   * Send email verification email to new user
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${config.WEB_URL}/verify-email?token=${encodeURIComponent(token)}`;

    const subject = 'Verify your FlashNote email address';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #1a1a1a; margin-bottom: 24px; font-size: 24px;">Welcome to FlashNote</h1>

    <p style="margin-bottom: 16px;">Please verify your email address to complete your registration and start generating SOAP notes.</p>

    <a href="${verificationUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 16px 0;">Verify Email Address</a>

    <p style="margin-top: 24px; font-size: 14px; color: #666;">This link will expire in 24 hours.</p>

    <p style="font-size: 14px; color: #666;">If you didn't create a FlashNote account, you can safely ignore this email.</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="font-size: 12px; color: #999; margin: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="font-size: 12px; color: #999; word-break: break-all;">${verificationUrl}</p>
  </div>
</body>
</html>
    `.trim();

    const text = `
Welcome to FlashNote

Please verify your email address to complete your registration and start generating SOAP notes.

Click this link to verify your email: ${verificationUrl}

This link will expire in 24 hours.

If you didn't create a FlashNote account, you can safely ignore this email.
    `.trim();

    await this.sendEmail(email, subject, html, text);
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${config.WEB_URL}/reset-password?token=${encodeURIComponent(token)}`;

    const subject = 'Reset your FlashNote password';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #1a1a1a; margin-bottom: 24px; font-size: 24px;">Reset Your Password</h1>

    <p style="margin-bottom: 16px;">We received a request to reset your FlashNote password. Click the button below to create a new password.</p>

    <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 16px 0;">Reset Password</a>

    <p style="margin-top: 24px; font-size: 14px; color: #dc2626; font-weight: 500;">This link will expire in 15 minutes for security reasons.</p>

    <p style="font-size: 14px; color: #666;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="font-size: 12px; color: #999; margin: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="font-size: 12px; color: #999; word-break: break-all;">${resetUrl}</p>
  </div>
</body>
</html>
    `.trim();

    const text = `
Reset Your Password

We received a request to reset your FlashNote password.

Click this link to reset your password: ${resetUrl}

This link will expire in 15 minutes for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
    `.trim();

    await this.sendEmail(email, subject, html, text);
  }

  /**
   * Internal method to send email via Resend
   */
  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    text: string
  ): Promise<void> {
    if (!this.resend) {
      // Development mode without Resend configured
      console.log('='.repeat(60));
      console.log('EMAIL SERVICE: Resend not configured, logging email:');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log('-'.repeat(60));
      console.log(text);
      console.log('='.repeat(60));
      return;
    }

    const from = `${config.EMAIL_FROM_NAME} <${config.EMAIL_FROM_ADDRESS}>`;

    const { error } = await this.resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      console.error('Email send error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
}

export const emailService = new EmailService();
