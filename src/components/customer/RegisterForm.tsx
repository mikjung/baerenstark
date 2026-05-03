'use client';

/**
 * RegisterForm — Iteration 7 / US-IT7-01.
 *
 * Re-aktiviertes Email/Password-Registrierungs-Formular nach IT6 D3-Reversion.
 *
 * Felder (gem. CustomerRegisterSchema):
 *   - firstName, lastName (Pflicht)
 *   - email (Pflicht, lower-case getrimmt vom Schema)
 *   - phone (optional)
 *   - password (mind. 8 Zeichen, max 200) — Passwort-Stärke-Indikator unten
 *   - privacyAccepted (Pflicht — DSGVO-Hinweis)
 *
 * Erfolg: Wechsel auf einen Confirmation-Hinweis im selben Card-Layout.
 * Der User kann sich (per Vorentscheidung Orchestrator) sofort einloggen,
 * auch ohne Verify-Link zu klicken.
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
  ZipCodeSchema,
  type CustomerRegisterInput,
} from '@/lib/schemas';

/**
 * Lokales Form-Schema (mit `passwordConfirm`-Bestätigungsfeld).
 *
 * Wir definieren die Validierung **lokal**, weil `passwordConfirm` nur im
 * Frontend existiert (Backend bekommt nur `password`). Die Regeln spiegeln
 * `CustomerRegisterSchema` aus `contracts/zod-schemas.ts` 1:1 — bei Spec-
 * Änderung am Vertrag ist hier nachzuziehen.
 */
const RegisterFormSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, 'Bitte Vorname angeben')
      .max(120, 'Vorname ist zu lang'),
    lastName: z
      .string()
      .trim()
      .min(1, 'Bitte Nachname angeben')
      .max(120, 'Nachname ist zu lang'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Bitte eine gültige E-Mail-Adresse angeben')
      .max(254, 'E-Mail-Adresse ist zu lang'),
    phone: z
      .string()
      .trim()
      .max(40, 'Telefonnummer ist zu lang')
      .optional(),
    // IT9 / US-IT9-02 — Adressfelder optional bei der Registrierung.
    // Wenn ein Feld leer bleibt, senden wir es als undefined (Backend
    // akzeptiert das via `.optional()`). Wenn es ausgefüllt ist, müssen
    // die Längen-/PLZ-Constraints stimmen.
    streetAndNumber: z
      .string()
      .trim()
      .max(100, 'Adresse ist zu lang')
      .optional()
      .or(z.literal('')),
    postalCode: z
      .string()
      .trim()
      .optional()
      .or(z.literal(''))
      .refine(
        (v) => !v || ZipCodeSchema.safeParse(v).success,
        { message: 'PLZ muss 5 Ziffern enthalten' },
      ),
    city: z
      .string()
      .trim()
      .max(100, 'Ort ist zu lang')
      .optional()
      .or(z.literal('')),
    password: z
      .string()
      .min(
        CUSTOMER_PASSWORD_MIN_LENGTH,
        `Passwort muss mindestens ${CUSTOMER_PASSWORD_MIN_LENGTH} Zeichen haben`,
      )
      .max(CUSTOMER_PASSWORD_MAX_LENGTH, 'Passwort ist zu lang'),
    passwordConfirm: z.string(),
    privacyAccepted: z.boolean().refine((v) => v === true, {
      message: 'Bitte den Datenschutzhinweis bestätigen',
    }),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Passwörter stimmen nicht überein',
    path: ['passwordConfirm'],
  });

type RegisterFormValues = z.infer<typeof RegisterFormSchema>;

type StrengthLevel = 'weak' | 'ok' | 'strong';

