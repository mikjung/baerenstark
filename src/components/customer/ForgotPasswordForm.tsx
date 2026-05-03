'use client';

/**
 * ForgotPasswordForm — Iteration 7 / US-IT7-05.
 *
 * E-Mail-Eingabefeld, Submit ruft `POST /api/customer/forgot-password`.
 *
 * **Email-Enumeration-Schutz (m1-IT7-konform):** Egal ob die Email
 * existiert oder nicht — die Erfolgs-Meldung ist identisch:
 *   „Falls ein Konto mit dieser Adresse existiert, haben wir dir einen
 *    Reset-Link geschickt."
 *
 * Das Frontend reagiert auf einen 2xx-Response IMMER mit der gleichen
 * neutralen Meldung. Validation/Rate-Limit-Fehler werden separat angezeigt.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiClientError, forgotPassword } from '@/lib/api-client';
import {
  CustomerForgotPasswordSchema,
  type CustomerForgotPasswordInput,
} from '@/lib/schemas';

function mapApiErrorMessage(err: ApiClientError): string {
  switch (err.code) {
    case 'RATE_LIMITED':
      return 'Zu viele Anfragen. Bitte später erneut versuchen.';
    case 'VALIDATION_ERROR':
      return err.message || 'Bitte eine gültige E-Mail-Adresse angeben.';
    case 'NETWORK_ERROR':
      return 'Verbindung zum Server fehlgeschlagen. Bitte Internetverbindung prüfen.';
    default:
      return 'Anfrage fehlgeschlagen. Bitte später erneut versuchen.';
  }
}

export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerForgotPasswordInput>({
    resolver: zodResolver(CustomerForgotPasswordSchema),
    mode: 'onBlur',
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await forgotPassword(values);
      setSubmittedEmail(values.email);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(mapApiErrorMessage(err));
      } else {
        setServerError('Anfrage fehlgeschlagen. Bitte erneut versuchen.');
      }
      setSubmitting(false);
    }
  });

  if (submittedEmail) {
    return (
      <div className="space-y-4">
        <Banner tone="success" title="Anfrage erhalten" role="status">
          Falls ein Konto mit der Adresse <strong>{submittedEmail}</strong>{' '}
          existiert, haben wir dir einen Reset-Link geschickt. Bitte prüfe dein
          Postfach (auch den Spam-Ordner). Der Link ist 1 Stunde gültig.
        </Banner>
        <p className="text-sm text-baerenstark-bark/80">
          Keine E-Mail erhalten?{' '}
          <button
            type="button"
            onClick={() => {
              setSubmittedEmail(null);
            }}
            className="text-baerenstark-wood underline-offset-2 hover:underline"
          >
            Erneut anfordern
          </button>
        </p>
        <p className="text-sm">
          <Link
            href="/konto/login"
            className="text-baerenstark-wood underline-offset-2 hover:underline"
          >
            ← Zurück zur Anmeldung
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <p className="text-sm text-baerenstark-bark/80">
        Gib die E-Mail-Adresse deines Kontos ein. Wir schicken dir einen Link,
        mit dem du dein Passwort zurücksetzen kannst.
      </p>

      <Input
        label="E-Mail"
        type="email"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register('email')}
      />

      {serverError && (
        <Banner tone="error" role="alert">
          {serverError}
        </Banner>
      )}

      <Button type="submit" isLoading={submitting} className="w-full">
        Reset-Link anfordern
      </Button>

      <p className="text-center text-sm">
        <Link
          href="/konto/login"
          className="text-baerenstark-wood underline-offset-2 hover:underline"
        >
          ← Zurück zur Anmeldung
        </Link>
      </p>
    </form>
  );
}
