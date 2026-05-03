/**
 * Bärenstark Hausservice — Geteilte Zod-Schemas (v1.6.1 — Iteration 6, QA-Revision)
 *
 * Diese Datei ist die einzige Quelle der Wahrheit für die Form
 * der API-Payloads. Sowohl Frontend (Forms, Fetch-Wrapper) als auch
 * Backend (API-Routes) importieren von hier.
 *
 * Pfad in der Live-App: src/lib/schemas.ts (synchron mit dieser Datei).
 *
 * Änderungen v1.6.1 (QA-Revision nach `QA_DESIGN_REVIEW_IT6.md`,
 * 2026-05-03 — verbindlich, siehe `ARCHITECTURE_IT6.md` Anhang B):
 *   - **F3 (DTO-Leak strukturell):** `CustomerUserPublicSchema`,
 *     `CustomerBookingSchema` und `PublicReviewSchema` sind auf
 *     `.strict()` umgestellt. Output-Validierung im Customer-Pfad ist
 *     Pflicht (siehe Anhang B §17.3). Helper
 *     `selectCustomerUserPublic()` / `selectCustomerUserAdmin()` leben
 *     in `src/lib/dto/user.ts` und sind verbindlich für jeden
 *     Prisma-Customer-Select.
 *   - **F1 (Bootstrap-Schutz):** Neue Fehlercodes
 *     `BOOTSTRAP_NOT_ALLOWED` (403) und `SETUP_NOT_CONFIGURED` (503).
 *     Engineering ergänzt `ApiErrorSchema.error.code` entsprechend.
 *   - **m1 (Public-Reviews):** `GET /api/reviews` rendert ausschließlich
 *     `PublicReviewSchema.strict()` — keine `customerId`/`bookingId`,
 *     `customerName` Format `"Vorname N."`.
 *
 * Änderungen v1.6 (Iteration 6 — US-IT6-01 bis US-IT6-09):
 *   - **US-IT6-01 (Multi-Admin):** `UserStatusSchema`,
 *     `CreateAdminSchema`, `UpdateAdminSchema`, `AdminListItemSchema`.
 *     Konstanten `ADMIN_PASSWORD_MIN_LENGTH` (12).
 *   - **US-IT6-02 (Kalender):** `CalendarEventSchema`,
 *     `AdminCalendarEventsQuerySchema`, `AvailabilityCalendarDaySchema`,
 *     `AvailabilityCalendarQuerySchema` (öffentlicher Tag-Status).
 *   - **US-IT6-03 (Reviews):** `ReviewAdminSchemaIT6` (mit `rejectedAt`/
 *     `moderatedAt`/`moderatedById`), `ReviewModerationStatusSchema`,
 *     `AdminReviewsQuerySchema`. `POST /api/customer/reviews` Vorbedingung
 *     verschärft (Backend-Logik, kein Schema-Eingriff).
 *   - **US-IT6-05 (Auth-Bereinigung):** `CUSTOMER_OAUTH_PROVIDERS_IT6`
 *     auf `['google','facebook']` (GitHub raus). Engineering ersetzt
 *     in `src/lib/schemas.ts` die alte Konstante.
 *   - **US-IT6-07 (Admin-Userverwaltung):** `CustomerUserAdminSchema`
 *     (DTO mit `adminNote`/`adminRating`),
 *     `UpdateCustomerUserAdminSchema`, `AdminUsersQuerySchema`.
 *     **Sicherheits-Convention:** `CustomerUserPublicSchema` bleibt
 *     leak-frei.
 *   - **US-IT6-08 (Finaler Preis):** `AdminBookingPatchSchema` mit
 *     `finalPriceEur` (Komma→Punkt-Normalisierung) und
 *     `finalPriceNote`. Konstanten `BOOKING_FINAL_PRICE_*`.
 *     `BookingAdminSchemaIT6` als Erweiterung von `BookingAdminSchema`.
 *   - **US-IT6-09 (Analytics):** `AnalyticsQuerySchema` (range enum),
 *     `AnalyticsResponseSchema` mit Sub-Schemas für KPIs, MonatsUmsatz,
 *     Service-Aufschlüsselung, Top-Kunden.
 *   - **Neue Fehlercodes (informell):** `ACCOUNT_DISABLED`,
 *     `LAST_ADMIN_LOCK`, `SELF_MUTATION_FORBIDDEN`,
 *     `BOOKING_NOT_COMPLETED`, `REVIEW_EXISTS`. Engineers erweitern
 *     `ApiErrorSchema.error.code` in der Live-Codebase.
 *
 * Änderungen v1.5 (Iteration 5 — US-30 bis US-34):
 *   - **US-31 (OAuth2):** `CustomerUserPublicSchema` erhält
 *     `oauthProvider`, `avatarUrl`. Neue Konstante `CUSTOMER_OAUTH_PROVIDERS`.
 *     Fehlercode `OAUTH_ONLY_ACCOUNT` (422) — Login mit Passwort gegen
 *     Konto ohne lokales Passwort.
 *   - **US-32 (Adresse):** `CreateBookingSchema` erhält drei neue
 *     Pflichtfelder `addressStreet`, `addressZip` (5-stellig), `addressCity`.
 *     `BookingFormSchema` ebenfalls. `BookingAdminSchema` und
 *     `CustomerBookingSchema` führen die Felder als nullable im Response
 *     (Bestand-Buchungen ohne Adresse).
 *   - **US-33 (Dauer):** `CreateBookingSchema.durationMinutes` neu
 *     (Whitelist 60/120/180/240/300/360/480 oder spezielle „all-day"-
 *     Markierung). `endTime` wird im API-Layer aus `startTime + duration`
 *     berechnet — Frontend schickt nur `startTime` + `durationMinutes`.
 *     `AvailableSlotsQuerySchema` erhält optionalen Param `duration`.
 *     Neuer `BOOKING_DURATION_OPTIONS` const-Array.
 *   - **US-34 (Buffer):** Neue Schemas `BufferConfigSchema` (Response),
 *     `UpdateBufferConfigSchema` (Body). Whitelist-Werte [0,15,30,45,60].
 *     `BUFFER_MINUTES_DEFAULT = 30`.
 *   - **US-30 (Admin-Pw-Reset UX):** Kein Schema-Eingriff (bestehende
 *     `LoginSchema` + `AdminSetupSchema` bleiben). Fix ist UX/Routing-Layer.
 *
 * Änderungen v1.4.1 (QA-Revision):
 *   - **BUG-402 Fix:** `CustomerProfileUpdateSchema` akzeptiert NUR
 *     firstName / lastName / phone — kein `email`-Feld mehr. E-Mail-
 *     Änderung erfordert Pending-Mechanismus (pendingEmail-Spalten),
 *     der im MVP nicht implementiert ist. Versucht ein Frontend
 *     trotzdem `email` zu senden, antwortet das Backend mit 400
 *     `VALIDATION_ERROR` (unknown field).
 *   - **MAJOR-402 Fix:** Neuer `SessionStatusSchema` für den
 *     öffentlichen Endpunkt `GET /api/payments/session-status` —
 *     Erfolgsseite kann den Stripe-Status auch ohne Customer-Session
 *     prüfen (Polling-fähig).
 *   - **MAJOR-403 Klärung:** `customerName` in ReviewSchema und
 *     PublicReviewSchema bleibt im Response Pflicht; Backend leitet
 *     ihn live aus dem Customer-Join ab (`firstName + lastName[0] + '.'`),
 *     Fallback `"Anonym"` bei `customerId === null`. Kein Schema-
 *     Eingriff (siehe ARCHITECTURE.md §17.1).
 *   - **MAJOR-405 Fix:** `CustomerLoginSchema` akzeptiert optional
 *     `redirectUrl`. Neuer `CustomerLoginResponseSchema` enthält den
 *     vom Backend validierten Pfad als `redirectUrl`. Externe URLs /
 *     Open-Redirects werden auf `/konto` gefiltert (siehe
 *     `safeCustomerCallback()` in ARCHITECTURE.md §17.1).
 *
 * Änderungen v1.4 (Iteration 4 — US-25 bis US-29):
 *   - **Kunden-Auth (US-25):**
 *     - CustomerRegisterSchema, CustomerLoginSchema,
 *       CustomerForgotPasswordSchema, CustomerResetPasswordSchema,
 *       CustomerProfileUpdateSchema, CustomerVerifyTokenQuerySchema.
 *     - CustomerUserPublicSchema (Response von GET /api/customer/me).
 *   - **Kundenportal (US-26/27):**
 *     - CustomerBookingSchema (reduzierte Booking-Antwort fürs Portal).
 *     - CustomerBookingsResponseSchema (upcoming / past Split).
 *   - **Zahlung (US-28):**
 *     - CreatePaymentSchema (Admin: Betrag hinterlegen).
 *     - PaymentSchema (Response).
 *     - CreatePaymentSessionSchema (Body: bookingId).
 *     - SessionStatusQuerySchema + SessionStatusSchema (öffentlicher
 *       Status-Endpoint für Stripe-Erfolgsseite, MAJOR-402-Fix).
 *     - StripeWebhookEventSchema (für Webhook-Validation).
 *     - PaymentStatusSchema enum.
 *   - **Reviews (US-29):**
 *     - CreateReviewSchema (Body), ReviewSchema (Response),
 *       PublicReviewSchema, ApproveReviewSchema (Admin).
 *   - **Booking-Status erweitert:** COMPLETED.
 *   - **BookingAdminSchema erweitert** um payment + customerId.
 *   - **CreateBookingSchema unverändert** — `customerId` wird serverseitig
 *     aus dem Cookie abgeleitet, NICHT aus dem Body.
 *   - Neuer Fehlercode: EMAIL_NOT_VERIFIED (422), PAYMENT_REQUIRED (402)
 *     bleibt Backlog.
 *
 * Änderungen v1.3 (Iteration 3 — US-17 bis US-24): siehe Git-History.
 *
 * Änderungen v1.2 (Iteration 2): siehe Git-History.
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
  'sonstiges', // IT3 / US-19 — Individuelle Anfrage.
] as const;

export const ServiceSchema = z.enum(SERVICES);
export type Service = z.infer<typeof ServiceSchema>;

/** Services, die "Sonstiges"-Verhalten triggern (verschärfte Beschreibung). */
export const CUSTOM_SERVICE_SLUG: Service = 'sonstiges';

