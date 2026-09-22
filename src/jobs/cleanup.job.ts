import cron from 'node-cron';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

/**
 * Daily at 01:00 — clean up expired refresh tokens.
 */
export function startCleanupJob(): void {
  cron.schedule('0 1 * * *', async () => {
    logger.info('[Job] cleanup: starting');
    try {
      const { count } = await prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      logger.info(`[Job] cleanup: deleted ${count} expired refresh token(s)`);
    } catch (err) {
      logger.error('[Job] cleanup: failed', { error: err });
    }
  });
  logger.info('[Job] cleanup: scheduled (daily 01:00)');
}
