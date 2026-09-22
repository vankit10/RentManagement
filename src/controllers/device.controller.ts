import { Response, NextFunction } from 'express';
import * as deviceService from '../services/device.service';
import { sendSuccess } from '../lib/response';
import { AuthenticatedRequest } from '../types';

export async function registerToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, platform, appVersion } = req.body as {
      token: string;
      platform: 'IOS' | 'ANDROID';
      appVersion?: string;
    };
    const result = await deviceService.registerToken(req.user.id, token, platform, appVersion);
    sendSuccess(res, result, 201);
  } catch (err) { next(err); }
}

export async function removeToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.body as { token: string };
    await deviceService.removeToken(token, req.user.id);
    sendSuccess(res, { message: 'Device token removed' });
  } catch (err) { next(err); }
}
