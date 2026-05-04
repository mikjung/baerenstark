/**
 * Iteration 6 — Frontend-API-Client-Erweiterungen.
 *
 * Wrappt die neuen Endpunkte aus `contracts/api-routes.md` §22:
 *   - §22.1 Multi-Admin (US-IT6-01)
 *   - §22.2 Kalender-UX  (US-IT6-02)
 *   - §22.3 Reviews-Verschärfung (US-IT6-03)
 *   - §22.4 Admin-Userverwaltung (US-IT6-07)
 *   - §22.5 Finaler Preis (US-IT6-08) — geht über `PATCH /api/admin/bookings/:id`
 *   - §22.6 Analytics (US-IT6-09)
 *
 * Alle Calls laufen via die existierende Fetch-Pipeline (`request()`)
 * aus `api-client.ts`; wir reichen Fehlersemantik (`ApiClientError`)
 * unverändert weiter.
 */

import { ApiClientError } from './api-client';
// Re-export für Frontend-Komponenten, die nur `api-client-it6.ts` kennen.
export { ApiClientError } from './api-client';
import type {
  AdminListItem,
  AdminUsersQuery,
  AnalyticsRange,
  AnalyticsResponse,
  AvailabilityCalendarDay,
  BookingAdminIT6,
  BookingStatus,
  CalendarEvent,
  CreateAdminInput,
  CustomerUserAdmin,
  PaymentMethod,
  ReviewAdminIT6,
  ReviewModerationStatus,
  UpdateAdminInput,
  UpdateCustomerUserAdminInput,
  CustomerBooking,
} from './schemas';

// ---------------------------------------------------------------------------
// Low-level Fetch (lokale Kopie, weil request() nicht exportiert ist)
// ---------------------------------------------------------------------------

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

interface DataEnvelope<T> {
  data: T;
}

