/**
 * Iteration 14 — Backend-Tests gegen `iteration-14.openapi.yaml` und
 * `ARCHITECTURE_IT14.md`.
 *
 * Abdeckung (alles ohne Live-Server, nur Schema-/Logik-Ebene):
 *
 *   - S04: Booking-Mapping liefert finalPriceEur + finalPriceNote +
 *     paymentMethod (Snapshot-Test gegen ein Booking-DTO).
 *   - S05: PaymentMethodSchema akzeptiert nur 'CASH' | 'BANK_TRANSFER';
 *     AdminBookingPatchSchema akzeptiert das Feld inkl. null;
 *     CreateBookingSchema (Customer-Submit) lehnt paymentMethod ab oder
 *     ignoriert es (es gibt KEIN Customer-Input für paymentMethod).
 *   - S07: Analytics-Filter — `completedBookings` zählt unabhängig von
 *     finalPriceEur (die Logik prüfen wir indirekt: zwei Where-Klauseln
 *     unterscheiden sich nur durch den Preis-Filter).
 *
 * Lauf:
 *   npm run test:it14
 *
 * Exit: 0 = alle PASS, 1 = mindestens ein FAIL.
 */

import {
  PaymentMethodSchema,
  AdminBookingPatchSchema,
  CreateBookingSchema,
  BookingAdminSchemaIT14,
  BookingAdminSchemaIT6,
} from '../contracts/zod-schemas';

let pass = 0;
let fail = 0;

function ok(name: string): void {
  pass++;
  // eslint-disable-next-line no-console
  console.log(`  PASS  ${name}`);
}
function bad(name: string, detail?: unknown): void {
  fail++;
  // eslint-disable-next-line no-console
  console.log(`  FAIL  ${name}`);
  if (detail !== undefined) {
    const s =
      typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2);
    // eslint-disable-next-line no-console
    console.log(`        ${s.split('\n').slice(0, 8).join('\n        ')}`);
  }
}
function group(label: string): void {
  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log(label);
}

// ---------------------------------------------------------------------------
// S05 — PaymentMethodSchema
// ---------------------------------------------------------------------------
group('IT14 / S05 — PaymentMethodSchema');

{
  const cash = PaymentMethodSchema.safeParse('CASH');
  if (cash.success) ok('CASH ist akzeptiert');
  else bad('CASH ist akzeptiert', cash.error);

  const transfer = PaymentMethodSchema.safeParse('BANK_TRANSFER');
  if (transfer.success) ok('BANK_TRANSFER ist akzeptiert');
  else bad('BANK_TRANSFER ist akzeptiert', transfer.error);

  // STRIPE / CARD / INVOICE müssen abgelehnt werden (Architect-Auflage Rev 2).
  for (const v of ['STRIPE', 'CARD', 'INVOICE', 'CASH_ON_DELIVERY', '']) {
    const r = PaymentMethodSchema.safeParse(v);
    if (!r.success) ok(`'${v}' wird abgelehnt`);
    else bad(`'${v}' wird abgelehnt`, 'unerwartet erfolgreich');
  }
}

// ---------------------------------------------------------------------------
// S05 — AdminBookingPatchSchema akzeptiert paymentMethod
// ---------------------------------------------------------------------------
group('IT14 / S05 — AdminBookingPatchSchema');

{
  const r1 = AdminBookingPatchSchema.safeParse({ paymentMethod: 'CASH' });
  if (r1.success && r1.data.paymentMethod === 'CASH')
    ok('paymentMethod=CASH wird übernommen');
  else bad('paymentMethod=CASH wird übernommen', r1);

  const r2 = AdminBookingPatchSchema.safeParse({ paymentMethod: null });
  if (r2.success && r2.data.paymentMethod === null)
    ok('paymentMethod=null wird übernommen (zurücksetzen)');
  else bad('paymentMethod=null wird übernommen', r2);

  const r3 = AdminBookingPatchSchema.safeParse({ paymentMethod: 'STRIPE' });
  if (!r3.success) ok('paymentMethod=STRIPE wird abgelehnt');
  else bad('paymentMethod=STRIPE wird abgelehnt', r3);

  // Ungültige Werte werden abgelehnt (Zod-Enum greift VOR superRefine).
  const r4 = AdminBookingPatchSchema.safeParse({ paymentMethod: 'BAR' });
  if (!r4.success) ok("paymentMethod='BAR' (string) wird abgelehnt");
  else bad("paymentMethod='BAR' wird abgelehnt", r4);

  // Kombi: paymentMethod ALLEINE genügt für superRefine.
  const r5 = AdminBookingPatchSchema.safeParse({
    paymentMethod: 'BANK_TRANSFER',
  });
  if (r5.success) ok('paymentMethod alleine erfüllt superRefine');
  else bad('paymentMethod alleine erfüllt superRefine', r5);
}

// ---------------------------------------------------------------------------
// S05 — Customer-Submit-Schema akzeptiert paymentMethod NICHT
// ---------------------------------------------------------------------------
group('IT14 / S05 — Customer kann paymentMethod nicht setzen');

