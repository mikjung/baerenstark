'use client';

/**
 * LoginForm — Iteration 6 / US-IT6-05.
 *
 * Email/Password und GitHub-Provider sind komplett entfernt. Es gibt
 * ausschließlich zwei OAuth-Buttons: Google und Facebook.
 *
 * Die Komponente liest `?error=`-Parameter aus dem Customer-NextAuth-Flow
 * und zeigt freundliche, deutschsprachige Fehlermeldungen.
 */

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Banner } from '@/components/ui/Banner';

type Provider = 'google' | 'facebook';

const CUSTOMER_AUTH_BASE_PATH = '/api/auth/customer';

function mapErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case 'oauth_no_email':
      return 'Dein Anbieter hat keine E-Mail-Adresse übermittelt. Bitte erlaube den E-Mail-Zugriff bei Google oder Facebook und versuche es erneut.';
    case 'oauth_unverified_conflict':
      return 'Es existiert bereits ein Konto mit dieser E-Mail-Adresse. Bitte melde dich mit dem ursprünglichen Anbieter an.';
    case 'oauth_unverified':
      return 'Dein Anbieter-Konto hat keine bestätigte E-Mail-Adresse.';
    case 'oauth_finalize_failed':
      return 'Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.';
    case 'oauth_error':
      return 'Die Anmeldung wurde abgebrochen oder ist fehlgeschlagen. Bitte erneut versuchen.';
    case 'legacy_credentials':
      return 'Die E-Mail/Passwort-Anmeldung ist nicht mehr verfügbar. Bitte melde dich mit Google oder Facebook unter derselben E-Mail-Adresse an.';
    default:
      return null;
  }
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const errorQuery = searchParams.get('error');
  const errorMessage = mapErrorMessage(errorQuery);
  const [pending, setPending] = useState<Provider | null>(null);

  const handleClick = (provider: Provider) => {
    setPending(provider);
    window.location.href = `${CUSTOMER_AUTH_BASE_PATH}/${provider}`;
  };

  return (
    <div className="space-y-5">
      {errorMessage && (
        <Banner tone="error" title="Anmeldung fehlgeschlagen" role="alert">
          {errorMessage}
        </Banner>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => handleClick('google')}
          disabled={pending !== null}
          aria-label="Mit Google fortfahren"
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-baerenstark-sand bg-white px-4 py-3 text-sm font-medium text-baerenstark-bark hover:bg-baerenstark-cream/50 transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent"
        >
          <GoogleIcon />
          <span>
            {pending === 'google' ? 'Wird umgeleitet …' : 'Mit Google fortfahren'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleClick('facebook')}
          disabled={pending !== null}
          aria-label="Mit Facebook fortfahren"
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-transparent bg-[#1877F2] px-4 py-3 text-sm font-medium text-white hover:bg-[#155EBF] transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent"
        >
          <FacebookIcon />
          <span>
            {pending === 'facebook' ? 'Wird umgeleitet …' : 'Mit Facebook fortfahren'}
          </span>
        </button>
      </div>

      <p className="rounded-md border border-baerenstark-sand bg-baerenstark-cream/50 p-3 text-xs leading-relaxed text-baerenstark-bark/80">
        Eine Anmeldung mit E-Mail und Passwort ist nicht mehr möglich. Falls
        du früher einen Account hattest, melde dich bitte mit Google oder
        Facebook unter derselben E-Mail-Adresse an — bestehende Buchungen
        werden automatisch verknüpft.
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
