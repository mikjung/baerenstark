/**
 * Bärenstark Hausservice — Geteilte Zod-Schemas (v1.3 — Iteration 3)
 *
 * Diese Datei ist die einzige Quelle der Wahrheit für die Form
 * der API-Payloads. Sowohl Frontend (Forms, Fetch-Wrapper) als auch
 * Backend (API-Routes) importieren von hier.
 *
 * Pfad in der Live-App: src/lib/schemas.ts (synchron mit dieser Datei).
 *
 * Änderungen v1.3 (Iteration 3 — US-17 bis US-24):
 *   - SERVICES erweitert um `'sonstiges'` (US-19).
 *   - CreateBookingSchema umgebaut: `slotId` ist DEPRECATED (nur Bestand);
 *     neue Buchungen senden `date + startTime + endTime` (US-17).
 *   - CreateBookingSchema enthält superRefine: bei service='sonstiges' muss
 *     description ≥ 30 Zeichen sein (US-19).
 *   - CreateBookingSchema enthält optionales `attachmentIds: string[]` (US-18).
 *   - Neue Schemas: AvailabilityTemplateSchema, UpdateAvailabilityTemplateSchema,
 *     DayOverrideSchema, CreateDayOverrideSchema, AvailableSlotsSchema.
 *   - Neue Schemas: BookingAttachmentSchema, UploadResponseSchema.
 *   - Neues Schema: UpcomingBookingSchema (US-21).
 *   - BookingAdminSchema erweitert um date/startTime/endTime/attachments.
 *   - SlotPublicSchema bleibt für Bestand erhalten; neuer
 *     `AvailableTimeSlotSchema` für IT3-Buchungs-UI.
 *
 * Änderungen v1.2 (Iteration 2):
 *   - BookingStatus erweitert: COUNTER_PROPOSED, CANCELLED.
 *   - customerEmail Pflicht, preprocess-Härtung.
 *   - Counter-Proposal, Rebooking, WeeklyAvailability, Calendar-Schemas.
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
// Booking-Status
// ---------------------------------------------------------------------------
export const BookingStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'REJECTED',
  'COUNTER_PROPOSED',
  'CANCELLED',
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
// Slot (Bestand IT1/IT2 — DEPRECATED in IT3)
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
// ---------------------------------------------------------------------------

/**
 * Body für POST /api/bookings (öffentlich, Kunde) — Iteration 3.
 *
 * Modus 1 (NEU IT3, Standard für neue Buchungen):
 *   - `date`, `startTime`, `endTime` sind Pflicht.
 *   - `slotId` darf NICHT gesetzt sein (oder ist leer/undefined).
 *
 * Modus 2 (Bestand IT1/IT2, Re-Booking-Flow für alte Buchungen):
 *   - `slotId` ist Pflicht.
 *   - `date`, `startTime`, `endTime` dürfen NICHT gesetzt sein.
 *
 * Genau einer der beiden Modi muss erfüllt sein. Wird im superRefine geprüft.
 *
 * Für US-19 (`service === 'sonstiges'`): description muss ≥ 30 Zeichen sein.
 *
 * Für US-18: optionales `attachmentIds`-Array — Frontend lädt Dateien zuerst
 * via `POST /api/upload` hoch, sammelt die zurückgegebenen IDs und schickt
 * sie zusammen mit der Buchung. Backend verknüpft die `BookingAttachment`-
 * Datensätze nach Insert mit der neuen Booking.
 */
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
    // Modus-Check: genau einer der beiden Modi.
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
      // endTime > startTime (lexikographisch + numerisch).
      const startMin = timeStringToMinutes(data.startTime!);
      const endMin = timeStringToMinutes(data.endTime!);
      if (endMin <= startMin) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Endzeit muss nach Startzeit liegen',
          path: ['endTime'],
        });
      }

      // date in der Zukunft (Berlin-TZ-Datum-Vergleich).
      // Hinweis: tagesgenauer Vergleich; das Backend führt zusätzlich
      // einen Verfügbarkeitsfenster-Check durch.
      const today = new Date();
      const todayBerlin = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Berlin',
      }).format(today); // "YYYY-MM-DD"
      if (data.date! < todayBerlin) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Das gewählte Datum liegt in der Vergangenheit',
          path: ['date'],
        });
      }
    }

    // US-19: Sonstiges-Service zwingt 30+ Zeichen Beschreibung.
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

/**
 * Form-Schema für `BookingForm.tsx` — wie CreateBookingSchema, aber ohne
 * `date/startTime/endTime/slotId`. Diese Werte verwaltet die Komponente
 * außerhalb von React-Hook-Form (im React-State), damit der Bug aus
 * BUG_BOOKING_IT3.md (hidden Input + register) nicht erneut auftritt.
 *
 * Beim Submit setzt die Komponente programmatisch die fehlenden Felder.
 */
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
// PATCH /api/bookings/:id (Admin — CONFIRMED|REJECTED)
// ---------------------------------------------------------------------------

export const UpdateBookingStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'REJECTED']),
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
// Booking — Admin-Antwort (erweitert in IT3)
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

/**
 * Admin-Antwort für GET /api/bookings.
 *
 * Iteration 3:
 *  - `slot` ist nullable (neue Buchungen haben keinen Slot).
 *  - `date / startTime / endTime` für IT3-Buchungen.
 *  - `attachments` für Datei-Anhänge (US-18).
 */
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
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type BookingAdmin = z.infer<typeof BookingAdminSchema>;