/** Mindestlänge der Beschreibung bei `service === 'sonstiges'` (US-19). */
export const CUSTOM_SERVICE_MIN_DESCRIPTION_LENGTH = 30;

// ---------------------------------------------------------------------------
// Booking-Status (Iteration 4: COMPLETED neu)
// ---------------------------------------------------------------------------
export const BookingStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'REJECTED',
  'COUNTER_PROPOSED',
  'CANCELLED',
  'COMPLETED', // IT4 — Voraussetzung für Bewertung (US-29).
]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = [
  'PENDING',
  'CONFIRMED',
  'COUNTER_PROPOSED',
] as const;

export const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = [
  'CONFIRMED',
  'REJECTED',
  'CANCELLED',
  'COMPLETED', // IT4
] as const;

/** Status, in denen ein Kunde im Portal stornieren darf (vor 24h-Frist-Check). */
export const PORTAL_CANCELLABLE_STATUSES: readonly BookingStatus[] = [
  'PENDING',
  'CONFIRMED',
  'COUNTER_PROPOSED',
] as const;

// ---------------------------------------------------------------------------
// Slot-Validierungs-Konstanten (Bestand IT1/IT2)
// ---------------------------------------------------------------------------
export const SLOT_MIN_DURATION_MINUTES = 30;
export const SLOT_MAX_DURATION_HOURS = 12;
export const SLOT_MAX_LEAD_TIME_DAYS = 365;

// ---------------------------------------------------------------------------
// Zeit-/Datums-Helfer (Iteration 3, Berlin-TZ-First)
// ---------------------------------------------------------------------------

/** "HH:MM" — 24h-Format, 00:00 bis 23:59. */
export const TimeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Uhrzeit muss im Format HH:MM sein');

/** "YYYY-MM-DD" — kein Offset, Berlin-TZ-Datum. */
export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss im Format YYYY-MM-DD sein')
  .refine(
    (val) => {
      const [y, m, d] = val.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      return (
        dt.getUTCFullYear() === y &&
        dt.getUTCMonth() === m - 1 &&
        dt.getUTCDate() === d
      );
    },
    { message: 'Datum existiert nicht (z.B. 2026-02-30)' },
  );

/** Hilfsfunktion: "HH:MM" → Minuten seit Mitternacht. */
function timeStringToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// ---------------------------------------------------------------------------
// Slot (Bestand IT1/IT2 — DEPRECATED in IT3, unverändert IT4)
// ---------------------------------------------------------------------------

export const SlotPublicSchema = z.object({
  id: z.string(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  description: z.string().nullable(),
  isBooked: z.boolean(),
});
export type SlotPublic = z.infer<typeof SlotPublicSchema>;

export const CreateSlotSchema = z
  .object({
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    description: z.string().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startsAt);
    const end = new Date(data.endsAt);
    const now = Date.now();

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Ungültiges Datum', path: ['startsAt'] });
      return;
    }
    if (end <= start) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Endzeit muss nach Startzeit liegen', path: ['endsAt'] });
    }
    const durationMs = end.getTime() - start.getTime();
    const minMs = SLOT_MIN_DURATION_MINUTES * 60 * 1000;
    const maxMs = SLOT_MAX_DURATION_HOURS * 60 * 60 * 1000;
    if (durationMs < minMs) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Slot muss mindestens ${SLOT_MIN_DURATION_MINUTES} Minuten dauern`, path: ['endsAt'] });
    }
    if (durationMs > maxMs) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Slot darf höchstens ${SLOT_MAX_DURATION_HOURS} Stunden dauern`, path: ['endsAt'] });
    }
    if (start.getTime() < now) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Startzeit muss in der Zukunft liegen', path: ['startsAt'] });
    }
    const maxLeadMs = SLOT_MAX_LEAD_TIME_DAYS * 24 * 60 * 60 * 1000;
    if (start.getTime() > now + maxLeadMs) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Startzeit darf höchstens ${SLOT_MAX_LEAD_TIME_DAYS} Tage in der Zukunft liegen`, path: ['startsAt'] });
    }
  });
export type CreateSlotInput = z.infer<typeof CreateSlotSchema>;

// ---------------------------------------------------------------------------
// Booking — Phone & Email-Härtung
// ---------------------------------------------------------------------------

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

const phoneOptionalSchema = z
  .string()
  .trim()
  .max(40, 'Telefonnummer ist zu lang')
  .regex(PHONE_ALLOWED_CHARS, 'Telefonnummer enthält ungültige Zeichen')
  .refine(
    (val) => (val.match(/\d/g)?.length ?? 0) >= PHONE_MIN_DIGITS,
    `Telefonnummer muss mindestens ${PHONE_MIN_DIGITS} Ziffern enthalten`,
  )
  .optional()
  .or(z.literal('').transform(() => undefined));

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

// ---------------------------------------------------------------------------
// Booking — IT3 (Date/Time-basiert) + IT1/IT2-Bestandsfeld slotId
// IT4-Anmerkung: customerId wird NICHT aus dem Body gelesen — Backend liest
// die ID aus dem `customer-session`-Cookie und befüllt sie selbst.
// IT5-Erweiterung (US-32 + US-33):
//   - Adresse (street/zip/city) ist Pflicht für IT5-Modus.
//   - durationMinutes ist Pflicht für IT5-Modus (Whitelist).
//     endTime wird im API-Layer aus startTime + durationMinutes
//     berechnet — Frontend MUSS endTime trotzdem mitschicken (für
//     IT3-Rückwärtskompatibilität); BE prüft Konsistenz und nimmt
//     im Konflikt-Fall den durationMinutes-Wert als Authority.
// ---------------------------------------------------------------------------

/** IT5 / US-33 — erlaubte Standard-Dauer-Optionen (Minuten). */
export const BOOKING_DURATION_OPTIONS = [60, 120, 180, 240, 300, 360, 480] as const;
export type BookingDurationOption = (typeof BOOKING_DURATION_OPTIONS)[number];

/**
 * Sonderwert „Ganztag" — wird beim Klick auf die „Ganztag"-Kachel vom
 * Frontend gesendet. Backend löst diesen Wert in die tatsächliche Dauer
 * des Verfügbarkeitsfensters für das Datum auf (siehe
 * `lib/availability.ts.resolveAllDayDuration(date)`).
 */
export const BOOKING_DURATION_ALL_DAY = -1 as const;

/** Min/Max-Dauer für die DB-CHECK-Constraint. */
export const BOOKING_DURATION_MIN_MINUTES = 15;
export const BOOKING_DURATION_MAX_MINUTES = 1440;

/** US-32: 5-stellige deutsche PLZ. */
export const ZipCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, 'PLZ muss 5 Ziffern enthalten');

/** US-32 Adress-Schema (Reuse in BookingForm + Create-Body). */
export const BookingAddressSchema = z.object({
  addressStreet: z
    .string()
    .trim()
    .min(3, 'Bitte Straße und Hausnummer angeben')
    .max(100, 'Adresse ist zu lang'),
  addressZip: ZipCodeSchema,
  addressCity: z
    .string()
    .trim()
    .min(2, 'Bitte den Ort angeben')
    .max(100, 'Ort ist zu lang'),
});
export type BookingAddress = z.infer<typeof BookingAddressSchema>;

/** US-33: Dauer-Validierung (Whitelist + Sonderwert). */
const bookingDurationSchema = z.union([
  z.literal(BOOKING_DURATION_ALL_DAY),
  z
    .number()
    .int()
    .refine(
      (v) => (BOOKING_DURATION_OPTIONS as readonly number[]).includes(v),
      'Ungültige Dauer. Bitte eine der angebotenen Optionen wählen.',
    ),
]);

export const CreateBookingSchema = z
  .object({
    // IT3-Modus:
    date: DateStringSchema.optional(),
    startTime: TimeStringSchema.optional(),
    endTime: TimeStringSchema.optional(),

    // IT5 / US-33: Auftragsdauer in Minuten (oder `BOOKING_DURATION_ALL_DAY`).
    // Pflicht im IT3/IT5-Modus, ignoriert im Slot-Modus (Bestand).
    durationMinutes: bookingDurationSchema.optional(),

    // Bestand IT1/IT2 (re-booking):
    slotId: z.string().optional(),

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

    // IT5 / US-32: Adresse (Pflicht im IT3/IT5-Modus).
    addressStreet: z
      .string()
      .trim()
      .min(3, 'Bitte Straße und Hausnummer angeben')
      .max(100, 'Adresse ist zu lang')
      .optional(),
    addressZip: ZipCodeSchema.optional(),
    addressCity: z
      .string()
      .trim()
      .min(2, 'Bitte den Ort angeben')
      .max(100, 'Ort ist zu lang')
      .optional(),

    // IT3 / US-18: Datei-Anhänge.
    attachmentIds: z.array(z.string().min(1)).max(5, 'Maximal 5 Dateien').optional(),

    privacyAccepted: z.literal(true, {
      errorMap: () => ({ message: 'Bitte den Datenschutzhinweis bestätigen' }),
    }),
  })
  .superRefine((data, ctx) => {
    const hasDateMode = !!(data.date && data.startTime && data.endTime);
    const hasSlotMode = !!data.slotId;

    if (!hasDateMode && !hasSlotMode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Bitte einen Termin auswählen (Datum + Uhrzeit).',
        path: ['date'],
      });
      return;
    }
    if (hasDateMode && hasSlotMode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Entweder Slot ODER Datum/Uhrzeit, nicht beides.',
        path: ['slotId'],
      });
      return;
    }

    if (hasDateMode) {
      const startMin = timeStringToMinutes(data.startTime!);
      const endMin = timeStringToMinutes(data.endTime!);
      if (endMin <= startMin) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Endzeit muss nach Startzeit liegen',
          path: ['endTime'],
        });
      }

      const today = new Date();
      const todayBerlin = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Berlin',
      }).format(today);
      if (data.date! < todayBerlin) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Das gewählte Datum liegt in der Vergangenheit',
          path: ['date'],
        });
      }

      // IT5 / US-33: Dauer ist Pflicht im Date-Modus.
      if (data.durationMinutes === undefined || data.durationMinutes === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Bitte wählen Sie eine Auftragsdauer.',
          path: ['durationMinutes'],
        });
      } else if (
        typeof data.durationMinutes === 'number' &&
        data.durationMinutes !== BOOKING_DURATION_ALL_DAY
      ) {
        // Konsistenz-Check: endTime muss zu startTime + durationMinutes passen.
        // Bei Mismatch nimmt Backend durationMinutes als Authority und
        // korrigiert endTime intern (kein Validation-Fehler — Frontend kann
        // sich verzählt haben). Engineers-Hinweis: hier KEIN ctx.addIssue.
      }

      // IT5 / US-32: Adresse ist Pflicht im Date-Modus.
      if (!data.addressStreet) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Bitte geben Sie Straße und Hausnummer an.',
          path: ['addressStreet'],
        });
      }
      if (!data.addressZip) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Bitte geben Sie eine PLZ an.',
          path: ['addressZip'],
        });
      }
      if (!data.addressCity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Bitte geben Sie den Ort an.',
          path: ['addressCity'],
        });
      }
    }

    if (data.service === CUSTOM_SERVICE_SLUG) {
      if (data.description.length < CUSTOM_SERVICE_MIN_DESCRIPTION_LENGTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Bei "Sonstiges" bitte mindestens ${CUSTOM_SERVICE_MIN_DESCRIPTION_LENGTH} Zeichen angeben.`,
          path: ['description'],
        });
      }
    }
  });
