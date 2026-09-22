import { UserRole } from '@prisma/client';
import { Request } from 'express';

// ─── Authenticated request ────────────────────────────────────────────────────

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: UserRole;
    orgId: string;
    email?: string;
    phone?: string;
  };
}

// ─── Query params ─────────────────────────────────────────────────────────────

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface TenantQuery extends PaginationQuery {
  search?: string;
  status?: string;
  propertyId?: string;
  unitId?: string;
}

export interface RentQuery extends PaginationQuery {
  tenantId?: string;
  status?: string;
  month?: string;
}

export interface PaymentQuery extends PaginationQuery {
  tenantId?: string;
  rentRecordId?: string;
}

export interface ElectricityQuery extends PaginationQuery {
  tenantId?: string;
  month?: string;
}

export interface NotificationQuery extends PaginationQuery {
  tenantId?: string;
  isRead?: string;
  type?: string;
}
