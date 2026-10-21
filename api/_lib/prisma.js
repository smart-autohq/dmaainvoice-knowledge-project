import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Resilient database query execution for serverless PostgreSQL (Neon).
 * Automatically handles transient connection closures / compute wakeups.
 */
export async function withPrismaRetry(operation, maxRetries = 2) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const isConnectionError =
        err.message?.includes('Closed') ||
        err.message?.includes('ConnectionReset') ||
        err.message?.includes('connection') ||
        err.message?.includes('10054') ||
        err.code === 'P1001' ||
        err.code === 'P1002';

      if (isConnectionError && attempt < maxRetries) {
        console.warn(`[Prisma Database Reconnect]: Connection reset by remote host. Reconnecting (attempt ${attempt}/${maxRetries})...`);
        try {
          await prisma.$disconnect();
          await prisma.$connect();
        } catch (reconnectErr) {
          // ignore reconnect error to allow retry
        }
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export default prisma;
