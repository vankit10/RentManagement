import { Request, Response, NextFunction } from 'express';
import * as paymentService from '../services/payment.service';
import { sendSuccess, sendPaginated } from '../lib/response';
import { AuthenticatedRequest } from '../types';

export async function listPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { payments, pagination } = await paymentService.listPayments(req.query as Record<string, unknown>);
    sendPaginated(res, payments, pagination);
  } catch (err) { next(err); }
}

export async function getPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payment = await paymentService.getPaymentById(req.params.id);
    sendSuccess(res, payment);
  } catch (err) { next(err); }
}

export async function getMyPayments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenant = await (await import('../services/tenant.service')).getTenantByUserId(req.user.id);
    const result = await paymentService.getPaymentsForTenant(tenant.id, req.query as Record<string, unknown>);
    sendPaginated(res, result.payments, result.pagination);
  } catch (err) { next(err); }
}

export async function recordPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payment = await paymentService.recordPayment(req.body);
    sendSuccess(res, payment, 201);
  } catch (err) { next(err); }
}
