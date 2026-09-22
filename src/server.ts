import 'dotenv/config';
import app from './app';
import { logger } from './lib/logger';
import prisma from './lib/prisma';
import { startAllJobs } from './jobs';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

// ─── Validate required env vars ───────────────────────────────────────────────
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'DEFAULT_ORG_ID'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  logger.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

// ─── Start server ─────────────────────────────────────────────────────────────
async function start() {
  try {
    // Test DB connection
    await prisma.$connect();
    logger.info('✅  Database connected');

    const server = app.listen(PORT, () => {
      logger.info(`🚀  Server running on http://localhost:${PORT}`);
      logger.info(`📋  Environment: ${process.env.NODE_ENV}`);
      logger.info(`🔑  API base: http://localhost:${PORT}/api/v1`);
    });

    // Start scheduled jobs
    startAllJobs();

    // ─── Graceful shutdown ────────────────────────────────────────────────────
    const shutdown = async (signal: string) => {
      logger.info(`[${signal}] Shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Database disconnected. Bye! 👋');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled promise rejection:', reason);
    });

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception:', err);
      process.exit(1);
    });

  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
