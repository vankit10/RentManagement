import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { ForbiddenError } from '../lib/errors';
import { AuthenticatedRequest } from '../types';

/**
 * Restrict a route to specific roles.
 * Must be used AFTER the authenticate middleware.
 */
export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      next(new ForbiddenError('Not authenticated'));
      return;
    }
    if (!roles.includes(authReq.user.role)) {
      next(new ForbiddenError(`Access denied. Required role: ${roles.join(' or ')}`));
      return;
    }
    next();
  };
}
