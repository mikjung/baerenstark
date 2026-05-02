'use client';

/**
 * ProfileForm — Profil-Bearbeitung (US-25 AC10).
 *
 * BUG-402-Fix: E-Mail ist read-only — `CustomerProfileUpdateSchema` ist
 * .strict() und akzeptiert nur firstName/lastName/phone.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiClientError, updateCustomerProfile } from '@/lib/api-client';
import type { CustomerUserPublic } from '@/lib/schemas';

const ProfileFormSchema = z.object({
  firstName: z.string().trim().min(1, 'Bitte Vorname angeben').max(120, 'Vorname ist zu lang'),
  lastName: z.string().trim().min(1, 'Bitte Nachname angeben').max(120, 'Nachname ist zu lang'),
  phone: z
    .string()
    .trim()
    .max(40, 'Telefonnummer ist zu lang')
    .optional()
    .or(z.literal('')),
});
type ProfileFormInput = z.infer<typeof ProfileFormSchema>;

interface ProfileFormProps {
  initialCustomer: CustomerUserPublic;
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
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await updateCustomerProfile({
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone && values.phone.length > 0 ? values.phone : undefined,
      });
      setSuccess('Profil aktualisiert.');
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
