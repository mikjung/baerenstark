'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const Schema = z.object({ email: z.string().email('Gültige E-Mail-Adresse eingeben.') });
type FormData = z.infer<typeof Schema>;

export default function AdminForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(Schema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    await fetch('/api/admin/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    setSent(true);
    setSubmitting(false);
  });

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-center">
        <Image src="/logo.png" alt="Bärenstark Logo" width={72} height={72} className="h-16 w-16 rounded-md object-contain" />
      </div>
      <div className="rounded-2xl border border-baerenstark-sand bg-white/85 p-6 shadow-card sm:p-8">
        <h1 className="mb-2 font-serif text-2xl font-bold text-baerenstark-bark">Passwort vergessen</h1>

        {sent ? (
          <Banner tone="success" title="E-Mail gesendet">
            Falls diese E-Mail-Adresse registriert ist, erhältst du in Kürze einen Link zum Zurücksetzen des Passworts.
            <p className="mt-3">
              <Link href="/admin/login" className="text-baerenstark-wood underline-offset-2 hover:underline text-sm">
                Zurück zum Login
              </Link>
            </p>
          </Banner>
        ) : (
          <>
            <p className="mb-6 text-sm text-baerenstark-bark/80">
              Gib deine Admin-E-Mail-Adresse ein. Wir schicken dir einen Link zum Zurücksetzen.
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
              <Button type="submit" isLoading={submitting} className="w-full">
                Reset-Link anfordern
              </Button>
              <p className="text-center text-sm text-baerenstark-bark/60">
                <Link href="/admin/login" className="text-baerenstark-wood underline-offset-2 hover:underline">
                  Zurück zum Login
                </Link>
              </p>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
