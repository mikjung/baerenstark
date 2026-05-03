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
import { toast } from '@/lib/toast';

function mapApiErrorMessage(err: ApiClientError): string {
  switch (err.code) {
    case 'RATE_LIMITED':
      return 'Zu viele Versuche. Bitte versuchen Sie es in einer Stunde erneut oder rufen Sie uns an: 0157-74787512.';
    case 'VALIDATION_ERROR':
      return err.message || 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
    case 'NETWORK_ERROR':
      return 'Wir konnten den Server nicht erreichen. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.';
    default:
      return 'Wir konnten den Reset-Link gerade nicht senden. Bitte versuchen Sie es in einer Minute erneut.';
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
      // IT10 / Spec §2.2 Punkt 4: zusätzlicher Erfolgs-Toast.
      toast.success('Falls die Adresse registriert ist, ist die E-Mail unterwegs.');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(mapApiErrorMessage(err));
      } else {
        setServerError(
          'Wir konnten den Reset-Link gerade nicht senden. Bitte versuchen Sie es in einer Minute erneut.',
        );
      }
      setSubmitting(false);
    }
  });

  if (submittedEmail) {
    return (
      <div className="space-y-4">
        <Banner tone="success" title="Bitte prüfen Sie Ihr Postfach" role="status">
          Falls <strong>{submittedEmail}</strong> registriert ist, finden Sie
          dort einen Link zum Zurücksetzen. Der Link ist 1 Stunde gültig.
        </Banner>
        <p className="text-sm text-baerenstark-bark/80">
          Falscher Tippfehler?{' '}
          <button
            type="button"
            onClick={() => {
              setSubmittedEmail(null);
            }}
            className="text-baerenstark-wood underline-offset-2 hover:underline"
          >
            Erneut versuchen
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
        Geben Sie die E-Mail-Adresse Ihres Kontos ein. Wir schicken Ihnen einen
        Link zum Zurücksetzen.
      </p>

      <Input
        label="E-Mail-Adresse"
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
        {submitting ? 'Wird gesendet…' : 'Link anfordern'}
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