function evaluatePasswordStrength(pw: string): {
  level: StrengthLevel | null;
  hint: string;
} {
  if (!pw) return { level: null, hint: '' };
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const long = pw.length >= 10;
  const veryLong = pw.length >= 14;

  if (pw.length < CUSTOMER_PASSWORD_MIN_LENGTH) {
    return {
      level: 'weak',
      hint: `Mindestens ${CUSTOMER_PASSWORD_MIN_LENGTH} Zeichen.`,
    };
  }
  if (!hasLetter || !hasNumber || !long) {
    return {
      level: 'ok',
      hint: 'Sicherer mit ≥ 10 Zeichen, Buchstaben und Zahlen.',
    };
  }
  return {
    level: veryLong ? 'strong' : 'strong',
    hint: 'Starkes Passwort.',
  };
}

function strengthBarClasses(level: StrengthLevel | null): {
  width: string;
  color: string;
  label: string;
} {
  switch (level) {
    case 'strong':
      return { width: 'w-full', color: 'bg-green-600', label: 'Stark' };
    case 'ok':
      return { width: 'w-2/3', color: 'bg-amber-500', label: 'Akzeptabel' };
    case 'weak':
      return { width: 'w-1/3', color: 'bg-red-500', label: 'Schwach' };
    default:
      return { width: 'w-0', color: 'bg-transparent', label: '' };
  }
}

function mapApiErrorMessage(err: ApiClientError): string {
  switch (err.code) {
    case 'EMAIL_ALREADY_REGISTERED':
    case 'CONFLICT':
      return 'Diese E-Mail-Adresse ist bereits registriert. Bitte melde dich stattdessen an oder setze dein Passwort zurück.';
    case 'RATE_LIMITED':
      return 'Zu viele Registrierungs-Versuche. Bitte später erneut versuchen.';
    case 'VALIDATION_ERROR':
      return err.message || 'Bitte alle Pflichtfelder korrekt ausfüllen.';
    case 'NETWORK_ERROR':
      return 'Verbindung zum Server fehlgeschlagen. Bitte Internetverbindung prüfen.';
    default:
      return 'Registrierung fehlgeschlagen. Bitte später erneut versuchen.';
  }
}

