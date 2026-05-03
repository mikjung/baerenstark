'use client';

/**
 * ResetPasswordForm — Iteration 7 / US-IT7-05.
 *
 * Liest `?token=...` aus der URL. Zwei Felder (neues Passwort + Bestätigung).
 * Submit → `POST /api/customer/reset-password`.
 *
 * Erfolg: Redirect zu `/konto/login?reset=success`.
 * 410 GONE (Token abgelaufen / bereits verbraucht): freundlicher Hinweis +
 *   Link zu `/konto/passwort-vergessen`.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiClientError, resetPassword } from '@/lib/api-client';
import {
  CUSTOMER_PASSWORD_MIN_LENGTH,
  CustomerResetPasswordSchema,
  type CustomerResetPasswordInput,
} from '@/lib/schemas';

function mapApiErrorMessage(err: ApiClientError): {
  message: string;
  showResetLink: boolean;
} {
  switch (err.code) {
    case 'INVALID_OR_EXPIRED_TOKEN':
    case 'GONE':
      return {
        message:
          'Dieser Link ist nicht mehr gültig oder wurde bereits verwendet. Bitte fordere einen neuen Reset-Link an.',
        showResetLink: true,
      };
    case 'RATE_LIMITED':
      return {
        message: 'Zu viele Anfragen. Bitte später erneut versuchen.',
        showResetLink: false,
      };
    case 'VALIDATION_ERROR':
      return {
        message: err.message || 'Bitte ein gültiges Passwort wählen.',
        showResetLink: false,
      };
    case 'NETWORK_ERROR':
      return {
        message:
          'Verbindung zum Server fehlgeschlagen. Bitte Internetverbindung prüfen.',
        showResetLink: false,
      };
    default:
      return {
        message: 'Passwort-Reset fehlgeschlagen. Bitte später erneut versuchen.',
        showResetLink: false,
      };
  }
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<{
    message: string;
    showResetLink: boolean;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerResetPasswordInput>({
    resolver: zodResolver(CustomerResetPasswordSchema),
    mode: 'onBlur',
    defaultValues: {
      token,
      password: '',
      passwordConfirm: '',
    },
  });

  if (!token) {
    return (
      <div className="space-y-4">
        <Banner tone="error" title="Link unvollständig" role="alert">
          Der Reset-Link ist unvollständig. Bitte fordere einen neuen Link an.
        </Banner>
        <Link
          href="/konto/passwort-vergessen"
          className="inline-flex w-full items-center justify-center rounded-lg bg-baerenstark-wood px-5 py-2.5 text-base font-medium text-baerenstark-cream transition-colors hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent"
        >
          Neuen Reset-Link anfordern
        </Link>
      </div>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await resetPassword({
        token,
        password: values.password,
        passwordConfirm: values.passwordConfirm,
      });
      router.replace('/konto/login?reset=success');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(mapApiErrorMessage(err));
      } else {
        setServerError({
          message: 'Passwort-Reset fehlgeschlagen. Bitte erneut versuchen.',
          showResetLink: false,
        });
      }
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <p className="text-sm text-baerenstark-bark/80">
        Wähle ein neues Passwort für dein Konto. Es muss mindestens{' '}
        {CUSTOMER_PASSWORD_MIN_LENGTH} Zeichen haben.
      </p>

      <input type="hidden" {...register('token')} value={token} readOnly />

      <Input
        label="Neues Passwort"
        type="password"
        autoComplete="new-password"
        required
        hint={`Mindestens ${CUSTOMER_PASSWORD_MIN_LENGTH} Zeichen.`}
        error={errors.password?.message}
        {...register('password')}
      />

      <Input
        label="Passwort bestätigen"
        type="password"
        autoComplete="new-password"
        required
        error={errors.passwordConfirm?.message}
        {...register('passwordConfirm')}
      />

      {serverError && (
        <div className="space-y-2">
          <Banner tone="error" role="alert">
            {serverError.message}
          </Banner>
          {serverError.showResetLink && (
            <p className="text-sm">
              <Link
                href="/konto/passwort-vergessen"
                className="text-baerenstark-wood underline-offset-2 hover:underline"
              >
                Neuen Reset-Link anfordern
              </Link>
            </p>
          )}
        </div>
      )}

      <Button type="submit" isLoading={submitting} className="w-full">
        Passwort ändern
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
