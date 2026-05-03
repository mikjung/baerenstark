/**
 * Frontend-Smoke-Tests für Iteration 10.
 *
 * Diese Tests prüfen die statischen Verträge der neuen IT10-Komponenten und
 * Helper, ohne ein UI-Test-Framework (RTL, Vitest etc.) zu benötigen — das
 * Repo trägt bisher nur tsx-basierte Smoke-Tests, dem schließen wir uns an.
 *
 * Lauf: `npx tsx tests/it10-frontend.test.ts`
 */

import { ApiClientError } from '../src/lib/api-client';
import { toast } from '../src/lib/toast';
import { subscribeToasts, type ToastEntry } from '../src/lib/toast';

let pass = 0;
let fail = 0;

function ok(name: string) {
  pass++;
  console.log(`  PASS  ${name}`);
}
function bad(name: string, err?: unknown) {
  fail++;
  console.log(`  FAIL  ${name}`);
  if (err) console.error(err);
}

function assert(cond: unknown, name: string) {
  if (cond) ok(name);
  else bad(name);
}

async function main() {
  console.log('IT10 Frontend Smoke-Tests');

  // 1. ApiClientError trägt subcode (ARCHITECTURE_IT10 §9.1).
  {
    const err = new ApiClientError(
      409,
      'CONFLICT',
      'Slot taken',
      'date',
      'BOOKING_SLOT_TAKEN',
    );
    assert(err.subcode === 'BOOKING_SLOT_TAKEN', 'ApiClientError carries subcode');
    assert(err.code === 'CONFLICT', 'ApiClientError preserves code');
    assert(err.field === 'date', 'ApiClientError preserves field');
    assert(err.status === 409, 'ApiClientError preserves status');
  }

  // 2. Toast-Service: API existiert + ID wird zurückgegeben.
  {
    let received: ToastEntry[] = [];
    const unsub = subscribeToasts((items) => {
      received = items;
    });
    const id = toast.success('Test');
    assert(typeof id === 'string' && id.length > 0, 'toast.success returns id');
    assert(
      received.some((t) => t.message === 'Test' && t.variant === 'success'),
      'subscribeToasts receives entry',
    );
    toast.dismiss(id);
    assert(
      !received.some((t) => t.id === id),
      'toast.dismiss removes entry',
    );
    unsub();
  }

  // 3. Toast stack capped at 3.
  {
    const ids: string[] = [];
    let received: ToastEntry[] = [];
    const unsub = subscribeToasts((items) => {
      received = items;
    });
    for (let i = 0; i < 5; i++) ids.push(toast.info(`Msg ${i}`, { duration: null }));
    assert(received.length <= 3, 'Toast stack capped at 3');
    for (const id of ids) toast.dismiss(id);
    unsub();
  }

  // 4. BookingStatusBadge label-Mapping (smoke import).
  {
    const mod = await import('../src/components/customer/BookingStatusBadge');
    assert(typeof mod.BookingStatusBadge === 'function', 'BookingStatusBadge exported');
  }

  // 5. QuickBookingModal export.
  {
    const mod = await import('../src/components/booking/QuickBookingModal');
    assert(
      typeof mod.QuickBookingModal === 'function',
      'QuickBookingModal exported',
    );
  }

  // 6. PaginationControls export.
  {
    const mod = await import('../src/components/ui/PaginationControls');
    assert(
      typeof mod.PaginationControls === 'function',
      'PaginationControls exported',
    );
  }

  // 7. EmptyState + ErrorState exports.
  {
    const e = await import('../src/components/ui/EmptyState');
    const r = await import('../src/components/ui/ErrorState');
    assert(typeof e.EmptyState === 'function', 'EmptyState exported');
    assert(typeof r.ErrorState === 'function', 'ErrorState exported');
  }

  console.log('');
  console.log(`  ${pass} passed, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

void main();
