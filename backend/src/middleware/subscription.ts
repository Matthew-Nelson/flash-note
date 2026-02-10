import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import { auditService } from '../services/audit-service.js';
import { AuditAction, type AuthenticatedRequest } from '../types/index.js';
import type { UserSubscriptionRow, OrgSubscriptionRow } from '../types/database.js';
import { getRequestMetadata, safeAuditLog } from '../utils/request-utils.js';

// Middleware to check subscription status
// Must be used after requireAuth middleware
export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { ipAddress, userAgent } = getRequestMetadata(req);

  try {
    // This middleware expects requireAuth to have run first
    const authenticatedReq = req as AuthenticatedRequest;
    if (!authenticatedReq.user?.userId) {
      safeAuditLog(
        auditService.log({
          userId: null,
          action: AuditAction.ACCESS_DENIED,
          status: 'FAILURE',
          metadata: { reason: 'unauthorized', path: req.path },
          ipAddress,
          userAgent,
        }),
        'subscription:unauthorized'
      );
      res.status(401).json({
        success: false,
        error: { code: 'unauthorized', message: 'Authentication required' },
      });
      return;
    }

    const userId = authenticatedReq.user.userId;

    const result = await db.query<UserSubscriptionRow>(
      `SELECT subscription_status, trial_ends_at, organization_id FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      safeAuditLog(
        auditService.log({
          userId,
          action: AuditAction.ACCESS_DENIED,
          status: 'FAILURE',
          metadata: { reason: 'user_not_found', path: req.path },
          ipAddress,
          userAgent,
        }),
        'subscription:user_not_found'
      );
      res.status(401).json({
        success: false,
        error: { code: 'user_not_found', message: 'User not found' },
      });
      return;
    }

    const user = result.rows[0]!;

    // 1. Individual trialing + valid → allow
    if (user.subscription_status === 'trialing' && user.trial_ends_at && new Date() < user.trial_ends_at) {
      next();
      return;
    }

    // 2. Individual active → allow
    if (user.subscription_status === 'active') {
      next();
      return;
    }

    // 3. Individual check failed — try org fallback before returning 402
    if (user.organization_id) {
      const orgResult = await db.query<OrgSubscriptionRow>(
        `SELECT o.subscription_status, o.trial_ends_at
         FROM organizations o
         JOIN organization_members om ON om.organization_id = o.id
         WHERE o.id = $1 AND om.user_id = $2 AND om.removed_at IS NULL`,
        [user.organization_id, userId]
      );

      if (orgResult.rows.length > 0) {
        const org = orgResult.rows[0]!;
        if (org.subscription_status === 'active') {
          next();
          return;
        }
        if (org.subscription_status === 'trialing' && org.trial_ends_at && new Date() < org.trial_ends_at) {
          next();
          return;
        }
        // Org exists but subscription lapsed
        safeAuditLog(
          auditService.log({
            userId,
            action: AuditAction.ACCESS_DENIED,
            status: 'FAILURE',
            metadata: { reason: 'clinic_subscription_expired', path: req.path },
            ipAddress,
            userAgent,
          }),
          'subscription:clinic_subscription_expired'
        );
        res.status(402).json({
          success: false,
          error: {
            code: 'clinic_subscription_expired',
            message: "Your clinic's subscription has ended. Subscribe individually or contact your clinic administrator.",
          },
        });
        return;
      }
    }

    // 4. Both individual and org checks failed — return original individual error
    if (user.subscription_status === 'trialing') {
      // Trial existed but expired
      safeAuditLog(
        auditService.log({
          userId,
          action: AuditAction.ACCESS_DENIED,
          status: 'FAILURE',
          metadata: { reason: 'trial_expired', path: req.path },
          ipAddress,
          userAgent,
        }),
        'subscription:trial_expired'
      );
      res.status(402).json({
        success: false,
        error: {
          code: 'trial_expired',
          message: 'Your trial has ended. Please subscribe to continue.',
        },
      });
      return;
    }

    // No active subscription at all
    safeAuditLog(
      auditService.log({
        userId,
        action: AuditAction.ACCESS_DENIED,
        status: 'FAILURE',
        metadata: { reason: 'subscription_required', subscriptionStatus: user.subscription_status, path: req.path },
        ipAddress,
        userAgent,
      }),
      'subscription:subscription_required'
    );
    res.status(402).json({
      success: false,
      error: {
        code: 'subscription_required',
        message: 'Please subscribe to use FlashNote.',
      },
    });
  } catch (error) {
    next(error);
  }
}
