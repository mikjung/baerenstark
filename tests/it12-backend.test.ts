/**
 * Smoke-Tests für Iteration 12 Backend-Anteile.
 *
 * Lauf:
 *   pnpm test:it12   (siehe package.json)
 * oder direkt:
 *   tsx --env-file=.env.local tests/it12-backend.test.ts
 *
 * Voraussetzungen:
 *   - DATABASE_URL gesetzt + migrate deploy gelaufen.
 *   - UNSUBSCRIBE_TOKEN_SECRET gesetzt (sonst marketing-tokens-Tests skippen).
 *   - BOOKING_TOKEN_SECRET gesetzt (sonst booking-token-Tests skippen).
 */

// Pflicht für die HMAC-Token-Tests:
process.env.UNSUBSCRIBE_TOKEN_SECRET ??= 'test-unsubscribe-secret-iteration-12-min-16-chars';

import { PrismaClient } from '@prisma/client';
import {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
} from '../src/lib/marketing-tokens';
import {
  applyMarketingTemplate,
  appendMarketingFooter,
} from '../src/lib/marketing/footer';
import { renderMarketingBody } from '../src/lib/marketing-mail';
import {
  readIdempotencyKey,
} from '../src/lib/idempotency';
import { performMarketingBulkSend } from '../src/lib/marketing-bulk-send';

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
  try {
    await fn();
  } catch (err) {
    bad(`${label} — group threw`, err);
  }
}

