import rateLimit from 'express-rate-limit';
import { sendError } from '../lib/response';
import { Request, Response } from 'express';

// ─── Generic API rate limit ───────────────────────────────────────────────────

export const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    sendError(
      res,
      429,
      'RATE_LIMIT_EXCEEDED',
      'Too many requests. Please wait and try again.',
    );
  },
});

// ─── Strict auth rate limit ───────────────────────────────────────────────────

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    sendError(
      res,
      429,
      'AUTH_RATE_LIMIT_EXCEEDED',
      'Too many login attempts. Please wait 15 minutes.',
    );
  },
});

// ─── OTP rate limit ───────────────────────────────────────────────────────────

export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.OTP_RATE_LIMIT_MAX ?? '5', 10),
  keyGenerator: (req: Request) =>
    (req.body?.phone as string) ?? req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    sendError(
      res,
      429,
      'OTP_RATE_LIMIT_EXCEEDED',
      'Too many OTP requests. Please wait before requesting another.',
    );
  },
});
