/**
 * Tests for EmailService when Resend is NOT configured.
 *
 * This tests the development mode fallback behavior where emails are logged
 * instead of sent via Resend.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TEST_CONFIG_DEFAULTS } from '../test/setup.js';

// Mock config WITHOUT Resend API key (development mode)
vi.mock('../config.js', () => ({
  config: {
    RESEND_API_KEY: '', // Empty string - Resend not configured
    WEB_URL: TEST_CONFIG_DEFAULTS.WEB_URL,
    EMAIL_FROM_ADDRESS: 'noreply@flashnote.app',
    EMAIL_FROM_NAME: 'FlashNote',
  },
}));

// Mock Resend to verify it's not called
const { mockResendSend } = vi.hoisted(() => ({
  mockResendSend: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = {
      send: mockResendSend,
    };
  },
}));

// Import after mocking
import { emailService } from './email-service.js';

describe('EmailService (no Resend)', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockResendSend.mockReset();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('sendVerificationEmail', () => {
    it('should log email to console when Resend is not configured', async () => {
      await emailService.sendVerificationEmail('user@example.com', 'verification-token');

      // Should NOT call Resend
      expect(mockResendSend).not.toHaveBeenCalled();

      // Should log to console
      expect(consoleLogSpy).toHaveBeenCalled();

      // Check for the email header/footer markers
      const calls = consoleLogSpy.mock.calls.map((call) => call[0]);
      expect(calls).toContain('EMAIL SERVICE: Resend not configured, logging email:');
      expect(calls.some((call) => call.includes('To: user@example.com'))).toBe(true);
      expect(calls.some((call) => call.includes('Subject: Verify your FlashNote email address'))).toBe(true);
    });

    it('should include verification URL in logged email', async () => {
      await emailService.sendVerificationEmail('user@example.com', 'my-token');

      const allLogOutput = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
      expect(allLogOutput).toContain('verify-email?token=my-token');
    });

    it('should not throw when Resend is not configured', async () => {
      await expect(
        emailService.sendVerificationEmail('user@example.com', 'token')
      ).resolves.toBeUndefined();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should log email to console when Resend is not configured', async () => {
      await emailService.sendPasswordResetEmail('user@example.com', 'reset-token');

      // Should NOT call Resend
      expect(mockResendSend).not.toHaveBeenCalled();

      // Should log to console
      expect(consoleLogSpy).toHaveBeenCalled();

      const calls = consoleLogSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((call) => call.includes('Subject: Reset your FlashNote password'))).toBe(true);
    });

    it('should include reset URL in logged email', async () => {
      await emailService.sendPasswordResetEmail('user@example.com', 'my-reset-token');

      const allLogOutput = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
      expect(allLogOutput).toContain('reset-password?token=my-reset-token');
    });

    it('should not throw when Resend is not configured', async () => {
      await expect(
        emailService.sendPasswordResetEmail('user@example.com', 'token')
      ).resolves.toBeUndefined();
    });
  });

  describe('console output format', () => {
    it('should use separator lines for readability', async () => {
      await emailService.sendVerificationEmail('user@example.com', 'token');

      const calls = consoleLogSpy.mock.calls.map((call) => call[0]);
      // Check for separator lines (60 equal signs or dashes)
      expect(calls.some((call) => typeof call === 'string' && call.includes('='.repeat(60)))).toBe(true);
      expect(calls.some((call) => typeof call === 'string' && call.includes('-'.repeat(60)))).toBe(true);
    });

    it('should include plain text version of email', async () => {
      await emailService.sendVerificationEmail('user@example.com', 'token');

      const allLogOutput = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
      // Plain text content should include the welcome message
      expect(allLogOutput).toContain('Welcome to FlashNote');
      expect(allLogOutput).toContain('verify your email address');
    });
  });
});
