import { Request, Response, NextFunction } from 'express';
import * as propertyService from '../services/property.service';
import { sendSuccess, sendPaginated } from '../lib/response';

export async function listProperties(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { properties, pagination } = await propertyService.listProperties(req.query as Record<string, unknown>);
    sendPaginated(res, properties, pagination);
  } catch (err) { next(err); }
}

export async function getProperty(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const property = await propertyService.getPropertyById(req.params.id);
    sendSuccess(res, property);
  } catch (err) { next(err); }
}

export async function createProperty(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const property = await propertyService.createProperty(req.body);
    sendSuccess(res, property, 201);
  } catch (err) { next(err); }
}

export async function updateProperty(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const property = await propertyService.updateProperty(req.params.id, req.body);
    sendSuccess(res, property);
  } catch (err) { next(err); }
}

export async function listUnits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { units, pagination } = await propertyService.listUnits(req.query as Record<string, unknown>);
    sendPaginated(res, units, pagination);
  } catch (err) { next(err); }
}

export async function getUnit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const unit = await propertyService.getUnitById(req.params.id);
    sendSuccess(res, unit);
  } catch (err) { next(err); }
}

export async function createUnit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const unit = await propertyService.createUnit(req.body);
    sendSuccess(res, unit, 201);
  } catch (err) { next(err); }
}

export async function updateUnit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const unit = await propertyService.updateUnit(req.params.id, req.body);
    sendSuccess(res, unit);
  } catch (err) { next(err); }
}
