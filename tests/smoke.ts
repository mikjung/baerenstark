/**
 * Smoke-Tests gegen Prisma-Layer + Schemas.
 *
 * Voraussetzung: DATABASE_URL gesetzt (default file:./dev.db) UND
 * `npx prisma migrate deploy` mindestens einmal ausgeführt.
 *
 * Lauf: node tests/smoke.mjs
 *
 * Diese Tests laufen ohne externe Test-Bibliothek (vermeidet
 * weitere Devdeps für den MVP). Bei Fehler exit(1).
 */

import { PrismaClient } from '@prisma/client';
import {
  CreateSlotSchema,
  CreateBookingSchema,
  AdminSetupSchema,
} from '../contracts/zod-schemas';

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;

function ok(name: string) {
  pass++;
  console.log(`  PASS  ${name}`);
}
function bad(name: string, err?: unknown) {
  fail++;
  console.log(`  FAIL  ${name}`);
  if (err) {
    const e = err as { stack?: string; message?: string };
    console.log(
      '        ' +
        (e.stack || e.message || String(err)).split('\n').slice(0, 3).join('\n        '),
    );
  }
}

async function group(label: string, fn: () => Promise<void>) {
  console.log('');
  console.log(label);
  await fn();
}

async function cleanup() {
  // Aufräumen — nur Test-Daten (Booking + Slot mit "test"-Marker)
  await prisma.booking.deleteMany({ where: { description: { startsWith: '__SMOKE__' } } });
  await prisma.slot.deleteMany({ where: { description: { startsWith: '__SMOKE__' } } });
}

