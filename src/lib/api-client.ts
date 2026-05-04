/**
 * Typisierter API-Client für alle Frontend-Aufrufe.
 *
 * Alle Endpunkte aus contracts/api-routes.md laufen über diese Funktionen.
 * Vorteile:
 *   - Einheitliches Error-Handling (ApiError-Format).
 *   - Kein direktes fetch() in UI-Komponenten verstreut.
 *   - Cookie-basierter Auth via NextAuth ist same-origin → credentials: 'include'.
 */

import type {
  ApiError,
  AvailabilityTemplateDay,
  AvailableSlotsResponse,
  BookingAdmin,
  BookingStatus,
  BufferConfig,
  CalendarMonth,
  CreateBookingInput,
  CreateDayOverrideInput,
  CreatePaymentInput,
  CreatePaymentSessionResponse,
  CreateReviewInput,
  CustomerBookingsResponse,
  CustomerForgotPasswordInput,
  CustomerLoginInput,
  CustomerLoginResponse,
  CustomerProfileUpdateInput,
  CustomerRegisterInput,
  CustomerResetPasswordInput,
  CustomerUserPublic,
  DayOverride,
  Payment,
  PublicReview,
  Review,
  SessionStatus,
  SlotPublic,
  UpcomingBooking,
  UploadResponse,
  WeeklyAvailabilityDay,
} from './schemas';

// ---------------------------------------------------------------------------
// Fehlerklasse
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'OVERLAP'
  | 'GONE'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'EMAIL_NOT_VERIFIED'
  | 'STRIPE_ERROR'
  | 'RATE_LIMITED'
  | 'MAIL_FAILED'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'
  | 'BLOB_NOT_CONFIGURED'
  // Iteration 7 — Customer-Email-Auth (US-IT7-01, US-IT7-05)
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'OAUTH_ONLY_ACCOUNT'
  | 'ALREADY_VERIFIED'
  | 'INVALID_OR_EXPIRED_TOKEN';

export class ApiClientError extends Error {
  status: number;
  code: ApiErrorCode;
  field?: string;
  /**
   * IT10 (ARCHITECTURE_IT10 §9.1, STRUCT-3): optionaler Subcode für feinere
   * Diagnose. Backend ergänzt z. B. `subcode: 'BOOKING_SLOT_TAKEN'` bei
   * Slot-Konflikten. Frontend mapped primär auf `subcode`, mit Fallback auf
   * `code === 'CONFLICT'` + `field === 'date'` für Rückwärts-Kompatibilität.
   */
  subcode?: string;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    field?: string,
    subcode?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.field = field;
    this.subcode = subcode;
  }
}

