'use client';

/**
 * AnfrageForm — einfaches Kontakt-/Anfrage-Formular.
 *
 * Sendet Daten an POST /api/anfrage (multipart/form-data).
 * Keine Datenbank, keine Terminplanung — Kommunikation läuft per E-Mail.
 */

import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { CONTACT } from '@/lib/contact';
import { SERVICE_LIST, type Service } from '@/lib/services';

const SERVICE_OPTIONS = SERVICE_LIST.map((s) => ({ value: s.slug, label: s.label }));
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const ACCEPTED_MIME = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

interface AnfrageFormProps {
  defaultService?: Service | null;
  /** Optional callback nach erfolgreichem Submit (z.B. um Dialog zu schließen). */
  onSuccess?: () => void;
  /** Render-Variante: 'page' (Standalone) oder 'dialog' (kompakter). */
  variant?: 'page' | 'dialog';
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AnfrageForm({
  defaultService = null,
  onSuccess,
  variant = 'page',
}: AnfrageFormProps) {
  const formId = useId();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function clearFieldError(name: string) {
    if (errors[name]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[name];
        return next;
      });
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    const merged = [...files, ...incoming].slice(0, MAX_ATTACHMENTS);
    const filtered = merged.filter((f) => f.size <= MAX_ATTACHMENT_BYTES);
    setFiles(filtered);
    // Input leeren, damit dieselbe Datei erneut auswählbar wäre.
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeFile(idx: number) {
    setFiles((arr) => arr.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === 'submitting') return;

    const form = e.currentTarget;
    const data = new FormData(form);

    // Manuell statt FormData(form) für Dateien, weil wir den State-File-Array nehmen.
    data.delete('attachments');
    for (const f of files) {
      data.append('attachments', f, f.name);
    }

    setStatus({ kind: 'submitting' });
    setErrors({});

    try {
      const res = await fetch('/api/anfrage', {
        method: 'POST',
        body: data,
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        errors?: Record<string, string>;
      };
      if (res.ok && json.ok) {
        setStatus({ kind: 'success' });
        onSuccess?.();
        return;
      }
      if (res.status === 422 && json.errors) {
        setErrors(json.errors);
        setStatus({ kind: 'idle' });
        return;
      }
      setStatus({
        kind: 'error',
        message:
          json.error ||
          `Wir konnten Ihre Anfrage gerade nicht senden. Bitte versuchen Sie es erneut oder rufen Sie uns an: ${CONTACT.phoneDisplay}.`,
      });
    } catch {
      setStatus({
        kind: 'error',
        message: `Verbindung fehlgeschlagen. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut. Alternativ erreichen Sie uns unter ${CONTACT.phoneDisplay}.`,
      });
    }
  }

  if (status.kind === 'success') {
    return (
      <Banner tone="success" title="Vielen Dank — Ihre Anfrage ist bei uns eingegangen!" role="status">
        <p className="mb-3">
          Wir melden uns zeitnah bei Ihnen, um die Details zu besprechen. Eine
          Eingangsbestätigung finden Sie in Ihrer E-Mail.
        </p>
        <p className="text-xs text-baerenstark-bark/70">
          Falls Sie es eilig haben, erreichen Sie uns auch telefonisch unter{' '}
          <a
            href={`tel:${CONTACT.phoneTel}`}
            className="font-medium text-baerenstark-wood underline-offset-2 hover:underline"
          >
            {CONTACT.phoneDisplay}
          </a>
          .
        </p>
      </Banner>
    );
  }

  const isBusy = status.kind === 'submitting';
  const wrapperClasses =
    variant === 'page'
      ? 'rounded-2xl border border-baerenstark-sand bg-white/80 p-6 shadow-soft'
      : '';

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      noValidate
      aria-busy={isBusy || undefined}
      className={wrapperClasses}
    >
      {status.kind === 'error' && (
        <div className="mb-5">
          <Banner tone="error" title="Anfrage konnte nicht gesendet werden" role="alert">
            <p>{status.message}</p>
          </Banner>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Name"
          name="customerName"
          required
          autoComplete="name"
          placeholder="Maria Mustermann"
          error={errors.customerName}
          onChange={() => clearFieldError('customerName')}
        />
        <Input
          label="Telefon"
          name="customerPhone"
          required
          type="tel"
          autoComplete="tel"
          placeholder="0157 1234567"
          hint="Mind. 6 Ziffern. Erlaubt sind Ziffern, +, -, /, ( )"
          error={errors.customerPhone}
          onChange={() => clearFieldError('customerPhone')}
        />
        <Input
          label="E-Mail-Adresse"
          name="customerEmail"
          required
          type="email"
          autoComplete="email"
          placeholder="maria@example.com"
          hint="Wir antworten direkt auf diese Adresse."
          error={errors.customerEmail}
          onChange={() => clearFieldError('customerEmail')}
        />
        <Select
          label="Dienstleistung"
          name="service"
          required
          options={SERVICE_OPTIONS}
          placeholder="Bitte wählen"
          defaultValue={defaultService ?? ''}
          error={errors.service}
          onChange={() => clearFieldError('service')}
        />
      </div>

      <div className="mt-4">
        <Textarea
          label="Beschreibung"
          name="description"
          required
          rows={5}
          placeholder="Was muss gemacht werden? (z.B. Keller mit ca. 30 m³ entrümpeln, Termin-Wunsch nächste Woche)"
          hint="Beschreiben Sie Ihr Anliegen so genau wie möglich — gerne auch mit Wunschtermin."
          error={errors.description}
          onChange={() => clearFieldError('description')}
        />
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm font-medium text-baerenstark-bark">
          Fotos oder PDF anhängen (optional)
        </p>
        <p className="mb-3 text-xs text-baerenstark-bark/70">
          Bis zu {MAX_ATTACHMENTS} Dateien, je max. 8 MB. Akzeptierte Formate:
          JPG, PNG, WEBP, HEIC, PDF.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_MIME}
          onChange={handleFileChange}
          className="block w-full text-sm text-baerenstark-bark file:mr-3 file:rounded-lg file:border-0 file:bg-baerenstark-sand file:px-4 file:py-2 file:text-sm file:font-medium file:text-baerenstark-bark hover:file:bg-baerenstark-accent"
          disabled={files.length >= MAX_ATTACHMENTS}
        />
        {files.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {files.map((f, idx) => (
              <li
                key={`${f.name}-${idx}`}
                className="flex items-center justify-between rounded-md border border-baerenstark-sand bg-baerenstark-cream/50 px-3 py-2 text-sm"
              >
                <span className="truncate">
                  📎 {f.name}{' '}
                  <span className="text-xs text-baerenstark-bark/60">
                    ({humanSize(f.size)})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="ml-2 text-xs font-medium text-baerenstark-wood hover:underline"
                >
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 rounded-lg border border-baerenstark-sand bg-baerenstark-cream/60 p-3">
        <label className="flex items-start gap-3 text-sm text-baerenstark-bark">
          <input
            type="checkbox"
            name="privacyAccepted"
            value="1"
            className="mt-0.5 h-5 w-5 cursor-pointer accent-baerenstark-wood"
            aria-required="true"
            aria-invalid={errors.privacyAccepted ? true : undefined}
            onChange={() => clearFieldError('privacyAccepted')}
          />
          <span>
            Ich habe die{' '}
            <Link
              href="/datenschutz"
              className="text-baerenstark-wood underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener"
            >
              Datenschutzerklärung
            </Link>{' '}
            gelesen und stimme der Verarbeitung meiner Daten zur Bearbeitung der
            Anfrage zu. <span aria-hidden="true">*</span>
          </span>
        </label>
        {errors.privacyAccepted && (
          <p role="alert" className="mt-2 text-xs font-medium text-red-700">
            {errors.privacyAccepted}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="submit" isLoading={isBusy}>
          {isBusy ? 'Anfrage wird gesendet…' : 'Anfrage absenden'}
        </Button>
      </div>
    </form>
  );
}
