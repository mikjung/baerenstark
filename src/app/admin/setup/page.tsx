/**
 * /admin/setup — Setup-Wizard (einmalig).
 *
 * Legt den ersten Admin-User an. Greift nur, solange die `users`-Tabelle leer
 * ist. Sobald ein User existiert → 409 vom Backend, UI zeigt entsprechenden
 * Hinweis mit Link auf /admin/login.
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiClientError, fetchSetupAvailable, postSetup } from '@/lib/api-client';
import { AdminSetupSchema, type AdminSetupInput } from '@/lib/schemas';

type Availability = { loading: true } | { loading: false; available: boolean; error?: string };

export default function SetupPage() {
  const router = useRouter();
  const [availability, setAvailability] = useState<Availability>({ loading: true });
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AdminSetupInput>({
    resolver: zodResolver(AdminSetupSchema),
    mode: 'onBlur',
  });

  useEffect(() => {
    let cancelled = false;
    fetchSetupAvailable()
      .then((res) => {
        if (cancelled) return;
        setAvailability({ loading: false, available: res.available });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setAvailability({
          loading: false,
          available: false,
          error:
            err instanceof ApiClientError
              ? err.message
              : 'Setup-Status konnte nicht geprüft werden.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError(null);
    try {
      await postSetup(values);
      // Direkt einloggen (NextAuth) und zu /admin
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
      });
      if (result?.error) {
        setServerError(
          'Account angelegt, aber automatischer Login ist fehlgeschlagen. Bitte manuell einloggen.',
        );
        router.push('/admin/login');
        return;
      }
      router.push('/admin');
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'CONFLICT') {
          setAvailability({ loading: false, available: false });
          return;
        }
        if (err.code === 'VALIDATION_ERROR' && err.field) {
          setError(err.field as keyof AdminSetupInput, {
            type: 'server',
            message: err.message,
          });
          setSubmitting(false);
          return;
        }
        setServerError(err.message);
      } else {
        setServerError('Unbekannter Fehler. Bitte erneut versuchen.');
      }
    } finally {
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
          Admin-Setup
        </h1>
        <p className="mb-6 text-sm text-baerenstark-bark/80">
          Einmaliges Anlegen des Admin-Accounts. Wer dieses Formular als Erster
          ausfüllt, wird zum Admin.
        </p>

        {availability.loading && (
          <div role="status" aria-live="polite" className="text-sm text-baerenstark-bark/70">
            Setup-Status wird geprüft …
          </div>
        )}

        {!availability.loading && !availability.available && (
          <Banner tone="info" title="Setup wurde bereits abgeschlossen">
            <p className="mb-3">
              {availability.error ??
                'Es existiert bereits ein Admin-Account. Bitte über die Login-Seite anmelden.'}
            </p>
            <Link
              href="/admin/login"
              className="inline-flex items-center justify-center rounded-lg bg-baerenstark-wood px-4 py-2 text-sm font-medium text-baerenstark-cream hover:bg-baerenstark-bark"
            >
              Zum Login
            </Link>
          </Banner>
        )}

        {!availability.loading && availability.available && (
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <Input
              label="Name"
              required
              autoComplete="name"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="E-Mail"
              type="email"
              required
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Passwort"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              hint="Mindestens 12 Zeichen."
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="Passwort bestätigen"
              type="password"
              required
              autoComplete="new-password"
              error={errors.passwordConfirm?.message}
              {...register('passwordConfirm')}
            />

            {serverError && (
              <Banner tone="error" role="alert">
                {serverError}
              </Banner>
            )}

            <Button type="submit" isLoading={submitting} className="w-full">
              Account anlegen
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
