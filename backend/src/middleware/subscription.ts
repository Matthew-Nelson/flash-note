import { Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function requireActiveSubscription(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await db.query(
      `SELECT subscription_status, trial_ends_at FROM users WHERE id = $1`,
      [req.user.userId]
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
