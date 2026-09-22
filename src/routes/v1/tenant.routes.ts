import { Router, Request, Response, NextFunction } from 'express';
import * as tenantController from '../../controllers/tenant.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  CreateTenantSchema,
  UpdateTenantSchema,
  TenantStatusSchema,
  TenantQuerySchema,
} from '../../validators/tenant.validator';
import { AuthenticatedRequest } from '../../types';

const router = Router();

// All tenant routes require authentication
router.use(authenticate);

// ─── Owner-only routes ────────────────────────────────────────────────────────

// GET /api/v1/tenants/stats  (must be before /:id)
router.get(
  '/stats',
  authorize('OWNER'),
  tenantController.getDashboardStats,
);

// GET /api/v1/tenants
router.get(
  '/',
  authorize('OWNER'),
  validate(TenantQuerySchema, 'query'),
  tenantController.listTenants,
);

// POST /api/v1/tenants
router.post(
  '/',
  authorize('OWNER'),
  validate(CreateTenantSchema),
  tenantController.createTenant,
);

// GET /api/v1/tenants/:id
router.get(
  '/:id',
  authorize('OWNER'),
  tenantController.getTenant,
);

// PUT /api/v1/tenants/:id
router.put(
  '/:id',
  authorize('OWNER'),
  validate(UpdateTenantSchema),
  tenantController.updateTenant,
);

// PATCH /api/v1/tenants/:id/status
router.patch(
  '/:id/status',
  authorize('OWNER'),
  validate(TenantStatusSchema),
  tenantController.updateTenantStatus,
);

// ─── Tenant self-service routes ───────────────────────────────────────────────

// GET /api/v1/tenants/me  — tenant views their own profile
router.get(
  '/me/profile',
  authorize('TENANT'),
  (req: Request, res: Response, next: NextFunction) =>
    tenantController.getMyTenantProfile(
      req as AuthenticatedRequest,
      res,
      next,
    ),
);

export default router;
