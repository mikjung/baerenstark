import { PrismaClient } from '@prisma/client';

// Singleton-Pattern für Prisma — verhindert "too many connections" in Dev
// (Next.js HMR würde sonst pro Re-Render einen neuen Client erzeugen).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
