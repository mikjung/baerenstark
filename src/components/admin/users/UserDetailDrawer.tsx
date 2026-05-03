'use client';

/**
 * UserDetailDrawer — Side-Drawer mit Profil-Edit + interner Notiz/Rating
 * (US-IT6-07 AC2, AC3, AC6).
 *
 * Side-Drawer rechts (auf Desktop) bzw. Bottom-Sheet (auf Mobile).
 * Lädt `GET /api/admin/users/:id` (Detail mit Buchungs-Liste).
 * Speichert via `PATCH /api/admin/users/:id`.
 * Löschen via `DELETE /api/admin/users/:id` mit ConfirmDialog.
 *
 * **Sicherheit:** zeigt explizit die Admin-only-Felder `adminNote` und
 * `adminRating` — diese Komponente ist klar von `PublicUserCard`/Customer-
 * facing-Komponenten getrennt (siehe ARCHITECTURE_IT6.md §9.2).
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Textarea } from '@/components/ui/Input';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ApiClientError } from '@/lib/api-client';
import {
  type AdminUserDetail,
  deleteAdminUser,
  fetchAdminUser,
  updateAdminUser,
} from '@/lib/api-client-it6';
import { formatBerlinDateShort, formatDateShort } from '@/lib/format';
import {
  CUSTOMER_ADMIN_NOTE_MAX_LENGTH,
  type CustomerUserAdmin,
} from '@/lib/schemas';
import { getServiceLabel } from '@/lib/services';
import { StarRatingInput } from './StarRatingInput';

interface Props {
  userId: string | null;
  onClose: () => void;
  onChanged: (user: CustomerUserAdmin) => void;
  onDeleted: (id: string) => void;
}

const FormSchema = z.object({
  firstName: z.string().trim().min(1, 'Pflichtfeld.').max(120),
  lastName: z.string().trim().min(1, 'Pflichtfeld.').max(120),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  adminNote: z.string().trim().max(CUSTOMER_ADMIN_NOTE_MAX_LENGTH).optional().or(z.literal('')),
});
type FormValues = z.infer<typeof FormSchema>;

type LoadStatus = 'loading' | 'ready' | 'error';

export function UserDetailDrawer({ userId, onClose, onChanged, onDeleted }: Props) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [adminRating, setAdminRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: 'onBlur',
    defaultValues: { firstName: '', lastName: '', phone: '', adminNote: '' },
  });

  useEffect(() => {
    if (!userId) {
      setUser(null);
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);
    setServerError(null);
    setSavedTick(null);
    fetchAdminUser(userId)
      .then((data) => {
        if (cancelled) return;
        setUser(data);
        setAdminRating(data.adminRating);
        reset({
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone ?? '',
          adminNote: data.adminNote ?? '',
        });
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        if (err instanceof ApiClientError && err.status === 404) {
          setErrorMessage('Kunde nicht gefunden (oder Backend noch nicht deployed).');
        } else {
          setErrorMessage(
            err instanceof ApiClientError ? err.message : 'Detail konnte nicht geladen werden.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reset]);

  useEffect(() => {
    if (!userId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [userId, onClose]);

  const ratingChanged = adminRating !== (user?.adminRating ?? null);
  const canSave = (isDirty || ratingChanged) && !submitting;

  const onSave = handleSubmit(async (values) => {
    if (!user) return;
    setServerError(null);
    setSavedTick(null);
    setSubmitting(true);
    try {
      const patch: Parameters<typeof updateAdminUser>[1] = {};
      if (values.firstName !== user.firstName) patch.firstName = values.firstName;
      if (values.lastName !== user.lastName) patch.lastName = values.lastName;
      const phoneInput = values.phone?.trim() || '';
      const phoneCurrent = user.phone ?? '';
      if (phoneInput !== phoneCurrent) {
        patch.phone = phoneInput === '' ? null : phoneInput;
      }
      const noteInput = values.adminNote?.trim() || '';
      const noteCurrent = user.adminNote ?? '';
      if (noteInput !== noteCurrent) {
        patch.adminNote = noteInput === '' ? null : noteInput;
      }
      if (ratingChanged) {
        patch.adminRating = adminRating;
      }
      if (Object.keys(patch).length === 0) {
        setSubmitting(false);
        return;
      }
      const updated = await updateAdminUser(user.id, patch);
      // bookings + adminRating-Originale aktualisieren
      setUser({ ...user, ...updated });
      onChanged(updated);
      setSavedTick('Gespeichert.');
      reset({
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone ?? '',
        adminNote: updated.adminNote ?? '',
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError('Speichern fehlgeschlagen.');
      }
    } finally {
      setSubmitting(false);
    }
  });

  const onDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      await deleteAdminUser(user.id);
      onDeleted(user.id);
      setDeleteOpen(false);
    } catch (err) {
      setServerError(
        err instanceof ApiClientError ? err.message : 'Löschen fehlgeschlagen.',
      );
      setDeleting(false);
    }
  };

  if (!userId) return null;

  const noteValue = watch('adminNote') ?? '';
  const noteLength = noteValue.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-drawer-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-baerenstark-sand bg-white p-5">
          <h2 id="user-drawer-title" className="font-serif text-xl font-bold text-baerenstark-bark">
            Kundendetails
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Schließen">
            ✕
          </Button>
        </header>

        <div className="flex-1 p-5 space-y-5">
          {status === 'loading' && <SkeletonCard />}
          {status === 'error' && errorMessage && (
            <Banner tone="error" role="alert">
              {errorMessage}
            </Banner>
          )}

          {status === 'ready' && user && (
            <>
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-baerenstark-bark/60">
                  Profil
                </h3>
                <p className="mt-1 text-xs text-baerenstark-bark/60">
                  E-Mail kann nicht editiert werden (OAuth-Konsistenz).
                </p>
                <form onSubmit={onSave} noValidate className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Vorname"
                      required
                      error={errors.firstName?.message}
                      {...register('firstName')}
                    />
                    <Input
                      label="Nachname"
                      required
                      error={errors.lastName?.message}
                      {...register('lastName')}
                    />
                  </div>
                  <Input
                    label="E-Mail"
                    value={user.email}
                    disabled
                    readOnly
                  />
                  <Input
                    label="Telefon"
                    type="tel"
                    error={errors.phone?.message}
                    {...register('phone')}
                  />

                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                      Intern (nur für Admins sichtbar)
                    </h4>
                    <div className="mt-2 space-y-3">
                      <StarRatingInput
                        value={adminRating}
                        onChange={setAdminRating}
                        label="Internes Admin-Rating"
                      />
                      <div>
                        <Textarea
                          label="Internes Kommentarfeld"
                          rows={4}
                          hint={`${noteLength} / ${CUSTOMER_ADMIN_NOTE_MAX_LENGTH} Zeichen`}
                          error={errors.adminNote?.message}
                          {...register('adminNote')}
                        />
                      </div>
                    </div>
                  </div>

                  {serverError && (
                    <Banner tone="error" role="alert">
                      {serverError}
                    </Banner>
                  )}
                  {savedTick && (
                    <Banner tone="success" role="status">
                      {savedTick}
                    </Banner>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteOpen(true)}
                      aria-label="Kunde löschen"
                    >
                      Kunde löschen
                    </Button>
                    <Button type="submit" isLoading={submitting} disabled={!canSave}>
                      Speichern
                    </Button>
                  </div>
                </form>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-baerenstark-bark/60">
                  Buchungshistorie ({user.bookings.length})
                </h3>
                {user.bookings.length === 0 ? (
                  <p className="mt-2 text-sm text-baerenstark-bark/70">
                    Noch keine Buchungen.
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-baerenstark-sand rounded border border-baerenstark-sand bg-white">
                    {user.bookings.map((b) => (
                      <li key={b.id} className="px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {getServiceLabel(b.service)}
                          </span>
                          <span className="text-xs text-baerenstark-bark/60">
                            {b.date ? formatBerlinDateShort(b.date) : formatDateShort(b.createdAt)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-baerenstark-bark/60">
                          Status: {b.status}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/*
                IT9 / US-IT9-02 AC6: Adresse READ-ONLY für den Admin
                anzeigen. Tom kann die Adresse nicht im Namen des Kunden
                ändern (DSGVO-Hoheit beim Kunden). Felder sind defensiv
                ausgelesen — wenn Backend die Felder noch nicht ausliefert
                (Migration nicht deployed), zeigen wir den Empty-State.
              */}
              <AdminAddressSection user={user} />

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-baerenstark-bark/60">
                  Stammdaten
                </h3>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-baerenstark-bark/60">Registriert</dt>
                  <dd>{formatDateShort(user.createdAt)}</dd>
                  <dt className="text-baerenstark-bark/60">E-Mail bestätigt</dt>
                  <dd>{user.emailVerified ? 'Ja' : 'Nein'}</dd>
                  <dt className="text-baerenstark-bark/60">OAuth</dt>
                  <dd>{user.oauthProvider ?? '—'}</dd>
                </dl>
              </section>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Kunde wirklich löschen?"
        description="Der Kunden-Account wird hart gelöscht. Verknüpfte Buchungen werden anonymisiert (Buchungsdaten bleiben erhalten)."
        confirmLabel="Löschen"
        variant="danger"
        isLoading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={onDelete}
      />
    </div>
  );
}

