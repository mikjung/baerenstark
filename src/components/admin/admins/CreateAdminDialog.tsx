'use client';

/**
 * CreateAdminDialog — Modal-Form für das Anlegen eines neuen Admins
 * (US-IT6-01 AC2). react-hook-form + Zod-Schema (CreateAdminSchema).
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiClientError } from '@/lib/api-client';
import { createAdmin } from '@/lib/api-client-it6';
import {
  CreateAdminSchema,
  type AdminListItem,
  type CreateAdminInput,
} from '@/lib/schemas';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (admin: AdminListItem) => void;
}

export function CreateAdminDialog({ open, onClose, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateAdminInput>({
    resolver: zodResolver(CreateAdminSchema),
    mode: 'onBlur',
    defaultValues: { name: '', email: '', password: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({ name: '', email: '', password: '' });
    setServerError(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose, reset]);

  if (!open) return null;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSubmitting(true);
    try {
      const created = await createAdmin(values);
      onCreated(created);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'CONFLICT' && err.field === 'email') {
          setServerError('Diese E-Mail ist bereits vergeben.');
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError('Anlegen fehlgeschlagen.');
      }
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-admin-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="create-admin-title"
          className="font-serif text-xl font-bold text-baerenstark-bark"
        >
          Neuen Admin anlegen
        </h2>
        <p className="mt-1 text-sm text-baerenstark-bark/70">
          Mindestens 12 Zeichen, ein Großbuchstabe, ein Kleinbuchstabe, eine Ziffer.
        </p>
        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
          <Input
            label="Name"
            autoFocus
            required
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="E-Mail"
            type="email"
            autoComplete="off"
            required
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Initiales Passwort"
            type="password"
            autoComplete="new-password"
            required
            error={errors.password?.message}
            {...register('password')}
          />

          {serverError && (
            <Banner tone="error" role="alert">
              {serverError}
            </Banner>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Abbrechen
            </Button>
            <Button type="submit" isLoading={submitting}>
              Anlegen
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
