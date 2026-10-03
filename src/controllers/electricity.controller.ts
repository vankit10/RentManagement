import { Request, Response, NextFunction } from 'express';
import * as electricityService from '../services/electricity.service';
import { sendSuccess, sendPaginated } from '../lib/response';
import { AuthenticatedRequest } from '../types';

export async function listReadings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { readings, pagination } = await electricityService.listMeterReadings(req.query as Record<string, unknown>);
    sendPaginated(res, readings, pagination);
  } catch (err) { next(err); }
}

export async function getReading(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reading = await electricityService.getMeterReadingById(req.params.id);
    sendSuccess(res, reading);
  } catch (err) { next(err); }
}

export async function getReadingForTenantMonth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reading = await electricityService.getMeterReadingForTenantMonth(
      req.params.tenantId,
      req.params.month,
    );
    // Keep a missing month a successful lookup: the app needs this to decide
    // whether to show details or prepare a new reading form.
    sendSuccess(res, { reading });
  } catch (err) { next(err); }
}

export async function getMyReadings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenant = await (await import('../services/tenant.service')).getTenantByUserId(req.user.id);
    const result = await electricityService.getReadingsForTenant(tenant.id, req.query as Record<string, unknown>);
    sendPaginated(res, result.readings, result.pagination);
  } catch (err) { next(err); }
}

export async function addReading(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reading = await electricityService.addMeterReading(req.body);
    sendSuccess(res, reading, 201);
  } catch (err) { next(err); }
}

export async function deleteReading(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await electricityService.deleteMeterReading(req.params.id);
    sendSuccess(res, { message: 'Meter reading deleted successfully' });
  } catch (err) { next(err); }
}

export async function getRate(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rate = await electricityService.getElectricityRate();
    sendSuccess(res, rate);
  } catch (err) { next(err); }
}

export async function updateRate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rate = await electricityService.updateElectricityRate(req.body);
    sendSuccess(res, rate);
  } catch (err) { next(err); }
}
