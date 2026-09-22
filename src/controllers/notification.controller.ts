import { Request, Response, NextFunction } from 'express';
import * as notificationService from '../services/notification.service';
import { sendSuccess, sendPaginated } from '../lib/response';
import { AuthenticatedRequest } from '../types';

export async function listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { notifications, pagination } = await notificationService.listNotifications(req.query as Record<string, unknown>);
    sendPaginated(res, notifications, pagination);
  } catch (err) { next(err); }
}

export async function getMyNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenant = await (await import('../services/tenant.service')).getTenantByUserId(req.user.id);
    const result = await notificationService.getNotificationsForTenant(tenant.id, req.query as Record<string, unknown>);
    sendPaginated(res, result.notifications, result.pagination);
  } catch (err) { next(err); }
}

export async function createNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const notification = await notificationService.createNotification(req.body);
    sendSuccess(res, notification, 201);
  } catch (err) { next(err); }
}

export async function broadcastNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { title, message, type } = req.body as { title: string; message: string; type?: string };
    const result = await notificationService.broadcastNotification(title, message, type as never);
    sendSuccess(res, result, 201);
  } catch (err) { next(err); }
}

export async function markRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user.id);
    sendSuccess(res, notification);
  } catch (err) { next(err); }
}

export async function markAllRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenant = await (await import('../services/tenant.service')).getTenantByUserId(req.user.id);
    const result = await notificationService.markAllAsRead(tenant.id);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}
