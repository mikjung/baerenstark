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
  BookingAdmin,
  CreateBookingInput,
  SlotPublic,
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
  | 'RATE_LIMITED'
  | 'MAIL_FAILED'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR';

export class ApiClientError extends Error {
  status: number;
  code: ApiErrorCode;
  field?: string;

  constructor(status: number, code: ApiErrorCode, message: string, field?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

// ---------------------------------------------------------------------------
// Low-level Fetch-Helper
// ---------------------------------------------------------------------------

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = opts;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      'Verbindung zum Server fehlgeschlagen. Bitte Internetverbindung prüfen.',
    );
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiClientError(
        response.status,
        'INTERNAL_ERROR',
        `Server-Fehler (${response.status})`,
      );
    }
    return undefined as T;
  }

  if (!response.ok) {
    const errorPayload = parsed as ApiError;
    const code = (errorPayload?.error?.code ?? 'INTERNAL_ERROR') as ApiErrorCode;
    const message = errorPayload?.error?.message ?? `Server-Fehler (${response.status})`;
    const field = errorPayload?.error?.field;
    throw new ApiClientError(response.status, code, message, field);
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
  signal?: AbortSignal;
}): Promise<SlotPublic[]> {
  const search = new URLSearchParams();
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
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
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  createdAt: string;
}

export async function createBooking(
  payload: CreateBookingInput,
): Promise<CreateBookingResponse> {
  const res = await request<DataEnvelope<CreateBookingResponse>>('/api/bookings', {
    method: 'POST',
    body: payload,
  });
  return res.data;
}

export async function fetchBookings(params?: {
  status?: 'PENDING' | 'CONFIRMED' | 'REJECTED';
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
  status: 'CONFIRMED' | 'REJECTED';
  updatedAt: string;
}

export async function updateBookingStatus(
  id: string,
  status: 'CONFIRMED' | 'REJECTED',
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
