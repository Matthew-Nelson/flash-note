import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import type { OrganizationMemberRow } from '../types/database.js';
import type { AuthenticatedRequest, OrgMembershipRequest, OrgRole } from '../types/index.js';

/**
 * Middleware that checks the authenticated user has an active org membership.
 * Attaches orgMembership to the request for downstream handlers.
 * Must be used after requireAuth.
 */
export async function requireOrgMembership(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'unauthorized', message: 'Authentication required' },
      });
      return;
    }

    const result = await db.query<OrganizationMemberRow>(
      `SELECT id, organization_id, user_id, role, is_billable, joined_at, removed_at
       FROM organization_members
       WHERE user_id = $1 AND removed_at IS NULL`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(403).json({
        success: false,
        error: { code: 'no_organization', message: 'You are not a member of any organization' },
      });
      return;
    }

    const row = result.rows[0]!;
    (req as OrgMembershipRequest).orgMembership = {
      organizationId: row.organization_id,
      role: row.role as OrgRole,
      isBillable: row.is_billable,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware factory that checks the user's org role is in the allowed list.
 * Must be used after requireOrgMembership.
 */
export function requireOrgRole(allowedRoles: OrgRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const orgReq = req as OrgMembershipRequest;

    if (!orgReq.orgMembership) {
      res.status(403).json({
        success: false,
        error: { code: 'no_organization', message: 'Organization membership required' },
      });
      return;
    }

    if (!allowedRoles.includes(orgReq.orgMembership.role)) {
      res.status(403).json({
        success: false,
        error: { code: 'insufficient_permissions', message: 'You do not have permission to perform this action' },
      });
      return;
    }

    next();
  };
}
