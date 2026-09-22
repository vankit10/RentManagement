import cron from 'node-cron';
import { detectAndMarkOverdue } from '../services/rent.service';
import { logger } from '../lib/logger';

/**
 * Daily at 00:05 — mark PENDING rent records as OVERDUE
 * if their due_date is in the past.
 * Idempotent — safe to run multiple times.
 */
export function startOverdueRentJob(): void {
  cron.schedule('5 0 * * *', async () => {
    logger.info('[Job] overdue-rent: starting');
    try {
      const count = await detectAndMarkOverdue();
      logger.info(`[Job] overdue-rent: marked ${count} record(s) as OVERDUE`);
    } catch (err) {
      logger.error('[Job] overdue-rent: failed', { error: err });
    }
  });
  logger.info('[Job] overdue-rent: scheduled (daily 00:05)');
}
