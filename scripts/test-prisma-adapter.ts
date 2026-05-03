/* eslint-disable no-console */
/**
 * Sanity-Test für den Prisma-Adapter-Setup.
 *
 * Prüft drei Fälle:
 *   1. Lokal mit SQLite (DATABASE_URL=file:...)
 *   2. Mocked libSQL-Pfad: Adapter-Klasse wird mit der richtigen
 *      Groß-/Kleinschreibung aus @prisma/adapter-libsql aufgelöst.
 *   3. Echter PrismaClient mit Adapter wird konstruiert (kein Fehler beim
 *      `new PrismaClient({ adapter })` → das war der Vercel-Crash).
 *
 * Der Test ruft KEINEN Query gegen Turso auf (kein echter Token nötig).
 *
 * Ausführen:  `npx tsx --env-file=.env scripts/test-prisma-adapter.ts`
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  // 1. Adapter-Klasse korrekt exportiert?
  const adapterMod = require('@prisma/adapter-libsql') as Record<string, unknown>;
  const klass = adapterMod.PrismaLibSQL;
  if (typeof klass !== 'function') {
    console.error('[FAIL] @prisma/adapter-libsql exportiert PrismaLibSQL nicht als Klasse:');
    console.error('       Verfügbare Exporte:', Object.keys(adapterMod));
    process.exit(1);
  }
  console.log('[OK]   PrismaLibSQL wird korrekt exportiert (5.22.0).');

  // 2. libSQL-Client kann angelegt werden (in-memory).
  const { createClient } = require('@libsql/client') as typeof import('@libsql/client');
  const libsql = createClient({ url: 'file::memory:?cache=shared' });
  console.log('[OK]   @libsql/client createClient() liefert', typeof libsql);

  // 3. Adapter konstruieren — hier ist 7.x bei Prisma 5 in der Regel gestorben.
  const Klass = klass as new (client: unknown) => unknown;
  const adapter = new Klass(libsql);
  console.log('[OK]   new PrismaLibSQL(client) liefert', typeof adapter);

  // 4. PrismaClient mit Adapter konstruieren — exakt der Vercel-Aufruf.
  const prisma = new PrismaClient({ adapter: adapter as any });
  console.log('[OK]   new PrismaClient({ adapter }) erfolgreich konstruiert.');

  // 5. Lokal: PrismaClient ohne Adapter (file:dev.db).
  const localPrisma = new PrismaClient();
  await localPrisma.$queryRaw`SELECT 1 AS ok`;
  console.log('[OK]   Lokaler PrismaClient (SQLite) liefert SELECT 1.');

  await localPrisma.$disconnect();
  await prisma.$disconnect();
  console.log('\nAlle Adapter-Sanity-Checks bestanden.');
}

main().catch((err) => {
  console.error('[FAIL]', err);
  process.exit(1);
});