// ---------------------------------------------------------------------------
// Low-level Fetch-Helper
// ---------------------------------------------------------------------------

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Wenn true, wird body NICHT JSON-serialisiert (z.B. FormData für Uploads). */
  rawBody?: boolean;
  signal?: AbortSignal;
  /** Optional zusätzliche Header (z. B. Idempotency-Key, IT12-S11). */
  headers?: Record<string, string>;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, rawBody = false, signal, headers: extraHeaders } = opts;

  let response: Response;
  try {
    const isJson = body && !rawBody;
    const baseHeaders: Record<string, string> = {};
    if (isJson) baseHeaders['Content-Type'] = 'application/json';
    const mergedHeaders = extraHeaders
      ? { ...baseHeaders, ...extraHeaders }
      : baseHeaders;
    response = await fetch(path, {
      method,
      headers: Object.keys(mergedHeaders).length > 0 ? mergedHeaders : undefined,
      body: rawBody ? (body as BodyInit) : isJson ? JSON.stringify(body) : undefined,
      signal,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    // Network-Errors (DNS, Offline, CORS) werden hier abgefangen und als
    // verständliche User-Message weitergegeben — niemals stilles Scheitern.
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      'Verbindung zum Server fehlgeschlagen. Bitte Internetverbindung prüfen und erneut versuchen.',
    );
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  let parsed: unknown;
  let parseFailed = false;
  try {
    parsed = await response.json();
  } catch {
    parseFailed = true;
  }

  if (!response.ok) {
    if (parseFailed || !parsed || typeof parsed !== 'object') {
      // Server hat keinen JSON-Body geliefert (z.B. 500 mit HTML-Errorpage).
      throw new ApiClientError(
        response.status,
        response.status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR',
        `Server-Fehler (HTTP ${response.status}). Bitte später erneut versuchen.`,
      );
    }
    const errorPayload = parsed as ApiError & { error?: { subcode?: string } };
    const code = (errorPayload?.error?.code ?? 'INTERNAL_ERROR') as ApiErrorCode;
    const message =
      errorPayload?.error?.message ?? `Server-Fehler (HTTP ${response.status})`;
    const field = errorPayload?.error?.field;
    // IT10 — Subcode bewusst optional aus dem rohen Body lesen (auch wenn das
    // ApiErrorSchema ihn aktuell nicht typisiert — siehe ARCHITECTURE_IT10 §9.1).
    const rawSubcode =
      typeof errorPayload?.error?.subcode === 'string'
        ? errorPayload.error.subcode
        : undefined;
    throw new ApiClientError(response.status, code, message, field, rawSubcode);
  }

  if (parseFailed) {
    return undefined as T;
  }

  return parsed as T;
}

interface DataEnvelope<T> {
  data: T;
}

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

export async function fetchSlots(params?: {
  from?: string;
  to?: string;
  day?: string;
  signal?: AbortSignal;
}): Promise<SlotPublic[]> {
  const search = new URLSearchParams();
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
  if (params?.day) search.set('day', params.day);
  const qs = search.toString();
  const path = qs ? `/api/slots?${qs}` : '/api/slots';
  const res = await request<DataEnvelope<SlotPublic[]>>(path, { signal: params?.signal });
  return res.data;
}

export interface CreateSlotPayload {
  startsAt: string;
  endsAt: string;
  description?: string | null;
}

export async function createSlot(payload: CreateSlotPayload): Promise<SlotPublic> {
  const res = await request<DataEnvelope<SlotPublic>>('/api/slots', {
    method: 'POST',
    body: payload,
  });
  return res.data;
}

export async function deleteSlot(id: string): Promise<void> {
  await request<void>(`/api/slots/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export interface CreateBookingResponse {
  id: string;
  status: BookingStatus;
  createdAt: string;
  /**
   * IT11 / US-IT11-03 (v3) — signierter JWT für die reload-feste Bestätigungs-
   * Seite (`/buchung/bestaetigung/[id]?token=...`). Gültigkeit 30 Tage. Optional,
   * weil ältere Backend-Versionen ohne IT11-Token noch antworten.
   */
  confirmationToken?: string;
  /**
   * IT11 / US-IT11-06 (v3) — signierter JWT für die Gast-Storno-Seite
   * (`/buchung/[id]/stornieren?token=...`). Gültigkeit 30 Tage.
   */
  cancellationToken?: string;
  /**
   * IT11 / BUG-MAJOR-03 — `true` wenn der POST in das 60-Sekunden-Doppel-
   * Submit-Window gelaufen ist und der Server die existierende Buchung
   * idempotent zurückgegeben hat. Frontend kann das ignorieren und ganz
   * normal redirecten.
   */
  deduplicated?: boolean;
}

/**
 * Erstellt eine reguläre Buchungsanfrage.
 * `rebookToken` (Iteration 2): wenn vorhanden, wird der Re-Booking-Endpoint
 * statt `POST /api/bookings` verwendet — der Kunde wählt einen neuen Slot
 * für eine bestehende Anfrage (US-13 AC4).
 */
export async function createBooking(
  payload: CreateBookingInput & { rebookToken?: string },
  opts?: { idempotencyKey?: string },
): Promise<CreateBookingResponse> {
  const { rebookToken, ...rest } = payload;
  if (rebookToken) {
    if (!rest.slotId) {
      throw new ApiClientError(
        400,
        'VALIDATION_ERROR',
        'Re-Booking erfordert eine Slot-ID.',
        'slotId',
      );
    }
    return rebookViaToken(rebookToken, rest.slotId);
  }
  const headers: Record<string, string> = {};
  if (opts?.idempotencyKey) {
    // IT12-S11 / ARCHITECTURE_IT12 §R.8 — Idempotency-Key als UUID-Header.
    headers['Idempotency-Key'] = opts.idempotencyKey;
  }
  const res = await request<DataEnvelope<CreateBookingResponse>>('/api/bookings', {
    method: 'POST',
    body: rest,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });
  return res.data;
}

export async function fetchBookings(params?: {
  status?: BookingStatus;
  signal?: AbortSignal;
}): Promise<BookingAdmin[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  const qs = search.toString();
  const path = qs ? `/api/bookings?${qs}` : '/api/bookings';
  const res = await request<DataEnvelope<BookingAdmin[]>>(path, { signal: params?.signal });
  return res.data;
}

export interface UpdateBookingResponse {
  id: string;
  status: 'CONFIRMED' | 'REJECTED' | 'COMPLETED';
  updatedAt: string;
}

export async function updateBookingStatus(
  id: string,
  status: 'CONFIRMED' | 'REJECTED' | 'COMPLETED',
): Promise<UpdateBookingResponse> {
  const res = await request<DataEnvelope<UpdateBookingResponse>>(
    `/api/bookings/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: { status },
    },
  );
  return res.data;
}

export interface ResendMailResponse {
  id: string;
  mailSent: boolean;
  mailError: string | null;
}