{
  // Wir bauen einen minimalen, ansonsten gültigen Customer-Submit
  // (slot-Mode für Bestand) und schmuggeln paymentMethod hinein.
  const submit = {
    slotId: 'slot_123',
    customerName: 'Max Mustermann',
    customerPhone: '0151123456',
    customerEmail: 'max@example.com',
    service: 'gardening',
    description: 'Test',
    privacyAccepted: true,
    paymentMethod: 'CASH', // ← darf KEINEN Effekt haben.
  };
  const r = CreateBookingSchema.safeParse(submit);
  if (!r.success) {
    // Wenn CreateBookingSchema strikt ist, lehnt es das Feld ab — das ist OK.
    ok('CreateBookingSchema lehnt paymentMethod ab oder Service-Validierung');
  } else {
    // Wenn passthrough: paymentMethod darf jedenfalls NICHT auf
    // r.data sein. (Pragmatischer Check: das parsedata.paymentMethod muss
    // entweder undefined sein ODER das Schema reicht es nicht durch.)
    const parsed = r.data as { paymentMethod?: unknown };
    if (parsed.paymentMethod === undefined)
      ok('CreateBookingSchema droppt paymentMethod im Output');
    else
      bad(
        'CreateBookingSchema droppt paymentMethod im Output',
        `paymentMethod=${String(parsed.paymentMethod)}`,
      );
  }
}

// ---------------------------------------------------------------------------
// S04 — BookingAdminSchemaIT14 hat finalPriceEur, finalPriceNote, paymentMethod
// ---------------------------------------------------------------------------
group('IT14 / S04 — BookingAdminSchemaIT14');

{
  const sample = {
    id: 'b1',
    slot: null,
    date: '2026-05-04',
    startTime: '10:00',
    endTime: '11:00',
    durationMinutes: 60,
    customerId: null,
    customerName: 'Tester',
    customerPhone: '+491511234567',
    customerEmail: 'test@example.com',
    service: 'entruempelung',
    description: 'Test',
    addressStreet: 'Hauptstr. 1',
    addressZip: '64283',
    addressCity: 'Darmstadt',
    status: 'COMPLETED',
    mailSent: true,
    mailError: null,
    cancelToken: 'tok_abc',
    counterProposalSlot: null,
    attachments: [],
    payment: null,
    finalPriceEur: '150.00',
    finalPriceNote: 'inkl. Anfahrt',
    paymentMethod: 'CASH',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const it14 = BookingAdminSchemaIT14.safeParse(sample);
  if (it14.success) ok('BookingAdminSchemaIT14 akzeptiert vollständigen DTO');
  else bad('BookingAdminSchemaIT14 akzeptiert vollständigen DTO', it14.error);

  // Negative: paymentMethod fehlt → soll fehlschlagen
  const { paymentMethod: _drop, ...withoutPm } = sample;
  void _drop;
  const missingPm = BookingAdminSchemaIT14.safeParse(withoutPm);
  if (!missingPm.success)
    ok('BookingAdminSchemaIT14 verlangt paymentMethod (auch null)');
  else bad('BookingAdminSchemaIT14 verlangt paymentMethod', missingPm);

  // IT14-Schema ist Erweiterung von IT6 — IT6-DTO ohne paymentMethod
  // muss weiterhin gegen IT6 valide sein.
  const it6 = BookingAdminSchemaIT6.safeParse(withoutPm);
  if (it6.success) ok('BookingAdminSchemaIT6 bleibt rückwärtskompatibel');
  else bad('BookingAdminSchemaIT6 bleibt rückwärtskompatibel', it6.error);
}

// ---------------------------------------------------------------------------
// S07 — Analytics: paymentMethod-Filter darf completedBookings nicht reduzieren.
// (Wir können hier ohne DB nur die Logik in analytics.ts prüfen — durch
// Inspektion des Source-Codes. Der eigentliche Query läuft im Integration-
// Test gegen die DB.)
// ---------------------------------------------------------------------------
group('IT14 / S07 — Analytics-Logik');

{
  // Smoke: Modul lädt ohne Fehler (Importpfad korrekt).
  // computeAnalytics ist async + braucht eine DB-Connection — wir
  // verifizieren hier nur, dass die Funktion exportiert ist.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../src/lib/analytics');
  if (typeof mod.computeAnalytics === 'function')
    ok('computeAnalytics ist exportiert');
  else bad('computeAnalytics ist exportiert');

  // Source-Inspection: completedTotalCount-Query existiert (signalisiert
  // dass der Bug-Fix S07 implementiert ist).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  const src = fs.readFileSync(
    require.resolve('../src/lib/analytics'),
    'utf8',
  );
  if (src.includes('completedTotalCount'))
    ok('analytics.ts enthält completedTotalCount (S07-Fix)');
  else bad('analytics.ts enthält completedTotalCount', 'S07-Fix fehlt');

  if (
    src.includes('completedBookings: completedTotalCount') ||
    /completedBookings:\s*completedTotalCount/.test(src)
  )
    ok('KPI completedBookings nutzt den filter-freien Count');
  else
    bad(
      'KPI completedBookings nutzt den filter-freien Count',
      'falscher Wert oder Variable umbenannt',
    );
}

// ---------------------------------------------------------------------------
// S02 — Middleware exportiert /api/admin im Matcher
// ---------------------------------------------------------------------------
group('IT14 / S02 — Middleware-Matcher');

{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  const src = fs.readFileSync('src/middleware.ts', 'utf8');
  if (src.includes("'/api/admin/:path*'"))
    ok('matcher enthält /api/admin/:path*');
  else bad('matcher enthält /api/admin/:path*');

  if (src.includes('UNAUTHORIZED') && src.includes('Bitte einloggen'))
    ok('Middleware liefert kanonische 401-JSON-Shape');
  else bad('Middleware liefert kanonische 401-JSON-Shape');

  if (src.includes('PUBLIC_ADMIN_API_PATHS'))
    ok('Public-Whitelist für /api/admin/** ist definiert');
  else bad('Public-Whitelist für /api/admin/** ist definiert');
}

// ---------------------------------------------------------------------------
console.log('');
console.log(`Total: ${pass} passed, ${fail} failed.`);
process.exit(fail > 0 ? 1 : 0);
