'use client';

/**
 * UserTable — Admin-Nutzerverwaltung (US-IT6-07).
 *
 * Features:
 *   - Tabelle mit Name, E-Mail, Registrierungsdatum, Buchungsanzahl,
 *     internem Admin-Rating.
 *   - Suche (mind. 2 Zeichen, Debounce 300 ms).
 *   - Sortierung (Whitelist: lastName_asc, createdAt_desc,
 *     bookingCount_desc, adminRating_desc).
 *   - Pagination.
 *   - Klick auf Zeile öffnet UserDetailDrawer mit Edit-Form (Profil +
 *     interne Notiz/Rating).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ApiClientError } from '@/lib/api-client';
import { fetchAdminUsers } from '@/lib/api-client-it6';
import { formatDateShort } from '@/lib/format';
import type { AdminUsersQuery, CustomerUserAdmin } from '@/lib/schemas';
import { UserDetailDrawer } from './UserDetailDrawer';

type Sort = AdminUsersQuery['sort'];

const SORT_OPTIONS: ReadonlyArray<{ value: Sort; label: string }> = [
  { value: 'lastName_asc', label: 'Nachname (A→Z)' },
  { value: 'createdAt_desc', label: 'Neuste zuerst' },
  { value: 'bookingCount_desc', label: 'Buchungsanzahl ↓' },
  { value: 'adminRating_desc', label: 'Rating ↓' },
];

const PAGE_SIZE = 25;

type LoadStatus = 'loading' | 'ready' | 'error';

export function UserTable() {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [users, setUsers] = useState<CustomerUserAdmin[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<Sort>('lastName_asc');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  // Debounce search (300 ms).
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed.length > 0 && trimmed.length < 2) {
      // < 2 Zeichen → keine Suche, leeren Filter setzen.
      setDebouncedQuery('');
      return;
    }
    const t = setTimeout(() => setDebouncedQuery(trimmed), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const lastReqId = useRef(0);

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    const reqId = ++lastReqId.current;
    try {
      const res = await fetchAdminUsers({
        q: debouncedQuery || undefined,
        page,
        pageSize: PAGE_SIZE,
        sort,
      });
      if (reqId !== lastReqId.current) return;
      // IT9 / US-IT9-01 (Defense-in-Depth): `fetchAdminUsers()` unwrappt
      // bereits die Backend-Envelope und prüft `Array.isArray`. Diese
      // zweite Prüfung schützt vor einem zukünftigen Drift im Mapper —
      // verhindert `users.map is not a function` und damit die Admin-
      // Error-Boundary.
      if (!Array.isArray(res.data)) {
        setStatus('error');
        setUsers([]);
        setTotal(0);
        setErrorMessage(
          'Datenformat-Fehler beim Laden der Nutzerliste. Bitte Seite neu laden oder den Support kontaktieren.',
        );
        return;
      }
      setUsers(res.data);
      setTotal(res.total);
      setStatus('ready');
    } catch (err) {
      if (reqId !== lastReqId.current) return;
      setStatus('error');
      if (err instanceof ApiClientError && err.status === 404) {
        setUsers([]);
        setTotal(0);
        setErrorMessage(
          'Nutzer-Endpoint ist noch nicht aktiv. Daten erscheinen, sobald das Backend deployed ist.',
        );
      } else {
        setErrorMessage(
          err instanceof ApiClientError ? err.message : 'Nutzer konnten nicht geladen werden.',
        );
      }
    }
  }, [debouncedQuery, page, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onChanged = (updated: CustomerUserAdmin) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  const onDeleted = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    setOpenId(null);
  };

  const visibleUsers = useMemo(() => users, [users]);

  return (
    <div className="space-y-4">
      {errorMessage && (
        <Banner tone="error" role="alert" title="Fehler">
          {errorMessage}
        </Banner>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[240px]">
          <Input
            label="Suche"
            type="search"
            placeholder="Name oder E-Mail (mind. 2 Zeichen)"
            value={searchInput}
            onChange={(e) => {
              setPage(1);
              setSearchInput(e.target.value);
            }}
            hint="Mindestens 2 Zeichen für die Filterung."
          />
        </div>
        <div className="min-w-[200px]">
          <label
            htmlFor="user-sort"
            className="block text-sm font-medium text-baerenstark-bark"
          >
            Sortierung
          </label>
          <select
            id="user-sort"
            value={sort}
            onChange={(e) => {
              setPage(1);
              setSort(e.target.value as Sort);
            }}
            className="mt-1.5 w-full rounded-lg border border-baerenstark-sand bg-white px-3 py-2 text-baerenstark-bark focus:border-baerenstark-wood focus:outline-none focus:ring-2 focus:ring-baerenstark-accent"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {status === 'loading' ? (
        <SkeletonCard />
      ) : visibleUsers.length === 0 ? (
        <div className="rounded-lg border border-baerenstark-sand bg-white p-8 text-center text-sm text-baerenstark-bark/70">
          {debouncedQuery
            ? `Keine Treffer für „${debouncedQuery}".`
            : 'Noch keine Kunden registriert.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-baerenstark-sand bg-white">
          <table className="w-full text-sm">
            <thead className="bg-baerenstark-cream/60 text-left text-xs uppercase tracking-wide text-baerenstark-bark/70">
              <tr>
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">E-Mail</th>
                <th className="px-3 py-2.5">Reg.</th>
                <th className="px-3 py-2.5">Buchungen</th>
                <th className="px-3 py-2.5">Rating</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((u) => (
                <tr key={u.id} className="border-t border-baerenstark-sand">
                  <td className="px-3 py-2.5 font-medium">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="px-3 py-2.5">{u.email}</td>
                  <td className="px-3 py-2.5 text-baerenstark-bark/70">
                    {formatDateShort(u.createdAt)}
                  </td>
                  <td className="px-3 py-2.5">{u.bookingCount}</td>
                  <td className="px-3 py-2.5">
                    {u.adminRating ? (
                      <span aria-label={`${u.adminRating} von 5 Sterne`}>
                        {'★'.repeat(u.adminRating)}
                        <span className="text-baerenstark-bark/30">
                          {'★'.repeat(5 - u.adminRating)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-baerenstark-bark/40">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setOpenId(u.id)}
                      aria-label={`${u.firstName} ${u.lastName} öffnen`}
                    >
                      Öffnen
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Zurück
          </Button>
          <span className="text-sm text-baerenstark-bark/70">
            Seite {page} von {totalPages} · {total} Einträge
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Weiter →
          </Button>
        </div>
      )}

      <UserDetailDrawer
        userId={openId}
        onClose={() => setOpenId(null)}
        onChanged={onChanged}
        onDeleted={onDeleted}
      />
    </div>
  );
}