async function run() {
  await group('IT12-S15 — Unsubscribe-Token (HMAC, stateless)', async () => {
    const cid = 'cust_test_abc123';
    const t1 = generateUnsubscribeToken(cid);
    const t2 = generateUnsubscribeToken(cid);
    if (t1 === t2) ok('Token ist deterministisch (gleicher Customer → gleicher Token)');
    else bad('Token ist NICHT deterministisch');

    const verified = verifyUnsubscribeToken(t1);
    if (verified === cid) ok('Verify liefert customerId zurück');
    else bad(`Verify lieferte ${verified}, erwartet ${cid}`);

    const tampered = t1.slice(0, -2) + 'XX';
    const verifiedTampered = verifyUnsubscribeToken(tampered);
    if (verifiedTampered === null) ok('Verify lehnt manipulierten Token ab');
    else bad('Verify akzeptierte einen manipulierten Token!');

    const nullVerified = verifyUnsubscribeToken(null);
    if (nullVerified === null) ok('Verify lehnt null ab');
    else bad('Verify akzeptierte null');

    const garbage = verifyUnsubscribeToken('not-a-valid-base64!!!');
    if (garbage === null) ok('Verify lehnt Garbage-Input ab');
    else bad('Verify akzeptierte Garbage');
  });

  await group('IT12-S15 — Marketing-Template + DSGVO-Footer', async () => {
    const tpl = applyMarketingTemplate('Hallo {{firstName}}, hier ist...', {
      firstName: 'Tom',
    });
    if (tpl === 'Hallo Tom, hier ist...') ok('{{firstName}}-Substitution funktioniert');
    else bad(`Template-Output: ${tpl}`);

    const fallback = applyMarketingTemplate('Hallo {{firstName}}!', { firstName: '' });
    if (fallback.includes('liebe Kundin / lieber Kunde'))
      ok('Fallback-Anrede greift bei leerem firstName');
    else bad(`Fallback-Output: ${fallback}`);

    const withFooter = appendMarketingFooter('Hallo!', {
      unsubscribeUrl: 'https://example.com/u?token=abc',
      baseUrl: 'https://example.com',
    });
    if (
      withFooter.includes('Sie erhalten diese E-Mail') &&
      withFooter.includes('https://example.com/u?token=abc') &&
      withFooter.includes('Impressum: https://example.com/impressum')
    )
      ok('Footer enthält DSGVO-Pflichttext + Unsubscribe-URL + Impressum');
    else bad('Footer-Output unvollständig');
  });

  await group('IT12-S15 — renderMarketingBody integriert alle Schritte', async () => {
    const body = renderMarketingBody('Hallo {{firstName}}!', {
      customerId: 'cust_test_xyz',
      firstName: 'Tom',
    });
    if (
      body.includes('Hallo Tom!') &&
      body.includes('Sie erhalten diese E-Mail') &&
      body.includes('/api/customer/unsubscribe?token=')
    )
      ok('renderMarketingBody: Substitution + Footer + Unsubscribe-Link');
    else bad('renderMarketingBody output unerwartet');
  });

  await group('IT12-S15 — Customer.unsubscribedAt-Schema-Feld funktioniert', async () => {
    const email = `__smoke__it12_unsubscribe_${Date.now()}@example.com`;
    const customer = await prisma.customerUser.create({
      data: {
        email,
        firstName: 'Smoke',
        lastName: 'Test',
        emailVerified: true,
      },
      select: { id: true, unsubscribedAt: true },
    });
    if (customer.unsubscribedAt === null)
      ok('Default unsubscribedAt = null (Bestandskunden-Sonderregel)');
    else bad('Default unsubscribedAt sollte null sein');

    await prisma.customerUser.update({
      where: { id: customer.id },
      data: { unsubscribedAt: new Date(), unsubscribedReason: 'EMAIL_FOOTER' },
    });
    const updated = await prisma.customerUser.findUnique({
      where: { id: customer.id },
      select: { unsubscribedAt: true, unsubscribedReason: true },
    });
    if (updated?.unsubscribedAt && updated.unsubscribedReason === 'EMAIL_FOOTER')
      ok('Unsubscribe-Update setzt beide Felder');
    else bad('Unsubscribe-Update hat unsubscribedAt/Reason nicht gesetzt');

    await prisma.customerUser.delete({ where: { id: customer.id } });
  });

  await group('IT12-S15 — MarketingEmail-Tabellen existieren', async () => {
    // Wir legen einen Audit-Record an + cascade-cleanup. Erfordert einen
    // existierenden Admin (User-Tabelle).
    const admin = await prisma.user.findFirst({ select: { id: true } });
    if (!admin) {
      console.log('  SKIP  kein Admin in users — Test übersprungen');
      return;
    }

    const me = await prisma.marketingEmail.create({
      data: {
        sentByAdminId: admin.id,
        subject: '__SMOKE__ Test-Mail',
        bodyText: '__SMOKE__ Body',
        filterServices: '[]',
        recipientCount: 0,
        status: 'draft',
      },
      select: { id: true, status: true },
    });
    if (me.status === 'draft') ok('MarketingEmail.create funktioniert (draft default)');
    else bad('MarketingEmail status falsch');

    await prisma.marketingEmail.delete({ where: { id: me.id } });
    ok('MarketingEmail.delete funktioniert (cleanup)');
  });

  await group('IT12-S11 (M8) — Idempotency-Key-Header-Validation', async () => {
    const goodHeaders = new Headers({ 'Idempotency-Key': '550e8400-e29b-41d4-a716-446655440000' });
    if (readIdempotencyKey(goodHeaders) === '550e8400-e29b-41d4-a716-446655440000')
      ok('UUID-Key wird akzeptiert');
    else bad('UUID-Key abgelehnt');

    const tooShort = new Headers({ 'Idempotency-Key': 'abc' });
    if (readIdempotencyKey(tooShort) === null) ok('Zu kurzer Key wird abgelehnt');
    else bad('Zu kurzer Key wurde akzeptiert');

    const badChars = new Headers({ 'Idempotency-Key': 'abc;DROP TABLE users--' });
    if (readIdempotencyKey(badChars) === null) ok('Key mit ungültigen Zeichen wird abgelehnt');
    else bad('Key mit ungültigen Zeichen wurde akzeptiert');

    const noHeader = new Headers();
    if (readIdempotencyKey(noHeader) === null) ok('Fehlender Header → null');
    else bad('Fehlender Header sollte null geben');
  });

  await group('IT12-S15 / BUG-003 — performMarketingBulkSend filtert auf Bestandskunden', async () => {
    const admin = await prisma.user.findFirst({ select: { id: true } });
    if (!admin) {
      console.log('  SKIP  kein Admin in users — Test übersprungen');
      return;
    }

    // Customer ohne COMPLETED-Booking — darf NICHT versendet werden.
    const customerNoBooking = await prisma.customerUser.create({
      data: {
        email: `__smoke__nobk_${Date.now()}@example.com`,
        firstName: 'NoBook',
        lastName: 'Test',
        emailVerified: true,
      },
      select: { id: true },
    });

    const me = await prisma.marketingEmail.create({
      data: {
        sentByAdminId: admin.id,
        subject: '__SMOKE__ Bug003',
        bodyText: '__SMOKE__ Body',
        filterServices: '[]',
        recipientCount: 0,
        status: 'draft',
      },
      select: { id: true },
    });

    const result = await performMarketingBulkSend({
      marketingEmailId: me.id,
      subject: '__SMOKE__ Bug003',
      body: '__SMOKE__ Body',
      recipientCustomerIds: [customerNoBooking.id],
      strictRecipients: true,
    });

    if (
      !result.ok &&
      result.errorCode === 'INVALID_RECIPIENTS' &&
      result.excludedRecipientIds.includes(customerNoBooking.id)
    ) {
      ok('strictRecipients=true wirft INVALID_RECIPIENTS für Customer ohne COMPLETED-Booking');
    } else {
      bad('UWG-Filter hat Customer ohne COMPLETED-Booking NICHT abgelehnt!');
    }

    // Cleanup.
    await prisma.marketingEmail.delete({ where: { id: me.id } }).catch(() => {});
    await prisma.customerUser.delete({ where: { id: customerNoBooking.id } });
  });

  await group('IT12-S15 — IdempotencyKey-Tabelle existiert', async () => {
    const key = `__smoke__it12_${Date.now()}`;
    const created = await prisma.idempotencyKey.create({
      data: {
        key,
        response: '{}',
        expiresAt: new Date(Date.now() + 1000),
      },
      select: { id: true, key: true },
    });
    if (created.key === key) ok('IdempotencyKey.create funktioniert');
    else bad('IdempotencyKey roundtrip fehlgeschlagen');
    await prisma.idempotencyKey.delete({ where: { id: created.id } });
    ok('IdempotencyKey.delete funktioniert');
  });

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
