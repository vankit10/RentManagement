import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors';
import { sendError } from '../lib/response';
import { logger } from '../lib/logger';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // ── Known operational errors ───────────────────────────────────────────────
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`[AppError] ${err.code}: ${err.message}`, {
        stack: err.stack,
      });
    }
    sendError(res, err.statusCode, err.code, err.message);
    return;
  }

  // ── Prisma errors ──────────────────────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.warn(`[Prisma] ${err.code}: ${err.message}`);

    switch (err.code) {
      case 'P2002':
        sendError(
          res,
          409,
          'DUPLICATE_ENTRY',
          'A record with this value already exists.',
        );
        return;
      case 'P2025':
        sendError(res, 404, 'NOT_FOUND', 'Record not found.');
        return;
      case 'P2003':
        sendError(
          res,
          400,
          'FOREIGN_KEY_VIOLATION',
          'Referenced record does not exist.',
        );
        return;
      default:
        sendError(
          res,
          500,
          'DATABASE_ERROR',
          'A database error occurred. Please try again.',
        );
        return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.warn('[Prisma] Validation error:', err.message);
    sendError(res, 400, 'DATABASE_VALIDATION_ERROR', 'Invalid data provided.');
    return;
  }

  // ── JWT errors ─────────────────────────────────────────────────────────────
  if (err instanceof Error) {
    if (err.name === 'JsonWebTokenError') {
      sendError(res, 401, 'INVALID_TOKEN', 'Invalid token.');
      return;
    }
    if (err.name === 'TokenExpiredError') {
      sendError(res, 401, 'TOKEN_EXPIRED', 'Token has expired.');
      return;
    }
  }

  // ── Unknown errors ─────────────────────────────────────────────────────────
  logger.error('[Unhandled Error]', {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  sendError(
    res,
    500,
    'INTERNAL_ERROR',
    'An unexpected error occurred. Please try again.',
  );
}

// ─── 404 handler ──────────────────────────────────────────────────────────────

export function notFoundHandler(req: Request, res: Response): void {
  sendError(
    res,
    404,
    'ROUTE_NOT_FOUND',
    `Route ${req.method} ${req.originalUrl} not found.`,
  );
}
