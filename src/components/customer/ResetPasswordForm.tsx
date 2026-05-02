'use client';

/**
 * ResetPasswordForm — `/konto/passwort-reset?token=...`
 *
 * Validiert lokal: Passwörter müssen übereinstimmen + min. 8 Zeichen.
 * Server-Antwort 400 → Token ungültig/abgelaufen.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiClientError, resetPassword } from '@/lib/api-client';
import {
  CUSTOMER_PASSWORD_MAX_LENGTH,
  CUSTOMER_PASSWORD_MIN_LENGTH,
} from '@/lib/schemas';

const FormSchema = z
  .object({
    password: z
      .string()
      .min(CUSTOMER_PASSWORD_MIN_LENGTH, `Passwort muss mindestens ${CUSTOMER_PASSWORD_MIN_LENGTH} Zeichen haben`)
      .max(CUSTOMER_PASSWORD_MAX_LENGTH, 'Passwort ist zu lang'),
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Passwörter stimmen nicht überein',
    path: ['passwordConfirm'],
  });
type FormInput = z.infer<typeof FormSchema>;

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(FormSchema),
    mode: 'onBlur',
    defaultValues: { password: '', passwordConfirm: '' },
  });

  if (!token) {
    return (
      <Banner tone="error" title="Ungültiger Link" role="alert">
        <p className="mb-3">
          Dieser Link ist unvollständig. Bitte fordere einen neuen
          Reset-Link an.
        </p>
        <p>
          <Link
            href="/konto/passwort-vergessen"
            className="text-baerenstark-wood underline-offset-2 hover:underline"
          >
            Reset-Link erneut anfordern
          </Link>
        </p>
      </Banner>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await resetPassword({
        token,
        password: values.password,
        passwordConfirm: values.passwordConfirm,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 400) {
          setServerError(
            err.message ||
              'Der Link ist nicht mehr gültig. Bitte fordere einen neuen Reset-Link an.',
          );
        } else if (err.code === 'RATE_LIMITED') {
          setServerError('Zu viele Versuche. Bitte 60 Minuten warten.');
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError('Passwort konnte nicht gesetzt werden. Bitte erneut versuchen.');
      }
    } finally {
      setSubmitting(false);
    }
  });

  if (success) {
    return (
      <div className="space-y-4">
        <Banner tone="success" role="status">
          Passwort geändert. Du kannst dich jetzt einloggen.
        </Banner>
        <p className="text-center">
          <Link
            href="/konto/login"
            className="text-baerenstark-wood underline-offset-2 hover:underline"
          >
            Zum Login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Input
        label="Neues Passwort"
        type="password"
        autoComplete="new-password"
        required
        hint="Mindestens 8 Zeichen."
        error={errors.password?.message}
        {...register('password')}
      />
      <Input
        label="Passwort bestätigen"
        type="password"
        autoComplete="new-password"
        required
        error={errors.passwordConfirm?.message}
        {...register('passwordConfirm')}
      />

      {serverError && (
        <Banner tone="error" role="alert">
          {serverError}
        </Banner>
      )}

      <Button type="submit" isLoading={submitting} className="w-full">
        Passwort speichern
      </Button>
    </form>
  );
}
