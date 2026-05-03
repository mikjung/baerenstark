'use client';

/**
 * AdminUserTable — `/admin/admins` (US-IT6-01).
 *
 * Tabelle aller Admin-Accounts mit Aktionen "Editieren", "Deaktivieren",
 * "Löschen" (Soft-Delete). Lock-out-Schutz: für die Zeile des aktuell
 * eingeloggten Admins sind alle Aktionen ausgegraut.
 *
 * Backend-Verhalten siehe contracts/api-routes.md §22.1:
 *   - Letzter Admin: 409 LAST_ADMIN_LOCK → Banner-Fehler.
 *   - Eigener Account: 409 SELF_MUTATION_FORBIDDEN → Banner-Fehler.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ApiClientError } from '@/lib/api-client';
import {
  deleteAdmin,
  fetchAdmins,
  updateAdmin,
} from '@/lib/api-client-it6';
import { formatDateTime } from '@/lib/format';
import type { AdminListItem } from '@/lib/schemas';
import { CreateAdminDialog } from './CreateAdminDialog';
import { EditAdminDialog } from './EditAdminDialog';

type LoadStatus = 'loading' | 'ready' | 'error';

interface Props {
  /** ID des aktuell eingeloggten Admins (für Self-Lock-out-Schutz). */
  currentAdminId: string;
}

interface PendingActionState {
  admin: AdminListItem;
  kind: 'disable' | 'delete';
}

export function AdminUserTable({ currentAdminId }: Props) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [admins, setAdmins] = useState<AdminListItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminListItem | null>(null);
  const [pending, setPending] = useState<PendingActionState | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const res = await fetchAdmins();
      setAdmins(res.data);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      if (err instanceof ApiClientError && err.status === 404) {
        setErrorMessage(
          'Admin-Endpoint ist noch nicht aktiv. Sobald das Backend deployed ist, erscheinen die Daten hier.',
        );
      } else {
        setErrorMessage(
          err instanceof ApiClientError
            ? err.message
            : 'Admins konnten nicht geladen werden.',
        );
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = useMemo(
    () => admins.filter((a) => a.status === 'ACTIVE').length,
    [admins],
  );

  const onCreated = (created: AdminListItem) => {
    setAdmins((prev) => [...prev, created]);
    setCreateOpen(false);
    setToast({ tone: 'success', message: `Admin "${created.name}" angelegt.` });
  };

  const onEdited = (updated: AdminListItem) => {
    setAdmins((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setEditTarget(null);
    setToast({ tone: 'success', message: 'Änderungen gespeichert.' });
  };

  const onConfirmAction = async () => {
    if (!pending) return;
    setActionInProgress(true);
    try {
      if (pending.kind === 'disable') {
        const updated = await updateAdmin(pending.admin.id, { status: 'DISABLED' });
        setAdmins((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setToast({ tone: 'success', message: 'Admin deaktiviert.' });
      } else {
        await deleteAdmin(pending.admin.id);
        // Nach Soft-Delete: status auf DISABLED — Server liefert 204, daher
        // optimistisch updaten.
        setAdmins((prev) =>
          prev.map((a) => (a.id === pending.admin.id ? { ...a, status: 'DISABLED' } : a)),
        );
        setToast({ tone: 'success', message: 'Admin gelöscht (deaktiviert).' });
      }
      setPending(null);
    } catch (err) {
      let message = 'Aktion fehlgeschlagen.';
      if (err instanceof ApiClientError) {
        if (err.code === 'CONFLICT' && /letzter|last/i.test(err.message)) {
          message = 'Mindestens ein Admin muss immer vorhanden sein.';
        } else if (err.message?.toLowerCase().includes('selbst')) {
          message = 'Du kannst dich nicht selbst deaktivieren oder löschen.';
        } else {
          message = err.message;
        }
      }
      setToast({ tone: 'error', message });
    } finally {
      setActionInProgress(false);
    }
  };

  if (status === 'loading') {
    return <SkeletonCard />;
  }

  return (
    <div className="space-y-4">
      {errorMessage && (
        <Banner tone="error" role="alert" title="Fehler">
          {errorMessage}
        </Banner>
      )}
      {toast && (
        <Banner tone={toast.tone} role={toast.tone === 'error' ? 'alert' : 'status'}>
          {toast.message}
        </Banner>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-baerenstark-bark/70">
          {admins.length} Konten · {activeCount} aktiv
        </p>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          Neuen Admin anlegen
        </Button>
      </div>

      {admins.length === 0 ? (
        <div className="rounded-lg border border-baerenstark-sand bg-white p-8 text-center text-sm text-baerenstark-bark/70">
          Noch keine Admins vorhanden.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-baerenstark-sand bg-white">
          <table className="w-full text-sm">
            <thead className="bg-baerenstark-cream/60 text-left text-xs uppercase tracking-wide text-baerenstark-bark/70">
              <tr>
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">E-Mail</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Letzter Login</th>
                <th className="px-3 py-2.5">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => {
                const isSelf = admin.id === currentAdminId;
                const isLastActive = admin.status === 'ACTIVE' && activeCount === 1;
                const disableBlocked = isSelf || isLastActive;
                return (
                  <tr key={admin.id} className="border-t border-baerenstark-sand">
                    <td className="px-3 py-2.5 font-medium">
                      {admin.name}
                      {isSelf && (
                        <span className="ml-2 text-xs text-baerenstark-bark/60">(du)</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">{admin.email}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={admin.status === 'ACTIVE' ? 'success' : 'neutral'}>
                        {admin.status === 'ACTIVE' ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-baerenstark-bark/70">
                      {admin.lastLoginAt ? formatDateTime(admin.lastLoginAt) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditTarget(admin)}
                          aria-label={`${admin.name} bearbeiten`}
                          disabled={isSelf}
                          title={isSelf ? 'Eigenes Konto kann nicht hier editiert werden.' : undefined}
                        >
                          Editieren
                        </Button>
                        {admin.status === 'ACTIVE' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPending({ admin, kind: 'disable' })}
                            disabled={disableBlocked}
                            title={
                              isSelf
                                ? 'Du kannst dich nicht selbst deaktivieren.'
                                : isLastActive
                                  ? 'Mindestens ein Admin muss immer vorhanden sein.'
                                  : undefined
                            }
                          >
                            Deaktivieren
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setPending({ admin, kind: 'delete' })}
                          disabled={disableBlocked}
                          title={
                            isSelf
                              ? 'Du kannst dich nicht selbst löschen.'
                              : isLastActive
                                ? 'Mindestens ein Admin muss immer vorhanden sein.'
                                : undefined
                          }
                        >
                          Löschen
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateAdminDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={onCreated}
      />
      <EditAdminDialog
        admin={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={onEdited}
      />
      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.kind === 'delete' ? 'Admin löschen?' : 'Admin deaktivieren?'
        }
        description={
          pending
            ? `${pending.admin.name} (${pending.admin.email}) ${
                pending.kind === 'delete'
                  ? 'wird deaktiviert (Soft-Delete) und kann sich nicht mehr einloggen.'
                  : 'wird deaktiviert und kann sich nicht mehr einloggen.'
              }`
            : ''
        }
        confirmLabel={pending?.kind === 'delete' ? 'Löschen' : 'Deaktivieren'}
        variant="danger"
        isLoading={actionInProgress}
        onCancel={() => setPending(null)}
        onConfirm={onConfirmAction}
      />
    </div>
  );
}
