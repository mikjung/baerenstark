'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams, useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const Schema = z.object({
  password: z.string().min(12, 'Mindestens 12 Zeichen.'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: 'Passwörter stimmen nicht überein.', path: ['confirm'] });
type FormData = z.infer<typeof Schema>;

function ResetForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(Schema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: values.password }),
    });
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push('/admin/login'), 3000);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.message ?? 'Ungültiger oder abgelaufener Link. Bitte erneut anfordern.');
    }
    setSubmitting(false);
  });

  if (!token) {
    return (
      <Banner tone="error" title="Ungültiger Link">
        Kein Reset-Token gefunden.{' '}
        <Link href="/admin/passwort-vergessen" className="underline">Neu anfordern</Link>
      </Banner>
    );
  }

  return done ? (
    <Banner tone="success" title="Passwort geändert">
      Dein Passwort wurde erfolgreich zurückgesetzt. Du wirst zum Login weitergeleitet …
    </Banner>
  ) : (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Input label="Neues Passwort" type="password" autoComplete="new-password" required hint="Mindestens 12 Zeichen." error={errors.password?.message} {...register('password')} />
      <Input label="Passwort bestätigen" type="password" autoComplete="new-password" required error={errors.confirm?.message} {...register('confirm')} />
      {error && <Banner tone="error" role="alert">{error}</Banner>}
      <Button type="submit" isLoading={submitting} className="w-full">Passwort speichern</Button>
    </form>
  );
}

export default function AdminPasswordResetPage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-center">
        <Image src="/logo.png" alt="Bärenstark Logo" width={72} height={72} className="h-16 w-16 rounded-md object-contain" />
      </div>
      <div className="rounded-2xl border border-baerenstark-sand bg-white/85 p-6 shadow-card sm:p-8">
        <h1 className="mb-2 font-serif text-2xl font-bold text-baerenstark-bark">Neues Passwort setzen</h1>
        <p className="mb-6 text-sm text-baerenstark-bark/80">Wähle ein sicheres Passwort (mind. 12 Zeichen).</p>
        <Suspense fallback={<div className="text-sm text-baerenstark-bark/70">Lade …</div>}>
          <ResetForm />
        </Suspense>
      </div>
    </section>
  );
}
