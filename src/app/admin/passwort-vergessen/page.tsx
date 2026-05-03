'use client';

/**
 * /admin/passwort-vergessen — Iteration 5 (US-30 UX-Verbesserungen).
 *
 * Verbesserungen:
 *   - Loading-Spinner via Button isLoading-State.
 *   - Klarer Erfolgs-Banner („Falls diese E-Mail registriert ist…").
 *   - Fehlerbanner bei Netzwerkfehler.
 *   - „Zurück zum Login"-Link IMMER sichtbar (auch im Erfolgs-Zustand).
 */

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const Schema = z.object({
  email: z.string().trim().email('Gültige E-Mail-Adresse eingeben.'),
});
type FormData = z.infer<typeof Schema>;

export default function AdminForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(Schema),
    mode: 'onBlur',
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    setNetworkError(null);
    try {
      const res = await fetch('/api/admin/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      // Wir behandeln nicht-OK als "neutral gesendet" (kein E-Mail-Existenz-Leak),
      // außer bei eindeutigen Server-Fehlern (5xx).
      if (res.status >= 500) {
        setNetworkError(
          'Der Server konnte deine Anfrage gerade nicht verarbeiten. Bitte versuche es in wenigen Minuten erneut.',
        );
      } else {
        setSent(true);
      }
    } catch {
      setNetworkError(
        'Verbindung zum Server fehlgeschlagen. Bitte prüfe deine Internetverbindung und versuche es erneut.',
      );
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
          Passwort vergessen
        </h1>

        {sent ? (
          <div className="space-y-4">
            <Banner tone="success" title="E-Mail gesendet" role="status">
              Falls diese E-Mail registriert ist, erhältst du in Kürze einen
              Reset-Link an deine E-Mail-Adresse.
            </Banner>
            <p className="text-sm text-baerenstark-bark/70">
              Der Link ist 60 Minuten gültig. Bitte prüfe auch deinen Spam-Ordner.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-baerenstark-bark/80">
              Gib deine Admin-E-Mail-Adresse ein. Wir schicken dir einen Link
              zum Zurücksetzen.
            </p>
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <Input
                label="E-Mail"
                type="email"
                autoComplete="email"
                required
                error={errors.email?.message}
                {...register('email')}
              />

              {networkError && (
                <Banner tone="error" role="alert" title="Verbindung fehlgeschlagen">
                  {networkError}
                </Banner>
              )}

              <Button type="submit" isLoading={submitting} className="w-full">
                Reset-Link anfordern
              </Button>
            </form>
          </>
        )}

        {/* "Zurück zum Login" — IMMER sichtbar (US-30 v1.5). */}
        <p className="mt-6 text-center text-sm text-baerenstark-bark/80">
          <Link
            href="/admin/login"
            className="text-baerenstark-wood underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
          >
            ← Zurück zum Login
          </Link>
        </p>
      </div>
    </section>
  );
}
