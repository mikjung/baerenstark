'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ApiClientError, deleteSlot } from '@/lib/api-client';
import { formatSlotRangeCompact } from '@/lib/format';
import type { SlotPublic } from '@/lib/schemas';

interface SlotTableProps {
  status: 'loading' | 'error' | 'ready';
  slots: SlotPublic[];
  errorMessage?: string | null;
  onChanged: () => void;
  onRetry: () => void;
}

export function SlotTable({ status, slots, errorMessage, onChanged, onRetry }: SlotTableProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (status === 'loading') {
    return (
      <div className="grid gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <Banner tone="error" title="Zeitfenster konnten nicht geladen werden" role="alert">
        <p className="mb-3">{errorMessage ?? 'Bitte erneut versuchen.'}</p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Erneut versuchen
        </Button>
      </Banner>
    );
  }

  if (slots.length === 0) {
    return (
      <Banner tone="info" title="Noch keine Zeitfenster angelegt">
        <p>Lege oben das erste Zeitfenster an, damit Kunden buchen können.</p>
      </Banner>
    );
  }

  const slotToDelete = pendingDeleteId
    ? slots.find((s) => s.id === pendingDeleteId)
    : null;

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteSlot(pendingDeleteId);
      setPendingDeleteId(null);
      onChanged();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'CONFLICT') {
          setDeleteError(
            'Dieses Zeitfenster hat bestätigte Buchungen. Bitte erst die Bestätigung zurückziehen.',
          );
        } else if (err.code === 'NOT_FOUND') {
          setDeleteError('Das Zeitfenster wurde bereits gelöscht.');
          onChanged();
          setPendingDeleteId(null);
        } else {
          setDeleteError(err.message);
        }
      } else {
        setDeleteError('Löschen fehlgeschlagen.');
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-baerenstark-sand bg-white/80 shadow-soft">
        <div className="block sm:hidden">
          <ul role="list" className="divide-y divide-baerenstark-sand/70">
            {slots.map((slot) => (
              <li key={slot.id} className="p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-medium text-baerenstark-bark">
                    {formatSlotRangeCompact(slot.startsAt, slot.endsAt)}
                  </span>
                  {slot.isBooked ? (
                    <Badge tone="warning">Belegt</Badge>
                  ) : (
                    <Badge tone="success">Frei</Badge>
                  )}
                </div>
                {slot.description && (
                  <p className="mb-2 text-sm text-baerenstark-bark/70">{slot.description}</p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingDeleteId(slot.id)}
                >
                  Löschen
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden sm:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-baerenstark-sand/40 text-xs uppercase tracking-wider text-baerenstark-bark/80">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Zeitfenster
                </th>
                <th scope="col" className="px-4 py-3">
                  Beschreibung
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Aktion
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-baerenstark-sand/60">
              {slots.map((slot) => (
                <tr key={slot.id} className="bg-white/60">
                  <td className="px-4 py-3 font-medium text-baerenstark-bark">
                    {formatSlotRangeCompact(slot.startsAt, slot.endsAt)}
                  </td>
                  <td className="px-4 py-3 text-baerenstark-bark/80">
                    {slot.description ?? <span className="text-baerenstark-bark/40">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {slot.isBooked ? (
                      <Badge tone="warning">Belegt</Badge>
                    ) : (
                      <Badge tone="success">Frei</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDeleteId(slot.id)}
                    >
                      Löschen
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(slotToDelete)}
        title="Zeitfenster löschen?"
        description={
          slotToDelete
            ? `${formatSlotRangeCompact(
                slotToDelete.startsAt,
                slotToDelete.endsAt,
              )} — Offene Anfragen werden automatisch abgelehnt.`
            : ''
        }
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="danger"
        isLoading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deleting) {
            setPendingDeleteId(null);
            setDeleteError(null);
          }
        }}
      />

      {deleteError && (
        <div className="mt-4">
          <Banner tone="error" role="alert">
            {deleteError}
          </Banner>
        </div>
      )}
    </>
  );
}
