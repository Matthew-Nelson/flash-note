import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config with RESEND_API_KEY set (production-like)
vi.mock('@/server/db/config', () => ({
  config: {
    RESEND_API_KEY: 'test-api-key',
    WEB_URL: 'https://app.flashnote.test',
    EMAIL_FROM_NAME: 'FlashNote',
    EMAIL_FROM_ADDRESS: 'noreply@flashnote.test',
  },
  isDevelopment: false,
  isTest: false,
}));

// Track calls to resend.emails.send via a global holder
// vi.hoisted runs before vi.mock and makes the variable available in the factory
const mockSend = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

import { sendVerificationEmail, sendPasswordResetEmail } from './email';

describe('email service', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  describe('sendVerificationEmail', () => {
    it('sends email with correct parameters', async () => {
      mockSend.mockResolvedValueOnce({ error: null });

      await sendVerificationEmail('user@example.com', 'test-token-123');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0] as Record<string, string>;
      expect(call.from).toBe('FlashNote <noreply@flashnote.test>');
      expect(call.to).toBe('user@example.com');
      expect(call.subject).toContain('Verify your email');
      expect(call.html).toContain('test-token-123');
      expect(call.text).toContain('test-token-123');
    });

    it('includes correct verification URL', async () => {
      mockSend.mockResolvedValueOnce({ error: null });

      await sendVerificationEmail('user@example.com', 'abc+/=123');

      const call = mockSend.mock.calls[0][0] as Record<string, string>;
      expect(call.html).toContain('https://app.flashnote.test/verify-email?token=');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends email with correct parameters', async () => {
      mockSend.mockResolvedValueOnce({ error: null });

      await sendPasswordResetEmail('user@example.com', 'reset-token-456');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0] as Record<string, string>;
      expect(call.from).toBe('FlashNote <noreply@flashnote.test>');
      expect(call.to).toBe('user@example.com');
      expect(call.subject).toContain('Reset your FlashNote password');
      expect(call.html).toContain('reset-token-456');
      expect(call.html).toContain('15 minutes');
    });
  });

  describe('error handling', () => {
    it('throws on Resend error', async () => {
      mockSend.mockResolvedValueOnce({
        error: { name: 'validation_error', message: 'Invalid recipient' },
      });

      await expect(
        sendVerificationEmail('bad@example.com', 'token')
      ).rejects.toThrow('Failed to send email: Invalid recipient');
    });
  });
});
