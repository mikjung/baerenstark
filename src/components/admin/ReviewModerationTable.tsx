'use client';

/**
 * ReviewModerationTable — Admin-UI für Bewertungs-Moderation (US-29 AC6).
 *
 * Lädt `GET /api/admin/reviews`. Buttons:
 *   - "Freigeben"  → PATCH approved=true
 *   - "Ablehnen"   → PATCH approved=false (zurückziehen)
 *
 * Filter: Status (alle / ausstehend / freigegeben).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  ApiClientError,
  fetchAdminReviews,
  updateReviewApproval,
} from '@/lib/api-client';
import { formatIsoBerlinShort } from '@/lib/customer-portal';
import type { Review } from '@/lib/schemas';
import { getServiceLabel } from '@/lib/services';

type FilterValue = 'all' | 'pending' | 'approved';

const FILTERS: ReadonlyArray<{ value: FilterValue; label: string }> = [
  { value: 'all', label: 'Alle' },
  { value: 'pending', label: 'Ausstehend' },
  { value: 'approved', label: 'Freigegeben' },
];

type Status = 'loading' | 'ready' | 'error';

export function ReviewModerationTable() {
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [actingId, setActingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await fetchAdminReviews();
      setReviews(data);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof ApiClientError ? err.message : 'Bewertungen konnten nicht geladen werden.',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'pending') return reviews.filter((r) => !r.approved);
    if (filter === 'approved') return reviews.filter((r) => r.approved);
    return reviews;
  }, [reviews, filter]);

  const pendingCount = useMemo(
    () => reviews.filter((r) => !r.approved).length,
    [reviews],
  );

  const onAction = async (review: Review, approved: boolean) => {
    setActingId(review.id);
    setToast(null);
    try {
      const updated = await updateReviewApproval(review.id, approved);
      setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setToast({
        tone: 'success',
        message: approved ? 'Bewertung freigegeben.' : 'Bewertung abgelehnt.',
      });
    } catch (err) {
      setToast({
        tone: 'error',
        message:
          err instanceof ApiClientError
            ? err.message
            : 'Aktion fehlgeschlagen. Bitte erneut versuchen.',
      });
    } finally {
      setActingId(null);
    }
  };

  return (
    <section aria-labelledby="reviews-moderation-title">
      <h2 id="reviews-moderation-title" className="sr-only">
        Bewertungen
      </h2>

      <div
        role="tablist"
        aria-label="Bewertungs-Filter"
        className="mb-4 inline-flex flex-wrap rounded-lg border border-baerenstark-sand bg-white/60 p-1"
      >
        {FILTERS.map((f) => {
          const active = filter === f.value;
          const count = f.value === 'pending' ? pendingCount : null;
          return (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.value)}
              className={[
                'flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent',
                active
                  ? 'bg-baerenstark-wood text-baerenstark-cream'
                  : 'text-baerenstark-bark hover:bg-baerenstark-sand/40',
              ].join(' ')}
            >
              {f.label}
              {count !== null && count > 0 && (
                <span
                  aria-label={`${count} ausstehend`}
                  className={[
                    'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs font-semibold',
                    active
                      ? 'bg-white/30 text-white'
                      : 'bg-red-600 text-white',
                  ].join(' ')}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {toast && (
        <div className="mb-4">
          <Banner tone={toast.tone === 'success' ? 'success' : 'error'} role="status">
            {toast.message}
          </Banner>
        </div>
      )}

      {status === 'loading' && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" ariaLabel="Lade Bewertung" />
          ))}
        </div>
      )}

      {status === 'error' && (
        <Banner tone="error" title="Fehler beim Laden" role="alert">
          <p className="mb-3">{errorMessage}</p>
          <Button variant="secondary" size="sm" onClick={load}>
            Erneut versuchen
          </Button>
        </Banner>
      )}

      {status === 'ready' && filtered.length === 0 && (
        <Banner tone="info">
          {filter === 'pending'
            ? 'Keine ausstehenden Bewertungen.'
            : 'Keine Bewertungen vorhanden.'}
        </Banner>
      )}

      {status === 'ready' && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-baerenstark-sand bg-white/70 shadow-soft">
          <table className="min-w-full divide-y divide-baerenstark-sand/60 text-sm">
            <thead className="bg-baerenstark-cream/50 text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold text-baerenstark-bark">
                  Kunde
                </th>
                <th scope="col" className="px-4 py-3 font-semibold text-baerenstark-bark">
                  Sterne
                </th>
                <th scope="col" className="px-4 py-3 font-semibold text-baerenstark-bark">
                  Service
                </th>
                <th scope="col" className="px-4 py-3 font-semibold text-baerenstark-bark">
                  Text
                </th>
                <th scope="col" className="px-4 py-3 font-semibold text-baerenstark-bark">
                  Datum
                </th>
                <th scope="col" className="px-4 py-3 font-semibold text-baerenstark-bark">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-semibold text-baerenstark-bark">
                  Aktion
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-baerenstark-sand/40">
              {filtered.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-3 font-medium text-baerenstark-bark">
                    {r.customerName}
                  </td>
                  <td className="px-4 py-3">
                    <span aria-label={`${r.stars} von 5 Sternen`} className="text-amber-accent">
                      {'★'.repeat(r.stars)}
                      {'☆'.repeat(5 - r.stars)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-baerenstark-bark/85">
                    {r.service ? getServiceLabel(r.service) : '—'}
                  </td>
                  <td className="px-4 py-3 text-baerenstark-bark/85">
                    {r.text ? `„${r.text}"` : <em className="text-baerenstark-bark/50">Kein Text</em>}
                  </td>
                  <td className="px-4 py-3 text-baerenstark-bark/85">
                    {formatIsoBerlinShort(r.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {r.approved ? (
                      <Badge tone="success">Freigegeben</Badge>
                    ) : (
                      <Badge tone="warning">Ausstehend</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.approved ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onAction(r, false)}
                        isLoading={actingId === r.id}
                      >
                        Zurückziehen
                      </Button>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => onAction(r, true)}
                          isLoading={actingId === r.id}
                        >
                          Freigeben
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onAction(r, false)}
                          disabled={actingId === r.id}
                        >
                          Ablehnen
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
