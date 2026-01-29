import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth-service.js';
import { auditService } from '../services/audit-service.js';
import { loginRateLimit, registerRateLimit, refreshRateLimit } from '../middleware/rate-limit.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { AuditAction, type AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/error-handler.js';

export const authRouter: Router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// POST /auth/register
authRouter.post('/register', registerRateLimit, async (req, res, next) => {
  try {
    const { email, password } = registerSchema.parse(req.body);
    const ipAddress = req.ip ?? undefined;
    const userAgent = req.get('user-agent');

    const result = await authService.register(email, password);

    await auditService.log({
      userId: result.user.id,
      action: AuditAction.REGISTER,
      status: 'SUCCESS',
      ipAddress,
      userAgent,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/login
authRouter.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const ipAddress = req.ip ?? undefined;
    const userAgent = req.get('user-agent');

    // Pass context for lockout tracking and audit logging
    const result = await authService.login(email, password, { ipAddress, userAgent });

    if (!result) {
      // Note: Failed attempt is already recorded by authService.login() via lockoutService
      // This audit log captures the high-level event for security monitoring
      await auditService.log({
        userId: null,
        action: AuditAction.LOGIN_FAILED,
        status: 'FAILURE',
        metadata: { email },
        ipAddress,
        userAgent,
      });

      throw new AppError(401, 'invalid_credentials', 'Invalid email or password');
    }

    await auditService.log({
      userId: result.user.id,
      action: AuditAction.LOGIN,
      status: 'SUCCESS',
      ipAddress,
      userAgent,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/refresh
// SECURITY: Rate limited to prevent token enumeration attacks
authRouter.post('/refresh', refreshRateLimit, async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    const result = await authService.refreshTokens(refreshToken);

    if (!result) {
      throw new AppError(401, 'invalid_token', 'Invalid or expired refresh token');
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/logout
authRouter.post('/logout', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const ipAddress = req.ip ?? undefined;
    const userAgent = req.get('user-agent');

    await authService.logout(userId);

    await auditService.log({
      userId,
      action: AuditAction.LOGOUT,
      status: 'SUCCESS',
      ipAddress,
      userAgent,
    });

    res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  } catch (error) {
    next(error);
  }
});