export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

export const BookingFormSchema = z
  .object({
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
    // IT5 / US-32: Adressfelder Pflicht.
    addressStreet: z
      .string()
      .trim()
      .min(3, 'Bitte Straße und Hausnummer angeben')
      .max(100, 'Adresse ist zu lang'),
    addressZip: ZipCodeSchema,
    addressCity: z
      .string()
      .trim()
      .min(2, 'Bitte den Ort angeben')
      .max(100, 'Ort ist zu lang'),
    // IT5 / US-33: Dauer-Auswahl Pflicht (vom DurationPicker gesetzt).
    durationMinutes: bookingDurationSchema,
    privacyAccepted: z.literal(true, {
      errorMap: () => ({ message: 'Bitte den Datenschutzhinweis bestätigen' }),
    }),
  })
  .superRefine((data, ctx) => {
    if (data.service === CUSTOM_SERVICE_SLUG) {
      if (data.description.length < CUSTOM_SERVICE_MIN_DESCRIPTION_LENGTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Bei "Sonstiges" bitte mindestens ${CUSTOM_SERVICE_MIN_DESCRIPTION_LENGTH} Zeichen angeben.`,
          path: ['description'],
        });
      }
    }
  });
export type BookingFormInput = z.infer<typeof BookingFormSchema>;

// ---------------------------------------------------------------------------
// PATCH /api/bookings/:id (Admin — CONFIRMED|REJECTED|COMPLETED)
// IT4: COMPLETED ergänzt — Tom markiert Termin nach Erbringung als
// abgeschlossen, was den Bewertungs-Flow im Kundenportal freischaltet.
// ---------------------------------------------------------------------------

export const UpdateBookingStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'REJECTED', 'COMPLETED']),
});
export type UpdateBookingStatusInput = z.infer<typeof UpdateBookingStatusSchema>;

// ---------------------------------------------------------------------------
// Counter-Proposal & Rebooking & Token-Action (Iteration 2 — unverändert)
// ---------------------------------------------------------------------------

export const CounterProposalSchema = z.object({
  newSlotId: z.string().min(1, 'Bitte einen alternativen Slot angeben'),
});
export type CounterProposalInput = z.infer<typeof CounterProposalSchema>;

export const TokenActionSchema = z.object({
  token: z.string().min(1, 'Token fehlt'),
  action: z.enum(['accept', 'cancel']),
});
export type TokenActionInput = z.infer<typeof TokenActionSchema>;

export const RebookingSchema = z.object({
  token: z.string().min(1, 'Token fehlt'),
  newSlotId: z.string().min(1, 'Bitte einen Slot auswählen'),
});
export type RebookingInput = z.infer<typeof RebookingSchema>;

// ---------------------------------------------------------------------------
// Booking — Admin-Antwort (IT4 erweitert um payment + customerId)
// ---------------------------------------------------------------------------

export const BookingAttachmentSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.string().datetime({ offset: true }),
});
export type BookingAttachment = z.infer<typeof BookingAttachmentSchema>;

export const BookingAdminSchema = z.object({
  id: z.string(),
  slot: z
    .object({
      id: z.string(),
      startsAt: z.string().datetime({ offset: true }),
      endsAt: z.string().datetime({ offset: true }),
      description: z.string().nullable(),
      deletedAt: z.string().datetime({ offset: true }).nullable(),
    })
    .nullable(),
  date: z.string().nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  // IT5 / US-33: Auftragsdauer in Minuten (Default 60 für Bestand).
  durationMinutes: z.number().int().nonnegative(),
  // IT4: optionale Verknüpfung zu einem registrierten Kunden.
  customerId: z.string().nullable(),
  customerName: z.string(),
  customerPhone: z.string(),
  customerEmail: z.string(),
  service: ServiceSchema,
  description: z.string(),
  // IT5 / US-32: Adresse — nullable, weil Bestandsbuchungen sie nicht haben.
  addressStreet: z.string().nullable(),
  addressZip: z.string().nullable(),
  addressCity: z.string().nullable(),
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
  attachments: z.array(BookingAttachmentSchema),
  // IT4: optionale Zahlung.
  payment: z
    .object({
      id: z.string(),
      bookingId: z.string(),
      amount: z.number().int().positive(),
      currency: z.string(),
      status: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']),
      paidAt: z.string().datetime({ offset: true }).nullable(),
      stripeSessionId: z.string().nullable(),
      description: z.string().nullable(),
      createdAt: z.string().datetime({ offset: true }),
      updatedAt: z.string().datetime({ offset: true }),
    })
    .nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type BookingAdmin = z.infer<typeof BookingAdminSchema>;

export const UpcomingBookingSchema = z.object({
  id: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  customerName: z.string(),
  service: ServiceSchema,
  isToday: z.boolean(),
});
export type UpcomingBooking = z.infer<typeof UpcomingBookingSchema>;

// ---------------------------------------------------------------------------
// Iteration 3 — AvailabilityTemplate (US-17, unverändert)
// ---------------------------------------------------------------------------

const SLOT_DURATION_MIN_MINUTES = 15;
const SLOT_DURATION_MAX_MINUTES = 480;
export const AVAILABILITY_TEMPLATE_SLOT_DURATION_MIN = SLOT_DURATION_MIN_MINUTES;
export const AVAILABILITY_TEMPLATE_SLOT_DURATION_MAX = SLOT_DURATION_MAX_MINUTES;

export const AvailabilityTemplateDaySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    isActive: z.boolean(),
    startTime: TimeStringSchema,
    endTime: TimeStringSchema,
    slotDurationMinutes: z
      .number()
      .int()
      .min(SLOT_DURATION_MIN_MINUTES, `Mindestens ${SLOT_DURATION_MIN_MINUTES} Minuten`)
      .max(SLOT_DURATION_MAX_MINUTES, `Höchstens ${SLOT_DURATION_MAX_MINUTES} Minuten`),
  })
  .superRefine((data, ctx) => {
    const startMin = timeStringToMinutes(data.startTime);
    const endMin = timeStringToMinutes(data.endTime);
    if (endMin <= startMin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Endzeit muss nach Startzeit liegen',
        path: ['endTime'],
      });
    }
    if (endMin - startMin < data.slotDurationMinutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Das Verfügbarkeitsfenster muss mindestens einen Slot enthalten',
        path: ['endTime'],
      });
    }
  });
export type AvailabilityTemplateDay = z.infer<typeof AvailabilityTemplateDaySchema>;

export const UpdateAvailabilityTemplateSchema = z.object({
  days: z
    .array(AvailabilityTemplateDaySchema)
    .min(1)
    .max(7)
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
export type UpdateAvailabilityTemplateInput = z.infer<typeof UpdateAvailabilityTemplateSchema>;

// ---------------------------------------------------------------------------
// Iteration 3 — DayOverride (unverändert)
// ---------------------------------------------------------------------------

export const DayOverrideSchema = z.object({
  id: z.string(),
  date: DateStringSchema,
  isActive: z.boolean(),
  startTime: TimeStringSchema.nullable(),
  endTime: TimeStringSchema.nullable(),
  reason: z.string().max(200).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type DayOverride = z.infer<typeof DayOverrideSchema>;

export const CreateDayOverrideSchema = z
  .object({
    date: DateStringSchema,
    isActive: z.boolean(),
    startTime: TimeStringSchema.nullable().optional(),
    endTime: TimeStringSchema.nullable().optional(),
    reason: z.string().trim().max(200).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.isActive) {
      const hasStart = data.startTime != null;
      const hasEnd = data.endTime != null;
      if (hasStart !== hasEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Wenn Zeiten gesetzt sind, müssen beide (Start & Ende) angegeben sein',
          path: ['endTime'],
        });
      }
      if (hasStart && hasEnd) {
        if (timeStringToMinutes(data.endTime!) <= timeStringToMinutes(data.startTime!)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Endzeit muss nach Startzeit liegen',
            path: ['endTime'],
          });
        }
      }
    }
  });
export type CreateDayOverrideInput = z.infer<typeof CreateDayOverrideSchema>;

export const DayOverrideMonthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Monat muss im Format YYYY-MM sein'),
});
export type DayOverrideMonthQuery = z.infer<typeof DayOverrideMonthQuerySchema>;

/**
 * IT8 / US-IT8-04: Globaler "alle DayOverrides"-Modus.
 *
 *   GET /api/admin/day-overrides?scope=all
 *
 * Liefert alle Einträge sortiert nach `date` aufsteigend. Hard-Cap:
 * 365 Einträge (DOS-Schutz, da ein Tag-Override max ~1 pro Kalendertag
 * sinnvoll ist; siehe ARCHITECTURE_IT8.md §4.2 + QA Minor BUG-IT8-04-B).
 * Wenn der Cap greift, ist `truncated: true` im Response-Payload.
 */
export const DayOverrideListAllQuerySchema = z.object({
  scope: z.literal('all'),
});
export type DayOverrideListAllQuery = z.infer<typeof DayOverrideListAllQuerySchema>;

/** Hard-Cap für `?scope=all` — siehe DayOverrideListAllQuerySchema. */
export const DAY_OVERRIDE_LIST_ALL_MAX = 365;

// ---------------------------------------------------------------------------
// Iteration 3 — Verfügbare Zeitslots pro Tag (unverändert)
// ---------------------------------------------------------------------------

export const AvailableTimeSlotSchema = z.object({
  startTime: TimeStringSchema,
  endTime: TimeStringSchema,
  available: z.boolean(),
});
export type AvailableTimeSlot = z.infer<typeof AvailableTimeSlotSchema>;

export const AvailableSlotsResponseSchema = z.object({
  date: DateStringSchema,
  isDayActive: z.boolean(),
  slots: z.array(AvailableTimeSlotSchema),
  overrideReason: z.string().nullable().optional(),
});
export type AvailableSlotsResponse = z.infer<typeof AvailableSlotsResponseSchema>;

/**
 * Query für GET /api/slots/available?date=YYYY-MM-DD&duration=NNN
 *
 * IT5 / US-33: optionaler Param `duration` (Minuten). Wenn gesetzt, prüft
 * der Endpoint, ob ein Slot mit der gewünschten Dauer ab dem Start
 * verfügbar ist (statt der Default-Slot-Dauer aus dem Template). Der
 * Wert muss in `BOOKING_DURATION_OPTIONS` enthalten sein oder dem
 * Sonderwert `BOOKING_DURATION_ALL_DAY` (-1) entsprechen.
 *
 * Wenn nicht gesetzt → fallback auf `slotDurationMinutes` aus dem
 * Availability-Template (IT3-Verhalten, rückwärtskompatibel).
 */
export const AvailableSlotsQuerySchema = z.object({
  date: DateStringSchema,
  duration: z
    .union([
      z.literal(BOOKING_DURATION_ALL_DAY),
      z.coerce
        .number()
        .int()
        .refine(
          (v) => (BOOKING_DURATION_OPTIONS as readonly number[]).includes(v),
          'Ungültige Dauer.',
        ),
    ])
    .optional(),
});
export type AvailableSlotsQuery = z.infer<typeof AvailableSlotsQuerySchema>;

// ---------------------------------------------------------------------------
// Iteration 2 (Bestand) — WeeklyAvailability
// ---------------------------------------------------------------------------

export const WeeklyAvailabilityDaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isActive: z.boolean(),
});
export type WeeklyAvailabilityDay = z.infer<typeof WeeklyAvailabilityDaySchema>;

export const UpdateWeeklyAvailabilitySchema = z.object({
  days: z
    .array(WeeklyAvailabilityDaySchema)
    .min(1)
    .max(7)
    .superRefine((days, ctx) => {
      const seen = new Set<number>();
      for (const d of days) {
        if (seen.has(d.dayOfWeek)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Wochentag ${d.dayOfWeek} ist doppelt enthalten` });
        }
        seen.add(d.dayOfWeek);
      }
    }),
});
export type UpdateWeeklyAvailabilityInput = z.infer<typeof UpdateWeeklyAvailabilitySchema>;

