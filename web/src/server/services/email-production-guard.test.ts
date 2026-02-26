import { describe, it, expect, vi } from 'vitest';

// Mock config: no RESEND_API_KEY AND production environment
vi.mock('@/server/db/config', () => ({
  config: {
    RESEND_API_KEY: '',
    WEB_URL: 'https://app.flashnote.com',
    EMAIL_FROM_NAME: 'FlashNote',
    EMAIL_FROM_ADDRESS: 'noreply@flashnote.app',
  },
  isDevelopment: false,
  isTest: false,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: vi.fn() };
  },
}));

import { sendVerificationEmail } from './email';

describe('email service (production guard)', () => {
  it('throws when Resend not configured in production', async () => {
    await expect(
      sendVerificationEmail('user@example.com', 'token')
    ).rejects.toThrow('Email service not configured in production');
  });
});
