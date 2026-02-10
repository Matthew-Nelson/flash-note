import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100 : 5, // 5 attempts in prod, 100 in dev
  message: {
    success: false,
    error: {
      code: 'too_many_attempts',
      message: 'Too many login attempts. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 100 : 3, // 3 registrations in prod, 100 in dev
  message: {
    success: false,
    error: {
      code: 'too_many_attempts',
      message: 'Too many registration attempts. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests
  message: {
    success: false,
    error: {
      code: 'rate_limit_exceeded',
      message: 'Too many requests. Please slow down.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generateRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 generations
  message: {
    success: false,
    error: {
      code: 'rate_limit_exceeded',
      message: 'Too many generation requests. Please slow down.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: Rate limit for refresh token endpoint to prevent enumeration attacks
export const refreshRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 refresh attempts per window
  message: {
    success: false,
    error: {
      code: 'too_many_attempts',
      message: 'Too many refresh attempts. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: Rate limit for email verification resend (HIGH-007)
// Prevents abuse of email sending while allowing legitimate resends
export const verificationResendRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 100 : 3, // 3 resend requests per hour in prod, 100 in dev
  message: {
    success: false,
    error: {
      code: 'too_many_attempts',
      message: 'Too many verification email requests. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: Rate limit for password reset requests (HIGH-001)
// Prevents email enumeration and abuse of password reset emails
export const passwordResetRequestRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 100 : 3, // 3 reset requests per hour per IP in prod, 100 in dev
  message: {
    success: false,
    error: {
      code: 'too_many_attempts',
      message: 'Too many password reset requests. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: Rate limit for password reset completion (HIGH-001)
// Prevents brute force attempts on reset tokens
export const passwordResetCompleteRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100 : 5, // 5 attempts per 15 minutes per IP in prod, 100 in dev
  message: {
    success: false,
    error: {
      code: 'too_many_attempts',
      message: 'Too many password reset attempts. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: Rate limit for invite code validation endpoint
// Prevents brute-force enumeration of valid codes
export const inviteCodeValidateRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDev ? 100 : 10, // 10 validation attempts per minute per IP in prod, 100 in dev
  message: {
    success: false,
    error: {
      code: 'rate_limit_exceeded',
      message: 'Too many validation attempts. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: Rate limit for email verification token submission
// Defense-in-depth against token brute force (tokens have 256-bit entropy,
// but rate limiting adds another layer of protection)
export const verificationCompleteRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100 : 10, // 10 attempts per 15 minutes per IP in prod, 100 in dev
  message: {
    success: false,
    error: {
      code: 'too_many_attempts',
      message: 'Too many verification attempts. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
