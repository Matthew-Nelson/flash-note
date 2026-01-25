import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

// Middleware to check subscription status
// Must be used after requireAuth middleware
export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // This middleware expects requireAuth to have run first
    const authenticatedReq = req as AuthenticatedRequest;
    if (!authenticatedReq.user?.userId) {
      res.status(401).json({
        success: false,
        error: { code: 'unauthorized', message: 'Authentication required' },
      });
      return;
    }

    const result = await db.query(
      `SELECT subscription_status, trial_ends_at FROM users WHERE id = $1`,
      [authenticatedReq.user.userId]
    );

    const user = result.rows[0];
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'user_not_found', message: 'User not found' },
      });
      return;
    }

    // Check if in active trial
    if (user.subscription_status === 'trialing') {
      if (new Date() < new Date(user.trial_ends_at)) {
        next();
        return;
      }
      // Trial expired
      res.status(402).json({
        success: false,
        error: {
          code: 'trial_expired',
          message: 'Your trial has ended. Please subscribe to continue.',
        },
      });
      return;
    }

    // Check for active subscription
    if (user.subscription_status === 'active') {
      next();
      return;
    }

    // Not subscribed
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
