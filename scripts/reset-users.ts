/**
 * Iteration 6 / US-IT6-06 — User-Wipe-Skript.
 *
 * **Zweck:** Ein einmaliger Migrations-Run, der alle Kunden- und Admin-
 * Konten aus der Datenbank entfernt. Buchungen werden gemäß §8.2 / m6
 * differenziert behandelt:
 *   - COMPLETED + CONFIRMED Buchungen: anonymisiert (`customerId = NULL`).
 *     Buchungs-Stammdaten (`customerName`, `customerPhone`, `customerEmail`)
 *     bleiben als statische Strings erhalten — Buchhaltungs- und Umsatz-
 *     Historie geht NICHT verloren.
 *   - PENDING + COUNTER_PROPOSED Buchungen: auf `CANCELLED` gesetzt,
 *     `customerId = NULL` — kein aktives Geschäft mehr.
 *   - REJECTED + CANCELLED bleiben unverändert (kein aktives Geschäft).
 *
 * **Stripe-Customer-Records (m3-Resolution, §17.7):** Das Skript fasst
 * Stripe-Records NICHT an. Es druckt am Ende die Stripe-Session-IDs
 * (Audit-Liste), die Tom **manuell** in seinem Stripe-Dashboard archivieren
 * muss (DSGVO-Eigenverantwortung).
 *
 * **ENV-Gate / Sicherheits-Schichten (D4-Resolution):**
 *   1. `ALLOW_USER_WIPE=true` ist immer Pflicht (sonst Exit-Code 1).
 *   2. `--dry-run` Flag → Skript druckt was gelöscht/anonymisiert WÜRDE,
 *      schreibt aber nichts in die DB. Empfohlen für Erst-Run.
 *   3. `NODE_ENV === 'production'` → ZUSÄTZLICH `CONFIRM_PRODUCTION_WIPE=true`
 *      verlangt. Verhindert versehentlichen Prod-Wipe, falls jemand das
 *      Skript aus dem Staging-Tab gegen die Prod-DB feuert.
 *   4. 5-Sekunden-Countdown vor dem ersten DELETE → letztes Abort-Fenster
 *      (Strg-C). Im Dry-Run-Modus übersprungen.
 *
 * **Reihenfolge (m6-Resolution, §17.10):**
 *   T-06a  ENV `BOOTSTRAP_ADMIN_EMAIL` in Prod setzen      (Operational)
 *   T-06b  Setup-Endpoint mit Allowlist-Gate deployen       (Backend, F1-Fix)
 *   T-07   ┄ DIESES SKRIPT ┄ User-Wipe in Pair mit Tom    (Operational)
 *   T-08   Auth-Bereinigung deployen                        (Full-Stack)
 *
 * **Cascade-Reihenfolge (verbindlich):**
 *   1. Reviews         (FKs auf customer + booking)
 *   2. Bookings        (status-Update + customerId=NULL; KEIN delete)
 *   3. Sessions        (existieren bei NextAuth-DB-Adapter — wir nutzen
 *                       JWT, daher hier nur defensiv)
 *   4. CustomerUser    (delete)
 *   5. User (Admin)    (delete)
 *
 * **Aufruf (lokal, dry-run empfohlen):**
 *   ALLOW_USER_WIPE=true npx tsx scripts/reset-users.ts --dry-run
 *
 * **Aufruf (lokal, real):**
 *   ALLOW_USER_WIPE=true npx tsx scripts/reset-users.ts
 *
 * **Aufruf (Produktion via Vercel CLI / SSH-Tunnel):**
 *   Im Pair mit Tom. Vorher Backup der Datenbank (Turso-Snapshot)!
 *   ALLOW_USER_WIPE=true CONFIRM_PRODUCTION_WIPE=true \
 *     NODE_ENV=production npx tsx scripts/reset-users.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface WipeSummary {
  customerUsersDeleted: number;
  adminUsersDeleted: number;
  bookingsAnonymized: number;
  bookingsCancelled: number;
  reviewsDeleted: number;
  stripeSessionIds: string[];
}

interface WipeFlags {
  dryRun: boolean;
}

function parseArgs(argv: readonly string[]): WipeFlags {
  const dryRun = argv.includes('--dry-run');
  return { dryRun };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2));
  const isProd = process.env.NODE_ENV === 'production';

  // Sicherheits-Schicht 1 — ALLOW_USER_WIPE ----------------------------------
  const allowed = (process.env.ALLOW_USER_WIPE ?? '').toLowerCase();
  if (allowed !== 'true' && allowed !== '1') {
    console.error(
      '\n[reset-users] WIPE_NOT_ALLOWED:\n' +
        '  Setze ENV `ALLOW_USER_WIPE=true`, um das Skript auszuführen.\n' +
        '  Beispiel:\n' +
        '    ALLOW_USER_WIPE=true npx tsx scripts/reset-users.ts --dry-run\n',
    );
    process.exit(1);
  }

  // Sicherheits-Schicht 2 — Production-Guard ---------------------------------
  // In Prod fordern wir ZUSÄTZLICH `CONFIRM_PRODUCTION_WIPE=true`. Das
  // verhindert, dass ein versehentlich gegen Prod-DB gerichtetes Skript
  // ohne explizite Doppel-Bestätigung läuft.
  if (isProd) {
    const confirmed = (process.env.CONFIRM_PRODUCTION_WIPE ?? '').toLowerCase();
    if (confirmed !== 'true' && confirmed !== '1') {
      console.error(
        '\n[reset-users] PRODUCTION_WIPE_NOT_CONFIRMED:\n' +
          '  NODE_ENV=production erkannt — zusätzlicher Schutz aktiv.\n' +
          '  Setze ENV `CONFIRM_PRODUCTION_WIPE=true`, um den Wipe zu bestätigen.\n' +
          '  Beispiel:\n' +
          '    ALLOW_USER_WIPE=true CONFIRM_PRODUCTION_WIPE=true \\\n' +
          '      NODE_ENV=production npx tsx scripts/reset-users.ts\n',
      );
      process.exit(1);
    }
    console.log(
      '[reset-users] WARNUNG: NODE_ENV=production + CONFIRM_PRODUCTION_WIPE=true.',
    );
  }

  // Banner -------------------------------------------------------------------
  if (flags.dryRun) {
    console.log('[reset-users] DRY-RUN aktiv — es werden KEINE Daten geändert.');
  } else {
    console.log(
      '\n[reset-users] WARNUNG: Wipe wird in 5 Sekunden gestartet. STRG-C zum Abbrechen.',
    );
    await sleep(5000);
  }

  console.log('[reset-users] Starte User-Wipe …');
  const summary: WipeSummary = {
    customerUsersDeleted: 0,
    adminUsersDeleted: 0,
    bookingsAnonymized: 0,
    bookingsCancelled: 0,
    reviewsDeleted: 0,
    stripeSessionIds: [],
  };

  // 1. Stripe-Session-IDs sammeln (für Tom-Runbook). ------------------------
  const payments = await prisma.payment.findMany({
    where: { stripeSessionId: { not: null } },
    select: { stripeSessionId: true },
  });
  summary.stripeSessionIds = payments
    .map((p) => p.stripeSessionId)
    .filter((s): s is string => !!s);

  // 2. Buchungen anonymisieren / stornieren --------------------------------
  // 2a) PENDING + COUNTER_PROPOSED → CANCELLED, customerId = NULL.
  if (flags.dryRun) {
    summary.bookingsCancelled = await prisma.booking.count({
      where: { status: { in: ['PENDING', 'COUNTER_PROPOSED'] } },
    });
  } else {
    const cancelledRes = await prisma.booking.updateMany({
      where: { status: { in: ['PENDING', 'COUNTER_PROPOSED'] } },
      data: { status: 'CANCELLED', customerId: null },
    });
    summary.bookingsCancelled = cancelledRes.count;
  }

  // 2b) CONFIRMED + COMPLETED → bleiben Status, customerId = NULL.
  if (flags.dryRun) {
    summary.bookingsAnonymized = await prisma.booking.count({
      where: {
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        customerId: { not: null },
      },
    });
  } else {
    const anonRes = await prisma.booking.updateMany({
      where: {
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        customerId: { not: null },
      },
      data: { customerId: null },
    });
    summary.bookingsAnonymized = anonRes.count;
  }

  // 3. Reviews löschen (Audit-Spur wäre via Booking-FK ohnehin betroffen). --
  // Reviews ohne Booking sind aus Privacy-Gründen wertlos — wegräumen.
  if (flags.dryRun) {
    summary.reviewsDeleted = await prisma.review.count();
  } else {
    const reviewsRes = await prisma.review.deleteMany({});
    summary.reviewsDeleted = reviewsRes.count;
  }

  // 4. CustomerUser löschen ------------------------------------------------
  if (flags.dryRun) {
    summary.customerUsersDeleted = await prisma.customerUser.count();
  } else {
    const cuRes = await prisma.customerUser.deleteMany({});
    summary.customerUsersDeleted = cuRes.count;
  }

  // 5. Admin-User löschen --------------------------------------------------
  // moderatedById in Reviews ist bereits via cascade (delete) erledigt.
  // createdById ist self-referenzierend mit ON DELETE SET NULL → safe.
  if (flags.dryRun) {
    summary.adminUsersDeleted = await prisma.user.count();
  } else {
    const usersRes = await prisma.user.deleteMany({});
    summary.adminUsersDeleted = usersRes.count;
  }

  await prisma.$disconnect();

  // Zusammenfassung --------------------------------------------------------
  console.log('\n[reset-users] DONE' + (flags.dryRun ? ' (DRY-RUN)' : ''));
  const verb = flags.dryRun ? 'WÜRDE entfernen' : 'entfernt';
  const verbAnon = flags.dryRun ? 'WÜRDE anonymisieren' : 'anonymisiert';
  const verbCancel = flags.dryRun ? 'WÜRDE stornieren' : 'storniert';
  const verbDel = flags.dryRun ? 'WÜRDE löschen' : 'gelöscht';
  console.log(`  CustomerUser ${verb}:        ${summary.customerUsersDeleted}`);
  console.log(`  Admin-User ${verb}:          ${summary.adminUsersDeleted}`);
  console.log(
    `  Buchungen ${verbAnon}:    ${summary.bookingsAnonymized}  (CONFIRMED/COMPLETED)`,
  );
  console.log(
    `  Buchungen ${verbCancel}:        ${summary.bookingsCancelled}  (PENDING/COUNTER_PROPOSED)`,
  );
  console.log(`  Reviews ${verbDel}:          ${summary.reviewsDeleted}`);

  if (summary.stripeSessionIds.length > 0) {
    console.log('\n[reset-users] Stripe-Cleanup (manuell, DSGVO-Verantwortung Tom):');
    console.log(
      '  Bitte folgende Stripe-Sessions/Customer im Stripe Dashboard\n' +
        '  archivieren oder löschen (Customers-Tab → Suche per Session-ID):',
    );
    for (const id of summary.stripeSessionIds) {
      console.log(`    - ${id}`);
    }
    console.log(
      '\n  Siehe `docs/AUTH_GOOGLE_FIX_RUNBOOK.md` Abschnitt „Stripe-Cleanup".\n',
    );
  } else {
    console.log('\n[reset-users] Keine Stripe-Sessions in DB — kein manueller Cleanup nötig.');
  }

  if (flags.dryRun) {
    console.log('\n[reset-users] DRY-RUN abgeschlossen — keine Daten verändert.');
    console.log(
      '  Für den echten Wipe: gleiches Kommando OHNE `--dry-run`.\n',
    );
  } else {
    console.log('\n[reset-users] Nächster Schritt:');
    console.log('  Tom ruft `/admin/setup` auf und legt sich als Bootstrap-Admin an.');
    console.log(
      '  Voraussetzung: ENV `BOOTSTRAP_ADMIN_EMAIL` ist gesetzt (F1-Fix, §17.1).\n',
    );
  }
}

main().catch(async (err) => {
  console.error('[reset-users] CRASH:', err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
