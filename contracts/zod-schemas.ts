/**
 * Bärenstark Hausservice — Geteilte Zod-Schemas (v1.2 — Iteration 2)
 *
 * Diese Datei ist die einzige Quelle der Wahrheit für die Form
 * der API-Payloads. Sowohl Frontend (Forms, Fetch-Wrapper) als auch
 * Backend (API-Routes) importieren von hier.
 *
 * Pfad in der Live-App: src/lib/schemas.ts (synchron mit dieser Datei).
 *
 * Änderungen v1.2 (Iteration 2 — US-13 bis US-16, BUG US-04):
 *   - BookingStatus erweitert: COUNTER_PROPOSED, CANCELLED.
 *   - CreateBookingSchema: customerEmail ist jetzt PFLICHT (US-13/US-14
 *     brauchen sie für Aktionslinks).
 *   - CreateBookingSchema: customerEmail-preprocess für Whitespace
 *     (BUG US-04 Fix 2 — siehe BUG_US04_ANALYSIS.md).
 *   - UpdateBookingStatusSchema bleibt auf CONFIRMED|REJECTED beschränkt;
 *     COUNTER_PROPOSED + CANCELLED haben dedizierte Endpunkte.
 *   - CounterProposalSchema neu (POST /api/bookings/:id/counter-proposal).
 *   - RebookingSchema neu (Re-Booking-Flow nach Counter-Proposal).
 *   - WeeklyAvailabilitySchema + WeeklyAvailabilityUpdateSchema neu (US-15).
 *   - CalendarDaySchema + CalendarMonthSchema neu (US-16).
 *   - BookingAdminSchema erweitert um cancelToken, counterProposalSlot.
 *   - Neuer Fehlercode `GONE` (HTTP 410): Token bereits verwendet / Endstatus erreicht.
 *
 * Änderungen v1.1:
 *   - BUG-008: Slot-Validierung — Min 30 min, Max 12 h, Max-Vorlauf 1 Jahr.
 *   - BUG-009: customerEmail klar als optional dokumentiert.
 *   - BUG-010: Telefon-Regex verschärft.
 *   - BUG-011: Datumsangaben akzeptieren auch Offsets.
 *   - BUG-002: Mail-Reliability-Felder.
 *   - Fehlercodes: OVERLAP, MAIL_FAILED, RATE_LIMITED.
 *   - Setup-Wizard: AdminSetupSchema neu.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Service-Konstante (muss mit src/lib/services.ts übereinstimmen)
// ---------------------------------------------------------------------------
export const SERVICES = [
  'entruempelung',
  'entkernung',
  'reinigung',
  'gruenflaechenpflege',
  'muelltonnenservice',
  'entsorgung',
] as const;

export const ServiceSchema = z.enum(SERVICES);
export type Service = z.infer<typeof ServiceSchema>;

// ---------------------------------------------------------------------------
// Booking-Status (erweitert in Iteration 2)
// ---------------------------------------------------------------------------
export const BookingStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'REJECTED',
  'COUNTER_PROPOSED',
  'CANCELLED',
]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

/**
 * Status, die einen Slot als belegt markieren (für isBooked-Logik).
 * REJECTED und CANCELLED geben den Slot wieder frei.
 */
export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = [
  'PENDING',
  'CONFIRMED',
  'COUNTER_PROPOSED',
] as const;

/** Endstatus, ab denen Token-basierte Aktionen nicht mehr möglich sind. */
export const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = [
  'CONFIRMED',
  'REJECTED',
  'CANCELLED',
] as const;

// ---------------------------------------------------------------------------
// Slot-Validierungs-Konstanten (BUG-008)
// ---------------------------------------------------------------------------
export const SLOT_MIN_DURATION_MINUTES = 30;
export const SLOT_MAX_DURATION_HOURS = 12;
export const SLOT_MAX_LEAD_TIME_DAYS = 365;

// ---------------------------------------------------------------------------
// Slot
// ---------------------------------------------------------------------------

/**
 * Antwort für GET /api/slots (öffentlich).
 *
 * `isBooked` ist abgeleitet:
 *   true  ⇔ es existiert eine Booking mit Status PENDING, CONFIRMED ODER COUNTER_PROPOSED.
 *   false sonst.
 */