export async function resendBookingMail(id: string): Promise<ResendMailResponse> {
  const res = await request<DataEnvelope<ResendMailResponse>>(
    `/api/bookings/${encodeURIComponent(id)}/resend-mail`,
    { method: 'POST' },
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Iteration 2 — Counter-Proposal (US-13)
// ---------------------------------------------------------------------------

export interface CounterProposalResponse {
  id: string;
  status: 'COUNTER_PROPOSED';
  counterProposalSlot: {
    id: string;
    startsAt: string;
    endsAt: string;
    description: string | null;
  };
  updatedAt: string;
}

export async function sendCounterProposal(
  bookingId: string,
  newSlotId: string,
): Promise<CounterProposalResponse> {
  const res = await request<DataEnvelope<CounterProposalResponse>>(
    `/api/bookings/${encodeURIComponent(bookingId)}/counter-proposal`,
    {
      method: 'POST',
      body: { newSlotId },
    },
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Iteration 2 — Rebook-Flow (US-13 AC4)
// ---------------------------------------------------------------------------

export interface RebookInfoResponse {
  bookingId: string;
  customerName: string;
  service: string;
  status: BookingStatus;
  originalSlot: {
    id: string;
    startsAt: string;
    endsAt: string;
    description: string | null;
  };
  counterProposalSlot: {
    id: string;
    startsAt: string;
    endsAt: string;
    description: string | null;
  } | null;
}

/**
 * Liefert die zur Re-Booking gehörende Booking-Info (Token-basiert).
 * Wird auf `/buchung?rebookToken=xxx` verwendet, um dem Kunden Kontext zu zeigen.
 *
 * Hinweis: Endpoint ist optional im Backend; falls nicht implementiert,
 * wirft 404 → Frontend zeigt einen generischen Re-Booking-Banner ohne Details.
 */
export async function fetchRebook(token: string): Promise<RebookInfoResponse> {
  const res = await request<DataEnvelope<RebookInfoResponse>>(
    `/api/bookings/rebook?token=${encodeURIComponent(token)}`,
    { method: 'GET' },
  );
  return res.data;
}

export async function rebookViaToken(
  token: string,
  newSlotId: string,
): Promise<CreateBookingResponse> {
  const res = await request<DataEnvelope<CreateBookingResponse>>('/api/bookings/rebook', {
    method: 'POST',
    body: { token, newSlotId },
  });
  return res.data;
}

// ---------------------------------------------------------------------------
// Iteration 2 — Verfügbarkeit (US-15)
// ---------------------------------------------------------------------------

export async function fetchAvailability(): Promise<WeeklyAvailabilityDay[]> {
  const res = await request<DataEnvelope<{ days: WeeklyAvailabilityDay[] }>>(
    '/api/availability',
  );
  return res.data.days;
}

export async function updateAvailability(
  days: WeeklyAvailabilityDay[],
): Promise<WeeklyAvailabilityDay[]> {
  const res = await request<DataEnvelope<{ days: WeeklyAvailabilityDay[] }>>(
    '/api/availability',
    {
      method: 'PUT',
      body: { days },
    },
  );
  return res.data.days;
}

// ---------------------------------------------------------------------------
// Iteration 2 — Kalender (US-16)
// ---------------------------------------------------------------------------

export async function fetchCalendar(
  year: number,
  month: number,
  signal?: AbortSignal,
): Promise<CalendarMonth> {
  const res = await request<DataEnvelope<CalendarMonth>>(
    `/api/calendar?year=${year}&month=${month}`,
    { signal },
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export async function fetchSetupAvailable(): Promise<{ available: boolean }> {
  const res = await request<DataEnvelope<{ available: boolean }>>('/api/admin/setup');
  return res.data;
}

export interface SetupPayload {
  email: string;
  name: string;
  password: string;
  passwordConfirm: string;
}

export async function postSetup(payload: SetupPayload): Promise<{ id: string; email: string }> {
  const res = await request<DataEnvelope<{ id: string; email: string }>>('/api/admin/setup', {
    method: 'POST',
    body: payload,
  });
  return res.data;
}

// ---------------------------------------------------------------------------
// Iteration 3 — Verfügbare Zeitslots (US-17)
// ---------------------------------------------------------------------------

/**
 * Lädt die verfügbaren Zeit-Slots für einen Tag.
 * `date` muss "YYYY-MM-DD" (Berlin-TZ) sein.
 *
 * Iteration 5 (US-33): zusätzlicher optionaler `duration`-Parameter (Minuten).
 * Wenn gesetzt, prüft das Backend, ob ein Slot mit der gewünschten Dauer
 * verfügbar ist (statt der Default-Slot-Dauer aus dem Template). Akzeptierte
 * Werte: BOOKING_DURATION_OPTIONS oder BOOKING_DURATION_ALL_DAY (-1).
 */
export async function fetchAvailableSlots(
  date: string,
  durationOrSignal?: number | AbortSignal,
  maybeSignal?: AbortSignal,
): Promise<AvailableSlotsResponse> {
  // Backwards-compat: alter Aufruf `fetchAvailableSlots(date, signal)` bleibt
  // gültig — wir prüfen den Typ des zweiten Arguments.
  let duration: number | undefined;
  let signal: AbortSignal | undefined;
  if (typeof durationOrSignal === 'number') {
    duration = durationOrSignal;
    signal = maybeSignal;
  } else {
    signal = durationOrSignal;
  }

  const search = new URLSearchParams({ date });
  if (typeof duration === 'number') {
    search.set('duration', String(duration));
  }
  const res = await request<DataEnvelope<AvailableSlotsResponse>>(
    `/api/slots/available?${search.toString()}`,
    { signal },
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Iteration 3 — AvailabilityTemplate (US-17)
// ---------------------------------------------------------------------------

export async function fetchAvailabilityTemplate(
  signal?: AbortSignal,
): Promise<AvailabilityTemplateDay[]> {
  const res = await request<DataEnvelope<{ days: AvailabilityTemplateDay[] }>>(
    '/api/admin/availability-template',
    { signal },
  );
  return res.data.days;
}

export async function updateAvailabilityTemplate(
  days: AvailabilityTemplateDay[],
): Promise<AvailabilityTemplateDay[]> {
  const res = await request<DataEnvelope<{ days: AvailabilityTemplateDay[] }>>(
    '/api/admin/availability-template',
    {
      method: 'PUT',
      body: { days },
    },
  );
  return res.data.days;
}

// ---------------------------------------------------------------------------
// Iteration 3 — DayOverrides (US-17)
// ---------------------------------------------------------------------------

export interface DayOverrideListResponse {
  month: string;
  overrides: DayOverride[];
}

/** Lädt alle Day-Overrides für einen Monat ("YYYY-MM"). */
export async function fetchDayOverrides(
  month: string,
  signal?: AbortSignal,
): Promise<DayOverrideListResponse> {
  const res = await request<DataEnvelope<DayOverrideListResponse>>(
    `/api/admin/day-overrides?month=${encodeURIComponent(month)}`,
    { signal },
  );
  return res.data;
}

/**
 * IT8 / US-IT8-04: Lädt **alle** Day-Overrides (kein Monatsfilter), sortiert
 * chronologisch aufsteigend nach Datum. Backend cappt auf
 * `DAY_OVERRIDE_LIST_ALL_MAX = 365` Einträge — wenn der Cap greift, ist
 * `truncated: true` im Response-Payload (UI zeigt einen Hinweis).
 */
export interface DayOverrideListAllResponse {
  scope: 'all';
  overrides: DayOverride[];
  truncated?: boolean;
}

export async function fetchAllDayOverrides(
  signal?: AbortSignal,
): Promise<DayOverrideListAllResponse> {
  const res = await request<DataEnvelope<DayOverrideListAllResponse>>(
    '/api/admin/day-overrides?scope=all',
    { signal },
  );
  return res.data;
}

export interface CreateDayOverrideResult {
  override: DayOverride;
  warning: {
    code: string;
    message: string;
    affectedBookingCount: number;
  } | null;
}

export async function createDayOverride(
  payload: CreateDayOverrideInput,
): Promise<CreateDayOverrideResult> {
  // Backend liefert evtl. ein optionales `warning`-Feld neben `data`.
  // Wir lesen das `Response` selbst, um Zugriff auf den vollen Body zu haben.
  const response = await fetch('/api/admin/day-overrides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    // ignore — wir prüfen unten ob OK
  }
  if (!response.ok) {
    const err = parsed as (ApiError & { error?: { subcode?: string } }) | null;
    const code = (err?.error?.code ?? 'INTERNAL_ERROR') as ApiErrorCode;
    const message = err?.error?.message ?? `Server-Fehler (HTTP ${response.status})`;
    const sub = typeof err?.error?.subcode === 'string' ? err.error.subcode : undefined;
    throw new ApiClientError(
      response.status,
      code,
      message,
      err?.error?.field,
      sub,
    );
  }
  const body = parsed as
    | { data: DayOverride; warning?: { code: string; message: string; affectedBookingCount: number } }
    | null;
  if (!body || !body.data) {
    throw new ApiClientError(500, 'INTERNAL_ERROR', 'Unerwartetes Antwortformat.');
  }
  return {
    override: body.data,
    warning: body.warning ?? null,
  };
}

export async function deleteDayOverride(id: string): Promise<void> {
  await request<void>(`/api/admin/day-overrides/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Iteration 3 — Bevorstehende Termine (US-21)
// ---------------------------------------------------------------------------

export async function fetchUpcomingBookings(
  limit = 10,
  signal?: AbortSignal,
): Promise<UpcomingBooking[]> {
  const safeLimit = Math.max(1, Math.min(100, limit));
  const res = await request<DataEnvelope<UpcomingBooking[]>>(
    `/api/admin/upcoming-bookings?limit=${safeLimit}`,
    { signal },
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Iteration 3 — Datei-Upload (US-18)
// ---------------------------------------------------------------------------

/**
 * Lädt eine einzelne Datei via `POST /api/upload` (multipart/form-data) hoch
 * und liefert die Attachment-Metadaten zurück.
 *
 * Wirft ApiClientError mit Code:
 *   - PAYLOAD_TOO_LARGE  → Datei > 20 MB.
 *   - UNSUPPORTED_MEDIA_TYPE → MIME-Type nicht erlaubt.
 *   - RATE_LIMITED       → 20/h/IP überschritten.
 *   - BLOB_NOT_CONFIGURED → Blob-Storage ist nicht konfiguriert (siehe US-18 Fallback).
 */
export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await request<DataEnvelope<UploadResponse>>('/api/upload', {
    method: 'POST',
    body: formData,
    rawBody: true,
  });
  return res.data;
}

// ---------------------------------------------------------------------------
// Iteration 4 — Kunden-Auth (US-25)
// ---------------------------------------------------------------------------
//
// Iteration 7 / US-IT7-01 + US-IT7-05:
//   Email/Password-Auth wieder aktiviert. Die Helper waren in IT6 D3 gelöscht
//   und kehren zurück. OAuth (Google + Facebook) bleibt parallel verfügbar.
//   Vertrag: contracts/api-routes.md §23.2 / §23.3.

/** POST /api/customer/register — US-IT7-01. */
export async function registerCustomer(
  payload: CustomerRegisterInput,
): Promise<CustomerUserPublic> {
  const res = await request<DataEnvelope<CustomerUserPublic>>(
    '/api/customer/register',
    { method: 'POST', body: payload },
  );
  return res.data;
}

/** POST /api/customer/login — US-IT7-01. */
export async function loginCustomer(
  payload: CustomerLoginInput,
): Promise<CustomerLoginResponse> {
  const res = await request<DataEnvelope<CustomerLoginResponse>>(
    '/api/customer/login',
    { method: 'POST', body: payload },
  );
  // IT12-S07: Customer-Sync-Event triggern, damit Header / useCustomer-
  // Subscriber den frischen Auth-State sofort kennen.
  if (typeof window !== 'undefined') {
    // dynamic import vermeidet circular dep + SSR-Crash
    import('./customer-sync').then((m) => m.emitCustomerChanged()).catch(() => {});
  }
  return res.data;
}

/**
 * POST /api/customer/forgot-password — US-IT7-05.
 *
 * Backend antwortet **immer** 200 (Email-Enumeration-Schutz). Dieser Helper
 * wirft trotzdem bei 4xx/5xx, damit Validation-Fehler oder Rate-Limits
 * im Frontend erkennbar bleiben.
 */
export async function forgotPassword(
  payload: CustomerForgotPasswordInput,
): Promise<void> {
  await request<{ ok: true }>('/api/customer/forgot-password', {
    method: 'POST',
    body: payload,
  });
}

/** POST /api/customer/reset-password — US-IT7-05. */
export async function resetPassword(
  payload: CustomerResetPasswordInput,
): Promise<void> {
  await request<{ ok: true }>('/api/customer/reset-password', {
    method: 'POST',
    body: payload,
  });
}

/** GET /api/customer/verify?token=... — US-IT7-01. */
export async function verifyEmail(token: string): Promise<void> {
  await request<{ ok: true }>(
    `/api/customer/verify?token=${encodeURIComponent(token)}`,
    { method: 'GET' },
  );
}

/** POST /api/customer/resend-verification — US-IT7-01. */
export async function resendVerification(): Promise<void> {
  await request<{ ok: true }>('/api/customer/resend-verification', {
    method: 'POST',
  });
}

export async function logoutCustomer(): Promise<void> {
  await request<DataEnvelope<{ loggedOut: boolean }>>('/api/customer/logout', {
    method: 'POST',
  });
  // IT12-S07: Customer-State-Subscriber refreshen.
  if (typeof window !== 'undefined') {
    import('./customer-sync').then((m) => m.emitCustomerChanged()).catch(() => {});
  }
}

/**
 * Lädt das eingeloggte Kundenprofil.
 *
 * Liefert `null` wenn kein/abgelaufenes Cookie vorliegt — der Frontend-Code
 * kann das als "nicht eingeloggt" interpretieren, ohne den Fehler an die
 * UI weiterzureichen.
 */
export async function getCustomerMe(): Promise<CustomerUserPublic | null> {
  try {
    const res = await request<DataEnvelope<CustomerUserPublic>>('/api/customer/me');
    return res.data;
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 401) {
      return null;
    }
    throw err;
  }
}

export async function updateCustomerProfile(
  payload: CustomerProfileUpdateInput,
): Promise<CustomerUserPublic> {
  const res = await request<DataEnvelope<CustomerUserPublic>>('/api/customer/me', {
    method: 'PATCH',
    body: payload,
  });
  return res.data;
}

// ---------------------------------------------------------------------------
// IT12-S05 — Konto aus Gast-Buchung anlegen
// ---------------------------------------------------------------------------

export interface RegisterFromBookingRequest {
  bookingId: string;
  confirmationToken: string;
  password: string;
}

export interface RegisterFromBookingResponse {
  customerId: string;
  linkedBookingsCount: number;
}

/**
 * POST /api/customer/register-from-booking — Token-gated Self-Service
 * Account-Creation aus einer existierenden Gast-Buchung. Backend leitet
 * Email/Vorname/Nachname aus dem `confirmationToken` ab; das Frontend
 * sendet sie NICHT mit (sonst ließe sich der Endpoint missbrauchen).
 *
 * Spec: ARCHITECTURE_IT12.md §R.4 Endpoint #1 + §5.
 *
 * Response 201 setzt direkt das `customer-session`-Cookie via Set-Cookie —
 * kein separater Login-Call nötig. Frontend ruft danach
 * `emitCustomerChanged()`.
 */
export async function registerFromBooking(
  payload: RegisterFromBookingRequest,
): Promise<RegisterFromBookingResponse> {
  const res = await request<RegisterFromBookingResponse>(
    '/api/customer/register-from-booking',
    { method: 'POST', body: payload },
  );
  // Bestand: andere Endpoints liefern `{ data: ... }`. Backend-Vertrag
  // §R.4 listet die Response ohne Envelope. Wir akzeptieren beide Formate.
  if (res && typeof res === 'object' && 'data' in res) {
    return (res as unknown as { data: RegisterFromBookingResponse }).data;
  }
  return res;
}

// ---------------------------------------------------------------------------
// IT12-S15 — Marketing-E-Mails (Admin-Seite, ARCHITECTURE_IT12.md §R.4)
// ---------------------------------------------------------------------------

export interface MarketingRecipient {
  customerId: string;
  email: string;
  firstName: string;
  lastName: string;
  bookedServices: string[];
  completedBookingCount: number;
  lastBookingAt: string | null;
  unsubscribedAt: string | null;
}

export interface MarketingRecipientListResponse {
  data: MarketingRecipient[];
  total: number;
  page: number;
  limit: number;
  /** Hilfsfeld für UI-Quota-Anzeige (Resend Free 100/Tag). */
  dailyQuotaRemaining?: number;
}

export interface MarketingRecipientFilters {
  service?: string; // Komma-getrennte Slugs
  hasBooked?: boolean;
  unsubscribed?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

export async function fetchMarketingRecipients(
  filters: MarketingRecipientFilters = {},
): Promise<MarketingRecipientListResponse> {
  const search = new URLSearchParams();
  if (filters.service) search.set('service', filters.service);
  if (typeof filters.hasBooked === 'boolean')
    search.set('hasBooked', String(filters.hasBooked));
  if (typeof filters.unsubscribed === 'boolean')
    search.set('unsubscribed', String(filters.unsubscribed));
  if (filters.search) search.set('search', filters.search);
  if (filters.page) search.set('page', String(filters.page));
  if (filters.limit) search.set('limit', String(filters.limit));
  const qs = search.toString();
  const path = qs
    ? `/api/admin/marketing/recipients?${qs}`
    : '/api/admin/marketing/recipients';
  // Backend liefert { data, total, page, limit }. Kein Envelope-Wrap.
  return request<MarketingRecipientListResponse>(path, { signal: filters.signal });
}

export interface CreateMarketingEmailRequest {
  subject: string;
  body: string;
  recipientIds: string[];
  filterServices?: string[];
  status: 'draft' | 'send';
}

export interface MarketingEmailCreatedResponse {
  id: string;
  status: 'draft' | 'sent' | 'partial_failure' | 'failed';
  intendedRecipients?: number | null;
  actualRecipients?: number | null;
  successCount?: number | null;
  failureCount?: number | null;
}

export async function createMarketingEmail(
  payload: CreateMarketingEmailRequest,
): Promise<MarketingEmailCreatedResponse> {
  return request<MarketingEmailCreatedResponse>('/api/admin/marketing/emails', {
    method: 'POST',
    body: payload,
  });
}

export interface MarketingEmailSendResponse {
  id: string;
  intendedRecipients: number;
  actualRecipients: number;
  successCount: number;
  failureCount: number;
  status: 'sent' | 'partial_failure' | 'failed';
  failedRecipients?: { email: string; errorMessage: string }[];
  /**
   * IT12-Bugfix BUG-001: Backend (Phase 4) kann bei `422 INVALID_RECIPIENTS`
   * eine Liste der ausgeschlossenen Empfänger im Error-Detail mitliefern;
   * im Erfolgsfall ist es immer leer/undefined.
   */
  excludedRecipients?: { customerId: string; reason: string }[];
}

/**
 * IT12-Bugfix BUG-001 — Send-Call sendet jetzt einen vollen Body
 * `{ recipientIds, subject, body }` statt eines leeren POST. Backend
 * akzeptiert (laut neuem `SendBodySchema`) `recipientIds` als Pflicht;
 * `subject` und `body` werden mitgesendet, damit auch der finale Stand
 * aus dem Composer (auch nach Edits, siehe FIND-002) übermittelt wird.
 *
 * Erwartete Backend-Antworten:
 *   - 200 mit `MarketingEmailSendResponse`
 *   - 400 VALIDATION_ERROR
 *   - 413 RECIPIENT_CAP_EXCEEDED
 *   - 422 INVALID_RECIPIENTS (Bestandskunden-Filter / Unsubscribe-Filter)
 *   - 429 DAILY_QUOTA_EXCEEDED
 *   - 502 RESEND_ERROR
 */
export interface SendMarketingEmailPayload {
  recipientIds: string[];
  subject: string;
  body: string;
}

export async function sendMarketingEmail(
  emailId: string,
  payload: SendMarketingEmailPayload,
): Promise<MarketingEmailSendResponse> {
  return request<MarketingEmailSendResponse>(
    `/api/admin/marketing/emails/${encodeURIComponent(emailId)}/send`,
    { method: 'POST', body: payload },
  );
}

export async function testSendMarketingEmail(
  emailId: string,
): Promise<{ ok: true; sentTo: string }> {
  return request<{ ok: true; sentTo: string }>(
    `/api/admin/marketing/emails/${encodeURIComponent(emailId)}/test-send`,
    { method: 'POST' },
  );
}

export interface MarketingEmailListItem {
  id: string;
  subject: string;
  recipientCount: number;
  successCount?: number;
  failureCount?: number;
  status: 'draft' | 'queued' | 'sending' | 'sent' | 'partial_failure' | 'failed';
  createdAt: string;
  completedAt: string | null;
}

export interface MarketingEmailListResponse {
  data: MarketingEmailListItem[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchMarketingEmails(params?: {
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}): Promise<MarketingEmailListResponse> {
  const search = new URLSearchParams();
  if (params?.page) search.set('page', String(params.page));
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  const path = qs ? `/api/admin/marketing/emails?${qs}` : '/api/admin/marketing/emails';
  return request<MarketingEmailListResponse>(path, { signal: params?.signal });
}

// ---------------------------------------------------------------------------
// Iteration 4 — Customer-Portal Bookings (US-26 / US-27)
// ---------------------------------------------------------------------------

export async function fetchCustomerBookings(
  signal?: AbortSignal,
): Promise<CustomerBookingsResponse> {
  const res = await request<DataEnvelope<CustomerBookingsResponse>>(
    '/api/customer/bookings',
    { signal },
  );
  return res.data;
}

export interface CancelCustomerBookingResponse {
  id: string;
  status: 'CANCELLED';
  cancelledAt: string;
}

export async function cancelCustomerBooking(
  bookingId: string,
): Promise<CancelCustomerBookingResponse> {
  const res = await request<DataEnvelope<CancelCustomerBookingResponse>>(
    `/api/customer/bookings/${encodeURIComponent(bookingId)}/cancel`,
    { method: 'POST' },
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Iteration 11 — Public Booking Summary + Cancel-Endpoints (US-IT11-03 + 06)
// ---------------------------------------------------------------------------

/**
 * IT11 / US-IT11-03 — minimal-DTO für die reload-feste Bestätigungsseite und
 * die Storno-Page-Preview. Keine PII außer dem vom Kunden selbst eingegebenen
 * Display-Namen. Quelle: ARCHITECTURE_IT11.md §3.5.
 */
export interface BookingPublicSummary {
  id: string;
  service: string;
  /** YYYY-MM-DD oder null (z.B. bei Bestand-Buchungen ohne Date-Mode-Felder). */
  date: string | null;
  /** HH:MM oder null. */
  startTime: string | null;
  status: BookingStatus;
  createdAt: string;
  customerName: string;
  /**
   * IT12-Bugfix BUG-002 — Optional: Backend kann bei Token-Auth
   * (`?token=<confirmationToken>`) die E-Mail-Adresse des Kunden
   * mitliefern, damit die „Konto erstellen?"-Card sie vorausgefüllt
   * anzeigen kann. Wenn das Backend das (noch) nicht liefert, bleibt
   * das Feld undefined und die Card fällt auf die ältere Microcopy
   * zurück.
   */
  customerEmail?: string;
}

/**
 * IT11 / US-IT11-03 + 06 — reload-feste Bestätigung und Cancel-Preview.
 * Akzeptiert sowohl `booking-confirmation`- als auch `booking-cancellation`-
 * Tokens (v3 Scope-Polymorphismus, ARCHITECTURE_IT11 §3.5).
 *
 * Aufgerufen primär aus den Server-Components `/buchung/bestaetigung/[id]` und
 * `/buchung/[id]/stornieren`. Auch aus Client-Components (z.B. nach Token-
 * Refresh) verwendbar.
 *
 * @param id        Buchungs-ID (CUID).
 * @param token     Optional bei eingeloggten Kunden (Auth-Cookie reicht).
 *                  Pflicht bei Gast-Kontext.
 */
export async function getBookingPublicSummary(
  id: string,
  token?: string,
): Promise<BookingPublicSummary> {
  const path = `/api/bookings/${encodeURIComponent(id)}/public-summary${
    token ? `?token=${encodeURIComponent(token)}` : ''
  }`;
  const res = await request<DataEnvelope<BookingPublicSummary>>(path, {
    method: 'GET',
  });
  return res.data;
}

/**
 * IT11 / US-IT11-06 — Cancel-Response. Schema gleich für eingeloggten Cancel
 * (über `/api/bookings/[id]/cancel` mit Cookie) und Gast-Cancel (mit Token).
 * Quelle: contracts/bookings-cancel.openapi.yaml §200.
 */
export interface CancelBookingResponse {
  id: string;
  status: 'CANCELLED';
  cancelledAt: string;
  /**
   * `true` wenn ein zweiter Aufruf eine bereits stornierte Buchung getroffen
   * hat — keine zweite Tom-Mail, kein zweiter Status-Update.
   */
  alreadyCancelled: boolean;
}

/**
 * IT11 / US-IT11-06 — eingeloggter Customer-Cancel über den **kanonischen**
 * Endpoint `/api/bookings/[id]/cancel` (Auth-Polymorphismus mit Cookie ODER
 * Token). Wird aus dem `/konto`-Dashboard aufgerufen.
 *
 * Antwort 200 mit `alreadyCancelled: true` bei Idempotenz; 409 bei Frist
 * abgelaufen oder Status nicht stornierbar; 401 bei Session-Ablauf.
 */
export async function cancelBookingAsCustomer(
  bookingId: string,
  reason?: string,
): Promise<CancelBookingResponse> {
  const body =
    reason && reason.trim().length > 0 ? { reason: reason.trim() } : undefined;
  const res = await request<DataEnvelope<CancelBookingResponse>>(
    `/api/bookings/${encodeURIComponent(bookingId)}/cancel`,
    {
      method: 'POST',
      body,
    },
  );
  return res.data;
}

/**
 * IT11 / US-IT11-06 — Gast-Cancel über den kanonischen Endpoint mit signiertem
 * Token in der Query. **Niemals als GET aufrufen** (Mail-Scanner-Race-Schutz,
 * ARCH §6.3) — der Storno wird ausschließlich nach explizitem User-Klick als
 * POST abgesendet.
 *
 * @param bookingId  Buchungs-ID aus dem Path.
 * @param token      Signierter JWT mit Scope `booking-cancellation`.
 * @param reason     Optionaler Storno-Grund (max. 500 Zeichen).
 */
export async function cancelBookingAsGuest(
  bookingId: string,
  token: string,
  reason?: string,
): Promise<CancelBookingResponse> {
  const body =
    reason && reason.trim().length > 0 ? { reason: reason.trim() } : undefined;
  const res = await request<DataEnvelope<CancelBookingResponse>>(
    `/api/bookings/${encodeURIComponent(bookingId)}/cancel?token=${encodeURIComponent(
      token,
    )}`,
    {
      method: 'POST',
      body,
    },
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Iteration 4 — Reviews (US-29)
// ---------------------------------------------------------------------------

export async function submitReview(
  payload: CreateReviewInput,
): Promise<Review> {
  const res = await request<DataEnvelope<Review>>('/api/customer/reviews', {
    method: 'POST',
    body: payload,
  });
  return res.data;
}

export interface PublicReviewsResponse {
  items: PublicReview[];
  average: number;
  total: number;
}

export async function fetchPublicReviews(
  limit = 20,
  signal?: AbortSignal,
): Promise<PublicReviewsResponse> {
  const safe = Math.max(1, Math.min(100, limit));
  const res = await request<DataEnvelope<PublicReviewsResponse>>(
    `/api/reviews?limit=${safe}`,
    { signal },
  );
  return res.data;
}

export async function fetchAdminReviews(
  signal?: AbortSignal,
): Promise<Review[]> {
  const res = await request<DataEnvelope<Review[]>>('/api/admin/reviews', {
    signal,
  });
  return res.data;
}

export async function updateReviewApproval(
  reviewId: string,
  approved: boolean,
): Promise<Review> {
  const res = await request<DataEnvelope<Review>>(
    `/api/admin/reviews/${encodeURIComponent(reviewId)}`,
    { method: 'PATCH', body: { approved } },
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Iteration 4 — Payments (US-28)
// ---------------------------------------------------------------------------

export async function createPaymentRequest(
  bookingId: string,
  payload: CreatePaymentInput,
): Promise<Payment> {
  const res = await request<DataEnvelope<Payment>>(
    `/api/admin/bookings/${encodeURIComponent(bookingId)}/payment`,
    { method: 'POST', body: payload },
  );
  return res.data;
}

export async function deletePaymentRequest(bookingId: string): Promise<void> {
  await request<void>(
    `/api/admin/bookings/${encodeURIComponent(bookingId)}/payment`,
    { method: 'DELETE' },
  );
}

export async function createPaymentSession(
  bookingId: string,
  cancelToken?: string,
): Promise<CreatePaymentSessionResponse> {
  const body: { bookingId: string; cancelToken?: string } = { bookingId };
  if (cancelToken) body.cancelToken = cancelToken;
  const res = await request<DataEnvelope<CreatePaymentSessionResponse>>(
    '/api/payments/create-session',
    { method: 'POST', body },
  );
  return res.data;
}

export async function fetchPaymentSessionStatus(
  sessionId: string,
  signal?: AbortSignal,
): Promise<SessionStatus> {
  const res = await request<DataEnvelope<SessionStatus>>(
    `/api/payments/session-status?session_id=${encodeURIComponent(sessionId)}`,
    { signal },
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Iteration 5 — Buffer-Config (US-34)
// ---------------------------------------------------------------------------

/**
 * Lädt den aktuellen Buffer-Wert (Minuten) aus der globalen Konfiguration.
 * Backend seedet den Default (30 Min) on-the-fly, falls kein Datensatz
 * existiert.
 */
export async function fetchBufferConfig(
  signal?: AbortSignal,
): Promise<BufferConfig> {
  const res = await request<DataEnvelope<BufferConfig>>(
    '/api/admin/buffer-config',
    { signal },
  );
  return res.data;
}

/**
 * Setzt den Buffer-Wert. Erlaubte Werte: 0, 15, 30, 45, 60 (Whitelist).
 * Andere Werte werden vom Server mit 400 `VALIDATION_ERROR` abgelehnt.
 */
export async function updateBufferConfig(
  bufferMinutes: number,
): Promise<BufferConfig> {
  const res = await request<DataEnvelope<BufferConfig>>(
    '/api/admin/buffer-config',
    {
      method: 'PUT',
      body: { bufferMinutes },
    },
  );
  return res.data;
}
