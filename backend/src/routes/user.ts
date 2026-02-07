import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { apiRateLimit } from '../middleware/rate-limit.js';
import { findUserById } from '../db/queries/users.js';
import { sanitizeUser } from '../services/auth-service.js';
import { AppError } from '../middleware/error-handler.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const userRouter: Router = Router();

/**
 * GET /user/me
 *
 * Returns the current user's profile data without rotating tokens or creating sessions.
 * Used by clients to poll for state changes (subscription status, email verification)
 * without the overhead of POST /auth/refresh.
 *
 * Requires: valid access token (Bearer auth)
 */
userRouter.get('/me', requireAuth, apiRateLimit, async (req, res, next) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;

    const user = await findUserById(userId);
    if (!user) {
      throw new AppError(404, 'not_found', 'User not found');
    }

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
});