export const SlotPublicSchema = z.object({
  id: z.string(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  description: z.string().nullable(),
  isBooked: z.boolean(),
});
export type SlotPublic = z.infer<typeof SlotPublicSchema>;

/**
 * Body für POST /api/slots (Admin).
 *
 * Sanity-Checks (BUG-008):
 *   - startsAt >= now (mit kleiner Toleranz wegen Clock-Drift im Backend nochmal).
 *   - endsAt - startsAt >= 30 min, <= 12 h.
 *   - startsAt <= now + 365 Tage.
 *   - Überlappungs-Check geschieht serverseitig (nicht Zod-fähig, weil
 *     DB-Lookup nötig). Verstoß → 409 mit code `OVERLAP`.
 */
export const CreateSlotSchema = z
  .object({
    startsAt: z
      .string()
      .datetime({ offset: true, message: 'Startzeit muss ein gültiges ISO-8601-Datum sein' }),
    endsAt: z
      .string()
      .datetime({ offset: true, message: 'Endzeit muss ein gültiges ISO-8601-Datum sein' }),
    description: z.string().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startsAt);
    const end = new Date(data.endsAt);
    const now = Date.now();

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Ungültiges Datum',
        path: ['startsAt'],
      });
      return;
    }

    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Endzeit muss nach Startzeit liegen',
        path: ['endsAt'],
      });
    }

    const durationMs = end.getTime() - start.getTime();
    const minMs = SLOT_MIN_DURATION_MINUTES * 60 * 1000;
    const maxMs = SLOT_MAX_DURATION_HOURS * 60 * 60 * 1000;

    if (durationMs < minMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Slot muss mindestens ${SLOT_MIN_DURATION_MINUTES} Minuten dauern`,
        path: ['endsAt'],
      });
    }

    if (durationMs > maxMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Slot darf höchstens ${SLOT_MAX_DURATION_HOURS} Stunden dauern`,
        path: ['endsAt'],
      });
    }

    if (start.getTime() < now) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Startzeit muss in der Zukunft liegen',
        path: ['startsAt'],
      });
    }

    const maxLeadMs = SLOT_MAX_LEAD_TIME_DAYS * 24 * 60 * 60 * 1000;
    if (start.getTime() > now + maxLeadMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Startzeit darf höchstens ${SLOT_MAX_LEAD_TIME_DAYS} Tage in der Zukunft liegen`,
        path: ['startsAt'],
      });
    }
  });
export type CreateSlotInput = z.infer<typeof CreateSlotSchema>;

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

/**
 * Telefon-Validierung (BUG-010).
 * - Erlaubte Zeichen: Ziffern, +, -, /, (, ), Leerzeichen.
 * - Mindestens 6 Ziffern nach Entfernen aller Trennzeichen.
 * - Max 40 Zeichen Gesamtlänge.
 */
const PHONE_ALLOWED_CHARS = /^[+\d\s\-/()]+$/;
const PHONE_MIN_DIGITS = 6;

const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Bitte eine Telefonnummer angeben')
  .max(40, 'Telefonnummer ist zu lang')
  .regex(PHONE_ALLOWED_CHARS, 'Telefonnummer enthält ungültige Zeichen')
  .refine(
    (val) => (val.match(/\d/g)?.length ?? 0) >= PHONE_MIN_DIGITS,
    `Telefonnummer muss mindestens ${PHONE_MIN_DIGITS} Ziffern enthalten`,
  );

/**
 * E-Mail-Schema mit Whitespace-Härtung (BUG US-04 Fix 2).
 *
 * `preprocess` trimmt vor der Validierung. Wenn der Trim-Output `''` ist,
 * wird der Wert auf `undefined` gemappt — wichtig, damit Browser-Autofill mit
 * Leerzeichen oder leere Default-Inputs nicht in Validierungsfehler laufen.
 *
 * In Iteration 2 ist E-Mail PFLICHT — daher das innere Schema ohne `.optional()`.
 */
const customerEmailRequiredSchema = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v;
    const trimmed = v.trim();
    return trimmed === '' ? undefined : trimmed;
  },
  z
    .string({
      required_error: 'Bitte eine E-Mail-Adresse angeben',
      invalid_type_error: 'Bitte eine E-Mail-Adresse angeben',
    })
    .email('Bitte eine gültige E-Mail-Adresse angeben')
    .max(254, 'E-Mail-Adresse ist zu lang'),
);

/**
 * Body für POST /api/bookings (öffentlich, Kunde).
 *
 * **Iteration 2: customerEmail ist Pflicht.** Begründung:
 *   - US-13 (Counter-Proposal) sendet einen Aktions-Link an den Kunden.
 *   - US-14 (Storno) ebenfalls.
 *   - Eingangsbestätigung an den Kunden braucht eine Adresse.
 *   - Ein einzelnes Pflichtfeld ist im MVP einfacher als zwei Code-Pfade
 *     (mit/ohne E-Mail). Trade-off: Kunden ohne E-Mail können online nicht
 *     buchen — sie sehen den tel:-Fallback prominent im Header der Seite.
 */
export const CreateBookingSchema = z.object({
  slotId: z.string().min(1, 'Bitte wählen Sie ein Zeitfenster'),
  customerName: z
    .string()
    .trim()
    .min(2, 'Name muss mindestens 2 Zeichen haben')
    .max(120, 'Name ist zu lang'),
  customerPhone: phoneSchema,
  customerEmail: customerEmailRequiredSchema,
  service: ServiceSchema,
  description: z
    .string()
    .trim()
    .min(5, 'Bitte eine kurze Beschreibung angeben')
    .max(2000, 'Beschreibung ist zu lang'),
  // DSGVO: Pflicht-Checkbox im Formular, damit der Datenschutzhinweis
  // aktiv bestätigt wird. Wird nicht in der DB persistiert.
  privacyAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Bitte den Datenschutzhinweis bestätigen' }),
  }),
});
export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

/**
 * Body für PATCH /api/bookings/:id (Admin) — bleibt auf CONFIRMED|REJECTED beschränkt.
 *
 * State-Machine (Iteration 2 — siehe ARCHITECTURE.md §15):
 *   PENDING            → CONFIRMED | REJECTED          (über diesen Endpoint)
 *   PENDING            → COUNTER_PROPOSED              (eigener Endpoint, siehe unten)
 *   PENDING            → CANCELLED                     (Kunden-Token-Endpoint)
 *   CONFIRMED          → REJECTED                      (über diesen Endpoint)
 *   COUNTER_PROPOSED   → CONFIRMED | CANCELLED         (Kunden-Token-Endpoint)
 *   COUNTER_PROPOSED   → PENDING                       (Re-Booking-Flow)
 *
 * Idempotenz (gleicher Zielstatus wie Ist-Status → 200 OK, kein Update,
 * kein updatedAt-Bump) bleibt unverändert.
 *
 * COUNTER_PROPOSED → CONFIRMED auf einem Slot, der inzwischen anderweitig
 * aktiv gebucht ist, wird vom DB-Constraint verhindert → 409 CONFLICT.
 */
export const UpdateBookingStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'REJECTED']),
});
export type UpdateBookingStatusInput = z.infer<typeof UpdateBookingStatusSchema>;

/**
 * Body für POST /api/bookings/:id/counter-proposal (Admin, Iteration 2 / US-13).
 *
 * Admin schlägt einen alternativen Slot vor. Verhalten:
 *   - Aktueller Status muss PENDING sein.
 *   - newSlotId muss ein anderer als der aktuelle slotId sein, existieren,
 *     nicht soft-deleted sein und keine aktive Buchung haben.
 *   - Booking wechselt auf COUNTER_PROPOSED, counterProposalSlotId wird gesetzt.
 *   - Mail-Versand an Kunden mit 3 Aktionslinks (siehe ARCHITECTURE.md §15).
 *   - Slot-Belegt-Status: COUNTER_PROPOSED zählt als belegt (siehe Partial Index).
 */
export const CounterProposalSchema = z.object({
  newSlotId: z.string().min(1, 'Bitte einen alternativen Slot angeben'),
});
export type CounterProposalInput = z.infer<typeof CounterProposalSchema>;

/**
 * Query-Parameter für GET /api/bookings/respond?token=xxx&action=accept|cancel
 * (Iteration 2 / US-13/US-14).
 *
 * Öffentlich (kein Auth). Token ist die Authority.
 *
 * Aktionen:
 *   - accept: COUNTER_PROPOSED → CONFIRMED. slotId wird auf
 *     counterProposalSlotId gesetzt; counterProposalSlotId auf NULL.
 *     Mail an Tom (Bestätigung).
 *   - cancel: PENDING|COUNTER_PROPOSED → CANCELLED.
 *     Mail an Tom (Info).
 *
 * Re-Use eines Tokens nach finalem Status (CONFIRMED/REJECTED/CANCELLED) → 410 GONE.
 */
export const TokenActionSchema = z.object({
  token: z.string().min(1, 'Token fehlt'),
  action: z.enum(['accept', 'cancel']),
});
export type TokenActionInput = z.infer<typeof TokenActionSchema>;

/**
 * Body für POST /api/bookings/respond (POST-Variante, falls aus dem Browser
 * via Re-Booking-Flow ein neuer Slot gewählt wird; Iteration 2 / US-13 AC4).
 *
 * Wenn der Kunde im Counter-Proposal "Neuen Termin wählen" klickt, landet er
 * auf /buchung?rebookToken=xxx, wählt einen neuen Slot und drückt Submit.
 * Das Frontend ruft POST /api/bookings/rebook mit { token, newSlotId } auf:
 *   COUNTER_PROPOSED → PENDING, slotId = newSlotId, counterProposalSlotId = NULL.
 * Tom erhält Benachrichtigungs-Mail (US-13 AC4).
 */
export const RebookingSchema = z.object({
  token: z.string().min(1, 'Token fehlt'),
  newSlotId: z.string().min(1, 'Bitte einen Slot auswählen'),
});
export type RebookingInput = z.infer<typeof RebookingSchema>;

/**
 * Antwort für GET /api/bookings (Admin).
 *
 * mailSent / mailError: Sichtbarkeit über E-Mail-Reliability (BUG-002).
 * Frontend zeigt Bookings mit `mailSent === false` farblich markiert
 * (orange/rot) und blendet `mailError` als Tooltip ein.
 *
 * Iteration 2: cancelToken (für Resend-Action-Links im Admin-UI),
 * counterProposalSlot (eingebetteter Slot-Datensatz, falls vorhanden).
 */
export const BookingAdminSchema = z.object({
  id: z.string(),
  slot: z.object({
    id: z.string(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    description: z.string().nullable(),
    deletedAt: z.string().datetime({ offset: true }).nullable(),
  }),
  customerName: z.string(),
  customerPhone: z.string(),
  customerEmail: z.string(),
  service: ServiceSchema,
  description: z.string(),
  status: BookingStatusSchema,
  mailSent: z.boolean(),
  mailError: z.string().nullable(),
  cancelToken: z.string(),
  counterProposalSlot: z
    .object({
      id: z.string(),
      startsAt: z.string().datetime({ offset: true }),
      endsAt: z.string().datetime({ offset: true }),
      description: z.string().nullable(),
    })
    .nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type BookingAdmin = z.infer<typeof BookingAdminSchema>;

// ---------------------------------------------------------------------------
// Weekly Availability (Iteration 2 / US-15)
// ---------------------------------------------------------------------------

/** Antwort für GET /api/availability (öffentlich) und Eingabe für PUT /api/availability (Admin). */
export const WeeklyAvailabilityDaySchema = z.object({
  dayOfWeek: z
    .number()
    .int()
    .min(0, 'Wochentag muss zwischen 0 (Sonntag) und 6 (Samstag) liegen')
    .max(6, 'Wochentag muss zwischen 0 (Sonntag) und 6 (Samstag) liegen'),
  isActive: z.boolean(),
});
export type WeeklyAvailabilityDay = z.infer<typeof WeeklyAvailabilityDaySchema>;

/** Body für PUT /api/availability (Admin). */
export const UpdateWeeklyAvailabilitySchema = z.object({
  days: z
    .array(WeeklyAvailabilityDaySchema)
    .min(1, 'Mindestens ein Wochentag erforderlich')
    .max(7, 'Höchstens 7 Wochentage')
    .superRefine((days, ctx) => {
      const seen = new Set<number>();
      for (const d of days) {
        if (seen.has(d.dayOfWeek)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Wochentag ${d.dayOfWeek} ist doppelt enthalten`,
          });
        }
        seen.add(d.dayOfWeek);
      }
    }),
});
export type UpdateWeeklyAvailabilityInput = z.infer<typeof UpdateWeeklyAvailabilitySchema>;

