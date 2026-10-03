import prisma from '../lib/prisma';
import { NotFoundError, BadRequestError } from '../lib/errors';
import { parsePagination } from '../lib/response';
import { Prisma, RentStatus } from '@prisma/client';
import { CreatePaymentInput } from '../validators/payment.validator';
import { reconcileTenantBills } from './billing.service';

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

  await reconcileTenantBills(data.tenantId);

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
  // Historical invoices remain payable. Reconciliation after this payment
  // reduces every later month's opening balance by the amount received.

  const amountAlreadyPaid = await prisma.payment.aggregate({
    where: { rentRecordId: data.rentRecordId },
    _sum: { amount: true },
  });
  const remainingBalance = Number(rentRecord.amount) - Number(amountAlreadyPaid._sum.amount ?? 0);
  if (data.amount > remainingBalance) {
    throw new BadRequestError(`Payment exceeds the remaining balance of ₹${remainingBalance.toFixed(2)}`);
  }

  // Atomic: record the payment and only mark the invoice paid when its full
  // balance has actually been received.
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

    const newRemainingBalance = remainingBalance - data.amount;
    const status: RentStatus = newRemainingBalance <= 0.005 ? 'PAID' : (rentRecord.status === 'OVERDUE' ? 'OVERDUE' : 'PENDING');

    await tx.rentRecord.update({
      where: { id: data.rentRecordId },
      data: {
        status,
        ...(status === 'PAID' && { paidDate: new Date(data.paymentDate) }),
      },
    });

    // Create in-app notification
    await tx.notification.create({
      data: {
        organizationId: ORG_ID,
        tenantId: data.tenantId,
        title: 'Payment Confirmed',
        message: status === 'PAID'
          ? `Your rent for ${rentRecord.month} has been paid in full.`
          : `Your payment of ₹${data.amount} for ${rentRecord.month} has been recorded. Remaining balance: ₹${newRemainingBalance.toFixed(2)}.`,
        type: 'PAYMENT_CONFIRMATION',
      },
    });

    return newPayment;
  });

  await reconcileTenantBills(data.tenantId);
  return getPaymentById(payment.id);
}
