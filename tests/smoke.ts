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
  CounterProposalSchema,
  RebookingSchema,
  TokenActionSchema,
  UpdateWeeklyAvailabilitySchema,
  CalendarQuerySchema,
  UpdateAvailabilityTemplateSchema,
  CreateDayOverrideSchema,
  AvailableSlotsQuerySchema,
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

  await group('Iteration 2 — Booking-Schema (customerEmail Pflicht)', async () => {
    // CreateBooking ohne email → Fehler (Iteration 2)
    const r1 = CreateBookingSchema.safeParse({
      slotId: 'x',
      customerName: 'Maria',
      customerPhone: '0157 12345678',
      service: 'entruempelung',
      description: 'Keller leeren',
      privacyAccepted: true,
    });
    !r1.success
      ? ok('CreateBooking rejects missing customerEmail (Iteration 2)')
      : bad('CreateBooking rejects missing customerEmail');

    // CreateBooking mit Whitespace-Email → preprocess → Fehler "fehlt"
    const r2 = CreateBookingSchema.safeParse({
      slotId: 'x',
      customerName: 'Maria',
      customerPhone: '0157 12345678',
      customerEmail: '   ',
      service: 'entruempelung',
      description: 'Keller leeren',
      privacyAccepted: true,
    });
    !r2.success
      ? ok('CreateBooking rejects whitespace-only customerEmail')
      : bad('CreateBooking rejects whitespace-only customerEmail');

    // CreateBooking mit getrimmter, gültiger Email → ok
    const r3 = CreateBookingSchema.safeParse({
      slotId: 'x',
      customerName: 'Maria',
      customerPhone: '0157 12345678',
      customerEmail: '  test@example.com  ',
      service: 'entruempelung',
      description: 'Keller leeren',
      privacyAccepted: true,
    });
    if (r3.success && r3.data.customerEmail === 'test@example.com') {
      ok('CreateBooking trims valid customerEmail');
    } else {
      bad('CreateBooking trims valid customerEmail', r3.success ? r3.data : r3.error);
    }
  });

  await group('Iteration 2 — Counter-Proposal-Schemas', async () => {
    const r1 = CounterProposalSchema.safeParse({ newSlotId: 'cl-abc' });
    r1.success
      ? ok('CounterProposalSchema accepts valid input')
      : bad('CounterProposalSchema accepts valid input');

    const r2 = CounterProposalSchema.safeParse({ newSlotId: '' });
    !r2.success
      ? ok('CounterProposalSchema rejects empty newSlotId')
      : bad('CounterProposalSchema rejects empty newSlotId');

    const r3 = RebookingSchema.safeParse({ token: 'tok', newSlotId: 'slot' });
    r3.success ? ok('RebookingSchema accepts valid input') : bad('RebookingSchema accepts valid input');

    const r4 = TokenActionSchema.safeParse({ token: 'tok', action: 'accept' });
    r4.success ? ok('TokenActionSchema accepts accept') : bad('TokenActionSchema accepts accept');

    const r5 = TokenActionSchema.safeParse({ token: 'tok', action: 'cancel' });
    r5.success ? ok('TokenActionSchema accepts cancel') : bad('TokenActionSchema accepts cancel');

    const r6 = TokenActionSchema.safeParse({ token: 'tok', action: 'reject' });
    !r6.success
      ? ok('TokenActionSchema rejects unknown action')
      : bad('TokenActionSchema rejects unknown action');
  });

  await group('Iteration 2 — Availability + Calendar-Schemas', async () => {
    const r1 = UpdateWeeklyAvailabilitySchema.safeParse({
      days: [
        { dayOfWeek: 0, isActive: false },
        { dayOfWeek: 1, isActive: true },
      ],
    });
    r1.success
      ? ok('UpdateWeeklyAvailability accepts valid days')
      : bad('UpdateWeeklyAvailability accepts valid days');

    const r2 = UpdateWeeklyAvailabilitySchema.safeParse({
      days: [
        { dayOfWeek: 1, isActive: false },
        { dayOfWeek: 1, isActive: true },
      ],
    });
    !r2.success
      ? ok('UpdateWeeklyAvailability rejects duplicate dayOfWeek')
      : bad('UpdateWeeklyAvailability rejects duplicate dayOfWeek');

    const r3 = UpdateWeeklyAvailabilitySchema.safeParse({
      days: [{ dayOfWeek: 7, isActive: true }],
    });
    !r3.success
      ? ok('UpdateWeeklyAvailability rejects dayOfWeek > 6')
      : bad('UpdateWeeklyAvailability rejects dayOfWeek > 6');

    const r4 = CalendarQuerySchema.safeParse({ year: '2026', month: '5' });
    r4.success ? ok('CalendarQuery accepts string coercion') : bad('CalendarQuery accepts string coercion');

    const r5 = CalendarQuerySchema.safeParse({ year: '2026', month: '13' });
    !r5.success ? ok('CalendarQuery rejects month=13') : bad('CalendarQuery rejects month=13');
  });

  await group('Iteration 2 — DB: WeeklyAvailability seed', async () => {
    const all = await prisma.weeklyAvailability.findMany({ orderBy: { dayOfWeek: 'asc' } });
    if (all.length === 7 && all.every((d, i) => d.dayOfWeek === i)) {
      ok('WeeklyAvailability has all 7 days seeded (0..6)');
    } else {
      bad(`WeeklyAvailability has all 7 days (got ${all.length})`);
    }
  });

  await group('Iteration 2 — DB: Booking gets cancelToken auto', async () => {
    const slot = await prisma.slot.create({
      data: {
        startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        description: '__SMOKE__token',
      },
    });
    const b = await prisma.booking.create({
      data: {
        slotId: slot.id,
        customerName: 'Token-Test',
        customerPhone: '0157 1234567',
        customerEmail: 'test@example.com',
        service: 'entruempelung',
        description: '__SMOKE__cancelToken',
      },
    });
    if (b.cancelToken && b.cancelToken.length >= 16) {
      ok('Booking gets a cancelToken auto-generated');
    } else {
      bad(`Booking gets a cancelToken (got "${b.cancelToken}")`);
    }
  });

  await group('Iteration 2 — DB: COUNTER_PROPOSED zählt im Partial Index', async () => {
    const slot = await prisma.slot.create({
      data: {
        startsAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        description: '__SMOKE__cpidx',
      },
    });
    const b1 = await prisma.booking.create({
      data: {
        slotId: slot.id,
        customerName: 'A',
        customerPhone: '0157 1234567',
        customerEmail: 'a@example.com',
        service: 'entruempelung',
        description: '__SMOKE__cp1',
        status: 'COUNTER_PROPOSED',
      },
    });

    let conflict = false;
    try {
      await prisma.booking.create({
        data: {
          slotId: slot.id,
          customerName: 'B',
          customerPhone: '0157 7654321',
          customerEmail: 'b@example.com',
          service: 'reinigung',
          description: '__SMOKE__cp2',
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') conflict = true;
    }
    conflict
      ? ok('Second booking on slot with COUNTER_PROPOSED is rejected (Partial Index v2)')
      : bad('Second booking on slot with COUNTER_PROPOSED is rejected');

    // CANCELLED → Slot wieder frei
    await prisma.booking.update({
      where: { id: b1.id },
      data: { status: 'CANCELLED' },
    });
    let secondOk = false;
    try {
      await prisma.booking.create({
        data: {
          slotId: slot.id,
          customerName: 'C',
          customerPhone: '0157 1112223',
          customerEmail: 'c@example.com',
          service: 'reinigung',
          description: '__SMOKE__cp3',
        },
      });
      secondOk = true;
    } catch {
      /* unexpected */
    }
    secondOk
      ? ok('CANCELLED gives slot back (new active booking succeeds)')
      : bad('CANCELLED gives slot back');
  });

  // -----------------------------------------------------------------
  // Iteration 3 Tests
  // -----------------------------------------------------------------

  await group('Iteration 3 — Schema Validation (Date/Time, Sonstiges, Attachments)', async () => {
    const r1 = CreateBookingSchema.safeParse({
      date: '2099-05-15',
      startTime: '09:00',
      endTime: '10:00',
      customerName: 'Maria',
      customerPhone: '0157 12345678',
      customerEmail: 'maria@example.com',
      service: 'entruempelung',
      description: 'Keller leeren',
      privacyAccepted: true,
    });
    r1.success
      ? ok('CreateBooking accepts date/startTime/endTime mode')
      : bad('CreateBooking accepts date mode', r1.error);

    const r2 = CreateBookingSchema.safeParse({
      slotId: 'someslot',
      customerName: 'Maria',
      customerPhone: '0157 12345678',
      customerEmail: 'maria@example.com',
      service: 'entruempelung',
      description: 'Keller leeren',
      privacyAccepted: true,
    });
    r2.success ? ok('CreateBooking accepts slotId mode') : bad('CreateBooking accepts slotId mode');

    const r3 = CreateBookingSchema.safeParse({
      customerName: 'Maria',
      customerPhone: '0157 12345678',
      customerEmail: 'maria@example.com',
      service: 'entruempelung',
      description: 'Keller leeren',
      privacyAccepted: true,
    });
    !r3.success ? ok('CreateBooking rejects when neither mode is set') : bad('CreateBooking rejects neither');

    const r4 = CreateBookingSchema.safeParse({
      slotId: 'x',
      date: '2099-05-15',
      startTime: '09:00',
      endTime: '10:00',
      customerName: 'Maria',
      customerPhone: '0157 12345678',
      customerEmail: 'maria@example.com',
      service: 'entruempelung',
      description: 'Keller leeren',
      privacyAccepted: true,
    });
    !r4.success ? ok('CreateBooking rejects when both modes are set') : bad('CreateBooking rejects both modes');

    const r5 = CreateBookingSchema.safeParse({
      date: '2099-05-15',
      startTime: '09:00',
      endTime: '10:00',
      customerName: 'Maria',
      customerPhone: '0157 12345678',
      customerEmail: 'maria@example.com',
      service: 'sonstiges',
      description: 'Kurz', // < 30 chars
      privacyAccepted: true,
    });
    !r5.success ? ok('CreateBooking rejects sonstiges with <30 char description') : bad('sonstiges <30');

    const r6 = CreateBookingSchema.safeParse({
      date: '2099-05-15',
      startTime: '09:00',
      endTime: '10:00',
      customerName: 'Maria',
      customerPhone: '0157 12345678',
      customerEmail: 'maria@example.com',
      service: 'sonstiges',
      description: 'Eine ausführliche Beschreibung mit mehr als 30 Zeichen!',
      privacyAccepted: true,
    });
    r6.success ? ok('CreateBooking accepts sonstiges with >=30 char description') : bad('sonstiges >=30');

    const r7 = CreateBookingSchema.safeParse({
      date: '2099-05-15',
      startTime: '10:00',
      endTime: '09:00', // end < start
      customerName: 'Maria',
      customerPhone: '0157 12345678',
      customerEmail: 'maria@example.com',
      service: 'entruempelung',
      description: 'Test',
      privacyAccepted: true,
    });
    !r7.success ? ok('CreateBooking rejects endTime <= startTime') : bad('endTime <= startTime');
  });

  await group('Iteration 3 — AvailabilityTemplate Schema', async () => {
    const r1 = UpdateAvailabilityTemplateSchema.safeParse({
      days: [
        { dayOfWeek: 0, isActive: false, startTime: '08:00', endTime: '17:00', slotDurationMinutes: 60 },
        { dayOfWeek: 1, isActive: true, startTime: '08:00', endTime: '17:00', slotDurationMinutes: 60 },
      ],
    });
    r1.success ? ok('UpdateAvailabilityTemplate accepts valid bulk') : bad('UpdateAvailabilityTemplate valid', r1.error);

    const r2 = UpdateAvailabilityTemplateSchema.safeParse({
      days: [
        { dayOfWeek: 1, isActive: true, startTime: '17:00', endTime: '08:00', slotDurationMinutes: 60 },
      ],
    });
    !r2.success ? ok('UpdateAvailabilityTemplate rejects endTime <= startTime') : bad('end <= start');

    const r3 = UpdateAvailabilityTemplateSchema.safeParse({
      days: [
        { dayOfWeek: 1, isActive: true, startTime: '08:00', endTime: '08:30', slotDurationMinutes: 60 },
      ],
    });
    !r3.success ? ok('UpdateAvailabilityTemplate rejects window < slotDuration') : bad('window < slotDuration');
  });

  await group('Iteration 3 — DayOverride Schema', async () => {
    const r1 = CreateDayOverrideSchema.safeParse({
      date: '2099-05-15',
      isActive: false,
      reason: 'Urlaub',
    });
    r1.success ? ok('CreateDayOverride accepts inactive (Urlaub)') : bad('inactive override', r1.error);

    const r2 = CreateDayOverrideSchema.safeParse({
      date: '2099-05-15',
      isActive: true,
      startTime: '09:00',
      endTime: '15:00',
    });
    r2.success ? ok('CreateDayOverride accepts active with custom times') : bad('active override');

    const r3 = CreateDayOverrideSchema.safeParse({
      date: '2099-05-15',
      isActive: true,
      startTime: '15:00',
      endTime: '09:00',
    });
    !r3.success ? ok('CreateDayOverride rejects endTime <= startTime') : bad('override end <= start');

    const r4 = AvailableSlotsQuerySchema.safeParse({ date: '2099-05-15' });
    r4.success ? ok('AvailableSlotsQuery accepts valid date') : bad('AvailableSlotsQuery valid');

    const r5 = AvailableSlotsQuerySchema.safeParse({ date: '2099-13-15' });
    !r5.success ? ok('AvailableSlotsQuery rejects invalid date') : bad('AvailableSlotsQuery invalid');
  });

  await group('Iteration 3 — DB: AvailabilityTemplate seeded', async () => {
    const all = await prisma.availabilityTemplate.findMany({ orderBy: { dayOfWeek: 'asc' } });
    if (all.length === 7 && all.every((d, i) => d.dayOfWeek === i)) {
      ok('AvailabilityTemplate has all 7 days seeded (0..6)');
    } else {
      bad(`AvailabilityTemplate has all 7 days (got ${all.length})`);
    }
  });

  await group('Iteration 3 — DB: Partial Unique Index uniq_active_booking_per_timeslot', async () => {
    const date = '2099-12-15';
    const startTime = '09:00';
    const endTime = '10:00';

    // Cleanup vor Test
    await prisma.booking.deleteMany({ where: { description: '__SMOKE__it3idx' } });

    await prisma.booking.create({
      data: {
        date,
        startTime,
        endTime,
        customerName: 'A',
        customerPhone: '0157 1234567',
        customerEmail: 'a@example.com',
        service: 'entruempelung',
        description: '__SMOKE__it3idx',
        status: 'PENDING',
      },
    });

    let conflictThrown = false;
    try {
      await prisma.booking.create({
        data: {
          date,
          startTime,
          endTime,
          customerName: 'B',
          customerPhone: '0157 1112223',
          customerEmail: 'b@example.com',
          service: 'reinigung',
          description: '__SMOKE__it3idx',
          status: 'PENDING',
        },
      });
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === 'P2002') conflictThrown = true;
    }
    conflictThrown
      ? ok('Second active booking on same timeslot is rejected by unique index')
      : bad('Second active booking on same timeslot is rejected');

    // REJECTED gibt Slot wieder frei
    const it3List = await prisma.booking.findMany({
      where: { description: '__SMOKE__it3idx', status: 'PENDING' },
    });
    if (it3List[0]) {
      await prisma.booking.update({ where: { id: it3List[0].id }, data: { status: 'REJECTED' } });
      let okThird = false;
      try {
        await prisma.booking.create({
          data: {
            date,
            startTime,
            endTime,
            customerName: 'C',
            customerPhone: '0157 5556667',
            customerEmail: 'c@example.com',
            service: 'reinigung',
            description: '__SMOKE__it3idx',
            status: 'PENDING',
          },
        });
        okThird = true;
      } catch {
        /* */
      }
      okThird
        ? ok('REJECTED frees timeslot — new active booking succeeds')
        : bad('REJECTED frees timeslot');
    }

    await prisma.booking.deleteMany({ where: { description: '__SMOKE__it3idx' } });
  });

  await group('Iteration 3 — Availability resolver', async () => {
    const { computeAvailableSlots, generateTimeSlots, todayInBerlin } = await import(
      '../src/lib/availability'
    );

    // generateTimeSlots
    const slots = generateTimeSlots('08:00', '11:00', 60);
    if (slots.length === 3 && slots[0] === '08:00' && slots[2] === '10:00') {
      ok('generateTimeSlots returns expected 60-min blocks');
    } else {
      bad(`generateTimeSlots: got ${JSON.stringify(slots)}`);
    }

    // 30-min Granularität
    const half = generateTimeSlots('08:00', '09:30', 30);
    if (half.length === 3 && half[0] === '08:00' && half[2] === '09:00') {
      ok('generateTimeSlots returns 30-min blocks');
    } else {
      bad(`generateTimeSlots 30-min: got ${JSON.stringify(half)}`);
    }

    // Vergangenheit → leeres Array
    const past = await computeAvailableSlots('2020-01-01');
    if (!past.isDayActive && past.slots.length === 0) {
      ok('computeAvailableSlots returns empty for past dates');
    } else {
      bad('computeAvailableSlots past');
    }

    // todayInBerlin liefert YYYY-MM-DD
    const t = todayInBerlin();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      ok('todayInBerlin returns YYYY-MM-DD format');
    } else {
      bad(`todayInBerlin: ${t}`);
    }
  });

  // -------------------------------------------------------------------------
  // Iteration 4 — Customer Auth, Cancellation, Stripe, Reviews
  // -------------------------------------------------------------------------
  await group('Iteration 4 — safeCustomerCallback', async () => {
    const { safeCustomerCallback } = await import('../src/lib/customer-auth');
    const cases: Array<{ input: unknown; expected: string; label: string }> = [
      { input: '/konto', expected: '/konto', label: 'plain path' },
      { input: '/konto/auftrag/abc', expected: '/konto/auftrag/abc', label: 'nested path' },
      { input: '/konto?a=b', expected: '/konto?a=b', label: 'with query' },
      { input: '', expected: '/konto', label: 'empty string' },
      { input: 'konto', expected: '/konto', label: 'no leading slash' },
      { input: '//evil.example/login', expected: '/konto', label: 'protocol-relative' },
      { input: 'http://x', expected: '/konto', label: 'absolute http URL' },
      { input: 'https://evil.example', expected: '/konto', label: 'https URL' },
      { input: '\\\\evil', expected: '/konto', label: 'backslash' },
      { input: '/konto with space', expected: '/konto', label: 'whitespace' },
      { input: null, expected: '/konto', label: 'null' },
      { input: 123, expected: '/konto', label: 'number' },
    ];
    for (const c of cases) {
      const got = safeCustomerCallback(c.input);
      if (got === c.expected) ok(`safeCustomerCallback: ${c.label}`);
      else bad(`safeCustomerCallback: ${c.label} (got "${got}", expected "${c.expected}")`);
    }
  });

  await group('Iteration 4 — Customer JWT roundtrip', async () => {
    const { createCustomerSession, verifyCustomerSession } = await import(
      '../src/lib/customer-auth'
    );
    process.env.AUTH_SECRET ??= 'test-secret-with-at-least-32-characters-aaa';
    const token = await createCustomerSession('cu_smoke_1', 'smoke@example.com');
    if (typeof token === 'string' && token.split('.').length === 3) {
      ok('createCustomerSession produces JWT-shaped string');
    } else {
      bad('createCustomerSession produces JWT-shaped string');
    }
    const decoded = await verifyCustomerSession(token);
    if (
      decoded?.customerId === 'cu_smoke_1' &&
      decoded?.email === 'smoke@example.com'
    ) {
      ok('verifyCustomerSession round-trips payload');
    } else {
      bad(`verifyCustomerSession round-trip: ${JSON.stringify(decoded)}`);
    }
    const bad1 = await verifyCustomerSession('not-a-token');
    if (bad1 === null) ok('verifyCustomerSession rejects garbage');
    else bad('verifyCustomerSession rejects garbage');
  });

  await group('Iteration 4 — Cancellation algorithm (DST-fest)', async () => {
    const { isCancellable, parseBerlinDateTime, todayInBerlin } = await import(
      '../src/lib/cancellation'
    );

    // Spring-forward (29.03.2026): Termin 10:00 Berlin, Storno 28.03 10:00 Berlin
    // → echte Differenz 23h → CONFIRMED → false (zu spät).
    const stornoDST_spring = parseBerlinDateTime('2026-03-28', '10:00');
    const cancelledSpring = isCancellable(
      {
        status: 'CONFIRMED',
        date: '2026-03-29',
        startTime: '10:00',
        slot: null,
      },
      stornoDST_spring,
    );
    if (!cancelledSpring) ok('DST spring-forward: 23h → not cancellable');
    else bad('DST spring-forward should NOT be cancellable');

    // Fall-back (25.10.2026 ist letzter So Oktober 2026): Termin 10:00
    // Berlin, Storno 24.10 10:00 Berlin → echte Differenz 25h → CONFIRMED
    // → true (erlaubt). Letzter Sonntag im Oktober 2026 ist der 25.10.
    const stornoDST_fall = parseBerlinDateTime('2026-10-24', '10:00');
    const cancelledFall = isCancellable(
      {
        status: 'CONFIRMED',
        date: '2026-10-25',
        startTime: '10:00',
        slot: null,
      },
      stornoDST_fall,
    );
    if (cancelledFall) ok('DST fall-back: 25h → cancellable');
    else bad('DST fall-back should be cancellable');

    // PORTAL_CANCELLABLE_STATUSES: REJECTED → false.
    const rejected = isCancellable({
      status: 'REJECTED',
      date: '2099-01-01',
      startTime: '10:00',
      slot: null,
    });
    if (!rejected) ok('REJECTED is never cancellable');
    else bad('REJECTED is never cancellable');

    // CONFIRMED 26h Zukunft → true.
    const future26h = new Date(Date.now() + 26 * 3600 * 1000);
    const dateStr = future26h.toISOString().slice(0, 10);
    // Wir nutzen die Stunde aus UTC und +1 für Berlin-Approximation, aber
    // einfacher: setze Datum/Zeit weit genug in die Zukunft.
    const farFuture = isCancellable(
      {
        status: 'CONFIRMED',
        date: '2099-01-01',
        startTime: '10:00',
        slot: null,
      },
    );
    if (farFuture) ok('CONFIRMED far future → cancellable');
    else bad('CONFIRMED far future should be cancellable');

    // PENDING in past → false.
    const pendingPast = isCancellable({
      status: 'PENDING',
      date: '2020-01-01',
      startTime: '10:00',
      slot: null,
    });
    if (!pendingPast) ok('PENDING past → not cancellable');
    else bad('PENDING past should NOT be cancellable');

    // MAJOR-404: keine date+slot → defensiv true.
    const noDate = isCancellable({
      status: 'CONFIRMED',
      date: null,
      startTime: null,
      slot: null,
    });
    if (noDate) ok('No date+slot → defensive true');
    else bad('No date+slot should be defensive true');

    // todayInBerlin → YYYY-MM-DD
    const today = todayInBerlin();
    if (/^\d{4}-\d{2}-\d{2}$/.test(today)) ok('todayInBerlin returns YYYY-MM-DD');
    else bad(`todayInBerlin: ${today}`);
    void dateStr;
  });

  await group('Iteration 4 — Customer schemas', async () => {
    const {
      CustomerRegisterSchema,
      CustomerLoginSchema,
      CustomerProfileUpdateSchema,
      CreatePaymentSchema,
      SessionStatusQuerySchema,
      CreateReviewSchema,
      ApproveReviewSchema,
    } = await import('../contracts/zod-schemas');

    const reg = CustomerRegisterSchema.safeParse({
      email: 'TEST@example.com',
      password: 'longenoughpw',
      firstName: 'Maria',
      lastName: 'Müller',
      phone: '0157-1234567',
      privacyAccepted: true,
    });
    reg.success ? ok('Register accepts valid input + lowercases email')
      : bad('Register valid input', reg.error);
    if (reg.success && reg.data.email === 'test@example.com') {
      ok('Register email lowercased');
    } else {
      bad('Register email should be lowercased');
    }

    const regBad = CustomerRegisterSchema.safeParse({
      email: 'foo@example.com',
      password: 'short',
      firstName: 'Maria',
      lastName: 'Müller',
      privacyAccepted: true,
    });
    !regBad.success ? ok('Register rejects short password')
      : bad('Register should reject short password');

    const noPrivacy = CustomerRegisterSchema.safeParse({
      email: 'foo@example.com',
      password: 'longenoughpw',
      firstName: 'Maria',
      lastName: 'Müller',
      privacyAccepted: false,
    });
    !noPrivacy.success ? ok('Register rejects privacyAccepted=false')
      : bad('Register should reject privacy false');

    const login = CustomerLoginSchema.safeParse({
      email: 'a@b.de',
      password: 'x',
      redirectUrl: '/konto',
    });
    login.success ? ok('Login accepts valid input')
      : bad('Login valid input', login.error);

    const profileBadEmail = CustomerProfileUpdateSchema.safeParse({
      firstName: 'Maria',
      email: 'neu@example.com',
    });
    !profileBadEmail.success ? ok('ProfileUpdate strict rejects email field')
      : bad('ProfileUpdate should reject email');

    const profileOk = CustomerProfileUpdateSchema.safeParse({
      firstName: 'Maria',
    });
    profileOk.success ? ok('ProfileUpdate accepts firstName only')
      : bad('ProfileUpdate firstName only');

    const payOk = CreatePaymentSchema.safeParse({ amount: 14000 });
    payOk.success ? ok('CreatePayment accepts 14000 cents')
      : bad('CreatePayment 14000 cents');
    const payTooLow = CreatePaymentSchema.safeParse({ amount: 50 });
    !payTooLow.success ? ok('CreatePayment rejects <100 cents')
      : bad('CreatePayment should reject <100 cents');

    const sessOk = SessionStatusQuerySchema.safeParse({
      session_id: 'cs_test_abc123',
    });
    sessOk.success ? ok('SessionStatus accepts cs_test_*')
      : bad('SessionStatus cs_test_*');
    const sessBad = SessionStatusQuerySchema.safeParse({
      session_id: 'foo_bar',
    });
    !sessBad.success ? ok('SessionStatus rejects bogus IDs')
      : bad('SessionStatus should reject bogus IDs');

    const revOk = CreateReviewSchema.safeParse({
      bookingId: 'bk_1',
      stars: 5,
      text: 'Top!',
    });
    revOk.success ? ok('CreateReview accepts valid input')
      : bad('CreateReview valid', revOk.error);
    const revBad = CreateReviewSchema.safeParse({
      bookingId: 'bk_1',
      stars: 6,
    });
    !revBad.success ? ok('CreateReview rejects stars=6')
      : bad('CreateReview should reject stars=6');

    const approveOk = ApproveReviewSchema.safeParse({ approved: true });
    approveOk.success ? ok('ApproveReview accepts approved=true')
      : bad('ApproveReview valid');
  });

  await group('Iteration 4 — Customer DB roundtrip', async () => {
    const bcrypt = await import('bcryptjs');
    const email = `__smoke_${Date.now()}@example.com`;
    const hash = await bcrypt.default.hash('test-password-123', 10);
    const u = await prisma.customerUser.create({
      data: {
        email,
        passwordHash: hash,
        firstName: 'Smoke',
        lastName: 'Test',
        emailVerified: true,
      },
    });
    if (u.id && u.email === email && !u.passwordHash.startsWith('test-')) {
      ok('CustomerUser created with bcrypt-hashed password');
    } else {
      bad('CustomerUser create roundtrip');
    }

    // Booking mit customerId
    const future = new Date(Date.now() + 7 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const booking = await prisma.booking.create({
      data: {
        date: future,
        startTime: '09:00',
        endTime: '10:00',
        customerId: u.id,
        customerName: 'Smoke',
        customerPhone: '0157-1111111',
        customerEmail: email,
        service: 'reinigung',
        description: '__SMOKE__customer-link',
        status: 'COMPLETED',
      },
    });

    // Review anlegen (UNIQUE auf bookingId)
    const review = await prisma.review.create({
      data: {
        customerId: u.id,
        bookingId: booking.id,
        stars: 5,
        text: '__SMOKE__ review',
      },
    });
    if (review.id && !review.approved) ok('Review created (approved=false default)');
    else bad('Review default approved should be false');

    // Doppelte Review → P2002 (UNIQUE bookingId)
    let doubleFailed = false;
    try {
      await prisma.review.create({
        data: { customerId: u.id, bookingId: booking.id, stars: 4 },
      });
    } catch {
      doubleFailed = true;
    }
    doubleFailed ? ok('Review UNIQUE bookingId enforced')
      : bad('Review duplicate should fail');

    // Payment anlegen
    const pay = await prisma.payment.create({
      data: { bookingId: booking.id, amount: 5000, status: 'PENDING' },
    });
    if (pay.amount === 5000 && pay.currency === 'eur') ok('Payment created with default eur');
    else bad('Payment defaults');

    // Cleanup
    await prisma.payment.delete({ where: { id: pay.id } });
    await prisma.review.delete({ where: { id: review.id } });
    await prisma.booking.delete({ where: { id: booking.id } });
    await prisma.customerUser.delete({ where: { id: u.id } });
    ok('Cleanup IT4 customer/booking/review/payment');
  });

  await group('Iteration 4 — Stripe singleton (no key)', async () => {
    const { getStripe, isStripeConfigured } = await import('../src/lib/stripe');
    // Im Smoke-Test ist STRIPE_SECRET_KEY nicht gesetzt → null.
    const before = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    const inst = getStripe();
    if (inst === null) ok('getStripe() returns null without key');
    else bad('getStripe() should be null without key');
    if (!isStripeConfigured()) ok('isStripeConfigured() false without key');
    else bad('isStripeConfigured() should be false');
    if (before !== undefined) process.env.STRIPE_SECRET_KEY = before;
  });

  await cleanup();
  await prisma.booking.deleteMany({ where: { description: { startsWith: '__SMOKE__' } } });
  await prisma.slot.deleteMany({ where: { description: { startsWith: '__SMOKE__' } } });

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