// ---------------------------------------------------------------------------
// Iteration 2 (Bestand) — Calendar
// ---------------------------------------------------------------------------

export const CalendarDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  available: z.boolean(),
  slotIds: z.array(z.string()),
});
export type CalendarDay = z.infer<typeof CalendarDaySchema>;

export const CalendarMonthSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  days: z.array(CalendarDaySchema),
});
export type CalendarMonth = z.infer<typeof CalendarMonthSchema>;

export const CalendarQuerySchema = z.object({
  year: z.coerce.number().int().min(2025).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});
export type CalendarQueryInput = z.infer<typeof CalendarQuerySchema>;

// ---------------------------------------------------------------------------
// Iteration 3 — Datei-Upload (unverändert)
// ---------------------------------------------------------------------------

export const UPLOAD_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const UPLOAD_MAX_FILES_PER_BOOKING = 5;
export const UPLOAD_ACCEPTED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'application/pdf',
] as const;
export type UploadContentType = (typeof UPLOAD_ACCEPTED_CONTENT_TYPES)[number];

export const UploadResponseSchema = z.object({
  attachmentId: z.string(),
  url: z.string().url(),
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;

// ---------------------------------------------------------------------------
// Auth (Login + Setup) — Admin (unverändert)
// ---------------------------------------------------------------------------

export const LoginSchema = z.object({
  email: z.string().trim().email('Bitte eine gültige E-Mail-Adresse angeben'),
  password: z.string().min(1, 'Passwort darf nicht leer sein'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const AdminSetupSchema = z
  .object({
    email: z.string().trim().email('Bitte eine gültige E-Mail-Adresse angeben'),
    name: z.string().trim().min(1).max(120),
    password: z.string().min(12).max(200),
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Passwörter stimmen nicht überein',
    path: ['passwordConfirm'],
  });
export type AdminSetupInput = z.infer<typeof AdminSetupSchema>;

// ===========================================================================
// ITERATION 4 — Kunden-Auth (US-25)
// ===========================================================================

/** Mindestlänge Passwort für Kunden-Konten (US-25 AC1). */
export const CUSTOMER_PASSWORD_MIN_LENGTH = 8;
export const CUSTOMER_PASSWORD_MAX_LENGTH = 200;

const customerPasswordSchema = z
  .string()
  .min(CUSTOMER_PASSWORD_MIN_LENGTH, `Passwort muss mindestens ${CUSTOMER_PASSWORD_MIN_LENGTH} Zeichen haben`)
  .max(CUSTOMER_PASSWORD_MAX_LENGTH, 'Passwort ist zu lang');

const customerEmailLoginSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Bitte eine gültige E-Mail-Adresse angeben')
  .max(254, 'E-Mail-Adresse ist zu lang');

/** Body für POST /api/customer/register (US-25 AC1). */
export const CustomerRegisterSchema = z.object({
  email: customerEmailLoginSchema,
  password: customerPasswordSchema,
  firstName: z.string().trim().min(1, 'Bitte Vorname angeben').max(120, 'Vorname ist zu lang'),
  lastName: z.string().trim().min(1, 'Bitte Nachname angeben').max(120, 'Nachname ist zu lang'),
  phone: phoneOptionalSchema,
  privacyAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Bitte den Datenschutzhinweis bestätigen' }),
  }),
});
export type CustomerRegisterInput = z.infer<typeof CustomerRegisterSchema>;

/**
 * Body für POST /api/customer/login (US-25 AC3).
 *
 * **MAJOR-405-Fix (v1.4.1):** `redirectUrl` ist optional. Backend
 * validiert ihn via `safeCustomerCallback()` (siehe ARCHITECTURE.md
 * §17.1) und gibt den geprüften Wert in `data.redirectUrl` zurück.
 * Ungültige Werte (externe Hosts, protokoll-relative URLs etc.)
 * werden auf `/konto` zurückgesetzt — kein Fehler, sondern stiller
 * Fallback. Damit ist Open-Redirect ausgeschlossen, ohne den UX-
 * Flow zu unterbrechen.
 */
export const CustomerLoginSchema = z.object({
  email: customerEmailLoginSchema,
  password: z.string().min(1, 'Passwort darf nicht leer sein'),
  /** Relativer Pfad ohne Host. Wird serverseitig validiert; sonst Fallback `/konto`. */
  redirectUrl: z.string().max(512).optional(),
});
export type CustomerLoginInput = z.infer<typeof CustomerLoginSchema>;

/** Body für POST /api/customer/forgot-password (US-25 AC5). */
export const CustomerForgotPasswordSchema = z.object({
  email: customerEmailLoginSchema,
});
export type CustomerForgotPasswordInput = z.infer<typeof CustomerForgotPasswordSchema>;

/** Body für POST /api/customer/reset-password (US-25 AC6). */
export const CustomerResetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Token fehlt'),
    password: customerPasswordSchema,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Passwörter stimmen nicht überein',
    path: ['passwordConfirm'],
  });
export type CustomerResetPasswordInput = z.infer<typeof CustomerResetPasswordSchema>;

/** Query für GET /api/customer/verify?token=... */
export const CustomerVerifyTokenQuerySchema = z.object({
  token: z.string().min(1, 'Token fehlt'),
});
export type CustomerVerifyTokenQuery = z.infer<typeof CustomerVerifyTokenQuerySchema>;

/**
 * Body für PATCH /api/customer/me (Profil-Update, US-25 AC10).
 *
 * **BUG-402-Fix (v1.4.1):** `email`-Feld ist ENTFERNT. E-Mail-Änderung
 * im MVP nicht erlaubt — sie würde einen Pending-State-Mechanismus
 * erfordern (pendingEmail / pendingEmailToken / pendingEmailTokenExpiry),
 * damit das Konto unter der alten E-Mail bedienbar bleibt, bis die neue
 * verifiziert ist. Das ist Backlog (eigene Story IT5).
 *
 * Schema ist `.strict()` — unbekannte Felder (insb. `email`) führen zu
 * 400 `VALIDATION_ERROR`. Frontend zeigt das `email`-Feld im Profil-
 * Formular nur als read-only an mit Hinweistext.
 */
export const CustomerProfileUpdateSchema = z
  .object({
    firstName: z.string().trim().min(1).max(120).optional(),
    lastName: z.string().trim().min(1).max(120).optional(),
    phone: phoneOptionalSchema,
  })
  .strict();
export type CustomerProfileUpdateInput = z.infer<typeof CustomerProfileUpdateSchema>;

/**
 * Response von GET /api/customer/me. Enthält keine sensiblen Felder.
 *
 * IT5 / US-31 ergänzt:
 *   - `oauthProvider`: 'google' | 'github' | null. Frontend zeigt das
 *     Passwort-Feld im Profil nur für `oauthProvider === null`-Konten.
 *   - `avatarUrl`: optionale Profilbild-URL vom OAuth-Provider.
 *   - `hasPassword`: true wenn ein lokales Passwort gesetzt ist (für
 *     gemischte Konten relevant — Kunde kann sowohl per E-Mail/Pw als
 *     auch per OAuth einloggen).
 */
/**
 * v1.6.1 (QA-Revision F3): `.strict()` ist Pflicht — verhindert, dass
 * `adminNote`/`adminRating` (oder andere interne Felder) durch ein
 * versehentliches `findUnique` ohne `select` durchsickern. Siehe
 * `ARCHITECTURE_IT6.md` Anhang B §17.3.
 *
 * **Engineering-Hinweis (Live-Code):** Das Live-`oauthProvider`-Enum
 * wird nach IT6 auf `['google', 'facebook']` umgestellt
 * (`CUSTOMER_OAUTH_PROVIDERS_IT6`). Bestand-Konten mit `'github'`
 * existieren nach US-IT6-06 (Wipe) nicht mehr. Engineers passen das
 * Enum entsprechend an.
 */
export const CustomerUserPublicSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string().nullable(),
    emailVerified: z.boolean(),
    // IT5 / US-31. IT6 (US-IT6-05): 'github' raus, 'facebook' rein. Wir
    // halten den Wert bewusst als `string().nullable()`, damit Bestandsdaten
    // (alte 'github'-Verknüpfungen, falls noch vorhanden) nicht durch
    // Strict-Validation crashen — sie werden vom Frontend einfach ignoriert.
    oauthProvider: z.string().nullable(),
    avatarUrl: z.string().url().nullable(),
    hasPassword: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type CustomerUserPublic = z.infer<typeof CustomerUserPublicSchema>;

/**
 * Response von POST /api/customer/login.
 *
 * Erweitert `CustomerUserPublicSchema` um `redirectUrl` — den
 * vom Backend via `safeCustomerCallback()` validierten Ziel-Pfad
 * (MAJOR-405-Fix v1.4.1). Frontend nutzt diesen Wert direkt für
 * `router.push()` ohne weitere Prüfung; ungültige Eingaben sind
 * bereits auf `/konto` zurückgesetzt.
 */
export const CustomerLoginResponseSchema = CustomerUserPublicSchema.extend({
  redirectUrl: z.string().min(1),
});
export type CustomerLoginResponse = z.infer<typeof CustomerLoginResponseSchema>;

// ===========================================================================
// ITERATION 4 — Kundenportal-Buchungen (US-26/27)
// ===========================================================================

/**
 * Reduzierte Booking-Antwort fürs Kundenportal.
 *
 * Enthält keine sensiblen Admin-Felder (mailError, cancelToken nur teilweise).
 * cancelToken bleibt enthalten, damit die Storno-Mail-Aktion auch im Portal
 * funktioniert (Hybrid-Flow).
 */
/**
 * v1.6.1 (QA-Revision F3 / US-IT6-08): `.strict()` ist Pflicht —
 * verhindert, dass `finalPriceEur`, `finalPriceNote`, `adminNote`
 * oder andere interne Felder im Customer-Pfad geleakt werden. Siehe
 * `ARCHITECTURE_IT6.md` Anhang B §17.3.
 */
export const CustomerBookingSchema = z
  .object({
    id: z.string(),
    date: z.string().nullable(),
    startTime: z.string().nullable(),
    endTime: z.string().nullable(),
    // IT5 / US-33: vom Kunden gewählte Dauer (Minuten).
    durationMinutes: z.number().int().nonnegative(),
    service: ServiceSchema,
    description: z.string(),
    // IT5 / US-32: Adresse (nullable für Bestand).
    addressStreet: z.string().nullable(),
    addressZip: z.string().nullable(),
    addressCity: z.string().nullable(),
    status: BookingStatusSchema,
    /** Liegt das Datum mehr als 24h in der Zukunft? Backend berechnet, Frontend zeigt Storno-Button. */
    cancellableUntilHours: z.number().int().nullable(),
    /** true wenn cancellable im Portal (Status erlaubt + 24h-Frist erfüllt). */
    isCancellable: z.boolean(),
    /** Wenn true: Bewertungs-Button im Detail-View zeigen (Status === 'COMPLETED' UND keine Review existiert). */
    canReview: z.boolean(),
    attachments: z.array(BookingAttachmentSchema),
    payment: z
      .object({
        id: z.string(),
        amount: z.number().int().positive(),
        currency: z.string(),
        status: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']),
        paidAt: z.string().datetime({ offset: true }).nullable(),
      })
      .strict()
      .nullable(),
    /** Wenn die Buchung schon eine Review hat — fürs Detail-View, schreibgeschützt. */
    review: z
      .object({
        id: z.string(),
        stars: z.number().int().min(1).max(5),
        text: z.string().nullable(),
        approved: z.boolean(),
        createdAt: z.string().datetime({ offset: true }),
      })
      .strict()
      .nullable(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type CustomerBooking = z.infer<typeof CustomerBookingSchema>;

/** Response von GET /api/customer/bookings — Split nach kommend/vergangen. */
export const CustomerBookingsResponseSchema = z.object({
  upcoming: z.array(CustomerBookingSchema),
  past: z.array(CustomerBookingSchema),
});
export type CustomerBookingsResponse = z.infer<typeof CustomerBookingsResponseSchema>;

/**
 * Server-seitige Konstante: Stornierungsfrist (in Stunden) für US-27.
 * Bei < 24h vor Termin ist Self-Service-Storno gesperrt — Kunde muss anrufen.
 */
export const PORTAL_CANCEL_DEADLINE_HOURS = 24;

// ===========================================================================
// ITERATION 4 — Zahlung (US-28)
// ===========================================================================

export const PaymentStatusSchema = z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

/**
 * Body für POST /api/admin/bookings/:id/payment.
 *
 * `amount` ist in **Cents** (Stripe-Konvention). Tom gibt im UI Euro ein,
 * Frontend multipliziert × 100 (mit Math.round für Float-Sicherheit).
 *
 * Min-Betrag: 100 Cent (1 €) — verhindert Rückfall auf 0 oder negative Beträge.
 * Max-Betrag: 1.000.000 Cent (10.000 €) — sanity-check für Tippfehler.
 */
export const CreatePaymentSchema = z.object({
  amount: z
    .number()
    .int('Betrag muss eine ganze Zahl in Cents sein')
    .min(100, 'Betrag muss mindestens 1 € (100 Cent) sein')
    .max(1_000_000, 'Betrag darf höchstens 10.000 € sein'),
  currency: z.literal('eur').optional(),
  description: z.string().trim().max(500, 'Beschreibung ist zu lang').optional(),
});
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;

/** Response-Schema für Payment (in BookingAdmin + GET /api/payments/:id eingebettet). */
export const PaymentSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  stripeSessionId: z.string().nullable(),
  amount: z.number().int().positive(),
  currency: z.string(),
  status: PaymentStatusSchema,
  description: z.string().nullable(),
  paidAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type Payment = z.infer<typeof PaymentSchema>;

/**
 * Body für POST /api/payments/create-session.
 *
 * Authentication-Modi:
 *   1. Eingeloggter Kunde (`customer-session`-Cookie): bookingId muss zu
 *      `customerId === me.id` gehören.
 *   2. Anonym mit `cancelToken` als Fallback (z.B. Kunde wurde nicht
 *      registriert; Tom hat trotzdem Payment angelegt). Backend prüft,
 *      dass `cancelToken` zur Buchung gehört.
 */
export const CreatePaymentSessionSchema = z
  .object({
    bookingId: z.string().min(1),
    /** Optional: cancelToken für Gast-Zahlung (kein Login nötig). */
    cancelToken: z.string().min(1).optional(),
  });
export type CreatePaymentSessionInput = z.infer<typeof CreatePaymentSessionSchema>;

/** Response von POST /api/payments/create-session. */
export const CreatePaymentSessionResponseSchema = z.object({
  /** Stripe-Checkout-Session-URL (`https://checkout.stripe.com/...`). Frontend macht window.location = url. */
  url: z.string().url(),
  sessionId: z.string(),
});
export type CreatePaymentSessionResponse = z.infer<typeof CreatePaymentSessionResponseSchema>;

/**
 * Query für GET /api/payments/session-status?session_id=xxx
 *
 * **MAJOR-402-Fix (v1.4.1):** Öffentlicher Status-Endpoint, der nach
 * Stripe-Redirect auf `/konto/zahlung/erfolg?session_id=...` aufgerufen
 * wird. Die Erfolgsseite poll'd diesen Endpoint (max. 5 Versuche, 1s
 * Intervall), bis der Webhook den Payment-Status auf PAID gesetzt hat.
 *
 * Sicherheits-Hinweis: Stripe-Session-IDs sind hochentropisch und nur
 * dem Käufer bekannt — sie wirken token-artig. Der Endpoint liefert
 * NUR den Status (kein Kunden-PII, kein Booking-Detail).
 */
export const SessionStatusQuerySchema = z.object({
  session_id: z
    .string()
    .min(1, 'session_id fehlt')
    .regex(/^cs_(test|live)_[A-Za-z0-9]+$/, 'Ungültige Stripe-Session-ID'),
});
export type SessionStatusQuery = z.infer<typeof SessionStatusQuerySchema>;

/**
 * Response von GET /api/payments/session-status.
 *
 * **MAJOR-402-Fix (v1.4.1):**
 *   - `status === 'PAID'`     → Erfolgsseite zeigt finale Bestätigung.
 *   - `status === 'PENDING'`  → weiter pollen (max 5×, dann Fallback).
 *   - `status === 'FAILED'`   → Fehler-UI.
 *   - `status === 'REFUNDED'` → akademisch — sollte direkt nach Redirect nie auftreten.
 *
 * `bookingId` kann der eingeloggte Kunde nutzen, um auf
 * `/konto/auftrag/:id` zu verlinken. Gäste ignorieren das Feld.
 */
export const SessionStatusSchema = z.object({
  sessionId: z.string(),
  status: PaymentStatusSchema,
  paidAt: z.string().datetime({ offset: true }).nullable(),
  /** Hilft eingeloggten Kunden, auf Auftragsdetails zu navigieren. Bei Gästen wird der Link vom Frontend ausgeblendet. */
  bookingId: z.string(),
});
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

/**
 * Polling-Konstanten für die Stripe-Erfolgsseite (Frontend-Konsumenten).
 * Sind hier zentral festgelegt, damit BE-Rate-Limits & FE-Polling
 * synchron bleiben.
 */
export const PAYMENT_SESSION_POLL_MAX_ATTEMPTS = 5;
export const PAYMENT_SESSION_POLL_INTERVAL_MS = 1000;

/**
 * Stripe-Webhook-Event-Schema (vereinfacht).
 *
 * Wir validieren NUR die Felder, die wir nutzen. Stripe-Signatur-Check
 * (mit `STRIPE_WEBHOOK_SECRET`) passiert VOR dem Zod-Parsing — siehe
 * `lib/stripe.ts.constructWebhookEvent()`.
 */
export const StripeWebhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.record(z.unknown()),
  }),
});
export type StripeWebhookEvent = z.infer<typeof StripeWebhookEventSchema>;

