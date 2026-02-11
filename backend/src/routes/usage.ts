import { Router } from 'express';
import { Sentry } from '../instrument.js';
import { requireAuth } from '../middleware/auth.js';
import { apiRateLimit } from '../middleware/rate-limit.js';
import { usageService } from '../services/usage-service.js';
import { findUserById } from '../db/queries/users.js';
import { findActiveMembership } from '../db/queries/organization-members.js';
import { findOrganizationById } from '../db/queries/organizations.js';
import { AppError } from '../middleware/error-handler.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const usageRouter: Router = Router();

/**
 * GET /usage/me
 *
 * Returns the current user's usage stats for the current month,
 * plus organization context if the user belongs to one.
 *
 * Response:
 *   { success: true, data: { currentMonth, notesGenerated, organization } }
 *
 * Requires: valid access token (Bearer auth)
 */
usageRouter.get('/me', requireAuth, apiRateLimit, async (req, res, next) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;

    const user = await findUserById(userId);
    if (!user) {
      throw new AppError(404, 'not_found', 'User not found');
    }

    // Compute current month inline (same format as UsageService)
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const usage = await usageService.getMonthlyUsage(userId);

    // Resolve organization context if user has an org
    let organization: { name: string; role: string } | null = null;
    if (user.organizationId) {
      // Defense-in-depth: verify active membership even if organizationId is set
      const membership = await findActiveMembership(userId);
      if (membership) {
        const org = await findOrganizationById(membership.organizationId);
        if (org) {
          organization = { name: org.name, role: membership.role };
        }
      }
    }

    res.json({
      success: true,
      data: {
        currentMonth,
        notesGenerated: usage.notesGenerated,
        organization,
      },
    });
  } catch (error) {
    if (!(error instanceof AppError)) {
      Sentry.captureException(error, {
        extra: {
          source: 'usage_endpoint',
          errorType: 'usage_fetch_failed',
          userId: (req as AuthenticatedRequest).user?.userId,
        },
      });
    }
    next(error);
  }
});