async function run() {
  await cleanup();

  await group('Schema Validation', async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const futurePlus1h = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();

    // CreateSlotSchema OK
    const r1 = CreateSlotSchema.safeParse({ startsAt: future, endsAt: futurePlus1h });
    r1.success ? ok('CreateSlot accepts valid input') : bad('CreateSlot accepts valid input', r1.error);

    // Slot < 30 min → Fehler
    const r2 = CreateSlotSchema.safeParse({
      startsAt: future,
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(),
    });
    !r2.success ? ok('CreateSlot rejects <30min') : bad('CreateSlot rejects <30min');

    // Slot in Vergangenheit → Fehler
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const past1h = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const r3 = CreateSlotSchema.safeParse({ startsAt: past, endsAt: past1h });
    !r3.success ? ok('CreateSlot rejects past dates') : bad('CreateSlot rejects past dates');

    // Slot >12h → Fehler
    const r4 = CreateSlotSchema.safeParse({
      startsAt: future,
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000 + 13 * 60 * 60 * 1000).toISOString(),
    });
    !r4.success ? ok('CreateSlot rejects >12h') : bad('CreateSlot rejects >12h');

    // Booking ohne privacyAccepted → Fehler
    const r5 = CreateBookingSchema.safeParse({
      slotId: 'x',
      customerName: 'Maria',
      customerPhone: '0157 12345678',
      service: 'entruempelung',
      description: 'Keller leeren',
    });
    !r5.success ? ok('CreateBooking rejects missing privacyAccepted') : bad('CreateBooking rejects missing privacyAccepted');

    // Booking Telefon mit <6 Ziffern → Fehler
    const r6 = CreateBookingSchema.safeParse({
      slotId: 'x',
      customerName: 'Maria',
      customerPhone: '12345',
      service: 'entruempelung',
      description: 'Keller leeren',
      privacyAccepted: true,
    });
    !r6.success ? ok('CreateBooking rejects phone <6 digits') : bad('CreateBooking rejects phone <6 digits');

    // Booking mit ungültigem Service → Fehler
    const r7 = CreateBookingSchema.safeParse({
      slotId: 'x',
      customerName: 'Maria',
      customerPhone: '0157 12345678',
      service: 'massage',
      description: 'Keller leeren',
      privacyAccepted: true,
    });
    !r7.success ? ok('CreateBooking rejects unknown service') : bad('CreateBooking rejects unknown service');

    // AdminSetup mit Passwort <12 Zeichen → Fehler
    const r8 = AdminSetupSchema.safeParse({
      email: 'tom@example.com',
      name: 'Tom',
      password: 'kurz',
      passwordConfirm: 'kurz',
    });
    !r8.success ? ok('AdminSetup rejects short password') : bad('AdminSetup rejects short password');

    // AdminSetup mit unterschiedlichen Passwörtern → Fehler
    const r9 = AdminSetupSchema.safeParse({
      email: 'tom@example.com',
      name: 'Tom',
      password: 'sicheres-passwort-1234',
      passwordConfirm: 'anderes-passwort-12345',
    });
    !r9.success ? ok('AdminSetup rejects password mismatch') : bad('AdminSetup rejects password mismatch');
  });

  await group('Partial Unique Index (BUG-006)', async () => {
    const slot = await prisma.slot.create({
      data: {
        startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        description: '__SMOKE__index',
      },
    });

    await prisma.booking.create({
      data: {
        slotId: slot.id,
        customerName: 'A',
        customerPhone: '0157 1234567',
        service: 'entruempelung',
        description: '__SMOKE__b1',
      },
    });

    let conflictThrown = false;
    try {
      await prisma.booking.create({
        data: {
          slotId: slot.id,
          customerName: 'B',
          customerPhone: '0157 7654321',
          service: 'reinigung',
          description: '__SMOKE__b2',
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') conflictThrown = true;
    }
    conflictThrown
      ? ok('Second active booking on same slot is rejected by unique index')
      : bad('Second active booking on same slot is rejected by unique index');

    // REJECTED gibt Slot frei → neue Booking darf wieder PENDING sein.
    await prisma.booking.updateMany({
      where: { slotId: slot.id, status: 'PENDING' },
      data: { status: 'REJECTED' },
    });

    let secondAccepted = false;
    try {
      await prisma.booking.create({
        data: {
          slotId: slot.id,
          customerName: 'C',
          customerPhone: '0157 1112223',
          service: 'reinigung',
          description: '__SMOKE__b3',
        },
      });
      secondAccepted = true;
    } catch (e) {
      // Should not throw
    }
    secondAccepted
      ? ok('Booking on slot with only REJECTED bookings succeeds')
      : bad('Booking on slot with only REJECTED bookings succeeds');
  });

  await group('Soft-Delete & PENDING-Migration (BUG-003)', async () => {
    const slot = await prisma.slot.create({
      data: {
        startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        description: '__SMOKE__softdelete',
      },
    });
    const booking = await prisma.booking.create({
      data: {
        slotId: slot.id,
        customerName: 'X',
        customerPhone: '0157 1112223',
        service: 'entruempelung',
        description: '__SMOKE__bd1',
      },
    });

    // Simuliere DELETE-Handler-Logik (Transaktion).
    const now = new Date();
    await prisma.$transaction([
      prisma.booking.updateMany({
        where: { slotId: slot.id, status: 'PENDING' },
        data: { status: 'REJECTED', updatedAt: now },
      }),
      prisma.slot.update({ where: { id: slot.id }, data: { deletedAt: now } }),
    ]);

    const after = await prisma.booking.findUnique({ where: { id: booking.id } });
    after?.status === 'REJECTED'
      ? ok('Soft-delete migrates PENDING bookings to REJECTED')
      : bad('Soft-delete migrates PENDING bookings to REJECTED');

    const slotAfter = await prisma.slot.findUnique({ where: { id: slot.id } });
    slotAfter?.deletedAt !== null
      ? ok('Slot is soft-deleted')
      : bad('Slot is soft-deleted');
  });

  await cleanup();
  await prisma.$disconnect();

  console.log('');
  console.log(`Total: ${pass} passed, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

run().catch(async (err) => {
  console.error('Test runner crashed:', err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
