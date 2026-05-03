'use client';

/**
 * OAuthButtons — Iteration 5 (US-31).
 *
 * Wiederverwendbare Google/GitHub-Anmeldebuttons unter `/konto/login` und
 * `/konto/registrieren`.
 *
 * Strategie (siehe ARCHITECTURE.md §18.2.4):
 *   Wir leiten direkt zur OAuth-Provider-Route der Customer-NextAuth-Instanz
 *   weiter (`/api/auth/customer/<provider>`). Das vermeidet zwei
 *   `SessionProvider`-Instanzen (Admin + Customer) auf dem Client und ist
 *   für reines OAuth-Login (kein Session-Read) ausreichend.
 *
 * Feature-Flag:
 *   `NEXT_PUBLIC_FEATURE_OAUTH_LOGIN === 'true'` aktiviert die Buttons.
 *   Die Variable wird in `next.config.js` aus `GOOGLE_CLIENT_ID` abgeleitet,
 *   damit die UI nur erscheint, wenn ein Provider konfiguriert ist.
 */

import { useState } from 'react';

type Provider = 'google' | 'github';

interface OAuthButtonsProps {
  /** Optional: Header-Text über den Buttons. Default: kein Header. */
  heading?: string;
}

/**
 * Custom NextAuth-Customer-Basispfad. Backend-Handler liegt auf
 * `/api/auth/customer/[...nextauth]/route.ts` (siehe §18.2.2).
 */
const CUSTOMER_AUTH_BASE_PATH = '/api/auth/customer';

function isOAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_OAUTH_LOGIN === 'true';
}

export function OAuthButtons({ heading }: OAuthButtonsProps) {
  const [pending, setPending] = useState<Provider | null>(null);

  if (!isOAuthEnabled()) {
    return null;
  }

  const handleClick = (provider: Provider) => {
    setPending(provider);
    // Direkter Browser-Navigations-Trigger an den Customer-NextAuth-Handler.
    // NextAuth übernimmt von dort den OAuth-Flow (PKCE, state, callback).
    window.location.href = `${CUSTOMER_AUTH_BASE_PATH}/${provider}`;
  };

  return (
    <div className="space-y-3">
      {heading && (
        <p className="text-sm font-medium text-baerenstark-bark/80">{heading}</p>
      )}

      <button
        type="button"
        onClick={() => handleClick('google')}
        disabled={pending !== null}
        aria-label="Mit Google anmelden"
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-baerenstark-sand bg-white px-4 py-2.5 text-sm font-medium text-baerenstark-bark hover:bg-baerenstark-cream/50 transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent"
      >
        <GoogleIcon />
        <span>
          {pending === 'google' ? 'Wird umgeleitet …' : 'Mit Google anmelden'}
        </span>
      </button>

      <button
        type="button"
        onClick={() => handleClick('github')}
        disabled={pending !== null}
        aria-label="Mit GitHub anmelden"
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-baerenstark-sand bg-[#24292e] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2f363d] transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent"
      >
        <GitHubIcon />
        <span>
          {pending === 'github' ? 'Wird umgeleitet …' : 'Mit GitHub anmelden'}
        </span>
      </button>
    </div>
  );
}

/**
 * OAuthDivider — kleiner "oder"-Trenner zwischen OAuth-Buttons und
 * E-Mail/Passwort-Form. Darf optional verwendet werden.
 */
export function OAuthDivider({ label = 'oder' }: { label?: string }) {
  if (!isOAuthEnabled()) {
    return null;
  }
  return (
    <div className="relative my-6" aria-hidden="true">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-baerenstark-sand" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-white px-2 text-baerenstark-bark/60">{label}</span>
      </div>
    </div>
  );
}

/** Mappt OAuth-Fehler-Query-Params auf deutsche User-Texte. */
export function mapOAuthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case 'oauth_no_email':
      return 'Dein OAuth-Anbieter hat keine E-Mail-Adresse übermittelt. Bitte registriere dich manuell mit E-Mail und Passwort.';
    case 'oauth_unverified_conflict':
      return 'Es existiert bereits ein Konto mit dieser E-Mail-Adresse, das noch nicht bestätigt wurde. Bitte bestätige zuerst deine E-Mail über den Link in der Registrierungs-Mail oder nutze „Passwort vergessen?", um Zugriff wiederherzustellen. Anschließend kannst du dich wieder mit Google/GitHub anmelden.';
    case 'oauth_unverified':
      return 'Dein OAuth-Konto hat keine bestätigte E-Mail-Adresse. Bitte bestätige sie zuerst beim Anbieter.';
    case 'oauth_finalize_failed':
      return 'Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.';
    case 'oauth_error':
      return 'Die Anmeldung wurde vom Anbieter abgebrochen oder ist fehlgeschlagen. Bitte erneut versuchen.';
    default:
      return null;
  }
}

/** Returns true wenn das Feature-Flag gesetzt ist (für Caller-Komponenten). */
export function useOAuthEnabled(): boolean {
  return isOAuthEnabled();
}

// ---------------------------------------------------------------------------
// SVG-Icons (inline; keine externe Abhängigkeit)
// ---------------------------------------------------------------------------

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
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

function GitHubIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