export function RegisterForm() {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    mode: 'onBlur',
    resolver: zodResolver(RegisterFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      streetAndNumber: '',
      postalCode: '',
      city: '',
      password: '',
      passwordConfirm: '',
      privacyAccepted: false,
    },
  });

  const passwordValue = watch('password') || '';
  const strength = evaluatePasswordStrength(passwordValue);
  const bar = strengthBarClasses(strength.level);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSubmitting(true);
    try {
      // Phone-Feld leer → undefined (Schema akzeptiert optional null/undef).
      // IT9 / US-IT9-02: Adressfelder ebenfalls leer → undefined; das Backend
      // ignoriert die Felder dann komplett (additive Optional-Felder im
      // CustomerRegisterSchema).
      const trimmedStreet = values.streetAndNumber?.trim();
      const trimmedZip = values.postalCode?.trim();
      const trimmedCity = values.city?.trim();
      const payload: CustomerRegisterInput = {
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone && values.phone.trim() !== '' ? values.phone : undefined,
        streetAndNumber: trimmedStreet ? trimmedStreet : undefined,
        postalCode: trimmedZip ? trimmedZip : undefined,
        city: trimmedCity ? trimmedCity : undefined,
        privacyAccepted: true,
      };
      const created = await registerCustomer(payload);
      setRegisteredEmail(created.email);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(mapApiErrorMessage(err));
      } else {
        setServerError('Registrierung fehlgeschlagen. Bitte erneut versuchen.');
      }
      setSubmitting(false);
    }
  });

  if (registeredEmail) {
    return (
      <div className="space-y-4">
        <Banner tone="success" title="Konto erstellt" role="status">
          Wir haben dir eine Bestätigungs-E-Mail an{' '}
          <strong>{registeredEmail}</strong> geschickt. Bitte klicke auf den
          Link in der E-Mail, um deine Adresse zu bestätigen.
        </Banner>
        <p className="text-sm text-baerenstark-bark/80">
          Du kannst dich auch sofort anmelden — die Bestätigung ist optional
          und kann später erfolgen.
        </p>
        <Link
          href="/konto/login"
          className="inline-flex w-full items-center justify-center rounded-lg bg-baerenstark-wood px-5 py-2.5 text-base font-medium text-baerenstark-cream transition-colors hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent"
        >
          Zur Anmeldung
        </Link>
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
        hint="Wird nur für Rückfragen zu deiner Buchung verwendet."
        error={errors.phone?.message}
        {...register('phone')}
      />

      {/*
        IT9 / US-IT9-02 — Adress-Section. Komplett optional bei der
        Registrierung. Hinweistext erklärt den Nutzen, ohne Druck. Wenn der
        Kunde die Adresse hier ausfüllt, ist sie später beim Buchen automatisch
        vorausgefüllt (siehe BookingForm).
      */}
      <fieldset className="rounded-lg border border-baerenstark-sand bg-baerenstark-cream/40 p-4">
        <legend className="px-1 text-sm font-medium text-baerenstark-bark">
          Deine Adresse (optional)
        </legend>
        <p className="mb-3 text-xs text-baerenstark-bark/70">
          Wird für Terminbuchungen benötigt — du kannst sie auch später im
          Profil ergänzen.
        </p>
        <div className="space-y-3">
          <Input
            label="Straße & Hausnummer"
            autoComplete="street-address"
            placeholder="Musterstraße 12"
            error={errors.streetAndNumber?.message}
            {...register('streetAndNumber')}
          />
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Input
                label="PLZ"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                autoComplete="postal-code"
                placeholder="64283"
                error={errors.postalCode?.message}
                {...register('postalCode')}
              />
            </div>
            <div className="col-span-2">
              <Input
                label="Ort"
                autoComplete="address-level2"
                placeholder="Darmstadt"
                error={errors.city?.message}
                {...register('city')}
              />
            </div>
          </div>
        </div>
      </fieldset>

      <div>
        <Input
          label="Passwort"
          type="password"
          autoComplete="new-password"
          required
          hint={`Mindestens ${CUSTOMER_PASSWORD_MIN_LENGTH} Zeichen.`}
          error={errors.password?.message}
          {...register('password')}
        />
        {passwordValue && (
          <div className="mt-2" aria-hidden="true">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-baerenstark-sand/60">
              <div
                className={`h-full rounded-full transition-all ${bar.width} ${bar.color}`}
              />
            </div>
            <p className="mt-1 text-xs text-baerenstark-bark/70">
              <span className="font-medium">{bar.label}</span>
              {strength.hint && <span> · {strength.hint}</span>}
            </p>
          </div>
        )}
      </div>

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
          id="privacyAccepted"
          type="checkbox"
          aria-invalid={Boolean(errors.privacyAccepted) || undefined}
          className="mt-1 h-4 w-4 rounded border-baerenstark-sand text-baerenstark-wood focus:ring-baerenstark-accent"
          {...register('privacyAccepted')}
        />
        <label
          htmlFor="privacyAccepted"
          className="text-sm text-baerenstark-bark/80"
        >
          Ich habe die{' '}
          <Link
            href="/datenschutz"
            className="text-baerenstark-wood underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Datenschutzerklärung
          </Link>{' '}
          gelesen und akzeptiere sie.
          <span aria-hidden="true" className="ml-0.5 text-baerenstark-wood">
            *
          </span>
        </label>
      </div>
      {errors.privacyAccepted?.message && (
        <p role="alert" className="-mt-2 text-xs font-medium text-red-700">
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

      <p className="text-center text-sm text-baerenstark-bark/80">
        Schon ein Konto?{' '}
        <Link
          href="/konto/login"
          className="font-medium text-baerenstark-wood underline-offset-2 hover:underline"
        >
          Jetzt anmelden
        </Link>
      </p>
    </form>
  );
}
