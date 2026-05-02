'use client';

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

export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

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
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'RATE_LIMITED') {
        setServerError(
          'Zu viele Anfragen. Bitte später erneut versuchen.',
        );
      } else {
        // Auch bei Netzwerkfehler die generische Erfolgsmeldung anzeigen,
        // ist hier UX-mäßig vertretbar — aber wir bleiben transparent und
        // zeigen einen Server-Fehler.
        setServerError(
          err instanceof ApiClientError
            ? err.message
            : 'Anfrage fehlgeschlagen. Bitte erneut versuchen.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  });

  if (success) {
    return (
      <div className="space-y-4">
        <Banner tone="success" role="status">
          Falls diese E-Mail registriert ist, erhältst du in Kürze einen
          Reset-Link.
        </Banner>
        <p className="text-sm text-baerenstark-bark/80">
          Hinweis: Aus Sicherheitsgründen geben wir nicht preis, ob ein Konto
          mit dieser E-Mail-Adresse existiert.
        </p>
        <p className="text-center text-sm">
          <Link
            href="/konto/login"
            className="text-baerenstark-wood underline-offset-2 hover:underline"
          >
            Zurück zum Login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
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
        Reset-Link senden
      </Button>

      <p className="pt-2 text-center text-sm text-baerenstark-bark/80">
        <Link
          href="/konto/login"
          className="text-baerenstark-wood underline-offset-2 hover:underline"
        >
          Zurück zum Login
        </Link>
      </p>
    </form>
  );
}
