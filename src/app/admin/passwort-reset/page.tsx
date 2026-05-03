'use client';

/**
 * /admin/passwort-reset — Iteration 5 (US-30 UX-Verbesserungen).
 *
 * Verbesserungen:
 *   - Passwort-Stärke-Indikator (einfach: < 12 Zeichen → "Schwach", >= 12 → "OK").
 *   - Loading-State während Submit.
 *   - Erfolg mit 3-Sekunden-Countdown → automatischer Redirect zu /admin/login.
 *   - Fehlerbanner bei abgelaufenem Token, mit Link zu /admin/passwort-vergessen.
 *
 * Mindestlänge ist Server-seitig 8 Zeichen (US-30 AC4); UI empfiehlt 12 für
 * eine sichere Wahl.
 */

import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams, useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_RECOMMENDED_LENGTH = 12;

const Schema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen.`),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwörter stimmen nicht überein.',
    path: ['confirm'],
  });
type FormData = z.infer<typeof Schema>;

type Strength = 'empty' | 'weak' | 'ok';

function evalStrength(value: string): Strength {
  if (!value) return 'empty';
  if (value.length < PASSWORD_RECOMMENDED_LENGTH) return 'weak';
  return 'ok';
}

function StrengthIndicator({ value }: { value: string }) {
  const strength = evalStrength(value);
  if (strength === 'empty') return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-1 flex items-center gap-2 text-xs"
    >
      <span
        aria-hidden="true"
        className={[
          'h-1.5 w-24 rounded-full',
          strength === 'weak' ? 'bg-amber-400' : 'bg-green-500',
        ].join(' ')}
      />
      <span
        className={
          strength === 'weak'
            ? 'font-medium text-amber-700'
            : 'font-medium text-green-700'
        }
      >
        {strength === 'weak'
          ? `Schwach — empfohlen sind mindestens ${PASSWORD_RECOMMENDED_LENGTH} Zeichen.`
          : 'Passwortstärke OK.'}
      </span>
    </div>
  );
}

function ResetForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(Schema),
    mode: 'onChange',
    defaultValues: { password: '', confirm: '' },
  });

  const passwordValue = watch('password') ?? '';

  // Erfolgs-Countdown → Redirect.
  useEffect(() => {
    if (!done) return;
    if (countdown <= 0) {
      router.push('/admin/login');
      return;
    }
    const timeout = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timeout);
  }, [done, countdown, router]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    setError(null);
    setTokenInvalid(false);
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: values.password }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        const body = await res.json().catch(() => ({}));
        const code = body?.error?.code as string | undefined;
        const msg = body?.error?.message as string | undefined;
        // Token-Fehler erkennen wir an Code/Message; sonst generischer Fehler.
        const isTokenIssue =
          code === 'NOT_FOUND' ||
          code === 'GONE' ||
          code === 'UNAUTHORIZED' ||
          (typeof msg === 'string' &&
            /token|abgelaufen|ungültig/i.test(msg));
        if (isTokenIssue) {
          setTokenInvalid(true);
        } else {
          setError(msg ?? 'Das Passwort konnte nicht gespeichert werden.');
        }
      }
    } catch {
      setError(
        'Verbindung zum Server fehlgeschlagen. Bitte erneut versuchen.',
      );
    } finally {
      setSubmitting(false);
    }
  });

  if (!token) {
    return (
      <Banner tone="error" title="Ungültiger Link" role="alert">
        <p className="mb-3">Kein Reset-Token gefunden.</p>
        <p>
          <Link
            href="/admin/passwort-vergessen"
            className="text-baerenstark-wood underline-offset-2 hover:underline"
          >
            Neuen Link anfordern
          </Link>
        </p>
      </Banner>
    );
  }

  if (tokenInvalid) {
    return (
      <Banner tone="error" title="Link abgelaufen oder ungültig" role="alert">
        <p className="mb-3">
          Der Reset-Link ist nicht mehr gültig. Bitte fordere einen neuen Link
          an.
        </p>
        <Link
          href="/admin/passwort-vergessen"
          className="inline-block rounded-lg bg-baerenstark-wood px-4 py-2 text-sm font-medium text-baerenstark-cream hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent"
        >
          Neuen Link anfordern
        </Link>
      </Banner>
    );
  }

  if (done) {
    return (
      <Banner tone="success" title="Passwort geändert" role="status">
        <p className="mb-2">
          Dein Passwort wurde erfolgreich zurückgesetzt.
        </p>
        <p className="text-sm">
          Du wirst in {countdown} Sekunde{countdown === 1 ? '' : 'n'} zum Login
          weitergeleitet …
        </p>
        <p className="mt-3">
          <Link
            href="/admin/login"
            className="text-baerenstark-wood underline-offset-2 hover:underline"
          >
            Sofort zum Login
          </Link>
        </p>
      </Banner>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <Input
          label="Neues Passwort"
          type="password"
          autoComplete="new-password"
          required
          hint={`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen — empfohlen ${PASSWORD_RECOMMENDED_LENGTH}+ für höhere Sicherheit.`}
          error={errors.password?.message}
          {...register('password')}
        />
        <StrengthIndicator value={passwordValue} />
      </div>

      <Input
        label="Passwort bestätigen"
        type="password"
        autoComplete="new-password"
        required
        error={errors.confirm?.message}
        {...register('confirm')}
      />

      {error && (
        <Banner tone="error" role="alert">
          {error}
        </Banner>
      )}

      <Button type="submit" isLoading={submitting} className="w-full">
        Passwort speichern
      </Button>

      <p className="pt-1 text-center text-sm text-baerenstark-bark/80">
        <Link
          href="/admin/login"
          className="text-baerenstark-wood underline-offset-2 hover:underline"
        >
          ← Zurück zum Login
        </Link>
      </p>
    </form>
  );
}

export default function AdminPasswordResetPage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-center">
        <Image
          src="/logo.png"
          alt="Bärenstark Logo"
          width={72}
          height={72}
          className="h-16 w-16 rounded-md object-contain"
        />
      </div>
      <div className="rounded-2xl border border-baerenstark-sand bg-white/85 p-6 shadow-card sm:p-8">
        <h1 className="mb-2 font-serif text-2xl font-bold text-baerenstark-bark">
          Neues Passwort setzen
        </h1>
        <p className="mb-6 text-sm text-baerenstark-bark/80">
          Wähle ein sicheres Passwort (mindestens {PASSWORD_MIN_LENGTH}{' '}
          Zeichen). Empfehlung: {PASSWORD_RECOMMENDED_LENGTH}+ Zeichen mit Zahlen
          und Sonderzeichen.
        </p>
        <Suspense
          fallback={
            <div role="status" aria-live="polite" className="text-sm text-baerenstark-bark/70">
              Lade …
            </div>
          }
        >
          <ResetForm />
        </Suspense>
      </div>
    </section>
  );
}