/** Stripe-Event-Types, die wir verarbeiten. */
export const HANDLED_STRIPE_EVENTS = [
  'checkout.session.completed',
  'checkout.session.expired',
  'payment_intent.payment_failed',
  'charge.refunded',
] as const;
export type HandledStripeEvent = (typeof HANDLED_STRIPE_EVENTS)[number];

// ===========================================================================
// ITERATION 4 — Reviews (US-29)
// ===========================================================================

/** Min/Max Sterne. */
export const REVIEW_MIN_STARS = 1;
export const REVIEW_MAX_STARS = 5;
export const REVIEW_MAX_TEXT_LENGTH = 500;
export const REVIEW_MIN_APPROVED_TO_REPLACE_STATIC = 4; // US-29 AC8

/**
 * Body für POST /api/customer/reviews (US-29).
 *
 * Voraussetzungen (Server-side):
 *   - Eingeloggter Kunde.
 *   - Booking gehört dem Kunden (booking.customerId === me.id).
 *   - Booking-Status === 'COMPLETED'.
 *   - Booking hat noch keine Review.
 */
export const CreateReviewSchema = z.object({
  bookingId: z.string().min(1, 'Buchungs-ID fehlt'),
  stars: z
    .number()
    .int()
    .min(REVIEW_MIN_STARS, `Mindestens ${REVIEW_MIN_STARS} Stern`)
    .max(REVIEW_MAX_STARS, `Höchstens ${REVIEW_MAX_STARS} Sterne`),
  text: z
    .string()
    .trim()
    .max(REVIEW_MAX_TEXT_LENGTH, `Maximal ${REVIEW_MAX_TEXT_LENGTH} Zeichen`)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

/** Body für PATCH /api/admin/reviews/:id (Admin-Freigabe / Ablehnung). */
export const ApproveReviewSchema = z.object({
  approved: z.boolean(),
});
export type ApproveReviewInput = z.infer<typeof ApproveReviewSchema>;

/** Response-Schema für Review (Admin sieht alles). */
export const ReviewSchema = z.object({
  id: z.string(),
  customerId: z.string().nullable(),
  bookingId: z.string().nullable(),
  customerName: z.string(), // wird joined oder snapshot — siehe BE-Spec.
  service: ServiceSchema.nullable(),
  stars: z.number().int().min(1).max(5),
  text: z.string().nullable(),
  approved: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type Review = z.infer<typeof ReviewSchema>;

/**
 * Öffentliche Review-Antwort (GET /api/reviews) — keine internen IDs,
 * Kundenname auf "Vorname N." gekürzt.
 *
 * v1.6.1 (QA-Revision m1): `.strict()` ist Pflicht. `GET /api/reviews`
 * (siehe `ARCHITECTURE_IT6.md` §5.3 + Anhang B §17.5) bindet sich
 * **ausschließlich** an dieses Schema — keine `customerId`,
 * keine `bookingId`, keine `userId`, keine `moderatedById` im Output.
 *
 * Whitelist (verbindlich): id, customerName, service, stars, text, createdAt.
 *
 * `customerName`-Format: `"Vorname N."` (Vorname + Nachname-Initial + Punkt);
 * Fallback `"Anonym"` bei `customerId === null` (anonymisierte Buchung).
 */
export const PublicReviewSchema = z
  .object({
    id: z.string(),
    /** "Vorname N." — Backend kürzt Nachname. "Anonym" wenn customerId null. */
    customerName: z.string(),
    service: ServiceSchema.nullable(),
    stars: z.number().int().min(1).max(5),
    text: z.string().nullable(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type PublicReview = z.infer<typeof PublicReviewSchema>;

// ---------------------------------------------------------------------------
// Einheitliches Fehler-Format (Iteration 4 erweitert)
// ---------------------------------------------------------------------------

/**
 * Iteration 4 — neue Fehlercodes:
 *  - `EMAIL_NOT_VERIFIED` (422): Login-Versuch mit nicht-verifiziertem
 *    Kunden-Konto. Frontend zeigt "Bestätigungs-E-Mail erneut senden".
 *  - `EMAIL_TAKEN` (409 Subkategorie): Registrierung mit bereits
 *    existierender E-Mail-Adresse. Wird als `CONFLICT` mit field='email'
 *    zurückgegeben.
 *  - `INVALID_TOKEN` (400 Subkategorie): Reset/Verify-Token ungültig
 *    oder abgelaufen. Wird als `VALIDATION_ERROR` mit field='token'
 *    zurückgegeben — Engineers-Hinweis: keine Auskunft, ob Token
 *    existiert hat oder abgelaufen ist (Enumeration-Schutz).
 *  - `STRIPE_ERROR` (502): Stripe-Upstream-Fehler bei Session-Erstellung
 *    oder Webhook-Verarbeitung.
 *
 * Bestehende Codes (unverändert):
 *  - VALIDATION_ERROR (400)
 *  - UNAUTHORIZED (401)
 *  - FORBIDDEN (403)
 *  - NOT_FOUND (404)
 *  - CONFLICT (409)
 *  - OVERLAP (409)
 *  - GONE (410)
 *  - PAYLOAD_TOO_LARGE (413)
 *  - UNSUPPORTED_MEDIA_TYPE (415)
 *  - RATE_LIMITED (429)
 *  - MAIL_FAILED (502)
 *  - INTERNAL_ERROR (500)
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
      'PAYLOAD_TOO_LARGE',
      'UNSUPPORTED_MEDIA_TYPE',
      'EMAIL_NOT_VERIFIED', // IT4
      'STRIPE_ERROR', // IT4
      'OAUTH_ONLY_ACCOUNT', // IT5 / US-31 — Login mit Pw gegen OAuth-only-Konto.
      'OAUTH_ERROR', // IT5 / US-31 — Provider-Fehler oder Flow-Abbruch.
      'RATE_LIMITED',
      'MAIL_FAILED',
      'INTERNAL_ERROR',
    ]),
    message: z.string(),
    field: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ===========================================================================
// ITERATION 5 — OAuth2 Customer-Login (US-31)
// ===========================================================================

/**
 * Erlaubte OAuth-Provider für Kunden-Login. Liste muss synchron mit der
 * NextAuth-Customer-Konfiguration in `lib/customer-oauth.ts` sein.
 */
/**
 * Iteration 6 (US-IT6-05) — Auth-Bereinigung: GitHub raus, Facebook rein.
 * Frontend-Component `<OAuthButtons />` zeigt nur noch Google + Facebook.
 */
export const CUSTOMER_OAUTH_PROVIDERS = ['google', 'facebook'] as const;
export type CustomerOAuthProvider = (typeof CUSTOMER_OAUTH_PROVIDERS)[number];

export const CustomerOAuthProviderSchema = z.enum(CUSTOMER_OAUTH_PROVIDERS);

/**
 * Body für POST /api/auth/customer/oauth-callback (intern, vom NextAuth-
 * Customer-Adapter aufgerufen). Engineers-Hinweis: dieses Schema wird
 * im NextAuth-Callback verwendet, um den User-Provider-Datensatz zu
 * normalisieren, bevor er gegen die DB gemappt wird.
 *
 * - `email` ist immer Pflicht (Account-Verknüpfung erfolgt per E-Mail).
 * - `oauthId` ist die provider-spezifische User-ID (Google `sub`,
 *   GitHub `id`).
 * - `firstName` / `lastName` werden aus dem Provider-Profil abgeleitet
 *   (Google `given_name`/`family_name`; GitHub `name` wird gesplittet).
 * - `avatarUrl` ist optional.
 */
export const OAuthProfileNormalizedSchema = z.object({
  provider: CustomerOAuthProviderSchema,
  oauthId: z.string().min(1),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Provider-E-Mail ungültig'),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  avatarUrl: z.string().url().optional().nullable(),
});
export type OAuthProfileNormalized = z.infer<typeof OAuthProfileNormalizedSchema>;

// ===========================================================================
// ITERATION 5 — Buffer-Konfiguration (US-34)
// ===========================================================================

/** Whitelist für Buffer-Werte (Minuten). Default ist 30. */
export const BUFFER_MINUTES_OPTIONS = [0, 15, 30, 45, 60] as const;
export type BufferMinutesOption = (typeof BUFFER_MINUTES_OPTIONS)[number];
export const BUFFER_MINUTES_DEFAULT: BufferMinutesOption = 30;

/** Response von GET /api/admin/buffer-config. */
export const BufferConfigSchema = z.object({
  bufferMinutes: z
    .number()
    .int()
    .min(0, 'Buffer darf nicht negativ sein')
    .max(240, 'Buffer ist zu groß'),
  updatedAt: z.string().datetime({ offset: true }),
});
export type BufferConfig = z.infer<typeof BufferConfigSchema>;

/**
 * Body für PUT /api/admin/buffer-config.
 *
 * Validiert auf Whitelist [0, 15, 30, 45, 60]. DB akzeptiert größere Werte
 * (Forward-Kompatibilität); im MVP zwingt das App-Layer die Whitelist.
 */
export const UpdateBufferConfigSchema = z.object({
  bufferMinutes: z
    .number()
    .int()
    .refine(
      (v) => (BUFFER_MINUTES_OPTIONS as readonly number[]).includes(v),
      `Bitte einen der erlaubten Werte wählen: ${BUFFER_MINUTES_OPTIONS.join(', ')} Minuten.`,
    ),
});
export type UpdateBufferConfigInput = z.infer<typeof UpdateBufferConfigSchema>;

// ===========================================================================
// ITERATION 6 — Schemas (US-IT6-01 bis US-IT6-09)
// ===========================================================================
//
// Querschnitt:
//   - DTO-Trennung (US-IT6-07): `CustomerUserPublicSchema` darf NIEMALS
//     `adminNote`/`adminRating` enthalten. Neuer `CustomerUserAdminSchema`
//     ist die einzige Stelle, an der diese Felder rausgegeben werden.
//   - OAuth-Provider (US-IT6-05): `CUSTOMER_OAUTH_PROVIDERS` wird auf
//     `['google','facebook']` umgestellt (GitHub raus).
//   - Neue Fehlercodes: `ACCOUNT_DISABLED`, `LAST_ADMIN_LOCK`,
//     `SELF_MUTATION_FORBIDDEN`, `BOOKING_NOT_COMPLETED`, `REVIEW_EXISTS`.

// ---------------------------------------------------------------------------
// US-IT6-05 — OAuth-Provider-Liste umstellen
// ---------------------------------------------------------------------------
//
// **Hinweis:** Die obige Konstante `CUSTOMER_OAUTH_PROVIDERS = ['google','github']`
// (im IT5-Block) wird mit IT6 durch diese Definition **ersetzt**. Engineering
// muss in `src/lib/schemas.ts` die alte Definition entfernen, sodass nur die
// IT6-Variante bleibt. Doppel-Export würde TypeScript brechen.
//
// Live-Code:
//   export const CUSTOMER_OAUTH_PROVIDERS = ['google', 'facebook'] as const;

export const CUSTOMER_OAUTH_PROVIDERS_IT6 = ['google', 'facebook'] as const;
export type CustomerOAuthProviderIT6 = (typeof CUSTOMER_OAUTH_PROVIDERS_IT6)[number];
export const CustomerOAuthProviderSchemaIT6 = z.enum(CUSTOMER_OAUTH_PROVIDERS_IT6);

// ---------------------------------------------------------------------------
// US-IT6-01 — Multi-Admin
// ---------------------------------------------------------------------------

export const ADMIN_PASSWORD_MIN_LENGTH = 12;
export const ADMIN_PASSWORD_MAX_LENGTH = 200;

export const UserStatusSchema = z.enum(['ACTIVE', 'DISABLED']);
export type UserStatus = z.infer<typeof UserStatusSchema>;

/** Body für POST /api/admin/admins. */
export const CreateAdminSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name muss mindestens 2 Zeichen haben')
    .max(120, 'Name ist zu lang'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Bitte eine gültige E-Mail-Adresse angeben'),
  password: z
    .string()
    .min(ADMIN_PASSWORD_MIN_LENGTH, `Mindestens ${ADMIN_PASSWORD_MIN_LENGTH} Zeichen.`)
    .max(ADMIN_PASSWORD_MAX_LENGTH, 'Passwort ist zu lang.')
    .regex(/[A-Z]/, 'Mindestens ein Großbuchstabe.')
    .regex(/[a-z]/, 'Mindestens ein Kleinbuchstabe.')
    .regex(/[0-9]/, 'Mindestens eine Ziffer.'),
});
export type CreateAdminInput = z.infer<typeof CreateAdminSchema>;

/** Body für PATCH /api/admin/admins/:id. Mind. ein Feld muss gesetzt sein. */
export const UpdateAdminSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    status: UserStatusSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.name === undefined &&
      data.email === undefined &&
      data.status === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Mindestens ein Feld muss gesetzt sein.',
        path: [],
      });
    }
  });
export type UpdateAdminInput = z.infer<typeof UpdateAdminSchema>;

/** Response-Item für GET /api/admin/admins. */
export const AdminListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  status: UserStatusSchema,
  createdAt: z.string().datetime({ offset: true }),
  lastLoginAt: z.string().datetime({ offset: true }).nullable(),
  createdById: z.string().nullable(),
});
export type AdminListItem = z.infer<typeof AdminListItemSchema>;

