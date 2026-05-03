/* eslint-disable */
import { PrismaClient } from '@prisma/client';

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? 'file:./dev.db';

  if (url.startsWith('libsql://') || url.startsWith('libsqls://')) {
    const { createClient } = require('@libsql/client');
    const { PrismaLibSql } = require('@prisma/adapter-libsql');

    const parsed = new URL(url);
    const authToken = parsed.searchParams.get('authToken') ?? undefined;
    parsed.searchParams.delete('authToken');

    const libsql = createClient({ url: parsed.toString(), authToken });
    const adapter = new PrismaLibSql(libsql);
    return new PrismaClient({ adapter });
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
