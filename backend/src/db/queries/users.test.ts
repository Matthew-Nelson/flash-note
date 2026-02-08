import { describe, it, expect, beforeEach } from 'vitest';
import { mockDbQuery, resetMocks, createMockUserRow } from '../../test/setup.js';
import {
  findUserByEmail,
  findUserById,
  createUser,
  updateUserSubscription,
  updateSubscriptionStatus,
  markEmailVerified,
  updatePassword,
  getTokenVersion,
  incrementTokenVersion,
  resetLockout,
} from './users.js';

describe('User Queries', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('findUserByEmail', () => {
    it('should return user when found', async () => {
      const mockRow = createMockUserRow({ email: 'test@example.com' });
      mockDbQuery.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await findUserByEmail('test@example.com');

      expect(result).not.toBeNull();
      expect(result!.email).toBe('test@example.com');
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['test@example.com']
      );
    });

    it('should return null when user not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await findUserByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should transform snake_case to camelCase', async () => {
      const mockRow = createMockUserRow({
        email_verified: true,
        failed_login_attempts: 3,
        token_version: 5,
      });
      mockDbQuery.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await findUserByEmail('test@example.com');

      expect(result!.emailVerified).toBe(true);
      expect(result!.failedLoginAttempts).toBe(3);
      expect(result!.tokenVersion).toBe(5);
    });
  });

  describe('findUserById', () => {
    it('should return user when found', async () => {
      const mockRow = createMockUserRow({ id: 'user-123' });
      mockDbQuery.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await findUserById('user-123');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('user-123');
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['user-123']
      );
    });

    it('should return null when user not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await findUserById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    it('should create user and return with all fields', async () => {
      const mockRow = createMockUserRow({
        id: 'new-user-id',
        email: 'new@example.com',
      });
      mockDbQuery.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await createUser('new@example.com', 'hashed-password');

      expect(result).not.toBeNull();
      expect(result.email).toBe('new@example.com');
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['new@example.com', 'hashed-password']
      );
    });

    it('should use RETURNING clause to get created user', async () => {
      const mockRow = createMockUserRow();
      mockDbQuery.mockResolvedValueOnce({ rows: [mockRow] });

      await createUser('test@example.com', 'hash');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING'),
        expect.any(Array)
      );
    });
  });

  describe('updateUserSubscription', () => {
    it('should update subscription with all parameters', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await updateUserSubscription(
        'user-123',
        'cus_stripe_123',
        'sub_stripe_456',
        'active'
      );

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        ['cus_stripe_123', 'sub_stripe_456', 'active', 'user-123']
      );
    });

    it('should update stripe_customer_id, subscription_id, and status', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await updateUserSubscription('user-123', 'cus_abc', 'sub_xyz', 'trialing');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('stripe_customer_id = $1'),
        expect.any(Array)
      );
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('subscription_id = $2'),
        expect.any(Array)
      );
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('subscription_status = $3'),
        expect.any(Array)
      );
    });
  });

  describe('updateSubscriptionStatus', () => {
    it('should update status only', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await updateSubscriptionStatus('user-123', 'canceled');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('subscription_status = $1'),
        ['canceled', 'user-123']
      );
    });

    it('should update updated_at timestamp', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await updateSubscriptionStatus('user-123', 'active');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = NOW()'),
        expect.any(Array)
      );
    });
  });

  describe('markEmailVerified', () => {
    it('should set email_verified to true', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await markEmailVerified('user-123');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('email_verified = TRUE'),
        ['user-123']
      );
    });

    it('should set email_verified_at to current time', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await markEmailVerified('user-123');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('email_verified_at = NOW()'),
        expect.any(Array)
      );
    });

    it('should update updated_at timestamp', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await markEmailVerified('user-123');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = NOW()'),
        expect.any(Array)
      );
    });
  });

  describe('updatePassword', () => {
    it('should update password hash', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await updatePassword('user-123', 'new-password-hash');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('password_hash = $1'),
        ['new-password-hash', 'user-123']
      );
    });

    it('should update updated_at timestamp', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await updatePassword('user-123', 'new-hash');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = NOW()'),
        expect.any(Array)
      );
    });
  });

  describe('getTokenVersion', () => {
    it('should return token version when user found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{ token_version: 5 }] });

      const result = await getTokenVersion('user-123');

      expect(result).toBe(5);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT token_version FROM users'),
        ['user-123']
      );
    });

    it('should return null when user not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await getTokenVersion('nonexistent');

      expect(result).toBeNull();
    });

    it('should return 1 when token_version is null (default)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{ token_version: null }] });

      const result = await getTokenVersion('user-123');

      expect(result).toBe(1);
    });
  });

  describe('incrementTokenVersion', () => {
    it('should increment and return new version', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{ token_version: 6 }] });

      const result = await incrementTokenVersion('user-123');

      expect(result).toBe(6);
    });

    it('should use RETURNING to get updated value', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{ token_version: 2 }] });

      await incrementTokenVersion('user-123');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING token_version'),
        ['user-123']
      );
    });

    it('should update updated_at timestamp', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{ token_version: 1 }] });

      await incrementTokenVersion('user-123');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = NOW()'),
        expect.any(Array)
      );
    });
  });

  describe('resetLockout', () => {
    it('should reset failed_login_attempts to 0', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await resetLockout('user-123');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('failed_login_attempts = 0'),
        ['user-123']
      );
    });

    it('should clear locked_until and last_failed_login_at', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await resetLockout('user-123');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('locked_until = NULL'),
        expect.any(Array)
      );
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('last_failed_login_at = NULL'),
        expect.any(Array)
      );
    });

    it('should update updated_at timestamp', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await resetLockout('user-123');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = NOW()'),
        expect.any(Array)
      );
    });
  });
});