/**
 * IT9 / US-IT9-02 AC6 — Adress-Section (read-only) im Admin-Drawer.
 *
 * Liest die drei Adressfelder defensiv aus dem `AdminUserDetail`-Object.
 * Falls das Backend sie noch nicht ausliefert (Migration noch nicht deployed
 * oder DTO-Helper nicht aktualisiert), zeigen wir den Empty-State statt
 * eines Crashes.
 *
 * KEIN Edit-Button: Tom darf die Adresse nicht im Namen des Kunden ändern
 * — DSGVO-Hoheit beim Kunden.
 */
function AdminAddressSection({ user }: { user: AdminUserDetail }) {
  const u = user as unknown as Record<string, unknown>;
  const street = typeof u.streetAndNumber === 'string' ? u.streetAndNumber : null;
  const zip = typeof u.postalCode === 'string' ? u.postalCode : null;
  const city = typeof u.city === 'string' ? u.city : null;
  const hasAddress = Boolean(street || zip || city);
  return (
    <section>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-baerenstark-bark/60">
        Adresse (Profil)
      </h3>
      <p className="mt-1 text-xs text-baerenstark-bark/60">
        Vom Kunden hinterlegte Default-Adresse. Read-only — Adressänderung nur
        durch den Kunden selbst (DSGVO).
      </p>
      {hasAddress ? (
        <address className="mt-2 not-italic text-sm text-baerenstark-bark">
          {street && <div>{street}</div>}
          <div>
            {zip}
            {zip && city ? ' ' : ''}
            {city}
          </div>
        </address>
      ) : (
        <p className="mt-2 text-sm text-baerenstark-bark/60">
          Keine Adresse hinterlegt.
        </p>
      )}
    </section>
  );
}
