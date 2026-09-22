import { Request, Response, NextFunction } from 'express';
import * as tenantService from '../services/tenant.service';
import { sendSuccess, sendPaginated } from '../lib/response';
import { AuthenticatedRequest } from '../types';
import { TenantStatus } from '@prisma/client';

// ─── GET /api/v1/tenants ──────────────────────────────────────────────────────

export async function listTenants(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { tenants, pagination } = await tenantService.listTenants(
      req.query as Record<string, unknown>,
    );
    sendPaginated(res, tenants, pagination);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/tenants/stats ────────────────────────────────────────────────

export async function getDashboardStats(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const stats = await tenantService.getDashboardStats();
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/tenants/me ───────────────────────────────────────────────────

export async function getMyTenantProfile(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenant = await tenantService.getTenantByUserId(req.user.id);
    sendSuccess(res, tenant);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/tenants/:id ──────────────────────────────────────────────────

export async function getTenant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenant = await tenantService.getTenantById(req.params.id);
    sendSuccess(res, tenant);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/tenants ─────────────────────────────────────────────────────

export async function createTenant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenant = await tenantService.createTenant(req.body);
    sendSuccess(res, tenant, 201);
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/v1/tenants/:id ──────────────────────────────────────────────────

export async function updateTenant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenant = await tenantService.updateTenant(req.params.id, req.body);
    sendSuccess(res, tenant);
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/v1/tenants/:id/status ────────────────────────────────────────

export async function updateTenantStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { status } = req.body as { status: TenantStatus };
    const tenant = await tenantService.updateTenantStatus(req.params.id, status);
    sendSuccess(res, tenant);
  } catch (err) {
    next(err);
  }
}
