/**
 * Iteration 6 / US-IT6-01 — Letzter-Admin-Race-Schutz (F2-Resolution).
 *
 * Siehe `ARCHITECTURE_IT6.md` Anhang B §17.2.
 *
 * **Problem (TOCTOU):** Zwei parallele PATCH-Requests können beide
 * `count({ status: 'ACTIVE' }) > 1` passieren und sich gegenseitig
 * deaktivieren → Lock-out. SQLite/libSQL bietet kein `SELECT … FOR UPDATE`,
 * Prisma kein Pessimistic-Locking.
 *
 * **Lösung:** Conditional UPDATE per `prisma.$executeRaw` mit Subselect-
 * Bedingung „target ist ACTIVE und es gibt mind. einen anderen ACTIVE-
 * Admin". Atomar — entweder das UPDATE betrifft 1 Zeile oder 0.
 */

import { prisma } from './prisma';

/**
 * Setzt `users.status = 'DISABLED'` für `targetId`, **aber nur**, wenn:
 *   1. der Target aktuell `status = 'ACTIVE'` ist (idempotent), UND
 *   2. mindestens ein **anderer** ACTIVE-Admin existiert.
 *
 * @returns `true` wenn das UPDATE 1 Zeile betroffen hat (Erfolg),
 *          `false` sonst (entweder Target schon DISABLED ODER Target
 *          ist letzter aktiver Admin → 409 LAST_ADMIN_LOCK).
 *
 * Der Caller muss zwischen den beiden `false`-Fällen unterscheiden,
 * indem er nach dem Helper-Aufruf den aktuellen Status liest.
 */
export async function disableAdminSafely(targetId: string): Promise<boolean> {
  // libSQL/SQLite-kompatibles Conditional UPDATE.
  // Subselect prüft `id != targetId AND status = 'ACTIVE'` — d.h. der Target
  // zählt nicht zum Mindestbestand.
  // `$executeRaw` liefert die Anzahl betroffener Zeilen (number).
  const result = await prisma.$executeRaw`
    UPDATE users
    SET status = 'DISABLED',
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${targetId}
      AND status = 'ACTIVE'
      AND EXISTS (
        SELECT 1 FROM users u2
        WHERE u2.id <> ${targetId}
          AND u2.status = 'ACTIVE'
      )
  `;
  return Number(result) === 1;
}
