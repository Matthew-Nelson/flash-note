import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClientQuery, mockClientRelease, resetMocks } from '../test/setup.js';

// Mock config before any imports that use it (error-handler → config)
vi.mock('../config.js', () => ({
  config: {
    NODE_ENV: 'production' as const,
  },
}));

import { organizationService } from './organization-service.js';

describe('OrganizationService', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('joinOrganization', () => {
    function setupHappyPathMocks() {
      const inviteCodeRow = {
        id: 'code-uuid',
        code: 'AB3K-M7RN',
        type: 'clinic',
        organization_id: 'org-uuid',
        created_by: 'admin-uuid',
        used_by: null,
        used_at: null,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        is_active: true,
        created_at: new Date(),
      };

      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // findByCodeForUpdate (SELECT ... FOR UPDATE)
      mockClientQuery.mockResolvedValueOnce({ rows: [inviteCodeRow] });
      // findOrganizationByIdForUpdate (SELECT ... FOR UPDATE)
      mockClientQuery.mockResolvedValueOnce({ rows: [{ max_seats: 5, name: 'Test Clinic' }] });
      // countBillableSeats
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      // hasActiveMembership (SELECT ... FOR UPDATE via client)
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // addMember
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // updateUserOrganization
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // markCodeAsUsed
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // COMMIT
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
    }

    it('should join org via clinic code (happy path)', async () => {
      setupHappyPathMocks();

      const result = await organizationService.joinOrganization('user-123', 'AB3K-M7RN');

      expect(result).toEqual({
        organizationId: 'org-uuid',
        organizationName: 'Test Clinic',
        codeId: 'code-uuid',
      });
      expect(mockClientRelease).toHaveBeenCalled();
    });

    it('should use FOR UPDATE for invite code lock', async () => {
      setupHappyPathMocks();

      await organizationService.joinOrganization('user-123', 'AB3K-M7RN');

      // findByCodeForUpdate should use FOR UPDATE
      const codeQuery = mockClientQuery.mock.calls[1] as [string, unknown[]];
      expect(codeQuery[0]).toContain('FOR UPDATE');
    });

    it('should use FOR UPDATE for org row lock', async () => {
      setupHappyPathMocks();

      await organizationService.joinOrganization('user-123', 'AB3K-M7RN');

      // findOrganizationByIdForUpdate should use FOR UPDATE
      const orgQuery = mockClientQuery.mock.calls[2] as [string, unknown[]];
      expect(orgQuery[0]).toContain('FOR UPDATE');
    });

    it('should use FOR UPDATE for membership check to serialize concurrent joins', async () => {
      setupHappyPathMocks();

      await organizationService.joinOrganization('user-123', 'AB3K-M7RN');

      // hasActiveMembership should use FOR UPDATE via the transaction client
      const membershipQuery = mockClientQuery.mock.calls[4] as [string, unknown[]];
      expect(membershipQuery[0]).toContain('FOR UPDATE');
      expect(membershipQuery[0]).toContain('removed_at IS NULL');
    });

    it('should reject when seat limit exceeded', async () => {
      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // findByCodeForUpdate
      mockClientQuery.mockResolvedValueOnce({
        rows: [{
          id: 'code-uuid', code: 'AB3K-M7RN', type: 'clinic',
          organization_id: 'org-uuid', created_by: 'admin', used_by: null,
          used_at: null, expires_at: new Date(Date.now() + 86400000),
          is_active: true, created_at: new Date(),
        }],
      });
      // findOrganizationByIdForUpdate
      mockClientQuery.mockResolvedValueOnce({ rows: [{ max_seats: 3, name: 'Small Clinic' }] });
      // countBillableSeats — at limit
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '3' }] });
      // ROLLBACK
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        organizationService.joinOrganization('user-123', 'AB3K-M7RN')
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'no_seats_available',
      });
    });

    it('should reject beta code at join endpoint', async () => {
      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // findByCodeForUpdate — beta code, not clinic
      mockClientQuery.mockResolvedValueOnce({
        rows: [{
          id: 'code-uuid', code: 'BETA-CODE', type: 'beta',
          organization_id: null, created_by: 'admin', used_by: null,
          used_at: null, expires_at: new Date(Date.now() + 86400000),
          is_active: true, created_at: new Date(),
        }],
      });
      // ROLLBACK
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        organizationService.joinOrganization('user-123', 'BETA-CODE')
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'invalid_code_type',
      });
    });

    it('should reject clinic code with missing organization (broken invariant)', async () => {
      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // findByCodeForUpdate — clinic code but no org
      mockClientQuery.mockResolvedValueOnce({
        rows: [{
          id: 'code-uuid', code: 'CLINIC-CODE', type: 'clinic',
          organization_id: null, created_by: 'admin', used_by: null,
          used_at: null, expires_at: new Date(Date.now() + 86400000),
          is_active: true, created_at: new Date(),
        }],
      });
      // ROLLBACK
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        organizationService.joinOrganization('user-123', 'CLINIC-CODE')
      ).rejects.toMatchObject({
        statusCode: 500,
        code: 'invalid_invite_code',
      });
    });

    it('should reject user already in organization', async () => {
      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // findByCodeForUpdate
      mockClientQuery.mockResolvedValueOnce({
        rows: [{
          id: 'code-uuid', code: 'AB3K-M7RN', type: 'clinic',
          organization_id: 'org-uuid', created_by: 'admin', used_by: null,
          used_at: null, expires_at: new Date(Date.now() + 86400000),
          is_active: true, created_at: new Date(),
        }],
      });
      // findOrganizationByIdForUpdate
      mockClientQuery.mockResolvedValueOnce({ rows: [{ max_seats: 5, name: 'Clinic' }] });
      // countBillableSeats
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      // hasActiveMembership — already has membership (returns rows)
      mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-member-id' }] });
      // ROLLBACK
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        organizationService.joinOrganization('user-123', 'AB3K-M7RN')
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'already_in_organization',
      });
    });

    it('should reject invalid invite code', async () => {
      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // findByCodeForUpdate — not found
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // ROLLBACK
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        organizationService.joinOrganization('user-123', 'INVALID')
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'invalid_invite_code',
      });
    });

    it('should reject org not found (broken invariant)', async () => {
      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // findByCodeForUpdate
      mockClientQuery.mockResolvedValueOnce({
        rows: [{
          id: 'code-uuid', code: 'AB3K-M7RN', type: 'clinic',
          organization_id: 'org-uuid', created_by: 'admin', used_by: null,
          used_at: null, expires_at: new Date(Date.now() + 86400000),
          is_active: true, created_at: new Date(),
        }],
      });
      // findOrganizationByIdForUpdate — not found
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // ROLLBACK
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        organizationService.joinOrganization('user-123', 'AB3K-M7RN')
      ).rejects.toMatchObject({
        statusCode: 500,
        code: 'invalid_invite_code',
      });
    });

    it('should rollback and release client on error', async () => {
      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // findByCodeForUpdate — not found
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // ROLLBACK
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      try {
        await organizationService.joinOrganization('user-123', 'INVALID');
      } catch {
        // expected
      }

      // Verify ROLLBACK was called
      const rollbackCall = mockClientQuery.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0] === 'ROLLBACK'
      );
      expect(rollbackCall).toBeDefined();

      // Verify client was released
      expect(mockClientRelease).toHaveBeenCalled();
    });
  });
});
