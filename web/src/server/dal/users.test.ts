import { describe, it, expect, beforeEach } from 'vitest';
import { mockDbQuery, mockClientQuery, resetMocks, createMockUserRow } from '@/test/dal-helpers';
import {
  findUserByEmail,
  findUserById,
  createUser,
  createUserWithClient,
  updateUserSubscription,
  updateSubscriptionStatus,
  markEmailVerified,
  updatePassword,
  resetLockout,
  updateUserOrganization,
  clearUserOrganization,
} from './users';

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

    it('should filter out soft-deleted users', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await findUserByEmail('deleted@example.com');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND NOT is_deleted'),
        ['deleted@example.com']
      );
    });

    it('should transform snake_case to camelCase', async () => {
      const mockRow = createMockUserRow({
        email_verified: true,
        failed_login_attempts: 3,
      });
      mockDbQuery.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await findUserByEmail('test@example.com');

      expect(result!.emailVerified).toBe(true);
      expect(result!.failedLoginAttempts).toBe(3);
    });

    it('should default null fields via null coalescing', async () => {
      // Create a row with nullish values to test ?? fallback branches
      const mockRow = {
        ...createMockUserRow(),
        failed_login_attempts: null,
        email_verified: null,
        organization_id: null,
        is_deleted: null,
        deleted_at: null,
      };
      mockDbQuery.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await findUserByEmail('test@example.com');

      expect(result!.failedLoginAttempts).toBe(0);
      expect(result!.emailVerified).toBe(false);
      expect(result!.organizationId).toBeNull();
      expect(result!.isDeleted).toBe(false);
      expect(result!.deletedAt).toBeNull();
    });

    it('should throw on invalid subscription_status from DB', async () => {
      const mockRow = createMockUserRow({ subscription_status: 'invalid_status' as never });
      mockDbQuery.mockResolvedValueOnce({ rows: [mockRow] });

      await expect(findUserByEmail('test@example.com')).rejects.toThrow();
    });

    it('should normalize email to lowercase for case-insensitive lookup', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await findUserByEmail('User@Example.COM');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(email)'),
        ['user@example.com']
      );
    });

    it('should trim whitespace from email', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await findUserByEmail('  test@example.com  ');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['test@example.com']
      );
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

    it('should filter out soft-deleted users', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await findUserById('deleted-user-id');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND NOT is_deleted'),
        ['deleted-user-id']
      );
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

    // H-12 fix: Verify that empty rows throw instead of crashing with undefined access
    it('should throw when INSERT RETURNING returns no rows', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await expect(createUser('test@example.com', 'hash')).rejects.toThrow(
        'createUser: INSERT RETURNING returned no rows'
      );
    });

    it('should normalize email to lowercase', async () => {
      const mockRow = createMockUserRow({ email: 'user@example.com' });
      mockDbQuery.mockResolvedValueOnce({ rows: [mockRow] });

      await createUser('User@Example.COM', 'hash');

      const [, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(params[0]).toBe('user@example.com');
    });

    it('should trim whitespace from email', async () => {
      const mockRow = createMockUserRow();
      mockDbQuery.mockResolvedValueOnce({ rows: [mockRow] });

      await createUser('  test@example.com  ', 'hash');

      const [, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(params[0]).toBe('test@example.com');
    });
  });

  describe('createUserWithClient', () => {
    it('should create user using transaction client', async () => {
      const mockRow = createMockUserRow({ id: 'new-id' });
      mockClientQuery.mockResolvedValueOnce({ rows: [mockRow] });

      const mockClient = { query: mockClientQuery } as never;
      const result = await createUserWithClient(mockClient, 'test@example.com', 'hash');

      expect(result.id).toBe('new-id');
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['test@example.com', 'hash']
      );
    });

    // H-12 fix
    it('should throw when INSERT RETURNING returns no rows', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as never;
      await expect(createUserWithClient(mockClient, 'test@example.com', 'hash')).rejects.toThrow(
        'createUserWithClient: INSERT RETURNING returned no rows'
      );
    });

    it('should normalize email to lowercase', async () => {
      const mockRow = createMockUserRow();
      mockClientQuery.mockResolvedValueOnce({ rows: [mockRow] });

      const mockClient = { query: mockClientQuery } as never;
      await createUserWithClient(mockClient, 'User@EXAMPLE.com', 'hash');

      const [, params] = mockClientQuery.mock.calls[0] as [string, unknown[]];
      expect(params[0]).toBe('user@example.com');
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

    it('should filter out soft-deleted users', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await updateUserSubscription('user-123', 'cus_abc', 'sub_xyz', 'active');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND NOT is_deleted'),
        expect.any(Array)
      );
    });

    it('should propagate database errors to the caller', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('connection refused'));

      await expect(
        updateUserSubscription('user-123', 'cus_abc', 'sub_xyz', 'active')
      ).rejects.toThrow('connection refused');
    });
  });

  describe('updateSubscriptionStatus', () => {
    it('should filter out soft-deleted users', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await updateSubscriptionStatus('user-123', 'canceled');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND NOT is_deleted'),
        expect.any(Array)
      );
    });

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
    it('should filter out soft-deleted users', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await markEmailVerified('user-123');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND NOT is_deleted'),
        expect.any(Array)
      );
    });

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
    it('should filter out soft-deleted users', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await updatePassword('user-123', 'new-hash');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND NOT is_deleted'),
        expect.any(Array)
      );
    });

    it('should update password hash using pool by default', async () => {
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

    it('should use PoolClient when provided for transaction composition', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as never;
      await updatePassword('user-123', 'new-hash', mockClient);

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('password_hash = $1'),
        ['new-hash', 'user-123']
      );
      expect(mockDbQuery).not.toHaveBeenCalled();
    });

    it('should propagate database errors to the caller', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('connection refused'));

      await expect(
        updatePassword('user-123', 'new-hash')
      ).rejects.toThrow('connection refused');
    });
  });

  describe('resetLockout', () => {
    it('should filter out soft-deleted users', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await resetLockout('user-123');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND NOT is_deleted'),
        expect.any(Array)
      );
    });

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

    it('should use PoolClient when provided for transaction composition', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as never;
      await resetLockout('user-123', mockClient);

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('failed_login_attempts = 0'),
        ['user-123']
      );
      expect(mockDbQuery).not.toHaveBeenCalled();
    });

    it('should propagate database errors to the caller', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('connection refused'));

      await expect(resetLockout('user-123')).rejects.toThrow('connection refused');
    });
  });

  describe('updateUserOrganization', () => {
    it('should filter out soft-deleted users', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as never;
      await updateUserOrganization(mockClient, 'user-123', 'org-456');

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND NOT is_deleted'),
        expect.any(Array)
      );
    });

    it('should set organization_id using transaction client', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as never;
      await updateUserOrganization(mockClient, 'user-123', 'org-456');

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('organization_id = $1'),
        ['org-456', 'user-123']
      );
    });
  });

  describe('clearUserOrganization', () => {
    it('should filter out soft-deleted users', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as never;
      await clearUserOrganization(mockClient, 'user-123');

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND NOT is_deleted'),
        expect.any(Array)
      );
    });

    it('should set organization_id to NULL using transaction client', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as never;
      await clearUserOrganization(mockClient, 'user-123');

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('organization_id = NULL'),
        ['user-123']
      );
    });
  });
});
