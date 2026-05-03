/* eslint-disable */
import { PrismaClient } from '@prisma/client';

/**
 * Erstellt den PrismaClient.
 *
 * - SQLite-Datei (`file:...`)  → nativer Client (lokal, dev.db).
 * - Turso (`libsql://` / `libsqls://` / `wss://` / `https://` mit `authToken`)
 *   → libSQL-Driver-Adapter (`@prisma/adapter-libsql`).
 *
 * Wichtig:
 *   • Die Versionen `@prisma/client@5.22.0`, `@prisma/adapter-libsql@5.22.0`
 *     und `@libsql/client@0.8.x` MÜSSEN gemeinsam aktualisiert werden.
 *     Adapter-7.x gehört zu Prisma 7.x und exportiert eine andere Klasse
 *     (Adapter-Factory), was zu `Cannot read properties of undefined
 *     (reading 'bind')` während `next build` führt.
 *   • Die korrekte Klasse aus dem 5.x-Adapter heißt `PrismaLibSQL`
 *     (komplett groß) — NICHT `PrismaLibSql`.
 */
function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? 'file:./dev.db';
  const isLibsql =
    url.startsWith('libsql://') ||
    url.startsWith('libsqls://') ||
    // Turso unterstützt zusätzlich wss:// und https:// als Transport.
    url.startsWith('wss://') ||
    url.startsWith('https://');

  if (isLibsql) {
    // Lazy require — verhindert, dass Next.js beim "Collecting page data"
    // den nativen libSQL-Client lädt, falls eine Route aus Versehen statisch
    // ausgewertet wird.
    const { createClient } = require('@libsql/client') as typeof import('@libsql/client');
    const { PrismaLibSQL } = require('@prisma/adapter-libsql') as {
      PrismaLibSQL: new (client: unknown) => any;
    };

    const parsed = new URL(url);
    const authToken = parsed.searchParams.get('authToken') ?? undefined;
    parsed.searchParams.delete('authToken');

    const libsql = createClient({ url: parsed.toString(), authToken });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
