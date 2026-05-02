'use client';

/**
 * LoginForm — Client-Komponente für /konto/login.
 *
 * Liest `?callbackUrl=/konto/...` aus der Query (Middleware setzt das beim
 * Redirect von geschützten Seiten) und reicht es als `redirectUrl` an den
 * Login-Endpoint. Server validiert via `safeCustomerCallback()` und gibt
 * den geprüften Pfad in `data.redirectUrl` zurück.
 *
 * Bei 422 EMAIL_NOT_VERIFIED wird ein "Bestätigungs-E-Mail erneut senden"-
 * Button angezeigt.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  ApiClientError,
  loginCustomer,
  resendVerification,
} from '@/lib/api-client';
import { safeCustomerCallback } from '@/lib/customer-portal';
import { CustomerLoginSchema, type CustomerLoginInput } from '@/lib/schemas';

const GENERIC_LOGIN_ERROR = 'E-Mail oder Passwort falsch.';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCustomerCallback(
    searchParams.get('callbackUrl') ?? searchParams.get('redirectUrl'),
  );
  const verifiedQuery = searchParams.get('verified');
  const errorQuery = searchParams.get('error');

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<CustomerLoginInput>({
    resolver: zodResolver(CustomerLoginSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
      redirectUrl: callbackUrl,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setNeedsVerification(null);
    setResendSuccess(null);
    setSubmitting(true);
    try {
      const result = await loginCustomer({
        email: values.email,
        password: values.password,
        redirectUrl: callbackUrl,
      });
      const target = safeCustomerCallback(result.redirectUrl);
      router.replace(target);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          setServerError(GENERIC_LOGIN_ERROR);
        } else if (err.code === 'EMAIL_NOT_VERIFIED' || err.status === 422) {
          setNeedsVerification(values.email);
        } else if (err.code === 'RATE_LIMITED') {
          setServerError('Zu viele Login-Versuche. Bitte 15 Minuten warten.');
        } else {
          setServerError(err.message || GENERIC_LOGIN_ERROR);
        }
      } else {
        setServerError(GENERIC_LOGIN_ERROR);
      }
      setSubmitting(false);
    }
  });

  const onResend = async () => {
    if (!needsVerification) return;
    setResending(true);
    setResendSuccess(null);
    try {
      await resendVerification(needsVerification);
      setResendSuccess(
        'Wir haben dir eine neue Bestätigungs-E-Mail gesendet (sofern dein Konto noch nicht verifiziert ist).',
      );
    } catch {
      setResendSuccess(
        'Wir haben dir eine neue Bestätigungs-E-Mail gesendet (sofern dein Konto noch nicht verifiziert ist).',
      );
    } finally {
      setResending(false);
    }
  };

  // Hinweise aus URL-Params (z.B. nach Verifikation)
  const queryBanner = (() => {
    if (verifiedQuery === '1') {
      return {
        tone: 'success' as const,
        message:
          'Deine E-Mail-Adresse wurde bestätigt. Du kannst dich jetzt einloggen.',
      };
    }
    if (errorQuery === 'invalid_token') {
      return {
        tone: 'error' as const,
        message:
          'Der Bestätigungslink ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an.',
      };
    }
    return null;
  })();

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {queryBanner && (
        <Banner tone={queryBanner.tone} role="status">
          {queryBanner.message}
        </Banner>
      )}

      <Input
        label="E-Mail"
        type="email"
        autoComplete="username"
        required
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="Passwort"
        type="password"
        autoComplete="current-password"
        required
        error={errors.password?.message}
        {...register('password')}
      />

      <div className="flex justify-end">
        <Link
          href="/konto/passwort-vergessen"
          className="text-sm text-baerenstark-wood underline-offset-2 hover:underline"
        >
          Passwort vergessen?
        </Link>
      </div>

      {serverError && (
        <Banner tone="error" role="alert">
          {serverError}
        </Banner>
      )}

      {needsVerification && (
        <Banner tone="warning" title="E-Mail-Adresse noch nicht bestätigt" role="alert">
          <p className="mb-3">
            Bitte bestätige zuerst deine E-Mail-Adresse, indem du den Link aus
            der Verifikations-E-Mail anklickst.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onResend}
            isLoading={resending}
          >
            Bestätigungs-E-Mail erneut senden
          </Button>
          {resendSuccess && (
            <p className="mt-2 text-sm text-green-900">{resendSuccess}</p>
          )}
        </Banner>
      )}

      <Button type="submit" isLoading={submitting} className="w-full">
        Einloggen
      </Button>

      <p className="pt-2 text-center text-sm text-baerenstark-bark/80">
        Noch kein Konto?{' '}
        <Link
          href={
            callbackUrl !== '/konto'
              ? `/konto/registrieren?callbackUrl=${encodeURIComponent(callbackUrl)}`
              : '/konto/registrieren'
          }
          className="text-baerenstark-wood underline-offset-2 hover:underline"
        >
          Jetzt registrieren
        </Link>
      </p>

      {/* Hidden marker for tests / dev tools — see getValues() if needed */}
      <input type="hidden" name="callbackUrl" value={getValues('redirectUrl') ?? callbackUrl} />
    </form>
  );
}
