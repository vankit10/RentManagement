import prisma from '../lib/prisma';

/** Rebuild monthly invoices from charges and actual payments in date order.
 * Each month's closing balance becomes the next month's opening balance.
 */
export async function reconcileTenantBills(tenantId: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, organizationId: process.env.DEFAULT_ORG_ID! },
  });
  if (!tenant) return;
  await prisma.$transaction(async tx => {
    const records = await tx.rentRecord.findMany({
      where: { tenantId, status: { not: 'CANCELLED' } },
      orderBy: { month: 'asc' },
      include: { payments: true },
    });
    const readings = await tx.meterReading.findMany({ where: { tenantId } });
    let openingBalance = 0;
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      const electricity = Number(readings.find(r => r.month === record.month)?.amount ?? 0);
      const total = Number(record.baseAmount) + openingBalance + electricity;
      const paid = record.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const closingBalance = Math.max(0, total - paid);
      const status = closingBalance <= 0.005 ? 'PAID'
        : index < records.length - 1 ? 'CARRIED_FORWARD'
        : record.dueDate < new Date() ? 'OVERDUE' : 'PENDING';
      await tx.rentRecord.update({
        where: { id: record.id },
        data: { amount: total, carriedForwardAmount: openingBalance, status },
      });
      openingBalance = closingBalance;
    }
  });
}
