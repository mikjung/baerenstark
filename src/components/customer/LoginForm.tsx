'use client';

/**
 * LoginForm — Iteration 7 / US-IT7-01.
 *
 * Email/Password-Form ist wieder primär (oben), darunter folgen die beiden
 * OAuth-Buttons (Google, Facebook). OAuth bleibt als Convenience-Methode
 * parallel verfügbar.
 *
 * Layout:
 *   1. Email-Form (Standard).
 *   2. Divider „oder".
 *   3. Google-Button.
 *   4. Facebook-Button.
 *   5. Footer: „Passwort vergessen?" + „Noch kein Konto? Registrieren".
 *
 * Fehler-Handling:
 *   - `?error=…` Query-Param aus dem OAuth-Flow → deutscher Banner oben.
 *   - `?reset=success` → Erfolgs-Banner nach erfolgreichem Reset.
 *   - `INVALID_CREDENTIALS` (401) → „E-Mail oder Passwort ungültig" — kein
 *     Hint, welches Feld falsch ist (Email-Enumeration-Schutz).
 *   - `OAUTH_ONLY_ACCOUNT` (422) → Hinweis, OAuth zu nutzen.
 *   - `RATE_LIMITED` (429) → freundliche Meldung.
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
} from '@/lib/api-client';
import {
  CustomerLoginSchema,
  type CustomerLoginInput,
} from '@/lib/schemas';

type Provider = 'google' | 'facebook';

const CUSTOMER_AUTH_BASE_PATH = '/api/auth/customer';

function mapOAuthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case 'oauth_no_email':
      return 'Mit deinem Konto ist keine E-Mail-Adresse verknüpft. Bitte registriere dich per E-Mail und Passwort.';
    case 'oauth_unverified_conflict':
      return 'Es existiert bereits ein Konto mit dieser E-Mail-Adresse. Bitte melde dich mit dem ursprünglichen Anbieter an oder setze dein Passwort über „Passwort vergessen?" zurück.';
    case 'oauth_unverified':
      return 'Dein Anbieter-Konto hat keine bestätigte E-Mail-Adresse.';
    case 'oauth_finalize_failed':
      return 'Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.';
    case 'oauth_error':
      return 'Die Anmeldung wurde abgebrochen oder ist fehlgeschlagen. Bitte erneut versuchen.';
    case 'session_expired':
      return 'Deine Sitzung ist abgelaufen. Bitte erneut anmelden.';
    default:
      return null;
  }
}

function mapApiErrorMessage(err: ApiClientError): string {
  switch (err.code) {
    case 'INVALID_CREDENTIALS':
    case 'UNAUTHORIZED':
      return 'E-Mail oder Passwort ungültig.';
    case 'OAUTH_ONLY_ACCOUNT':
      return 'Dieses Konto wurde mit Google oder Facebook angelegt. Bitte melde dich über einen der OAuth-Buttons unten an oder setze dein Passwort über „Passwort vergessen?".';
    case 'RATE_LIMITED':
      return 'Zu viele Anmelde-Versuche. Bitte später erneut versuchen.';
    case 'VALIDATION_ERROR':
      return err.message || 'Bitte E-Mail-Adresse und Passwort prüfen.';
    case 'NETWORK_ERROR':
      return 'Verbindung zum Server fehlgeschlagen. Bitte Internetverbindung prüfen.';
    default:
      return 'Anmeldung fehlgeschlagen. Bitte später erneut versuchen.';
  }
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const oauthErrorMessage = mapOAuthErrorMessage(searchParams.get('error'));
  const resetSuccess = searchParams.get('reset') === 'success';
  const verifySuccess = searchParams.get('verified') === '1';

  const callbackUrlRaw = searchParams.get('callbackUrl') ?? '/konto';
  // Defensiv: nur same-origin (relative Pfade) zulassen, kein offenes Redirect.
  const callbackUrl = callbackUrlRaw.startsWith('/') ? callbackUrlRaw : '/konto';

  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerLoginInput>({
    resolver: zodResolver(CustomerLoginSchema),
    mode: 'onBlur',
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSubmitting(true);
    try {
      const result = await loginCustomer({
        email: values.email,
        password: values.password,
        redirectUrl: callbackUrl,
      });
      // Backend hat das Session-Cookie gesetzt → weiter zum Ziel.
      const target =
        result.redirectUrl && result.redirectUrl.startsWith('/')
          ? result.redirectUrl
          : '/konto';
      router.replace(target);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(mapApiErrorMessage(err));
      } else {
        setServerError('Anmeldung fehlgeschlagen. Bitte erneut versuchen.');
      }
      setSubmitting(false);
    }
  });

  const handleOAuthClick = async (provider: Provider) => {
    setPendingProvider(provider);
    try {
      const csrfRes = await fetch(`${CUSTOMER_AUTH_BASE_PATH}/csrf`, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!csrfRes.ok) throw new Error('csrf_fetch_failed');
      const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
      if (!csrfToken) throw new Error('csrf_token_missing');

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `${CUSTOMER_AUTH_BASE_PATH}/signin/${provider}`;
      form.style.display = 'none';

      const csrfInput = document.createElement('input');
      csrfInput.type = 'hidden';
      csrfInput.name = 'csrfToken';
      csrfInput.value = csrfToken;
      form.appendChild(csrfInput);

      const callbackInput = document.createElement('input');
      callbackInput.type = 'hidden';
      callbackInput.name = 'callbackUrl';
      callbackInput.value = `${window.location.origin}/konto/oauth-erfolg`;
      form.appendChild(callbackInput);

      document.body.appendChild(form);
      form.submit();
    } catch {
      setPendingProvider(null);
      setServerError('Anmeldung konnte nicht gestartet werden. Bitte erneut versuchen.');
    }
  };

  return (
    <div className="space-y-5">
      {oauthErrorMessage && (
        <Banner tone="error" title="Anmeldung fehlgeschlagen" role="alert">
          {oauthErrorMessage}
        </Banner>
      )}

      {resetSuccess && (
        <Banner tone="success" role="status">
          Passwort erfolgreich geändert. Bitte melde dich mit dem neuen Passwort an.
        </Banner>
      )}

      {verifySuccess && (
        <Banner tone="success" role="status">
          E-Mail bestätigt. Du kannst dich jetzt einloggen.
        </Banner>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Input
          label="E-Mail"
          type="email"
          autoComplete="email"
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

        {serverError && (
          <Banner tone="error" role="alert">
            {serverError}
          </Banner>
        )}

        <Button type="submit" isLoading={submitting} className="w-full">
          Einloggen
        </Button>

        <p className="text-center text-sm">
          <Link
            href="/konto/passwort-vergessen"
            className="text-baerenstark-wood underline-offset-2 hover:underline"
          >
            Passwort vergessen?
          </Link>
        </p>
      </form>

      <div className="relative my-2" aria-hidden="true">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-baerenstark-sand" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-baerenstark-bark/60">oder</span>
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => handleOAuthClick('google')}
          disabled={pendingProvider !== null || submitting}
          aria-label="Mit Google anmelden"
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-baerenstark-sand bg-white px-4 py-3 text-sm font-medium text-baerenstark-bark hover:bg-baerenstark-cream/50 transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent"
        >
          <GoogleIcon />
          <span>
            {pendingProvider === 'google'
              ? 'Wird umgeleitet …'
              : 'Mit Google anmelden'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleOAuthClick('facebook')}
          disabled={pendingProvider !== null || submitting}
          aria-label="Mit Facebook anmelden"
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-transparent bg-[#1877F2] px-4 py-3 text-sm font-medium text-white hover:bg-[#155EBF] transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent"
        >
          <FacebookIcon />
          <span>
            {pendingProvider === 'facebook'
              ? 'Wird umgeleitet …'
              : 'Mit Facebook anmelden'}
          </span>
        </button>
      </div>

      <p className="text-center text-sm text-baerenstark-bark/80">
        Noch kein Konto?{' '}
        <Link
          href="/konto/registrieren"
          className="font-medium text-baerenstark-wood underline-offset-2 hover:underline"
        >
          Jetzt registrieren
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.099 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.412c0-3.014 1.792-4.683 4.532-4.683 1.314 0 2.687.235 2.687.235v2.97h-1.514c-1.49 0-1.954.927-1.954 1.878v2.255h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}
