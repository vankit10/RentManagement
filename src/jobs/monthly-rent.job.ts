import cron from 'node-cron';
import { generateMonthlyRent } from '../services/rent.service';
import { logger } from '../lib/logger';

/**
 * Monthly on the 1st at 00:10 — generate rent records for all active tenants.
 * Idempotent — skips tenants that already have a record for the current month.
 */
export function startMonthlyRentJob(): void {
  cron.schedule('10 0 1 * *', async () => {
    logger.info('[Job] monthly-rent: starting');
    try {
      const result = await generateMonthlyRent({});
      logger.info(
        `[Job] monthly-rent: created=${result.created} skipped=${result.skipped} month=${result.month}`,
      );
    } catch (err) {
      logger.error('[Job] monthly-rent: failed', { error: err });
    }
  });
  logger.info('[Job] monthly-rent: scheduled (1st of month 00:10)');
}