// ---------------------------------------------------------------------------
// US-IT6-02 — Kalender (Admin-Aggregator + öffentlicher Tag-Status)
// ---------------------------------------------------------------------------

export const CalendarEventTypeSchema = z.enum([
  'BOOKING',
  'AVAILABILITY',
  'BUFFER',
]);
export type CalendarEventType = z.infer<typeof CalendarEventTypeSchema>;

export const CalendarEventSchema = z.object({
  id: z.string(),
  type: CalendarEventTypeSchema,
  title: z.string(),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  /** Nur bei BOOKING gesetzt. */
  status: BookingStatusSchema.optional(),
  /** FullCalendar-Convention. */
  color: z.string().optional(),
  /** FullCalendar-Convention für Hintergrund-Events (AVAILABILITY). */
  display: z.literal('background').optional(),
  /** Klick-Ziel für Buchungs-Events. */
  url: z.string().optional(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const AdminCalendarEventsQuerySchema = z
  .object({
    from: DateStringSchema,
    to: DateStringSchema,
  })
  .superRefine((d, ctx) => {
    const fromMs = Date.parse(d.from);
    const toMs = Date.parse(d.to);
    if (toMs < fromMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '`to` muss nach `from` liegen.',
        path: ['to'],
      });
    }
    const days = (toMs - fromMs) / (1000 * 60 * 60 * 24);
    if (days > 90) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Max 90 Tage Range pro Anfrage.',
        path: ['to'],
      });
    }
  });
