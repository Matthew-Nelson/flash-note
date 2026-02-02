import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TEST_CONFIG_DEFAULTS } from '../test/setup.js';

// Create controlled mocks using vi.hoisted to avoid initialization order issues
const { mockResendSend } = vi.hoisted(() => ({
  mockResendSend: vi.fn(),
}));

// Mock Resend class - use a class to work with 'new Resend()'
vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = {
      send: mockResendSend,
    };
  },
}));

// Mock config
vi.mock('../config.js', () => ({
  config: {
    RESEND_API_KEY: 'test_api_key',
    WEB_URL: TEST_CONFIG_DEFAULTS.WEB_URL,
    EMAIL_FROM_ADDRESS: 'noreply@flashnote.com',
    EMAIL_FROM_NAME: 'FlashNote',
  },
}));

// Import after mocking
import { emailService } from './email-service.js';

describe('EmailService', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockResendSend.mockReset();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {}) as ReturnType<typeof vi.spyOn>;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}) as ReturnType<typeof vi.spyOn>;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('sendVerificationEmail', () => {
    it('should call Resend send with correct parameters', async () => {
      mockResendSend.mockResolvedValueOnce({ error: null });

      await emailService.sendVerificationEmail('user@example.com', 'token123');

      expect(mockResendSend).toHaveBeenCalledTimes(1);
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Verify your email to start saving hours on documentation',
        })
      );
    });

    it('should include from address in email', async () => {
      mockResendSend.mockResolvedValueOnce({ error: null });

      await emailService.sendVerificationEmail('user@example.com', 'token');

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('FlashNote'),
        })
      );
    });

    it('should include verification URL with token in HTML', async () => {
      mockResendSend.mockResolvedValueOnce({ error: null });

      await emailService.sendVerificationEmail('user@example.com', 'my-verification-token');

      const callArgs = mockResendSend.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();

      const expectedUrl = `${TEST_CONFIG_DEFAULTS.WEB_URL}/verify-email?token=my-verification-token`;
      expect(callArgs.html).toContain(expectedUrl);
    });

    it('should include verification URL in plain text', async () => {
      mockResendSend.mockResolvedValueOnce({ error: null });

      await emailService.sendVerificationEmail('user@example.com', 'my-verification-token');

      const callArgs = mockResendSend.mock.calls[0]?.[0];
      expect(callArgs.text).toContain('verify-email?token=my-verification-token');
    });

    it('should URL-encode special characters in token', async () => {
      mockResendSend.mockResolvedValueOnce({ error: null });

      await emailService.sendVerificationEmail('user@example.com', 'token+with/special=chars');

      const callArgs = mockResendSend.mock.calls[0]?.[0];
      // URL encoded version
      expect(callArgs.html).toContain('token%2Bwith%2Fspecial%3Dchars');
    });

    it('should include 24-hour expiry notice', async () => {
      mockResendSend.mockResolvedValueOnce({ error: null });

      await emailService.sendVerificationEmail('user@example.com', 'token');

      const callArgs = mockResendSend.mock.calls[0]?.[0];
      expect(callArgs.html).toContain('24 hours');
      expect(callArgs.text).toContain('24 hours');
    });

    it('should throw error when Resend returns error', async () => {
      mockResendSend.mockResolvedValueOnce({
        error: { message: 'Invalid API key' },
      });

      await expect(
        emailService.sendVerificationEmail('user@example.com', 'token')
      ).rejects.toThrow('Failed to send email: Invalid API key');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should call Resend send with correct parameters', async () => {
      mockResendSend.mockResolvedValueOnce({ error: null });

      await emailService.sendPasswordResetEmail('user@example.com', 'reset-token');

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Reset your FlashNote password',
        })
      );
    });

    it('should include reset URL with token in HTML', async () => {
      mockResendSend.mockResolvedValueOnce({ error: null });

      await emailService.sendPasswordResetEmail('user@example.com', 'my-reset-token');

      const callArgs = mockResendSend.mock.calls[0]?.[0];
      const expectedUrl = `${TEST_CONFIG_DEFAULTS.WEB_URL}/reset-password?token=my-reset-token`;
      expect(callArgs.html).toContain(expectedUrl);
    });

    it('should include reset URL in plain text', async () => {
      mockResendSend.mockResolvedValueOnce({ error: null });

      await emailService.sendPasswordResetEmail('user@example.com', 'my-reset-token');

      const callArgs = mockResendSend.mock.calls[0]?.[0];
      expect(callArgs.text).toContain('reset-password?token=my-reset-token');
    });

    it('should include 15-minute expiry notice', async () => {
      mockResendSend.mockResolvedValueOnce({ error: null });

      await emailService.sendPasswordResetEmail('user@example.com', 'token');

      const callArgs = mockResendSend.mock.calls[0]?.[0];
      expect(callArgs.html).toContain('15 minutes');
      expect(callArgs.text).toContain('15 minutes');
    });

    it('should throw error when Resend returns error', async () => {
      mockResendSend.mockResolvedValueOnce({
        error: { message: 'Rate limit exceeded' },
      });

      await expect(
        emailService.sendPasswordResetEmail('user@example.com', 'token')
      ).rejects.toThrow('Failed to send email: Rate limit exceeded');
    });
  });

  describe('email content', () => {
    it('should include both HTML and plain text versions', async () => {
      mockResendSend.mockResolvedValueOnce({ error: null });

      await emailService.sendVerificationEmail('user@example.com', 'token');

      const callArgs = mockResendSend.mock.calls[0]?.[0];

      expect(callArgs.html).toBeDefined();
      expect(callArgs.text).toBeDefined();
      expect(callArgs.html.length).toBeGreaterThan(0);
      expect(callArgs.text.length).toBeGreaterThan(0);
    });

    it('should include fallback URL instruction in HTML', async () => {
      mockResendSend.mockResolvedValueOnce({ error: null });

      await emailService.sendVerificationEmail('user@example.com', 'token');

      const callArgs = mockResendSend.mock.calls[0]?.[0];

      // HTML should include instruction to copy-paste URL
      expect(callArgs.html).toContain('copy this link');
    });

    it('should include clickable link in text version', async () => {
      mockResendSend.mockResolvedValueOnce({ error: null });

      await emailService.sendVerificationEmail('user@example.com', 'token');

      const callArgs = mockResendSend.mock.calls[0]?.[0];

      // Text should include the full URL
      expect(callArgs.text).toContain('http');
    });
  });

  describe('HIPAA compliance', () => {
    it('should NOT include PHI-related terms in verification email', async () => {
      mockResendSend.mockResolvedValueOnce({ error: null });

      await emailService.sendVerificationEmail('user@example.com', 'token');

      const callArgs = mockResendSend.mock.calls[0]?.[0];

      // Email should not contain patient-specific information
      expect(callArgs.html.toLowerCase()).not.toContain('patient name');
      expect(callArgs.html.toLowerCase()).not.toContain('diagnosis');
      expect(callArgs.html.toLowerCase()).not.toContain('medical record');
    });

    it('should NOT include PHI-related terms in password reset email', async () => {
      mockResendSend.mockResolvedValueOnce({ error: null });

      await emailService.sendPasswordResetEmail('user@example.com', 'token');

      const callArgs = mockResendSend.mock.calls[0]?.[0];

      expect(callArgs.html.toLowerCase()).not.toContain('patient');
      expect(callArgs.html.toLowerCase()).not.toContain('medical record');
    });

    it('should only include email address as user-specific data', async () => {
      mockResendSend.mockResolvedValueOnce({ error: null });

      await emailService.sendVerificationEmail('user@example.com', 'token');

      const callArgs = mockResendSend.mock.calls[0]?.[0];

      // Only the 'to' field should contain user-specific data
      expect(callArgs.to).toBe('user@example.com');
      // Subject should be generic
      expect(callArgs.subject).not.toContain('user@example.com');
    });
  });

  describe('error handling', () => {
    it('should log error when Resend fails', async () => {
      mockResendSend.mockResolvedValueOnce({
        error: { message: 'API error' },
      });

      try {
        await emailService.sendVerificationEmail('user@example.com', 'token');
      } catch {
        // Expected to throw
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Email send error:',
        expect.objectContaining({ message: 'API error' })
      );
    });

    it('should propagate meaningful error message', async () => {
      mockResendSend.mockResolvedValueOnce({
        error: { message: 'Invalid recipient address' },
      });

      await expect(
        emailService.sendVerificationEmail('bad-email', 'token')
      ).rejects.toThrow('Failed to send email: Invalid recipient address');
    });
  });
});
