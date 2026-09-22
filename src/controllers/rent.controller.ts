import { Request, Response, NextFunction } from 'express';
import * as rentService from '../services/rent.service';
import { sendSuccess, sendPaginated } from '../lib/response';
import { AuthenticatedRequest } from '../types';

export async function listRentRecords(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { records, pagination } = await rentService.listRentRecords(req.query as Record<string, unknown>);
    sendPaginated(res, records, pagination);
  } catch (err) { next(err); }
}

export async function getRentRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const record = await rentService.getRentRecordById(req.params.id);
    sendSuccess(res, record);
  } catch (err) { next(err); }
}

export async function getMyRentRecords(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenant = await (await import('../services/tenant.service')).getTenantByUserId(req.user.id);
    const result = await rentService.getRentRecordsForTenant(tenant.id, req.query as Record<string, unknown>);
    sendPaginated(res, result.records, result.pagination);
  } catch (err) { next(err); }
}

export async function generateRent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await rentService.generateMonthlyRent(req.body);
    sendSuccess(res, result, 201);
  } catch (err) { next(err); }
}

export async function updateRentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const record = await rentService.updateRentStatus(req.params.id, req.body.status);
    sendSuccess(res, record);
  } catch (err) { next(err); }
}

export async function markOverdue(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const count = await rentService.detectAndMarkOverdue();
    sendSuccess(res, { markedOverdue: count });
  } catch (err) { next(err); }
}
