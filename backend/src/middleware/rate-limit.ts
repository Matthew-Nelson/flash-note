import rateLimit from 'express-rate-limit';

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
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
  max: 3, // 3 registrations
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