export type AdminCalendarEventsQuery = z.infer<typeof AdminCalendarEventsQuerySchema>;

export const AvailabilityCalendarDayStatusSchema = z.enum([
  'available',
  'partial',
  'unavailable',
]);
export type AvailabilityCalendarDayStatus = z.infer<
  typeof AvailabilityCalendarDayStatusSchema
>;

export const AvailabilityCalendarDaySchema = z.object({
  date: DateStringSchema,
  status: AvailabilityCalendarDayStatusSchema,
});
export type AvailabilityCalendarDay = z.infer<typeof AvailabilityCalendarDaySchema>;

export const AvailabilityCalendarQuerySchema = z
  .object({
    from: DateStringSchema,
    to: DateStringSchema,
    serviceId: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    const fromMs = Date.parse(d.from);
    const toMs = Date.parse(d.to);
    if (toMs < fromMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '`to` muss nach `from` liegen.',
        path: ['to'],
      });
    }
    const days = (toMs - fromMs) / (1000 * 60 * 60 * 24);
    if (days > 62) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Max 62 Tage Range pro Anfrage.',
        path: ['to'],
      });
    }
  });
export type AvailabilityCalendarQuery = z.infer<typeof AvailabilityCalendarQuerySchema>;

// ---------------------------------------------------------------------------
// US-IT6-03 — Reviews mit COMPLETED-Trigger & Reject-Spur
// ---------------------------------------------------------------------------

/** Erweitertes ReviewSchema (Admin-View) — bestehendes ReviewSchema bleibt
 * abwärtskompatibel; Engineering kann die Felder direkt auf das Bestand-
 * Schema mergen. */
export const ReviewAdminSchemaIT6 = ReviewSchema.extend({
  rejectedAt: z.string().datetime({ offset: true }).nullable(),
  moderatedAt: z.string().datetime({ offset: true }).nullable(),
  moderatedById: z.string().nullable(),
});
export type ReviewAdminIT6 = z.infer<typeof ReviewAdminSchemaIT6>;

export const ReviewModerationStatusSchema = z.enum([
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
]);
export type ReviewModerationStatus = z.infer<typeof ReviewModerationStatusSchema>;

export const AdminReviewsQuerySchema = z.object({
  status: ReviewModerationStatusSchema.optional(),
});
export type AdminReviewsQuery = z.infer<typeof AdminReviewsQuerySchema>;

// ---------------------------------------------------------------------------
// US-IT6-07 — Admin-Userverwaltung (DTOs)
// ---------------------------------------------------------------------------

/**
 * Admin-DTO für CustomerUser.
 *
 * **Sicherheits-Convention:** `CustomerUserPublicSchema` (Bestand) DARF
 * `adminNote` und `adminRating` NIEMALS enthalten. `CustomerUserAdminSchema`
 * (NEU) ist die einzige Stelle, an der diese Felder im Output erscheinen.
 *
 * Backend-Code in `lib/customer-portal.ts` und allen `/api/customer/*`
 * MUSS `prisma.customerUser`-Selects mit explizitem `select` versehen,
 * damit die Felder nicht versehentlich geleakt werden.
 */
export const CUSTOMER_ADMIN_NOTE_MAX_LENGTH = 1000;
export const CUSTOMER_ADMIN_RATING_MIN = 1;
export const CUSTOMER_ADMIN_RATING_MAX = 5;

export const CustomerUserAdminSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  emailVerified: z.boolean(),
  oauthProvider: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  // Interne Felder — siehe oben.
  adminNote: z.string().max(CUSTOMER_ADMIN_NOTE_MAX_LENGTH).nullable(),
  adminRating: z
    .number()
    .int()
    .min(CUSTOMER_ADMIN_RATING_MIN)
    .max(CUSTOMER_ADMIN_RATING_MAX)
    .nullable(),
  bookingCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime({ offset: true }),
});
export type CustomerUserAdmin = z.infer<typeof CustomerUserAdminSchema>;

/** Body für PATCH /api/admin/users/:id. Alle Felder optional, mind. eines. */
export const UpdateCustomerUserAdminSchema = z
  .object({
    firstName: z.string().trim().min(1).max(120).optional(),
    lastName: z.string().trim().min(1).max(120).optional(),
    phone: z
      .string()
      .trim()
      .min(5)
      .max(40)
      .nullable()
      .optional(),
    adminNote: z
      .string()
      .trim()
      .max(CUSTOMER_ADMIN_NOTE_MAX_LENGTH)
      .nullable()
      .optional(),
    adminRating: z
      .number()
      .int()
      .min(CUSTOMER_ADMIN_RATING_MIN)
      .max(CUSTOMER_ADMIN_RATING_MAX)
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Mindestens ein Feld muss gesetzt sein.',
        path: [],
      });
    }
  });
