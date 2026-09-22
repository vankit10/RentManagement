import cron from 'node-cron';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

const ORG_ID = process.env.DEFAULT_ORG_ID!;
const REMINDER_DAYS_BEFORE = 3; // send reminder 3 days before due date

/**
 * Daily at 09:00 — notify tenants whose rent is due in N days.
 * Idempotent — checks for existing reminder notification before creating.
 */
export function startRentReminderJob(): void {
  cron.schedule('0 9 * * *', async () => {
    logger.info('[Job] rent-reminder: starting');
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + REMINDER_DAYS_BEFORE);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Find PENDING records due on target date
      const pendingRent = await prisma.rentRecord.findMany({
        where: {
          status: 'PENDING',
          dueDate: { gte: startOfDay, lte: endOfDay },
          tenant: { organizationId: ORG_ID, status: 'ACTIVE' },
        },
        include: {
          tenant: { select: { id: true, name: true } },
        },
      });

      let sent = 0;
      for (const record of pendingRent) {
        // Check if reminder already sent today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingReminder = await prisma.notification.findFirst({
          where: {
            tenantId: record.tenantId,
            type: 'RENT_REMINDER',
            createdAt: { gte: today },
          },
        });

        if (!existingReminder) {
          await prisma.notification.create({
            data: {
              organizationId: ORG_ID,
              tenantId: record.tenantId,
              title: 'Rent Due Soon',
              message: `Your rent of ₹${record.amount} for ${record.month} is due in ${REMINDER_DAYS_BEFORE} days.`,
              type: 'RENT_REMINDER',
            },
          });
          sent++;
        }
      }

      logger.info(`[Job] rent-reminder: sent ${sent} reminder(s)`);
    } catch (err) {
      logger.error('[Job] rent-reminder: failed', { error: err });
    }
  });
  logger.info('[Job] rent-reminder: scheduled (daily 09:00)');
}
