import prisma from '../lib/prisma';
import { NotFoundError } from '../lib/errors';
import { parsePagination } from '../lib/response';
import { Prisma } from '@prisma/client';

const ORG_ID = process.env.DEFAULT_ORG_ID!;

// ─── Properties ───────────────────────────────────────────────────────────────

export async function listProperties(query: Record<string, unknown> = {}) {
  const { page, limit, skip } = parsePagination(query);

  const where: Prisma.PropertyWhereInput = { organizationId: ORG_ID };

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { units: true } },
      },
    }),
    prisma.property.count({ where }),
  ]);

  return {
    properties,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getPropertyById(id: string) {
  const property = await prisma.property.findFirst({
    where: { id, organizationId: ORG_ID },
    include: {
      units: { orderBy: { unitNumber: 'asc' } },
    },
  });
  if (!property) throw new NotFoundError('Property');
  return property;
}

export async function createProperty(data: {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}) {
  return prisma.property.create({
    data: { ...data, organizationId: ORG_ID },
  });
}

export async function updateProperty(
  id: string,
  data: {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    status?: 'ACTIVE' | 'INACTIVE';
  },
) {
  const property = await prisma.property.findFirst({
    where: { id, organizationId: ORG_ID },
  });
  if (!property) throw new NotFoundError('Property');

  return prisma.property.update({ where: { id }, data });
}

// ─── Units ────────────────────────────────────────────────────────────────────

export async function listUnits(query: Record<string, unknown> = {}) {
  const { page, limit, skip } = parsePagination(query);
  const propertyId = query.propertyId as string | undefined;
  const status = query.status as string | undefined;

  const where: Prisma.UnitWhereInput = {
    property: { organizationId: ORG_ID },
    ...(propertyId && { propertyId }),
    ...(status && { status: status as Prisma.EnumUnitStatusFilter }),
  };

  const [units, total] = await Promise.all([
    prisma.unit.findMany({
      where,
      skip,
      take: limit,
      orderBy: { unitNumber: 'asc' },
      include: {
        property: { select: { id: true, name: true } },
        tenants: {
          where: { status: 'ACTIVE' },
          select: { id: true, name: true, phone: true },
          take: 1,
        },
      },
    }),
    prisma.unit.count({ where }),
  ]);

  return {
    units,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getUnitById(id: string) {
  const unit = await prisma.unit.findFirst({
    where: { id, property: { organizationId: ORG_ID } },
    include: {
      property: { select: { id: true, name: true } },
      tenants: {
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, phone: true },
      },
    },
  });
  if (!unit) throw new NotFoundError('Unit');
  return unit;
}

export async function createUnit(data: {
  propertyId: string;
  unitNumber: string;
  monthlyRent?: number;
  rentDueDay?: number;
}) {
  const property = await prisma.property.findFirst({
    where: { id: data.propertyId, organizationId: ORG_ID },
  });
  if (!property) throw new NotFoundError('Property');

  return prisma.unit.create({ data });
}

export async function updateUnit(
  id: string,
  data: {
    unitNumber?: string;
    monthlyRent?: number;
    rentDueDay?: number;
    status?: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'INACTIVE';
  },
) {
  const unit = await prisma.unit.findFirst({
    where: { id, property: { organizationId: ORG_ID } },
  });
  if (!unit) throw new NotFoundError('Unit');

  return prisma.unit.update({ where: { id }, data });
}