export type UpdateCustomerUserAdminInput = z.infer<
  typeof UpdateCustomerUserAdminSchema
>;

export const AdminUsersQuerySchema = z.object({
  q: z.string().trim().min(2).max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z
    .enum(['lastName_asc', 'createdAt_desc', 'bookingCount_desc', 'adminRating_desc'])
    .default('lastName_asc'),
});
export type AdminUsersQuery = z.infer<typeof AdminUsersQuerySchema>;

// ---------------------------------------------------------------------------
// US-IT6-08 — Finaler Preis pro Buchung
// ---------------------------------------------------------------------------

export const BOOKING_FINAL_PRICE_MIN_EUR = 0;
export const BOOKING_FINAL_PRICE_MAX_EUR = 100_000;
export const BOOKING_FINAL_PRICE_NOTE_MAX_LENGTH = 200;

/**
 * Akzeptiert string ("185,00") oder number (185). Komma → Punkt
 * Normalisierung erfolgt im Schema. `null` = entfernen.
 */
const finalPriceEurInputSchema = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return v;
    const cleaned = v.replace(/\s/g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  })
  .refine(
    (n) =>
      n === null ||
      (Number.isFinite(n) &&
        n >= BOOKING_FINAL_PRICE_MIN_EUR &&
        n <= BOOKING_FINAL_PRICE_MAX_EUR),
    {
      message: `Bitte einen gültigen Betrag in Euro eingeben (${BOOKING_FINAL_PRICE_MIN_EUR}–${BOOKING_FINAL_PRICE_MAX_EUR}).`,
    },
  );

/** Erweitertes Body-Schema für PATCH /api/admin/bookings/:id (IT6). */
export const AdminBookingPatchSchema = z
  .object({
    status: BookingStatusSchema.optional(),
    finalPriceEur: finalPriceEurInputSchema,
    finalPriceNote: z
      .string()
      .trim()
      .max(BOOKING_FINAL_PRICE_NOTE_MAX_LENGTH)
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    const hasAny =
      data.status !== undefined ||
      data.finalPriceEur !== undefined ||
      data.finalPriceNote !== undefined;
    if (!hasAny) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Mindestens ein Feld muss gesetzt sein.',
        path: [],
      });
    }
  });
export type AdminBookingPatchInput = z.infer<typeof AdminBookingPatchSchema>;

/** Erweiterung von BookingAdminSchema um IT6-Felder. */
export const BookingAdminSchemaIT6 = BookingAdminSchema.extend({
  finalPriceEur: z.string().nullable(), // Prisma Decimal serialisiert als String.
  finalPriceNote: z.string().nullable(),
});
export type BookingAdminIT6 = z.infer<typeof BookingAdminSchemaIT6>;

// ---------------------------------------------------------------------------
// US-IT6-09 — Analytics
// ---------------------------------------------------------------------------

export const AnalyticsRangeSchema = z.enum(['30d', '90d', '12m', 'ytd', 'custom']);
export type AnalyticsRange = z.infer<typeof AnalyticsRangeSchema>;

export const AnalyticsQuerySchema = z
  .object({
    range: AnalyticsRangeSchema.default('12m'),
    from: DateStringSchema.optional(),
    to: DateStringSchema.optional(),
  })
  .superRefine((d, ctx) => {
    if (d.range === 'custom') {
      if (!d.from || !d.to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Bei range=custom sind from+to Pflicht.',
          path: ['range'],
        });
      } else if (Date.parse(d.to) < Date.parse(d.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '`to` muss nach `from` liegen.',
          path: ['to'],
        });
      }
    }
  });
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

export const AnalyticsKpisSchema = z.object({
  /** Decimal-String wegen Prisma. `null` wenn keine Daten. */
  totalRevenueEur: z.string().nullable(),
  completedBookings: z.number().int().nonnegative(),
  averageOrderValueEur: z.string().nullable(),
  bookingsThisMonth: z.number().int().nonnegative(),
});

export const AnalyticsRevenueByMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  totalEur: z.string(), // Decimal-String.
  count: z.number().int().nonnegative(),
});

export const AnalyticsBookingsByServiceSchema = z.object({
  service: ServiceSchema,
  count: z.number().int().nonnegative(),
});

export const AnalyticsTopCustomerSchema = z.object({
  customerId: z.string(),
  customerName: z.string(), // "Vorname N." (Live-Join, Anonym wenn customerId obsolete)
  totalEur: z.string(),
  bookingCount: z.number().int().nonnegative(),
});

export const AnalyticsResponseSchema = z.object({
  range: z.object({
    from: DateStringSchema,
    to: DateStringSchema,
  }),
  kpis: AnalyticsKpisSchema,
  revenueByMonth: z.array(AnalyticsRevenueByMonthSchema),
  bookingsByService: z.array(AnalyticsBookingsByServiceSchema),
  topCustomers: z.array(AnalyticsTopCustomerSchema),
});
export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>;

// ---------------------------------------------------------------------------
// IT6 — Erweiterte Fehlercodes (Hinweis für ApiErrorSchema-Konsumenten)
// ---------------------------------------------------------------------------
//
// **Engineering-Hinweis:** Die folgenden Codes sollen in
// `ApiErrorSchema.error.code` zusätzlich akzeptiert werden. Engineering
// erweitert die enum-Liste in `src/lib/schemas.ts` um:
//
//   'ACCOUNT_DISABLED',         // 422 — disabled Admin-Login.
//   'LAST_ADMIN_LOCK',          // 409 — letzter aktiver Admin nicht löschbar.
//   'SELF_MUTATION_FORBIDDEN',  // 409 — Admin will sich selbst deaktivieren.
//   'BOOKING_NOT_COMPLETED',    // 409 — Review nur bei COMPLETED.
//   'REVIEW_EXISTS',            // 409 — Buchung hat bereits eine Review.
//
// **NEU v1.6.1 (QA-Revision F1, siehe ARCHITECTURE_IT6.md Anhang B §17.1):**
//
//   'BOOTSTRAP_NOT_ALLOWED',    // 403 — Setup-Email matched nicht
//                               //       BOOTSTRAP_ADMIN_EMAIL.
//   'SETUP_NOT_CONFIGURED',     // 503 — Setup ist aufgerufen worden,
//                               //       ENV BOOTSTRAP_ADMIN_EMAIL fehlt
//                               //       (Setup-Page ist blockiert, bis
//                               //       Eng den Wert setzt).
//
// Im `contracts/zod-schemas.ts` (dieser Datei) wird das Bestandsschema
// nicht hart erweitert, um IT5-Live-Code nicht zu brechen — Engineers
// fügen die Codes lokal in ihrer Branch ein.

// ---------------------------------------------------------------------------
// IT7 — Auth-Stabilisierung & Email-Auth-Wiederherstellung
// ---------------------------------------------------------------------------
//
// Verbindlich: siehe `ARCHITECTURE_IT7.md`.
//
// **Wiederverwendete Schemas (KEINE Änderungen nötig — IT7 reaktiviert
// Schemas aus IT4/§11):**
//   - `CustomerRegisterSchema`               (POST /api/customer/register)
//   - `CustomerLoginSchema`                  (POST /api/customer/login)
//   - `CustomerLoginResponseSchema`          (Response von /login)
//   - `CustomerForgotPasswordSchema`         (POST /forgot-password)
//   - `CustomerResetPasswordSchema`          (POST /reset-password)
//   - `CustomerVerifyTokenQuerySchema`       (GET /verify?token=...)
//   - `CustomerUserPublicSchema`.strict()    (Response von /me, /login)
//
// **DTO-Garantie (F3-Erweiterung in IT7, siehe ARCHITECTURE_IT7.md §6):**
//
// `CustomerUserPublicSchema` ist bereits `.strict()` (seit IT6 §17.3).
// Die folgenden DB-Felder werden durch den Helper
// `selectCustomerUserPublic()` (`src/lib/dto/user.ts`) **strukturell**
// aus jedem Customer-Endpoint-Output ferngehalten:
//
//   - 'passwordHash'           — Geheimnis (NEU IT7).
//   - 'verificationToken'      — Klartext-Token (NEU IT7).
//   - 'verificationTokenExpiry'— internal (NEU IT7).
//   - 'oauthId'                — Provider-spezifische ID (NEU IT7).
//   - 'adminNote'              — IT6 §17.3.
//   - 'adminRating'            — IT6 §17.3.
//
// `scripts/check-dto-leaks.ts` muss diese Liste in `FORBIDDEN_FIELDS`
// pflegen und CI grün halten.
//
// **NEUE Fehlercodes IT7 (Engineering-Hinweis für ApiErrorSchema):**
//
//   'INVALID_OR_EXPIRED_TOKEN',     // 410 — Verify- oder Reset-Token
//                                   //       unbekannt, abgelaufen oder
//                                   //       bereits verwendet.
//   'EMAIL_ALREADY_REGISTERED',     // 409 — Customer-Register-Konflikt
//                                   //       (Email existiert).
//   'OAUTH_ONLY_ACCOUNT',           // 422 — Customer-Login mit Pwd
//                                   //       gegen Account ohne
//                                   //       passwordHash. Frontend leitet
//                                   //       zu OAuth-Buttons.
//   'ALREADY_VERIFIED',             // 409 — resend-verification gegen
//                                   //       Account mit emailVerified=true.
//   'RATE_LIMITED',                 // 429 — alle Auth-Endpoints.
//
// **Erinnerung: IT6 §17.3 + IT7 §6 → bei Customer-Pfaden IMMER**
//   1. `selectCustomerUserPublic()` als Prisma-`select`,
//   2. Mapper `toCustomerPublic()` (in `src/lib/customer-auth-server.ts`),
//   3. `CustomerUserPublicSchema.parse()` als Output-Validierung.
