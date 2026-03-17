import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
}));

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

vi.mock('@/server/lib/logger', () => ({ logger: mockLogger }));

import { sendVerificationEmail, sendPasswordResetEmail } from './email';

describe('email service (dev mode — no Resend API key)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs verification email via logger instead of sending', async () => {
    await sendVerificationEmail('user@example.com', 'dev-token');

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'email_service',
        to: '[redacted]',
        subject: expect.stringContaining('Verify your email'),
      }),
      expect.stringContaining('Dev mode')
    );
  });

  it('logs password reset email via logger instead of sending', async () => {
    await sendPasswordResetEmail('user@example.com', 'reset-dev-token');

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'email_service',
        to: '[redacted]',
        subject: expect.stringContaining('Reset your FlashNote password'),
      }),
      expect.stringContaining('Dev mode')
    );
  });

  it('does not call Resend API', async () => {
    await sendVerificationEmail('user@example.com', 'token');

    // The Resend constructor was never called with a real key,
    // so the resend singleton is null — no API calls made
    // We verify by checking logger.info was used instead
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'email_service' }),
      expect.stringContaining('Dev mode')
    );
  });
});