/**
 * US-21: Übersicht bevorstehender bestätigter Termine im Admin-Dashboard.
 * Reduzierte Form (kein customerPhone/Email/description), für die Liste.
 */
export const UpcomingBookingSchema = z.object({
  id: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  customerName: z.string(),
  service: ServiceSchema,
  /** true, wenn das Datum dem heutigen Tag (Berlin-TZ) entspricht. */
  isToday: z.boolean(),
});
export type UpcomingBooking = z.infer<typeof UpcomingBookingSchema>;

// ---------------------------------------------------------------------------
// Iteration 3 — AvailabilityTemplate (US-17)
// ---------------------------------------------------------------------------

const SLOT_DURATION_MIN_MINUTES = 15;
const SLOT_DURATION_MAX_MINUTES = 480; // 8h
export const AVAILABILITY_TEMPLATE_SLOT_DURATION_MIN = SLOT_DURATION_MIN_MINUTES;
export const AVAILABILITY_TEMPLATE_SLOT_DURATION_MAX = SLOT_DURATION_MAX_MINUTES;

/**
 * Single Day in der AvailabilityTemplate.
 * `startTime < endTime`, `slotDurationMinutes` muss in das Fenster passen
 * (mind. ein Slot).
 */
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

/** Body für PUT /api/admin/availability-template (Bulk-Update). */
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
// Iteration 3 — DayOverride (US-17)
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

/**
 * Body für POST /api/admin/day-overrides.
 *
 * Wenn `isActive: false`, sind startTime/endTime irrelevant (Tag ist gesperrt).
 * Wenn `isActive: true`, MÜSSEN startTime/endTime entweder beide null sein
 * (= Template-Defaults nutzen) oder beide "HH:MM" mit endTime > startTime.
 */
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

/** Query für GET /api/admin/day-overrides?month=YYYY-MM. */
export const DayOverrideMonthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Monat muss im Format YYYY-MM sein'),
});
export type DayOverrideMonthQuery = z.infer<typeof DayOverrideMonthQuerySchema>;

// ---------------------------------------------------------------------------
// Iteration 3 — Verfügbare Zeitslots pro Tag (US-17)
// ---------------------------------------------------------------------------

/**
 * Ein berechneter Buchungs-Block für GET /api/slots/available?date=YYYY-MM-DD.
 *
 * `available: false` ⇔ es gibt eine aktive Buchung auf diesem Block.
 * Frontend rendert `available: true` als klickbar, `available: false` als
 * ausgegraut.
 */
export const AvailableTimeSlotSchema = z.object({
  startTime: TimeStringSchema,
  endTime: TimeStringSchema,
  available: z.boolean(),
});
export type AvailableTimeSlot = z.infer<typeof AvailableTimeSlotSchema>;

/** Antwort für GET /api/slots/available?date=YYYY-MM-DD. */
export const AvailableSlotsResponseSchema = z.object({
  date: DateStringSchema,
  /** false = der ganze Tag ist gesperrt (Override oder Wochentag inaktiv). */
  isDayActive: z.boolean(),
  /** Nicht-leere Liste, wenn isDayActive=true; sonst leeres Array. */
  slots: z.array(AvailableTimeSlotSchema),
  /** Optional: Override-Reason (Urlaub etc.), falls Tag durch Override gesperrt. */
  overrideReason: z.string().nullable().optional(),
});
export type AvailableSlotsResponse = z.infer<typeof AvailableSlotsResponseSchema>;

/** Query für GET /api/slots/available. */
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
// Iteration 3 — Datei-Upload (US-18)
// ---------------------------------------------------------------------------

export const UPLOAD_MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
export const UPLOAD_MAX_FILES_PER_BOOKING = 5;
export const UPLOAD_ACCEPTED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime', // .mov
  'application/pdf',
] as const;
export type UploadContentType = (typeof UPLOAD_ACCEPTED_CONTENT_TYPES)[number];

export const UploadResponseSchema = z.object({
  /** Temporäre Attachment-ID, wird beim POST /api/bookings im `attachmentIds`-Array referenziert. */
  attachmentId: z.string(),
  url: z.string().url(),
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;

// ---------------------------------------------------------------------------
// Auth (Login + Setup) — unverändert
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

// ---------------------------------------------------------------------------
// Einheitliches Fehler-Format
// ---------------------------------------------------------------------------

/**
 * Iteration 3 — neue Fehlercodes:
 *  - `PAYLOAD_TOO_LARGE` (413): Datei-Upload überschreitet Größenlimit (US-18).
 *  - `UNSUPPORTED_MEDIA_TYPE` (415): Nicht erlaubter MIME-Type (US-18).
 *
 * Bestehende Codes (unverändert):
 *  - VALIDATION_ERROR (400)
 *  - UNAUTHORIZED (401)
 *  - FORBIDDEN (403)
 *  - NOT_FOUND (404)
 *  - CONFLICT (409)
 *  - OVERLAP (409)
 *  - GONE (410)
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
      'RATE_LIMITED',
      'MAIL_FAILED',
      'INTERNAL_ERROR',
    ]),
    message: z.string(),
    field: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