interface RawApiError {
  error?: { code?: string; message?: string; field?: string };
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = opts;
  let response: Response;
  try {
    const isJson = body !== undefined;
    response = await fetch(path, {
      method,
      headers: isJson ? { 'Content-Type': 'application/json' } : undefined,
      body: isJson ? JSON.stringify(body) : undefined,
      signal,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      'Verbindung zum Server fehlgeschlagen. Bitte Internetverbindung prüfen und erneut versuchen.',
    );
  }

  if (response.status === 204) return undefined as T;

  let parsed: unknown;
  let parseFailed = false;
  try {
    parsed = await response.json();
  } catch {
    parseFailed = true;
  }

  if (!response.ok) {
    if (parseFailed || !parsed || typeof parsed !== 'object') {
      throw new ApiClientError(
        response.status,
        response.status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR',
        `Server-Fehler (HTTP ${response.status}). Bitte später erneut versuchen.`,
      );
    }
    const err = parsed as RawApiError;
    const code = (err.error?.code ?? 'INTERNAL_ERROR') as never;
    throw new ApiClientError(
      response.status,
      code,
      err.error?.message ?? `Server-Fehler (HTTP ${response.status})`,
      err.error?.field,
    );
  }

  if (parseFailed) return undefined as T;
  return parsed as T;
}

// ---------------------------------------------------------------------------
// US-IT6-01 — Multi-Admin
// ---------------------------------------------------------------------------

export interface AdminListResponse {
  data: AdminListItem[];
  total: number;
}

/**
 * IT8 / US-IT8-01: Backend liefert nun den flachen Vertrag
 *   `{ data: AdminListItem[] }`
 * (symmetrisch zu `createAdmin`/`updateAdmin`). Der frühere geschachtelte
 * `{ data: { data: [...], total: N } }`-Vertrag hatte die Admin-Liste
 * mit einem TypeError abrauchen lassen (`admins.filter is not a function`),
 * weil der FE-Client das Outer-`data`-Objekt direkt an `setAdmins` reichte.
 *
 * Defensive-Read: Wir prüfen explizit, dass `res.data` ein Array ist, und
 * werfen sonst einen klar lesbaren `ApiClientError`. Damit ist ein
 * zukünftiger Schema-Drift sofort sichtbar und erzeugt keine weiße Seite.
 */
export async function fetchAdmins(signal?: AbortSignal): Promise<AdminListResponse> {
  const res = await request<DataEnvelope<AdminListItem[]>>('/api/admin/admins', { signal });
  if (!Array.isArray(res?.data)) {
    throw new ApiClientError(
      500,
      'INTERNAL_ERROR',
      'Unerwartetes Antwortformat der Admin-Liste. Bitte Seite neu laden oder den Support kontaktieren.',
    );
  }
  return { data: res.data, total: res.data.length };
}

export async function createAdmin(input: CreateAdminInput): Promise<AdminListItem> {
  const res = await request<DataEnvelope<AdminListItem>>('/api/admin/admins', {
    method: 'POST',
    body: input,
  });
  return res.data;
}

export async function updateAdmin(
  id: string,
  input: UpdateAdminInput,
): Promise<AdminListItem> {
  const res = await request<DataEnvelope<AdminListItem>>(
    `/api/admin/admins/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: input },
  );
  return res.data;
}

/** Soft-Delete via Status-Update auf DISABLED. */
export async function deleteAdmin(id: string): Promise<void> {
  await request<void>(`/api/admin/admins/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// US-IT6-02 — Kalender-UX
// ---------------------------------------------------------------------------

export interface AdminCalendarEventsResponse {
  events: CalendarEvent[];
}

export async function fetchAdminCalendarEvents(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<CalendarEvent[]> {
  const search = new URLSearchParams({ from, to });
  const res = await request<DataEnvelope<AdminCalendarEventsResponse>>(
    `/api/admin/calendar/events?${search.toString()}`,
    { signal },
  );
  return res.data.events;
}

export interface AvailabilityCalendarResponse {
  days: AvailabilityCalendarDay[];
}

export async function fetchAvailabilityCalendar(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<AvailabilityCalendarDay[]> {
  const search = new URLSearchParams({ from, to });
  const res = await request<DataEnvelope<AvailabilityCalendarResponse>>(
    `/api/availability/calendar?${search.toString()}`,
    { signal },
  );
  return res.data.days;
}

// ---------------------------------------------------------------------------
// US-IT6-03 — Reviews mit Status-Filter
// ---------------------------------------------------------------------------

export async function fetchAdminReviewsIT6(
  status?: ReviewModerationStatus,
  signal?: AbortSignal,
): Promise<ReviewAdminIT6[]> {
  const path = status
    ? `/api/admin/reviews?status=${encodeURIComponent(status)}`
    : '/api/admin/reviews';
  const res = await request<DataEnvelope<ReviewAdminIT6[]>>(path, { signal });
  return res.data;
}

// ---------------------------------------------------------------------------
// US-IT6-07 — Admin-Userverwaltung
// ---------------------------------------------------------------------------

export interface AdminUsersListResponse {
  data: CustomerUserAdmin[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * IT9 / US-IT9-01: Backend-Response-Shape ist jetzt
 *   `{ data: { items: CustomerUserAdmin[]; total; page; pageSize } }`
 *
 * (vorher fehlerhaft `{ data: { data: [...], total, page, pageSize } }` → der
 * frühere Wrapper hat das innere Objekt unverarbeitet an `setUsers` gereicht
 * und `users.map is not a function` ausgelöst, was die Admin-Error-Boundary
 * gezeigt hat.)
 *
 * Wir unwrappen die Envelope hier zentral und liefern dem alten
 * Caller-Vertrag (`{ data: User[]; total; page; pageSize }`) unverändert
 * zurück — UserTable bleibt rückwärtskompatibel.
 *
 * Defensive-Read: explizite `Array.isArray`-Prüfung. Bei Schema-Drift wirft
 * die Funktion einen klar lesbaren `ApiClientError` statt eines untypisierten
 * Crashes — analog zur IT8-01-Lösung in `fetchAdmins`.
 */
interface AdminUsersListEnvelope {
  items: CustomerUserAdmin[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchAdminUsers(
  query: Partial<AdminUsersQuery> = {},
  signal?: AbortSignal,
): Promise<AdminUsersListResponse> {
  const search = new URLSearchParams();
  if (query.q) search.set('q', query.q);
  if (query.page) search.set('page', String(query.page));
  if (query.pageSize) search.set('pageSize', String(query.pageSize));
  if (query.sort) search.set('sort', query.sort);
  const qs = search.toString();
  const path = qs ? `/api/admin/users?${qs}` : '/api/admin/users';
  const res = await request<DataEnvelope<AdminUsersListEnvelope>>(path, { signal });
  if (!res?.data || !Array.isArray(res.data.items)) {
    throw new ApiClientError(
      500,
      'INTERNAL_ERROR',
      'Unerwartetes Antwortformat der Nutzerliste. Bitte Seite neu laden oder den Support kontaktieren.',
    );
  }
  return {
    data: res.data.items,
    total: typeof res.data.total === 'number' ? res.data.total : 0,
    page: typeof res.data.page === 'number' ? res.data.page : 1,
    pageSize: typeof res.data.pageSize === 'number' ? res.data.pageSize : res.data.items.length,
  };
}

export interface AdminUserDetail extends CustomerUserAdmin {
  bookings: CustomerBooking[];
}

export async function fetchAdminUser(
  id: string,
  signal?: AbortSignal,
): Promise<AdminUserDetail> {
  const res = await request<DataEnvelope<AdminUserDetail>>(
    `/api/admin/users/${encodeURIComponent(id)}`,
    { signal },
  );
  return res.data;
}

export async function updateAdminUser(
  id: string,
  input: UpdateCustomerUserAdminInput,
): Promise<CustomerUserAdmin> {
  const res = await request<DataEnvelope<CustomerUserAdmin>>(
    `/api/admin/users/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: input },
  );
  return res.data;
}

export async function deleteAdminUser(id: string): Promise<void> {
  await request<void>(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// US-IT6-08 — Finaler Preis (PATCH /api/admin/bookings/:id)
// ---------------------------------------------------------------------------

export interface AdminBookingPatchPayload {
  status?: BookingStatus;
  finalPriceEur?: string | number | null;
  finalPriceNote?: string | null;
  /** IT14 / US-IT14-S05 — Zahlungsart (intern, von Admin gesetzt). NULL = nicht erfasst. */
  paymentMethod?: PaymentMethod | null;
}

export async function patchAdminBooking(
  id: string,
  payload: AdminBookingPatchPayload,
): Promise<BookingAdminIT6> {
  const res = await request<DataEnvelope<BookingAdminIT6>>(
    `/api/admin/bookings/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: payload },
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// US-IT6-09 — Analytics
// ---------------------------------------------------------------------------

export async function fetchAnalytics(
  range: AnalyticsRange,
  custom?: { from: string; to: string },
  signal?: AbortSignal,
): Promise<AnalyticsResponse> {
  const search = new URLSearchParams({ range });
  if (range === 'custom' && custom) {
    search.set('from', custom.from);
    search.set('to', custom.to);
  }
  const res = await request<DataEnvelope<AnalyticsResponse>>(
    `/api/admin/analytics?${search.toString()}`,
    { signal },
  );
  return res.data;
}
