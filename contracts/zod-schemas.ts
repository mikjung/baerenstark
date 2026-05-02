/**
 * Bärenstark Hausservice — Geteilte Zod-Schemas (v1.4.1 — Iteration 4 Revision)
 *
 * Diese Datei ist die einzige Quelle der Wahrheit für die Form
 * der API-Payloads. Sowohl Frontend (Forms, Fetch-Wrapper) als auch
 * Backend (API-Routes) importieren von hier.
 *
 * Pfad in der Live-App: src/lib/schemas.ts (synchron mit dieser Datei).
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
// ---------------------------------------------------------------------------

export const CreateBookingSchema = z
  .object({
    // IT3-Modus:
    date: DateStringSchema.optional(),
    startTime: TimeStringSchema.optional(),
    endTime: TimeStringSchema.optional(),

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
  // IT4: optionale Verknüpfung zu einem registrierten Kunden.
  customerId: z.string().nullable(),
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

export const AvailableSlotsQuerySchema = z.object({
  date: DateStringSchema,
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

/** Response von GET /api/customer/me. Enthält keine sensiblen Felder. */
export const CustomerUserPublicSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  emailVerified: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
});
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
export const CustomerBookingSchema = z.object({
  id: z.string(),
  date: z.string().nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  service: ServiceSchema,
  description: z.string(),
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
    .nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
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
 */
export const PublicReviewSchema = z.object({
  id: z.string(),
  /** "Vorname N." — Backend kürzt Nachname. */
  customerName: z.string(),
  service: ServiceSchema.nullable(),
  stars: z.number().int().min(1).max(5),
  text: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
});
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
      'RATE_LIMITED',
      'MAIL_FAILED',
      'INTERNAL_ERROR',
    ]),
    message: z.string(),
    field: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
