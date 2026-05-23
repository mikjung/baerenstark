import { NextResponse } from 'next/server';
import { SERVICES, type Service } from '@/lib/services';
import {
  sendAnfrageToAdmin,
  sendAnfrageReceiptToCustomer,
  type AnfrageMailPayload,
} from '@/lib/anfrage-mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8 MB pro Datei
const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20 MB Gesamt
const MAX_ATTACHMENTS = 5;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

function trimOrNull(s: FormDataEntryValue | null): string {
  return typeof s === 'string' ? s.trim() : '';
}

function isService(s: string): s is Service {
  return (SERVICES as readonly string[]).includes(s);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/[^\d]/g, '');
  return digits.length >= 6 && /^[+\d\s\-/()]+$/.test(phone);
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Ungültige Anfrage-Daten.' },
      { status: 400 },
    );
  }

  const customerName = trimOrNull(form.get('customerName'));
  const customerPhone = trimOrNull(form.get('customerPhone'));
  const customerEmail = trimOrNull(form.get('customerEmail'));
  const serviceRaw = trimOrNull(form.get('service'));
  const description = trimOrNull(form.get('description'));
  const privacyAccepted = form.get('privacyAccepted');

  const errors: Record<string, string> = {};

  if (customerName.length < 2 || customerName.length > 120) {
    errors.customerName = 'Bitte geben Sie Ihren Namen an (mind. 2 Zeichen).';
  }
  if (!isValidPhone(customerPhone)) {
    errors.customerPhone = 'Bitte geben Sie eine gültige Telefonnummer an.';
  }
  if (!isValidEmail(customerEmail)) {
    errors.customerEmail = 'Bitte geben Sie eine gültige E-Mail-Adresse an.';
  }
  if (!isService(serviceRaw)) {
    errors.service = 'Bitte wählen Sie eine Dienstleistung aus.';
  }
  if (description.length < 10 || description.length > 5000) {
    errors.description = 'Bitte beschreiben Sie Ihr Anliegen (10–5000 Zeichen).';
  }
  if (!privacyAccepted) {
    errors.privacyAccepted = 'Bitte stimmen Sie der Datenschutzerklärung zu.';
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  const service = serviceRaw as Service;

  const files = form.getAll('attachments').filter((f): f is File => f instanceof File);
  const attachments: AnfrageMailPayload['attachments'] = [];
  let totalBytes = 0;

  if (files.length > MAX_ATTACHMENTS) {
    return NextResponse.json(
      { ok: false, error: `Maximal ${MAX_ATTACHMENTS} Dateien erlaubt.` },
      { status: 422 },
    );
  }

  for (const file of files) {
    if (file.size === 0) continue;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { ok: false, error: `Datei "${file.name}" ist größer als 8 MB.` },
        { status: 422 },
      );
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: `Dateityp "${file.type || 'unbekannt'}" wird nicht unterstützt.` },
        { status: 422 },
      );
    }
    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'Gesamtgröße der Anhänge überschreitet 20 MB.' },
        { status: 422 },
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    attachments.push({
      filename: file.name || `anhang-${attachments.length + 1}`,
      content: buf,
      contentType: file.type,
    });
  }

  const payload: AnfrageMailPayload = {
    customerName,
    customerPhone,
    customerEmail,
    service,
    description,
    attachments: attachments.length > 0 ? attachments : undefined,
  };

  const adminResult = await sendAnfrageToAdmin(payload);
  if (!adminResult.ok) {
    console.error('[anfrage] admin mail failed:', adminResult.error);
    return NextResponse.json(
      {
        ok: false,
        error:
          'Wir konnten Ihre Anfrage gerade nicht zustellen. Bitte versuchen Sie es erneut oder rufen Sie uns an: 0157 74787512.',
      },
      { status: 502 },
    );
  }

  // Kunden-Empfangsbestätigung best-effort, blockiert die Response nicht.
  sendAnfrageReceiptToCustomer(payload).then((res) => {
    if (!res.ok) {
      console.warn('[anfrage] customer receipt failed:', res.error);
    }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
