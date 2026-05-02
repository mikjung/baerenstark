/**
 * /admin/login — Admin-Login (US-07).
 *
 * Beim Mount: prüft via GET /api/admin/setup, ob noch kein Admin existiert.
 * Wenn ja → Redirect auf /admin/setup.
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fetchSetupAvailable } from '@/lib/api-client';
import { LoginSchema, type LoginInput } from '@/lib/schemas';

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  const callbackUrlRaw = searchParams.get('callbackUrl') ?? '/admin';
  // Defensiv: nur same-origin (relative Pfade, die mit "/" anfangen) zulassen.
  const callbackUrl = callbackUrlRaw.startsWith('/') ? callbackUrlRaw : '/admin';

  const [setupChecked, setSetupChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    mode: 'onBlur',
  });

  useEffect(() => {
    let cancelled = false;
    fetchSetupAvailable()
      .then((res) => {
        if (cancelled) return;
        if (res.available) {
          router.replace('/admin/setup');
        } else {
          setSetupChecked(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Wenn Check fehlschlägt: Login-Form trotzdem zeigen.
        setSetupChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Mappe NextAuth-Error-Param auf nutzerfreundliche Meldungen
  const errorBanner = (() => {
    if (serverError) return serverError;
    if (!errorParam) return null;
    if (errorParam === 'RateLimited') {
      return 'Zu viele Anmelde-Versuche. Bitte 15 Minuten warten.';
    }
    if (errorParam === 'CredentialsSignin') {
      return 'E-Mail oder Passwort ist falsch.';
    }
    return 'Anmeldung fehlgeschlagen.';
  })();

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSubmitting(true);
    try {
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
        callbackUrl,
      });
      if (!result || result.error) {
        if (result?.error === 'RateLimited') {
          setServerError('Zu viele Anmelde-Versuche. Bitte 15 Minuten warten.');
        } else {
          setServerError('E-Mail oder Passwort ist falsch.');
        }
        setSubmitting(false);
        return;
      }
      router.replace(result.url ?? callbackUrl);
    } catch {
      setServerError('Anmeldung fehlgeschlagen. Bitte erneut versuchen.');
      setSubmitting(false);
    }
  });

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
          Admin-Login
        </h1>
        <p className="mb-6 text-sm text-baerenstark-bark/80">
          Geschützter Bereich für Tom. Bei Problemen mit dem Login{' '}
          <Link href="/" className="text-baerenstark-wood underline-offset-2 hover:underline">
            zur Startseite
          </Link>
          .
        </p>

        {!setupChecked && (
          <div role="status" aria-live="polite" className="text-sm text-baerenstark-bark/70">
            Status wird geprüft …
          </div>
        )}

        {setupChecked && (
          <form onSubmit={onSubmit} noValidate className="space-y-4">
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

            {errorBanner && (
              <Banner tone="error" role="alert">
                {errorBanner}
              </Banner>
            )}

            <Button type="submit" isLoading={submitting} className="w-full">
              Anmelden
            </Button>

            <p className="text-center text-sm text-baerenstark-bark/60">
              <Link
                href="/admin/passwort-vergessen"
                className="text-baerenstark-wood underline-offset-2 hover:underline"
              >
                Passwort vergessen?
              </Link>
            </p>
          </form>
        )}
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <section className="mx-auto max-w-md p-8 text-sm text-baerenstark-bark/70">
          Lade …
        </section>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
