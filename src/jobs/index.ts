import { startOverdueRentJob } from './overdue-rent.job';
import { startMonthlyRentJob } from './monthly-rent.job';
import { startCleanupJob } from './cleanup.job';
import { startRentReminderJob } from './rent-reminder.job';
import { logger } from '../lib/logger';

export function startAllJobs(): void {
  if (process.env.NODE_ENV === 'test') {
    logger.info('[Jobs] Skipping scheduled jobs in test environment');
    return;
  }
  logger.info('[Jobs] Starting all scheduled jobs...');
  startOverdueRentJob();
  startMonthlyRentJob();
  startCleanupJob();
  startRentReminderJob();
  logger.info('[Jobs] All scheduled jobs started');
}
