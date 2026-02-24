import { describe, it, expect, beforeEach } from 'vitest';
import { mockDbQuery, mockClientQuery, resetMocks, createMockOrgMemberRow } from '@/test/dal-helpers';

import {
  addMember,
  findActiveMembership,
  hasActiveMembership,
  findMembershipRecord,
  findActiveMemberByOrgAndUser,
  countBillableSeats,
  removeMember,
} from './organization-members';

describe('Organization Member Queries', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('addMember', () => {
    it('should INSERT with parameterized query', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as never;
      await addMember(mockClient, 'org-123', 'user-123', 'member', true);

      const [sql, params] = mockClientQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO organization_members');
      expect(sql).toContain('$1');
      expect(params).toEqual(['org-123', 'user-123', 'member', true]);
    });

    it('should accept different roles', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as never;
      await addMember(mockClient, 'org-123', 'user-123', 'owner', false);

      const [, params] = mockClientQuery.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual(['org-123', 'user-123', 'owner', false]);
    });
  });

  describe('findActiveMembership', () => {
    it('should return membership for active member', async () => {
      const memberRow = createMockOrgMemberRow();
      mockDbQuery.mockResolvedValueOnce({ rows: [memberRow] });

      const result = await findActiveMembership('test-user-id');

      expect(result).toEqual({
        organizationId: 'org-uuid',
        role: 'member',
        isBillable: true,
      });
    });

    it('should return null for non-member', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await findActiveMembership('nonexistent-user');

      expect(result).toBeNull();
    });

    it('should filter by removed_at IS NULL', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await findActiveMembership('user-123');

      const [sql] = mockDbQuery.mock.calls[0] as [string];
      expect(sql).toContain('removed_at IS NULL');
    });

    it('should use explicit column list (no SELECT *)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await findActiveMembership('user-123');

      const [sql] = mockDbQuery.mock.calls[0] as [string];
      expect(sql).not.toContain('SELECT *');
      expect(sql).toContain('organization_id');
      expect(sql).toContain('role');
      expect(sql).toContain('is_billable');
    });

    it('should use parameterized query', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await findActiveMembership('user-123');

      const [sql, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('$1');
      expect(params).toEqual(['user-123']);
    });

    // L-5 fix: Zod-validate role instead of `as OrgRole` cast
    it('should throw on invalid role from database', async () => {
      const memberRow = createMockOrgMemberRow({ role: 'superadmin' });
      mockDbQuery.mockResolvedValueOnce({ rows: [memberRow] });

      await expect(findActiveMembership('test-user-id')).rejects.toThrow();
    });
  });

  describe('hasActiveMembership', () => {
    it('should return true when user has active membership', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'member-id' }] });

      const mockClient = { query: mockClientQuery } as never;
      const result = await hasActiveMembership(mockClient, 'user-123');

      expect(result).toBe(true);
    });

    it('should return false when user has no active membership', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as never;
      const result = await hasActiveMembership(mockClient, 'user-123');

      expect(result).toBe(false);
    });

    it('should use FOR UPDATE to serialize concurrent joins', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as never;
      await hasActiveMembership(mockClient, 'user-123');

      const [sql] = mockClientQuery.mock.calls[0] as [string];
      expect(sql).toContain('FOR UPDATE');
      expect(sql).toContain('removed_at IS NULL');
    });

    it('should use transaction client (not pool)', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as never;
      await hasActiveMembership(mockClient, 'user-123');

      expect(mockClientQuery).toHaveBeenCalledTimes(1);
      expect(mockDbQuery).not.toHaveBeenCalled();
    });
  });

  // M-22 fix: Renamed from findMemberByOrgAndUser
  describe('findMembershipRecord', () => {
    it('should return member row including removed members', async () => {
      const memberRow = createMockOrgMemberRow({ removed_at: new Date() });
      mockDbQuery.mockResolvedValueOnce({ rows: [memberRow] });

      const result = await findMembershipRecord('org-uuid', 'test-user-id');

      expect(result).not.toBeNull();
      expect(result!.removed_at).not.toBeNull();
    });

    it('should return null when not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await findMembershipRecord('org-123', 'user-123');

      expect(result).toBeNull();
    });

    it('should NOT filter by removed_at (includes all records)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await findMembershipRecord('org-123', 'user-123');

      const [sql] = mockDbQuery.mock.calls[0] as [string];
      expect(sql).not.toContain('removed_at IS NULL');
    });
  });

  // M-22 fix: New function for active-only lookups
  describe('findActiveMemberByOrgAndUser', () => {
    it('should return active member only', async () => {
      const memberRow = createMockOrgMemberRow();
      mockDbQuery.mockResolvedValueOnce({ rows: [memberRow] });

      const result = await findActiveMemberByOrgAndUser('org-uuid', 'test-user-id');

      expect(result).not.toBeNull();
      expect(result!.removed_at).toBeNull();
    });

    it('should filter by removed_at IS NULL', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await findActiveMemberByOrgAndUser('org-123', 'user-123');

      const [sql] = mockDbQuery.mock.calls[0] as [string];
      expect(sql).toContain('removed_at IS NULL');
    });

    it('should return null when not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await findActiveMemberByOrgAndUser('org-123', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('countBillableSeats', () => {
    it('should count only billable active members', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '3' }] });

      const mockClient = { query: mockClientQuery } as never;
      const result = await countBillableSeats(mockClient, 'org-123');

      expect(result).toBe(3);

      const [sql] = mockClientQuery.mock.calls[0] as [string];
      expect(sql).toContain('is_billable = TRUE');
      expect(sql).toContain('removed_at IS NULL');
    });

    it('should return 0 when no billable members', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const mockClient = { query: mockClientQuery } as never;
      const result = await countBillableSeats(mockClient, 'org-123');

      expect(result).toBe(0);
    });

    // H-12 fix: Defensive check on empty rows
    it('should return 0 when rows are unexpectedly empty', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as never;
      const result = await countBillableSeats(mockClient, 'org-123');

      expect(result).toBe(0);
    });
  });

  describe('removeMember', () => {
    it('should soft-delete by setting removed_at', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const mockClient = { query: mockClientQuery } as never;
      const result = await removeMember(mockClient, 'org-123', 'user-123');

      expect(result).toBe(true);

      const [sql, params] = mockClientQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('SET removed_at = NOW()');
      expect(sql).toContain('removed_at IS NULL');
      expect(params).toEqual(['org-123', 'user-123']);
    });

    // M-25 fix: Returns boolean indicating row was updated
    it('should return false when no row was updated', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const mockClient = { query: mockClientQuery } as never;
      const result = await removeMember(mockClient, 'org-123', 'user-123');

      expect(result).toBe(false);
    });

    // M-25 fix: Handle null rowCount
    it('should return false when rowCount is null', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as never;
      const result = await removeMember(mockClient, 'org-123', 'user-123');

      expect(result).toBe(false);
    });
  });

  describe('DB error propagation', () => {
    it('findActiveMembership should propagate database errors', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('connection refused'));

      await expect(findActiveMembership('user-123')).rejects.toThrow('connection refused');
    });

    it('findMembershipRecord should propagate database errors', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('connection refused'));

      await expect(findMembershipRecord('org-123', 'user-123')).rejects.toThrow('connection refused');
    });
  });
});