// ---------------------------------------------------------------------------
// Calendar (Iteration 2 / US-16)
// ---------------------------------------------------------------------------

/**
 * Ein einzelner Tag in der Kalenderansicht.
 *
 * `available` ist die kombinierte Logik:
 *   available = WeeklyAvailability(weekday).isActive
 *               AND (kein CONFIRMED Slot an diesem Tag)
 *               AND (Datum > heute)
 *
 * `slotIds` ist die Liste der Slot-IDs, die an diesem Tag mindestens teilweise
 * liegen UND nicht soft-deleted sind UND keine aktive Buchung haben (oder
 * deren aktive Buchung den Tag freilässt — pragmatisch: Slots, die der Kunde
 * potentiell wählen kann).
 */
export const CalendarDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss im Format YYYY-MM-DD sein'),
  available: z.boolean(),
  slotIds: z.array(z.string()),
});
export type CalendarDay = z.infer<typeof CalendarDaySchema>;

/** Antwort für GET /api/calendar?year=YYYY&month=MM. */
export const CalendarMonthSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  days: z.array(CalendarDaySchema),
});
export type CalendarMonth = z.infer<typeof CalendarMonthSchema>;

/** Query-Parameter für GET /api/calendar. */
export const CalendarQuerySchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(2025, 'Jahr muss >= 2025 sein')
    .max(2100, 'Jahr ist außerhalb des Bereichs'),
  month: z.coerce.number().int().min(1).max(12),
});
export type CalendarQueryInput = z.infer<typeof CalendarQuerySchema>;

