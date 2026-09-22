import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { UnauthorizedError } from '../lib/errors';
import { AuthenticatedRequest } from '../types';

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Token not provided');
    }

    const payload = verifyAccessToken(token);

    (req as AuthenticatedRequest).user = {
      id: payload.sub,
      role: payload.role,
      orgId: payload.orgId,
      email: payload.email,
      phone: payload.phone,
    };

    next();
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      next(err);
      return;
    }
    // JWT errors (expired, invalid)
    const message =
      err instanceof Error && err.name === 'TokenExpiredError'
        ? 'Token has expired. Please log in again.'
        : 'Invalid token. Please log in again.';
    next(new UnauthorizedError(message));
  }
}
