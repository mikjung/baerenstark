'use client';

/**
 * ProfileForm — Profil-Bearbeitung (US-25 AC10).
 *
 * BUG-402-Fix: E-Mail ist read-only — `CustomerProfileUpdateSchema` ist
 * .strict() und akzeptiert nur firstName/lastName/phone.
 *
 * IT9 / US-IT9-02 — Adress-Section ergänzt:
 *   - Drei Felder (Straße & Hausnummer, PLZ, Ort), vorausgefüllt mit dem
 *     `initialCustomer`-Wert (oder leer für Konten ohne Adresse).
 *   - Speichern → PATCH /api/customer/me mit den drei Feldern.
 *   - DSGVO-Lösch-Pfad: alle drei Felder leeren + speichern → Backend
 *     setzt sie auf NULL (Frontend sendet leere Strings, Schema akzeptiert
 *     `union([string, '', null])`).
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiClientError, updateCustomerProfile } from '@/lib/api-client';
import { ZipCodeSchema, type CustomerUserPublic } from '@/lib/schemas';

const ProfileFormSchema = z.object({
  firstName: z.string().trim().min(1, 'Bitte Vorname angeben').max(120, 'Vorname ist zu lang'),
  lastName: z.string().trim().min(1, 'Bitte Nachname angeben').max(120, 'Nachname ist zu lang'),
  phone: z
    .string()
    .trim()
    .max(40, 'Telefonnummer ist zu lang')
    .optional()
    .or(z.literal('')),
  // IT9 / US-IT9-02 — Adressfelder:
  //   - leer (`""`) → Backend setzt das jeweilige Feld auf NULL (Lösch-Pfad).
  //   - PLZ muss leer sein ODER 5 Ziffern erfüllen (refine).
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
});
type ProfileFormInput = z.infer<typeof ProfileFormSchema>;

interface ProfileFormProps {
  initialCustomer: CustomerUserPublic;
}

/**
 * Liest Adressfelder defensiv aus dem `CustomerUserPublic`-Object.
 * Falls das Backend das Feld noch nicht ausliefert (Migration noch nicht
 * deployed), bleiben die Werte leer statt undefined-crashes auszulösen.
 */
function readAddressDefault(
  c: CustomerUserPublic,
  key: 'streetAndNumber' | 'postalCode' | 'city',
): string {
  // Defensive: Backend könnte die Felder beim Login noch nicht mitliefern.
  // Wir lesen sie via index-cast und fallen auf '' zurück.
  const v = (c as unknown as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : '';
}

export function ProfileForm({ initialCustomer }: ProfileFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<ProfileFormInput>({
    resolver: zodResolver(ProfileFormSchema),
    mode: 'onBlur',
    defaultValues: {
      firstName: initialCustomer.firstName,
      lastName: initialCustomer.lastName,
      phone: initialCustomer.phone ?? '',
      streetAndNumber: readAddressDefault(initialCustomer, 'streetAndNumber'),
      postalCode: readAddressDefault(initialCustomer, 'postalCode'),
      city: readAddressDefault(initialCustomer, 'city'),
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const phoneValue = values.phone && values.phone.length > 0 ? values.phone : undefined;
      // IT9 / US-IT9-02: Leere Strings explizit als '' senden — das Backend
      // mappt sie via `union([string, '', null])` auf NULL und löscht damit
      // den DB-Wert (DSGVO-Lösch-Pfad). Fehlt das Feld im Body komplett
      // (undefined), bleibt der DB-Wert unverändert.
      const street = values.streetAndNumber?.trim() ?? '';
      const zip = values.postalCode?.trim() ?? '';
      const city = values.city?.trim() ?? '';
      await updateCustomerProfile({
        firstName: values.firstName,
        lastName: values.lastName,
        phone: phoneValue,
        streetAndNumber: street,
        postalCode: zip,
        city: city,
      });
      const wasCleared = !street && !zip && !city;
      setSuccess(
        wasCleared
          ? 'Profil aktualisiert. Adresse wurde entfernt.'
          : 'Adresse gespeichert.',
      );
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'VALIDATION_ERROR' && err.field) {
          setError(err.field as keyof ProfileFormInput, { message: err.message });
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError('Profil konnte nicht aktualisiert werden.');
      }
    } finally {
      setSubmitting(false);
    }
  });

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
        value={initialCustomer.email}
        readOnly
        disabled
        hint="E-Mail-Adresse kann derzeit nicht selbst geändert werden. Bitte wende dich an unser Team."
        autoComplete="email"
      />

      <Input
        label="Telefon"
        type="tel"
        autoComplete="tel"
        error={errors.phone?.message}
        {...register('phone')}
      />

      {/*
        IT9 / US-IT9-02 — Adresse. Optional auf Form-Level. Hinweistext
        erklärt den Lösch-Pfad (alle Felder leer → Adresse wird entfernt).
      */}
      <fieldset className="rounded-lg border border-baerenstark-sand bg-baerenstark-cream/40 p-4">
        <legend className="px-1 text-sm font-medium text-baerenstark-bark">
          Adresse
        </legend>
        <p className="mb-3 text-xs text-baerenstark-bark/70">
          Wird beim Buchen vorausgefüllt. Du kannst die Adresse jederzeit
          ändern. Alle Felder leer speichern entfernt deine Adresse aus
          unserem System.
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

      {serverError && (
        <Banner tone="error" role="alert">
          {serverError}
        </Banner>
      )}
      {success && (
        <Banner tone="success" role="status">
          {success}
        </Banner>
      )}

      <Button type="submit" isLoading={submitting} disabled={!isDirty}>
        Speichern
      </Button>
    </form>
  );
}
