'use client';

/**
 * EditAdminDialog — Modal-Form für das Editieren eines bestehenden Admins
 * (US-IT6-01 AC6). Erlaubt Änderung von Name und E-Mail.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiClientError } from '@/lib/api-client';
import { updateAdmin } from '@/lib/api-client-it6';
import type { AdminListItem } from '@/lib/schemas';

interface Props {
  admin: AdminListItem | null;
  onClose: () => void;
  onSaved: (admin: AdminListItem) => void;
}

const FormSchema = z.object({
  name: z.string().trim().min(2, 'Mindestens 2 Zeichen.').max(120, 'Zu lang.'),
  email: z.string().trim().toLowerCase().email('Ungültige E-Mail.'),
});
type FormValues = z.infer<typeof FormSchema>;

export function EditAdminDialog({ admin, onClose, onSaved }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: 'onBlur',
    defaultValues: { name: admin?.name ?? '', email: admin?.email ?? '' },
  });

  useEffect(() => {
    if (!admin) return;
    reset({ name: admin.name, email: admin.email });
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
  }, [admin, onClose, reset]);

  if (!admin) return null;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSubmitting(true);
    try {
      const patch: { name?: string; email?: string } = {};
      if (values.name !== admin.name) patch.name = values.name;
      if (values.email !== admin.email) patch.email = values.email;
      if (Object.keys(patch).length === 0) {
        onClose();
        return;
      }
      const updated = await updateAdmin(admin.id, patch);
      onSaved(updated);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'CONFLICT' && err.field === 'email') {
          setServerError('Diese E-Mail ist bereits vergeben.');
        } else if (err.message?.toLowerCase().includes('selbst')) {
          setServerError('Du kannst dein eigenes Konto nicht hier editieren.');
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError('Speichern fehlgeschlagen.');
      }
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-admin-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="edit-admin-title"
          className="font-serif text-xl font-bold text-baerenstark-bark"
        >
          Admin editieren
        </h2>
        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
          <Input
            label="Name"
            required
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="E-Mail"
            type="email"
            required
            error={errors.email?.message}
            {...register('email')}
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
            <Button type="submit" isLoading={submitting} disabled={!isDirty}>
              Speichern
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
