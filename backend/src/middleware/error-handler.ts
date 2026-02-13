import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import * as Sentry from '@sentry/node';
import { config } from '../config.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error (but never log PHI)
  console.error('Error:', {
    name: err.name,
    ...(err instanceof AppError && { code: err.code, statusCode: err.statusCode }),
    ...(config.NODE_ENV !== 'production' && {
      message: err.message,
      stack: err.stack,
    }),
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'validation_error',
        message: 'Invalid request data',
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  // Known application errors
  if (err instanceof AppError) {
    // Capture 5xx errors to Sentry - these indicate server-side failures
    // 4xx errors are expected client errors and don't need Sentry alerts
    if (err.statusCode >= 500) {
      Sentry.captureException(err, {
        extra: {
          source: 'app_error',
          statusCode: err.statusCode,
          errorCode: err.code,
        },
      });
    }
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // Unknown errors - capture to Sentry for monitoring
  Sentry.captureException(err);

  res.status(500).json({
    success: false,
    error: {
      code: 'internal_error',
      message: 'An unexpected error occurred',
    },
  });
}
