import { describe, it, expect, beforeEach } from 'vitest';
import { mockDbQuery, mockClientQuery, resetMocks, createMockOrgRow } from '@/test/dal-helpers';

import {
  createOrganization,
  findOrganizationById,
  findOrganizationByIdForUpdate,
  getOrgSubscription,
} from './organizations';

describe('Organization Queries', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('createOrganization', () => {
    it('should INSERT with parameterized query and RETURNING', async () => {
      const orgRow = createMockOrgRow();
      mockClientQuery.mockResolvedValueOnce({ rows: [orgRow] });

      const mockClient = { query: mockClientQuery } as never;
      const result = await createOrganization(mockClient, 'Test Clinic', 5);

      expect(result.id).toBe('org-uuid');
      expect(result.name).toBe('Test Clinic');
      expect(result.maxSeats).toBe(5);

      const [sql, params] = mockClientQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO organizations');
      expect(sql).toContain('RETURNING');
      expect(sql).toContain('$1');
      expect(sql).toContain('$2');
      expect(params).toEqual(['Test Clinic', 5]);
    });

    it('should transform snake_case row to camelCase', async () => {
      const orgRow = createMockOrgRow({
        stripe_customer_id: 'cus_123',
        subscription_status: 'trialing',
        trial_ends_at: new Date('2025-01-01'),
      });
      mockClientQuery.mockResolvedValueOnce({ rows: [orgRow] });

      const mockClient = { query: mockClientQuery } as never;
      const result = await createOrganization(mockClient, 'Clinic', 10);

      expect(result.stripeCustomerId).toBe('cus_123');
      expect(result.subscriptionStatus).toBe('trialing');
      expect(result.trialEndsAt).toEqual(new Date('2025-01-01'));
    });

    it('should use explicit column list (no SELECT *)', async () => {
      const orgRow = createMockOrgRow();
      mockClientQuery.mockResolvedValueOnce({ rows: [orgRow] });

      const mockClient = { query: mockClientQuery } as never;
      await createOrganization(mockClient, 'Clinic', 5);

      const [sql] = mockClientQuery.mock.calls[0] as [string];
      expect(sql).not.toContain('SELECT *');
      expect(sql).toContain('id');
      expect(sql).toContain('name');
      expect(sql).toContain('max_seats');
    });

    // H-12 fix
    it('should throw when INSERT RETURNING returns no rows', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as never;
      await expect(createOrganization(mockClient, 'Clinic', 5)).rejects.toThrow(
        'createOrganization: INSERT RETURNING returned no rows'
      );
    });
  });

  describe('findOrganizationById', () => {
    it('should return organization when found', async () => {
      const orgRow = createMockOrgRow();
      mockDbQuery.mockResolvedValueOnce({ rows: [orgRow] });

      const result = await findOrganizationById('org-uuid');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('org-uuid');
      expect(result!.name).toBe('Test Clinic');
    });

    it('should return null when not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await findOrganizationById('nonexistent');

      expect(result).toBeNull();
    });

    it('should use parameterized query', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await findOrganizationById('org-123');

      const [sql, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('$1');
      expect(params).toEqual(['org-123']);
    });

    it('should propagate database errors to the caller', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('connection refused'));

      await expect(findOrganizationById('org-123')).rejects.toThrow('connection refused');
    });
  });

  describe('findOrganizationByIdForUpdate', () => {
    it('should use FOR UPDATE for row locking', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ max_seats: 10, name: 'Clinic' }],
      });

      const mockClient = { query: mockClientQuery } as never;
      const result = await findOrganizationByIdForUpdate(mockClient, 'org-123');

      expect(result).toEqual({ maxSeats: 10, name: 'Clinic' });

      const [sql] = mockClientQuery.mock.calls[0] as [string];
      expect(sql).toContain('FOR UPDATE');
    });

    it('should return null when org not found', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as never;
      const result = await findOrganizationByIdForUpdate(mockClient, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getOrgSubscription', () => {
    it('should JOIN organizations and organization_members for defense-in-depth', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ subscription_status: 'active', trial_ends_at: null }],
      });

      const result = await getOrgSubscription('org-123', 'user-123');

      expect(result).toEqual({ subscription_status: 'active', trial_ends_at: null });

      const [sql, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('JOIN organization_members');
      expect(sql).toContain('removed_at IS NULL');
      expect(params).toEqual(['org-123', 'user-123']);
    });

    it('should return null when no active membership found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await getOrgSubscription('org-123', 'user-123');

      expect(result).toBeNull();
    });

    it('should use parameterized query', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await getOrgSubscription("'; DROP TABLE organizations; --", 'user-123');

      const [sql, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('$1');
      expect(sql).toContain('$2');
      expect(sql).not.toContain('DROP TABLE');
      expect(params[0]).toContain('DROP TABLE');
    });

    it('should propagate database errors to the caller', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('connection refused'));

      await expect(getOrgSubscription('org-123', 'user-123')).rejects.toThrow('connection refused');
    });
  });
});
