import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { orgJoinRateLimit } from '../middleware/rate-limit.js';
import { organizationService } from '../services/organization-service.js';
import { auditService } from '../services/audit-service.js';
import { findActiveMembership } from '../db/queries/organization-members.js';
import { AuditAction, type AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/error-handler.js';

export const organizationRouter: Router = Router();

const joinSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required').max(20),
});

// POST /organization/join
organizationRouter.post('/join', orgJoinRateLimit, requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const { inviteCode } = joinSchema.parse(req.body);
    const userId = (req as AuthenticatedRequest).user.userId;
    const ipAddress = req.ip ?? undefined;
    const userAgent = req.get('user-agent');

    const normalizedCode = inviteCode.trim().toUpperCase();

    // Pre-check: fast-fail if user already in an org (UX optimization).
    // Authoritative check is inside the service transaction (TOCTOU-safe).
    const existingMembership = await findActiveMembership(userId);
    if (existingMembership) {
      throw new AppError(409, 'already_in_organization',
        'You are already a member of an organization');
    }

    const result = await organizationService.joinOrganization(userId, normalizedCode);

    await auditService.log({
      userId,
      action: AuditAction.ORG_MEMBER_JOINED,
      status: 'SUCCESS',
      metadata: { organizationId: result.organizationId, source: 'join_endpoint' },
      ipAddress,
      userAgent,
    });

    await auditService.log({
      userId,
      action: AuditAction.INVITE_CODE_REDEEMED,
      status: 'SUCCESS',
      metadata: { codeId: result.codeId },
      ipAddress,
      userAgent,
    });

    res.json({
      success: true,
      data: {
        organizationId: result.organizationId,
        organizationName: result.organizationName,
      },
    });
  } catch (error) {
    next(error);
  }
});
