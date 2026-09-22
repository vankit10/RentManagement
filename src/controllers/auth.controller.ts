import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { sendSuccess } from '../lib/response';
import { AuthenticatedRequest } from '../types';
import { BadRequestError } from '../lib/errors';

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const result = await authService.login(email, password);
    sendSuccess(res, result, 200);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/auth/refresh-token ─────────────────────────────────────────

export async function refreshToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { refreshToken: token } = req.body as { refreshToken: string };
    const result = await authService.refreshTokens(token);
    sendSuccess(res, result, 200);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/auth/logout ─────────────────────────────────────────────────

export async function logout(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { refreshToken: token } = req.body as { refreshToken?: string };
    if (token) {
      await authService.logout(token);
    }
    sendSuccess(res, { message: 'Logged out successfully' }, 200);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/auth/logout-all ────────────────────────────────────────────

export async function logoutAll(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await authService.logoutAll(req.user.id);
    sendSuccess(res, { message: 'All sessions terminated' }, 200);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/auth/me ──────────────────────────────────────────────────────

export async function getMe(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await authService.getMe(req.user.id);
    sendSuccess(res, user, 200);
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/v1/auth/change-password ──────────────────────────────────────

export async function changePassword(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    if (!currentPassword || !newPassword) {
      throw new BadRequestError('currentPassword and newPassword are required');
    }
    await authService.changePassword(req.user.id, currentPassword, newPassword);
    sendSuccess(res, { message: 'Password changed successfully' }, 200);
  } catch (err) {
    next(err);
  }
}
