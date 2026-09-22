import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { NotFoundError, ConflictError, BadRequestError } from '../lib/errors';
import { parsePagination } from '../lib/response';
import { CreateTenantInput, UpdateTenantInput } from '../validators/tenant.validator';
import { TenantStatus, Prisma } from '@prisma/client';

const ORG_ID = process.env.DEFAULT_ORG_ID!;

// ─── List tenants ─────────────────────────────────────────────────────────────

export async function listTenants(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const search = query.search as string | undefined;
  const status = query.status as TenantStatus | undefined;
  const unitId = query.unitId as string | undefined;

  const where: Prisma.TenantWhereInput = {
    organizationId: ORG_ID,
    ...(status && { status }),
    ...(unitId && { unitId }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        unit: { select: { id: true, unitNumber: true } },
      },
    }),
    prisma.tenant.count({ where }),
  ]);

  return {
    tenants,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ─── Get single tenant ────────────────────────────────────────────────────────

export async function getTenantById(id: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id, organizationId: ORG_ID },
    include: {
      unit: {
        include: {
          property: { select: { id: true, name: true } },
        },
      },
      user: {
        select: { id: true, email: true, lastLoginAt: true, status: true },
      },
    },
  });

  if (!tenant) throw new NotFoundError('Tenant');
  return tenant;
}

// ─── Get tenant by authenticated user ID ─────────────────────────────────────

export async function getTenantByUserId(userId: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { userId, organizationId: ORG_ID },
    include: {
      unit: { include: { property: { select: { id: true, name: true } } } },
    },
  });

  if (!tenant) throw new NotFoundError('Tenant');
  return tenant;
}

// ─── Create tenant ────────────────────────────────────────────────────────────

export async function createTenant(data: CreateTenantInput) {
  // Check phone uniqueness
  const existing = await prisma.tenant.findUnique({
    where: { phone: data.phone },
  });
  if (existing) {
    throw new ConflictError('A tenant with this phone number already exists');
  }

  // If unitId provided, check unit is available
  if (data.unitId) {
    const unit = await prisma.unit.findUnique({ where: { id: data.unitId } });
    if (!unit) throw new NotFoundError('Unit');
    if (unit.status === 'OCCUPIED') {
      throw new BadRequestError('This unit is already occupied');
    }
  }

  // Create user account for tenant (password = phone number by default)
  const passwordHash = await bcrypt.hash(data.phone, 12);

  const tenant = await prisma.$transaction(async (tx) => {
    // Create user
    const user = await tx.user.create({
      data: {
        organizationId: ORG_ID,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        passwordHash,
        role: 'TENANT',
        status: 'ACTIVE',
      },
    });

    // Create tenant linked to user
    const newTenant = await tx.tenant.create({
      data: {
        organizationId: ORG_ID,
        userId: user.id,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        unitId: data.unitId ?? null,
        joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
        rentAmount: data.rentAmount ?? null,
        dueDay: data.dueDay ?? null,
        status: 'ACTIVE',
      },
    });

    // Mark unit as OCCUPIED
    if (data.unitId) {
      await tx.unit.update({
        where: { id: data.unitId },
        data: { status: 'OCCUPIED' },
      });
    }

    return newTenant;
  });

  return getTenantById(tenant.id);
}

// ─── Update tenant ────────────────────────────────────────────────────────────

export async function updateTenant(id: string, data: UpdateTenantInput) {
  const tenant = await prisma.tenant.findFirst({
    where: { id, organizationId: ORG_ID },
  });
  if (!tenant) throw new NotFoundError('Tenant');

  // If changing unit, validate new unit is available
  if (data.unitId !== undefined && data.unitId !== tenant.unitId) {
    if (data.unitId) {
      const unit = await prisma.unit.findUnique({ where: { id: data.unitId } });
      if (!unit) throw new NotFoundError('Unit');
      if (unit.status === 'OCCUPIED') {
        throw new BadRequestError('This unit is already occupied');
      }
    }

    await prisma.$transaction(async (tx) => {
      // Free old unit
      if (tenant.unitId) {
        await tx.unit.update({
          where: { id: tenant.unitId },
          data: { status: 'AVAILABLE' },
        });
      }
      // Occupy new unit
      if (data.unitId) {
        await tx.unit.update({
          where: { id: data.unitId },
          data: { status: 'OCCUPIED' },
        });
      }
    });
  }

  await prisma.tenant.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.unitId !== undefined && { unitId: data.unitId }),
      ...(data.joiningDate && { joiningDate: new Date(data.joiningDate) }),
      ...(data.rentAmount !== undefined && { rentAmount: data.rentAmount }),
      ...(data.dueDay !== undefined && { dueDay: data.dueDay }),
    },
  });

  // Sync name to user profile if changed
  if (data.name && tenant.userId) {
    await prisma.user.update({
      where: { id: tenant.userId },
      data: { name: data.name },
    });
  }

  return getTenantById(id);
}

// ─── Update tenant status ─────────────────────────────────────────────────────

export async function updateTenantStatus(id: string, status: TenantStatus) {
  const tenant = await prisma.tenant.findFirst({
    where: { id, organizationId: ORG_ID },
  });
  if (!tenant) throw new NotFoundError('Tenant');

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id }, data: { status } });

    // Free unit when deactivating
    if (status === 'INACTIVE' && tenant.unitId) {
      await tx.unit.update({
        where: { id: tenant.unitId },
        data: { status: 'AVAILABLE' },
      });
    }

    // Disable user account
    if (tenant.userId) {
      await tx.user.update({
        where: { id: tenant.userId },
        data: { status: status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE' },
      });
    }
  });

  return getTenantById(id);
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const [
    totalTenants,
    activeTenants,
    pendingRent,
    overdueRent,
    collectedThisMonth,
  ] = await Promise.all([
    prisma.tenant.count({ where: { organizationId: ORG_ID } }),
    prisma.tenant.count({ where: { organizationId: ORG_ID, status: 'ACTIVE' } }),
    prisma.rentRecord.count({ where: { status: 'PENDING', tenant: { organizationId: ORG_ID } } }),
    prisma.rentRecord.count({ where: { status: 'OVERDUE', tenant: { organizationId: ORG_ID } } }),
    prisma.payment.aggregate({
      where: {
        tenant: { organizationId: ORG_ID },
        paymentDate: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalTenants,
    activeTenants,
    pendingRent,
    overdueRent,
    collectedThisMonth: collectedThisMonth._sum.amount ?? 0,
  };
}
