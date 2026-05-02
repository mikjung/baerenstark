'use client';

/**
 * RegisterForm — Client-Komponente für /konto/registrieren (US-25 AC1).
 *
 * Felder: Vorname, Nachname, E-Mail, Passwort, Passwort bestätigen,
 * Telefon (optional), Datenschutz-Zustimmung.
 *
 * Validierung lokal via Zod (passwordConfirm-Match erweitert die Server-
 * Schema-Validierung; Server kennt nur `password`). Server-Antwort 409
 * "E-Mail bereits registriert" wird unter dem E-Mail-Feld gerendert.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiClientError, registerCustomer } from '@/lib/api-client';
import {
  CUSTOMER_PASSWORD_MAX_LENGTH,
  CUSTOMER_PASSWORD_MIN_LENGTH,
} from '@/lib/schemas';

const RegisterFormSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Bitte Vorname angeben').max(120, 'Vorname ist zu lang'),
    lastName: z.string().trim().min(1, 'Bitte Nachname angeben').max(120, 'Nachname ist zu lang'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Bitte eine gültige E-Mail-Adresse angeben')
      .max(254, 'E-Mail-Adresse ist zu lang'),
    password: z
      .string()
      .min(CUSTOMER_PASSWORD_MIN_LENGTH, `Passwort muss mindestens ${CUSTOMER_PASSWORD_MIN_LENGTH} Zeichen haben`)
      .max(CUSTOMER_PASSWORD_MAX_LENGTH, 'Passwort ist zu lang'),
    passwordConfirm: z.string(),
    phone: z
      .string()
      .trim()
      .max(40, 'Telefonnummer ist zu lang')
      .optional()
      .or(z.literal('')),
    privacyAccepted: z.literal(true, {
      errorMap: () => ({ message: 'Bitte den Datenschutzhinweis bestätigen' }),
    }),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Passwörter stimmen nicht überein',
    path: ['passwordConfirm'],
  });
type RegisterFormInput = z.infer<typeof RegisterFormSchema>;

export function RegisterForm() {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormInput>({
    resolver: zodResolver(RegisterFormSchema),
    mode: 'onBlur',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      passwordConfirm: '',
      phone: '',
      privacyAccepted: undefined as unknown as true,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await registerCustomer({
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone && values.phone.length > 0 ? values.phone : undefined,
        privacyAccepted: true,
      });
      setSuccess(
        'Wir haben dir eine Bestätigungs-E-Mail gesendet. Bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren.',
      );
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 409 && err.field === 'email') {
          setError('email', { message: err.message || 'Diese E-Mail ist bereits registriert.' });
        } else if (err.code === 'VALIDATION_ERROR' && err.field) {
          setError(err.field as keyof RegisterFormInput, { message: err.message });
        } else if (err.code === 'RATE_LIMITED') {
          setServerError('Zu viele Registrierungsversuche. Bitte später erneut versuchen.');
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError('Registrierung fehlgeschlagen. Bitte erneut versuchen.');
      }
    } finally {
      setSubmitting(false);
    }
  });

  if (success) {
    return (
      <div className="space-y-4">
        <Banner tone="success" title="Konto erstellt" role="status">
          <p>{success}</p>
        </Banner>
        <p className="text-sm text-baerenstark-bark/80">
          Hast du keine E-Mail erhalten? Prüfe bitte deinen Spam-Ordner. Bei
          Problemen{' '}
          <a
            href="mailto:info@baerenstark.de"
            className="text-baerenstark-wood underline-offset-2 hover:underline"
          >
            kontaktiere uns
          </a>
          .
        </p>
        <p className="text-sm text-baerenstark-bark/80">
          Bereits bestätigt?{' '}
          <Link
            href="/konto/login"
            className="text-baerenstark-wood underline-offset-2 hover:underline"
          >
            Jetzt einloggen
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Vorname"
          autoComplete="given-name"
          required
          error={errors.firstName?.message}
          {...register('firstName')}
        />
        <Input
          label="Nachname"
          autoComplete="family-name"
          required
          error={errors.lastName?.message}
          {...register('lastName')}
        />
      </div>
      <Input
        label="E-Mail"
        type="email"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="Telefon (optional)"
        type="tel"
        autoComplete="tel"
        error={errors.phone?.message}
        {...register('phone')}
      />
      <Input
        label="Passwort"
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

      <div className="flex items-start gap-2">
        <input
          id="privacy-accepted"
          type="checkbox"
          {...register('privacyAccepted')}
          className="mt-1 h-4 w-4 rounded border-baerenstark-wood text-baerenstark-wood focus:ring-baerenstark-accent"
          aria-invalid={errors.privacyAccepted ? true : undefined}
        />
        <label
          htmlFor="privacy-accepted"
          className="text-sm text-baerenstark-bark/85"
        >
          Ich habe die{' '}
          <Link
            href="/datenschutz"
            className="text-baerenstark-wood underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener"
          >
            Datenschutzerklärung
          </Link>{' '}
          gelesen und bin einverstanden.
        </label>
      </div>
      {errors.privacyAccepted && (
        <p role="alert" className="text-xs font-medium text-red-700">
          {errors.privacyAccepted.message}
        </p>
      )}

      {serverError && (
        <Banner tone="error" role="alert">
          {serverError}
        </Banner>
      )}

      <Button type="submit" isLoading={submitting} className="w-full">
        Konto erstellen
      </Button>

      <p className="pt-2 text-center text-sm text-baerenstark-bark/80">
        Bereits registriert?{' '}
        <Link
          href="/konto/login"
          className="text-baerenstark-wood underline-offset-2 hover:underline"
        >
          Hier einloggen
        </Link>
      </p>
    </form>
  );
}
