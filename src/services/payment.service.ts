import prisma from '../lib/prisma';
import { NotFoundError, BadRequestError } from '../lib/errors';
import { parsePagination } from '../lib/response';
import { Prisma } from '@prisma/client';
import { CreatePaymentInput } from '../validators/payment.validator';

const ORG_ID = process.env.DEFAULT_ORG_ID!;

// ─── List payments ────────────────────────────────────────────────────────────

export async function listPayments(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const tenantId = query.tenantId as string | undefined;
  const rentRecordId = query.rentRecordId as string | undefined;

  const where: Prisma.PaymentWhereInput = {
    tenant: { organizationId: ORG_ID },
    ...(tenantId && { tenantId }),
    ...(rentRecordId && { rentRecordId }),
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { paymentDate: 'desc' },
      include: {
        tenant: { select: { id: true, name: true, phone: true } },
        rentRecord: { select: { id: true, month: true, amount: true, status: true } },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    payments,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ─── Get payment by ID ────────────────────────────────────────────────────────

export async function getPaymentById(id: string) {
  const payment = await prisma.payment.findFirst({
    where: { id, tenant: { organizationId: ORG_ID } },
    include: {
      tenant: { select: { id: true, name: true, phone: true } },
      rentRecord: true,
    },
  });
  if (!payment) throw new NotFoundError('Payment');
  return payment;
}

// ─── Get payments for a tenant (self-service) ─────────────────────────────────

export async function getPaymentsForTenant(
  tenantId: string,
  query: Record<string, unknown> = {},
) {
  const { page, limit, skip } = parsePagination(query);

  const where: Prisma.PaymentWhereInput = {
    tenantId,
    tenant: { organizationId: ORG_ID },
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { paymentDate: 'desc' },
      include: {
        rentRecord: { select: { id: true, month: true, amount: true } },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    payments,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ─── Record payment ───────────────────────────────────────────────────────────

export async function recordPayment(data: CreatePaymentInput) {
  // Validate tenant belongs to org
  const tenant = await prisma.tenant.findFirst({
    where: { id: data.tenantId, organizationId: ORG_ID },
  });
  if (!tenant) throw new NotFoundError('Tenant');

  // Validate rent record
  const rentRecord = await prisma.rentRecord.findFirst({
    where: { id: data.rentRecordId, tenantId: data.tenantId },
  });
  if (!rentRecord) throw new NotFoundError('Rent record');

  if (rentRecord.status === 'PAID') {
    throw new BadRequestError('This rent record is already marked as paid');
  }
  if (rentRecord.status === 'CANCELLED') {
    throw new BadRequestError('Cannot record payment for a cancelled rent record');
  }

  // Atomic: create payment + update rent status + create notification
  const payment = await prisma.$transaction(async (tx) => {
    const newPayment = await tx.payment.create({
      data: {
        tenantId: data.tenantId,
        rentRecordId: data.rentRecordId,
        amount: data.amount,
        paymentDate: new Date(data.paymentDate),
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber,
        notes: data.notes,
      },
    });

    // Mark rent as paid
    await tx.rentRecord.update({
      where: { id: data.rentRecordId },
      data: { status: 'PAID', paidDate: new Date(data.paymentDate) },
    });

    // Create in-app notification
    await tx.notification.create({
      data: {
        organizationId: ORG_ID,
        tenantId: data.tenantId,
        title: 'Payment Confirmed',
        message: `Your payment of ₹${data.amount} for ${rentRecord.month} has been recorded successfully.`,
        type: 'PAYMENT_CONFIRMATION',
      },
    });

    return newPayment;
  });

  return getPaymentById(payment.id);
}