// ---------------------------------------------------------------------------
// Auth (Login)
// ---------------------------------------------------------------------------

/** Eingaben für NextAuth Credentials Provider (US-07) */
export const LoginSchema = z.object({
  email: z.string().trim().email('Bitte eine gültige E-Mail-Adresse angeben'),
  password: z.string().min(1, 'Passwort darf nicht leer sein'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

/**
 * Body für POST /api/admin/setup (Setup-Wizard, einmalig).
 *
 * Greift nur, wenn die `users`-Tabelle leer ist. Sobald ein User existiert,
 * antwortet der Endpoint mit 409 CONFLICT. Tom setzt sein Initial-Passwort
 * selbst — kein Engineer kennt es jemals.
 */
export const AdminSetupSchema = z
  .object({
    email: z.string().trim().email('Bitte eine gültige E-Mail-Adresse angeben'),
    name: z.string().trim().min(1, 'Name darf nicht leer sein').max(120),
    password: z
      .string()
      .min(12, 'Passwort muss mindestens 12 Zeichen lang sein')
      .max(200, 'Passwort ist zu lang'),
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Passwörter stimmen nicht überein',
    path: ['passwordConfirm'],
  });
export type AdminSetupInput = z.infer<typeof AdminSetupSchema>;

// ---------------------------------------------------------------------------
// Einheitliches Fehler-Format
// ---------------------------------------------------------------------------

/**
 * Fehler-Codes (verbindlich für FE/BE-Vertrag).
 *
 *  - VALIDATION_ERROR  400  Eingaben sind ungültig (Zod-Fehler).
 *  - UNAUTHORIZED      401  Keine oder ungültige Session.
 *  - FORBIDDEN         403  Eingeloggt, aber nicht berechtigt.
 *  - NOT_FOUND         404  Ressource existiert nicht.
 *  - CONFLICT          409  Slot bereits aktiv gebucht (BUG-001/006) oder
 *                            Status-Übergang nicht erlaubt.
 *  - OVERLAP           409  Neuer Slot überschneidet bestehenden Slot (BUG-008).
 *  - GONE              410  Token bereits verwendet / Booking in Endstatus
 *                            (Iteration 2 / US-13/US-14).
 *  - RATE_LIMITED      429  Rate-Limit überschritten.
 *  - MAIL_FAILED       —    Marker im Booking-Datensatz; nicht als HTTP-Antwort
 *                            bei POST /api/bookings (Buchung wird trotzdem
 *                            persistiert), sondern für Admin-Dashboard und
 *                            Resend-Trigger-Endpoints.
 *  - INTERNAL_ERROR    500  Unerwarteter Server-Fehler.
 */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      'VALIDATION_ERROR',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'OVERLAP',
      'GONE',
      'RATE_LIMITED',
      'MAIL_FAILED',
      'INTERNAL_ERROR',
    ]),
    message: z.string(),
    field: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
