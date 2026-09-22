import { Router, Request, Response, NextFunction } from 'express';
import * as authController from '../../controllers/auth.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { authLimiter } from '../../middleware/rateLimit.middleware';
import {
  LoginSchema,
  RefreshTokenSchema,
  ChangePasswordSchema,
} from '../../validators/auth.validator';
import { AuthenticatedRequest } from '../../types';

const router = Router();

// ─── Public routes ────────────────────────────────────────────────────────────

// POST /api/v1/auth/login
router.post(
  '/login',
  authLimiter,
  validate(LoginSchema),
  authController.login,
);

// POST /api/v1/auth/refresh-token
router.post(
  '/refresh-token',
  validate(RefreshTokenSchema),
  authController.refreshToken,
);

// POST /api/v1/auth/logout  (soft — no auth required, just deletes the token)
router.post('/logout', authController.logout);

// ─── Protected routes ─────────────────────────────────────────────────────────

// GET /api/v1/auth/me
router.get(
  '/me',
  authenticate,
  (req: Request, res: Response, next: NextFunction) =>
    authController.getMe(req as AuthenticatedRequest, res, next),
);

// POST /api/v1/auth/logout-all
router.post(
  '/logout-all',
  authenticate,
  (req: Request, res: Response, next: NextFunction) =>
    authController.logoutAll(req as AuthenticatedRequest, res, next),
);

// PATCH /api/v1/auth/change-password
router.patch(
  '/change-password',
  authenticate,
  validate(ChangePasswordSchema),
  (req: Request, res: Response, next: NextFunction) =>
    authController.changePassword(req as AuthenticatedRequest, res, next),
);

export default router;
