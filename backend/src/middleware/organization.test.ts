import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { mockDbQuery, resetMocks, createMockOrgMemberRow } from '../test/setup.js';
import { requireOrgMembership, requireOrgRole } from './organization.js';
import type { AuthenticatedRequest, OrgMembershipRequest } from '../types/index.js';

describe('Organization Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      user: { userId: 'user-123', email: 'test@example.com', tokenVersion: 1 },
    };
    mockRes = {
      status: statusMock as unknown as Response['status'],
      json: jsonMock as unknown as Response['json'],
    };
    mockNext = vi.fn() as unknown as NextFunction;
  });

  describe('requireOrgMembership', () => {
    it('should allow active member and attach orgMembership', async () => {
      const memberRow = createMockOrgMemberRow({
        organization_id: 'org-456',
        role: 'admin',
        is_billable: false,
      });
      mockDbQuery.mockResolvedValueOnce({ rows: [memberRow] });

      await requireOrgMembership(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();

      const orgReq = mockReq as OrgMembershipRequest;
      expect(orgReq.orgMembership).toEqual({
        organizationId: 'org-456',
        role: 'admin',
        isBillable: false,
      });
    });

    it('should deny non-member (no rows)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await requireOrgMembership(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: { code: 'no_organization', message: 'You are not a member of any organization' },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny removed member (query filters by removed_at IS NULL)', async () => {
      // removed members won't appear in results due to WHERE clause
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await requireOrgMembership(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();

      // Verify the query filters removed members
      const [sql] = mockDbQuery.mock.calls[0] as [string];
      expect(sql).toContain('removed_at IS NULL');
    });

    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined;

      await requireOrgMembership(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next(error) on database failure', async () => {
      const dbError = new Error('Database connection failed');
      mockDbQuery.mockRejectedValueOnce(dbError);

      await requireOrgMembership(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });

    it('should use explicit column list (no SELECT *)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await requireOrgMembership(mockReq as Request, mockRes as Response, mockNext);

      const [sql] = mockDbQuery.mock.calls[0] as [string];
      expect(sql).not.toContain('SELECT *');
      expect(sql).toContain('organization_id');
      expect(sql).toContain('role');
      expect(sql).toContain('is_billable');
    });
  });

  describe('requireOrgRole', () => {
    it('should allow owner when owner+admin are allowed', () => {
      const orgReq = mockReq as OrgMembershipRequest;
      orgReq.orgMembership = { organizationId: 'org-1', role: 'owner', isBillable: false };

      const middleware = requireOrgRole(['owner', 'admin']);
      middleware(orgReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should allow admin when owner+admin are allowed', () => {
      const orgReq = mockReq as OrgMembershipRequest;
      orgReq.orgMembership = { organizationId: 'org-1', role: 'admin', isBillable: true };

      const middleware = requireOrgRole(['owner', 'admin']);
      middleware(orgReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should deny member when only owner+admin are allowed', () => {
      const orgReq = mockReq as OrgMembershipRequest;
      orgReq.orgMembership = { organizationId: 'org-1', role: 'member', isBillable: true };

      const middleware = requireOrgRole(['owner', 'admin']);
      middleware(orgReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: { code: 'insufficient_permissions', message: 'You do not have permission to perform this action' },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow owner when only owner is allowed', () => {
      const orgReq = mockReq as OrgMembershipRequest;
      orgReq.orgMembership = { organizationId: 'org-1', role: 'owner', isBillable: false };

      const middleware = requireOrgRole(['owner']);
      middleware(orgReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny admin when only owner is allowed', () => {
      const orgReq = mockReq as OrgMembershipRequest;
      orgReq.orgMembership = { organizationId: 'org-1', role: 'admin', isBillable: true };

      const middleware = requireOrgRole(['owner']);
      middleware(orgReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny member when only owner is allowed', () => {
      const orgReq = mockReq as OrgMembershipRequest;
      orgReq.orgMembership = { organizationId: 'org-1', role: 'member', isBillable: true };

      const middleware = requireOrgRole(['owner']);
      middleware(orgReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when orgMembership is not set', () => {
      // orgMembership not set (requireOrgMembership wasn't called)
      const middleware = requireOrgRole(['owner']);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: { code: 'no_organization', message: 'Organization membership required' },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
