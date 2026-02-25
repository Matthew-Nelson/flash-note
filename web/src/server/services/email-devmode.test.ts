import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config WITHOUT RESEND_API_KEY (dev mode — emails logged to console)
vi.mock('@/server/db/config', () => ({
  config: {
    RESEND_API_KEY: '',
    WEB_URL: 'http://localhost:3000',
    EMAIL_FROM_NAME: 'FlashNote',
    EMAIL_FROM_ADDRESS: 'noreply@flashnote.test',
  },
  isDevelopment: true,
  isTest: false,
}));

// Resend module still needs to be available (imported but not instantiated)
vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: vi.fn() };
  },
}));

import { sendVerificationEmail, sendPasswordResetEmail } from './email';

describe('email service (dev mode — no Resend API key)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('logs verification email to console instead of sending', async () => {
    await sendVerificationEmail('user@example.com', 'dev-token');

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('EMAIL SERVICE: Resend not configured')
    );
    // H-4: email address must be redacted in dev mode too
    expect(console.log).toHaveBeenCalledWith('To: [redacted]');
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Verify your email')
    );
  });

  it('logs password reset email to console instead of sending', async () => {
    await sendPasswordResetEmail('user@example.com', 'reset-dev-token');

    expect(console.log).toHaveBeenCalledWith('To: [redacted]');
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Reset your FlashNote password')
    );
  });

  it('does not call Resend API', async () => {
    await sendVerificationEmail('user@example.com', 'token');

    // The Resend constructor was never called with a real key,
    // so the resend singleton is null — no API calls made
    // We verify by checking console.log was used instead
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('EMAIL SERVICE')
    );
  });
});
