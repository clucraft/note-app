import rateLimit from 'express-rate-limit';

// General API rate limit - 100 requests per minute
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limit for login - 5 attempts per 15 minutes
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many login attempts, please try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
});

// Strict limit for registration - 3 per hour per IP
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: 'Too many accounts created, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limit for password reset requests - 3 per hour
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: 'Too many password reset attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limit for AI endpoints - 30 per hour (expensive operations)
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: { error: 'AI request limit reached, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limit for file uploads - 20 per minute
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: 'Too many uploads, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limit for public share access - 10 per minute (prevent token brute forcing)
export const shareAccessLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
