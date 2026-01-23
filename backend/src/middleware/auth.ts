import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { TokenPayload, AuthenticatedRequest } from '../types/index.js';

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'missing_token', message: 'Authorization header required' },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as TokenPayload;
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: { code: 'invalid_token', message: 'Invalid or expired token' },
    });
  }
}
