import prisma from '../lib/prisma';
import { NotFoundError, ConflictError } from '../lib/errors';
import { parsePagination } from '../lib/response';
import { RentStatus, Prisma } from '@prisma/client';
import { GenerateRentInput } from '../validators/rent.validator';

const ORG_ID = process.env.DEFAULT_ORG_ID!;

// ─── Current month key helper ─────────────────────────────────────────────────

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function buildDueDate(month: string, dueDay: number): Date {
  const [year, mon] = month.split('-').map(Number);
  return new Date(year, mon - 1, dueDay);
}

// ─── List rent records ────────────────────────────────────────────────────────

export async function listRentRecords(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const tenantId = query.tenantId as string | undefined;
  const status = query.status as RentStatus | undefined;
  const month = query.month as string | undefined;

  const where: Prisma.RentRecordWhereInput = {
    tenant: { organizationId: ORG_ID },
    ...(tenantId && { tenantId }),
    ...(status && { status }),
    ...(month && { month }),
  };

  const [records, total] = await Promise.all([
    prisma.rentRecord.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ month: 'desc' }, { createdAt: 'desc' }],
      include: {
        tenant: { select: { id: true, name: true, phone: true } },
        payments: { select: { id: true, amount: true, paymentDate: true } },
      },
    }),
    prisma.rentRecord.count({ where }),
  ]);

  return {
    records,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ─── Get single rent record ───────────────────────────────────────────────────

export async function getRentRecordById(id: string) {
  const record = await prisma.rentRecord.findFirst({
    where: { id, tenant: { organizationId: ORG_ID } },
    include: {
      tenant: { select: { id: true, name: true, phone: true } },
      payments: true,
    },
  });
  if (!record) throw new NotFoundError('Rent record');
  return record;
}

// ─── Get rent records for a specific tenant ───────────────────────────────────

export async function getRentRecordsForTenant(
  tenantId: string,
  query: Record<string, unknown> = {},
) {
  const { page, limit, skip } = parsePagination(query);
  const status = query.status as RentStatus | undefined;

  const where: Prisma.RentRecordWhereInput = {
    tenantId,
    tenant: { organizationId: ORG_ID },
    ...(status && { status }),
  };

  const [records, total] = await Promise.all([
    prisma.rentRecord.findMany({
      where,
      skip,
      take: limit,
      orderBy: { month: 'desc' },
      include: {
        payments: { select: { id: true, amount: true, paymentDate: true, paymentMethod: true } },
      },
    }),
    prisma.rentRecord.count({ where }),
  ]);

  return {
    records,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ─── Generate monthly rent records ────────────────────────────────────────────

export async function generateMonthlyRent(input: GenerateRentInput) {
  const month = input.month ?? currentMonthKey();

  // Get all active tenants with rent configured
  const tenants = await prisma.tenant.findMany({
    where: {
      organizationId: ORG_ID,
      status: 'ACTIVE',
      rentAmount: { not: null },
      dueDay: { not: null },
    },
  });

  if (tenants.length === 0) {
    return { created: 0, skipped: 0, month };
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  await Promise.all(
    tenants.map(async (tenant) => {
      try {
        // Check if already exists
        const existing = await prisma.rentRecord.findUnique({
          where: { tenantId_month: { tenantId: tenant.id, month } },
        });

        if (existing) {
          skipped++;
          return;
        }

        const dueDate = buildDueDate(month, tenant.dueDay!);

        await prisma.rentRecord.create({
          data: {
            tenantId: tenant.id,
            month,
            amount: tenant.rentAmount!,
            dueDate,
            status: 'PENDING',
          },
        });

        created++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Tenant ${tenant.id}: ${msg}`);
      }
    }),
  );

  if (errors.length > 0) {
    throw new Error(
      `${created} record(s) created, ${errors.length} failed: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}`,
    );
  }

  return { created, skipped, month };
}

// ─── Update rent status ───────────────────────────────────────────────────────

export async function updateRentStatus(id: string, status: RentStatus) {
  const record = await prisma.rentRecord.findFirst({
    where: { id, tenant: { organizationId: ORG_ID } },
  });
  if (!record) throw new NotFoundError('Rent record');

  return prisma.rentRecord.update({
    where: { id },
    data: {
      status,
      ...(status === 'PAID' && !record.paidDate && { paidDate: new Date() }),
    },
    include: {
      tenant: { select: { id: true, name: true, phone: true } },
    },
  });
}

// ─── Detect and mark overdue ──────────────────────────────────────────────────

export async function detectAndMarkOverdue(): Promise<number> {
  const result = await prisma.rentRecord.updateMany({
    where: {
      status: 'PENDING',
      dueDate: { lt: new Date() },
      tenant: { organizationId: ORG_ID },
    },
    data: { status: 'OVERDUE' },
  });
  return result.count;
}
