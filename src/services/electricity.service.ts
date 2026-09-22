import prisma from '../lib/prisma';
import { NotFoundError, ConflictError, BadRequestError } from '../lib/errors';
import { parsePagination } from '../lib/response';
import { Prisma } from '@prisma/client';
import { CreateMeterReadingInput, UpdateElectricityRateInput } from '../validators/electricity.validator';

const ORG_ID = process.env.DEFAULT_ORG_ID!;

// ─── List meter readings ──────────────────────────────────────────────────────

export async function listMeterReadings(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const tenantId = query.tenantId as string | undefined;
  const month = query.month as string | undefined;

  const where: Prisma.MeterReadingWhereInput = {
    tenant: { organizationId: ORG_ID },
    ...(tenantId && { tenantId }),
    ...(month && { month }),
  };

  const [readings, total] = await Promise.all([
    prisma.meterReading.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ month: 'desc' }, { readingDate: 'desc' }],
      include: {
        tenant: { select: { id: true, name: true, phone: true } },
      },
    }),
    prisma.meterReading.count({ where }),
  ]);

  return {
    readings,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ─── Get single reading ───────────────────────────────────────────────────────

export async function getMeterReadingById(id: string) {
  const reading = await prisma.meterReading.findFirst({
    where: { id, tenant: { organizationId: ORG_ID } },
    include: {
      tenant: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!reading) throw new NotFoundError('Meter reading');
  return reading;
}

// ─── Get readings for a tenant ────────────────────────────────────────────────

export async function getReadingsForTenant(
  tenantId: string,
  query: Record<string, unknown> = {},
) {
  const { page, limit, skip } = parsePagination(query);

  const where: Prisma.MeterReadingWhereInput = {
    tenantId,
    tenant: { organizationId: ORG_ID },
  };

  const [readings, total] = await Promise.all([
    prisma.meterReading.findMany({
      where,
      skip,
      take: limit,
      orderBy: { month: 'desc' },
    }),
    prisma.meterReading.count({ where }),
  ]);

  return {
    readings,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ─── Add meter reading ────────────────────────────────────────────────────────

export async function addMeterReading(data: CreateMeterReadingInput) {
  // Validate tenant belongs to org
  const tenant = await prisma.tenant.findFirst({
    where: { id: data.tenantId, organizationId: ORG_ID },
  });
  if (!tenant) throw new NotFoundError('Tenant');

  // Business rule: current >= previous
  if (data.currentReading < data.previousReading) {
    throw new BadRequestError(
      'Current reading cannot be less than previous reading',
    );
  }

  // Duplicate check before hitting DB constraint
  const existing = await prisma.meterReading.findUnique({
    where: {
      tenantId_month: { tenantId: data.tenantId, month: data.month },
    },
  });
  if (existing) {
    throw new ConflictError(
      `A meter reading for ${data.month} already exists for this tenant`,
    );
  }

  const unitsConsumed = data.currentReading - data.previousReading;
  const amount = unitsConsumed * data.rate;

  const reading = await prisma.meterReading.create({
    data: {
      tenantId: data.tenantId,
      month: data.month,
      previousReading: data.previousReading,
      currentReading: data.currentReading,
      unitsConsumed,
      rate: data.rate,
      amount,
      readingDate: new Date(data.readingDate),
    },
    include: {
      tenant: { select: { id: true, name: true } },
    },
  });

  // Create notification for tenant
  await prisma.notification.create({
    data: {
      organizationId: ORG_ID,
      tenantId: data.tenantId,
      title: 'Electricity Bill Updated',
      message: `Your electricity bill for ${data.month}: ${unitsConsumed} units × ₹${data.rate} = ₹${amount.toFixed(2)}`,
      type: 'ELECTRICITY_BILL',
    },
  });

  return reading;
}

// ─── Delete meter reading ─────────────────────────────────────────────────────

export async function deleteMeterReading(id: string) {
  const reading = await prisma.meterReading.findFirst({
    where: { id, tenant: { organizationId: ORG_ID } },
  });
  if (!reading) throw new NotFoundError('Meter reading');
  await prisma.meterReading.delete({ where: { id } });
}

// ─── Get / update electricity rate ───────────────────────────────────────────

export async function getElectricityRate() {
  const setting = await prisma.electricitySetting.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  return setting;
}

export async function updateElectricityRate(data: UpdateElectricityRateInput) {
  const existing = await prisma.electricitySetting.findFirst();
  if (existing) {
    return prisma.electricitySetting.update({
      where: { id: existing.id },
      data: { ratePerUnit: data.ratePerUnit },
    });
  }
  return prisma.electricitySetting.create({
    data: { ratePerUnit: data.ratePerUnit },
  });
}
