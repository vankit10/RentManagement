import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { NotFoundError, ConflictError, BadRequestError } from '../lib/errors';
import { parsePagination } from '../lib/response';
import { CreateTenantInput, UpdateTenantInput } from '../validators/tenant.validator';
import { TenantStatus, Prisma } from '@prisma/client';

const ORG_ID = process.env.DEFAULT_ORG_ID!;

// ─── List tenants ─────────────────────────────────────────────────────────────

export async function listTenants(query: Record<string, unknown>, ownerId: string) {
  const { page, limit, skip } = parsePagination(query);
  const search = query.search as string | undefined;
  const status = query.status as TenantStatus | undefined;
  const unitId = query.unitId as string | undefined;

  const where: Prisma.TenantWhereInput = {
    organizationId: ORG_ID,
    ownerId,
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

export async function getTenantById(id: string, ownerId?: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id, organizationId: ORG_ID, ...(ownerId && { ownerId }) },
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

export async function createTenant(data: CreateTenantInput, ownerId: string) {
  const email = data.email?.trim().toLowerCase() || null;
  const phone = data.phone?.trim() || null;

  // An email-only request can link an existing self-registered tenant account.
  if (email) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (existingUser) {
      if (existingUser.role !== 'TENANT') {
        throw new BadRequestError('This email belongs to an owner account, not a tenant');
      }
      if (existingUser.tenant?.ownerId && existingUser.tenant.ownerId !== ownerId) {
        throw new ConflictError('This tenant is already assigned to another owner');
      }

      const tenant = existingUser.tenant
        ? await prisma.tenant.update({
            where: { id: existingUser.tenant.id },
            data: {
              ownerId,
              ...(data.name?.trim() && { name: data.name.trim() }),
              ...(data.unitId !== undefined && { unitId: data.unitId }),
              ...(data.joiningDate && { joiningDate: new Date(data.joiningDate) }),
              ...(data.rentAmount !== undefined && { rentAmount: data.rentAmount }),
              ...(data.dueDay !== undefined && { dueDay: data.dueDay }),
            },
          })
        : await prisma.tenant.create({
            data: {
              organizationId: ORG_ID,
              ownerId,
              userId: existingUser.id,
              name: existingUser.name,
              phone: existingUser.phone,
              email,
            },
          });

      return {
        tenant: await getTenantById(tenant.id, ownerId),
        defaultPasswordAssigned: false,
        usedExistingAccount: true,
      };
    }
  }

  // Check phone uniqueness
  if (phone) {
    const existing = await prisma.tenant.findUnique({ where: { phone } });
    if (existing) throw new ConflictError('A tenant with this phone number already exists');
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
  // Email-created accounts use the agreed default password, even when the
  // owner also supplies a phone number. Phone-only registration keeps the
  // existing phone-number default for backward compatibility.
  const defaultPasswordAssigned = !!email;
  const passwordHash = await bcrypt.hash(defaultPasswordAssigned ? 'Ad123456' : phone!, 12);
  const tenantName = data.name?.trim() || email?.split('@')[0] || 'Tenant';

  const tenant = await prisma.$transaction(async (tx) => {
    // Create user
    const user = await tx.user.create({
      data: {
        organizationId: ORG_ID,
        name: tenantName,
        phone,
        email,
        passwordHash,
        role: 'TENANT',
        status: 'ACTIVE',
      },
    });

    // Create tenant linked to user
    const newTenant = await tx.tenant.create({
      data: {
        organizationId: ORG_ID,
        ownerId,
        userId: user.id,
        name: tenantName,
        phone,
        email,
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

  return {
    tenant: await getTenantById(tenant.id, ownerId),
    defaultPasswordAssigned,
    usedExistingAccount: false,
  };
}

// ─── Update tenant ────────────────────────────────────────────────────────────

export async function updateTenant(id: string, data: UpdateTenantInput, ownerId: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id, organizationId: ORG_ID, ownerId },
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

  return getTenantById(id, ownerId);
}

// ─── Update tenant status ─────────────────────────────────────────────────────

export async function updateTenantStatus(id: string, status: TenantStatus, ownerId: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id, organizationId: ORG_ID, ownerId },
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

  return getTenantById(id, ownerId);
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export async function getDashboardStats(ownerId: string) {
  const [
    totalTenants,
    activeTenants,
    pendingRent,
    overdueRent,
    collectedThisMonth,
  ] = await Promise.all([
    prisma.tenant.count({ where: { organizationId: ORG_ID, ownerId } }),
    prisma.tenant.count({ where: { organizationId: ORG_ID, ownerId, status: 'ACTIVE' } }),
    prisma.rentRecord.count({ where: { status: 'PENDING', tenant: { organizationId: ORG_ID, ownerId } } }),
    prisma.rentRecord.count({ where: { status: 'OVERDUE', tenant: { organizationId: ORG_ID, ownerId } } }),
    prisma.payment.aggregate({
      where: {
        tenant: { organizationId: ORG_ID, ownerId },
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
