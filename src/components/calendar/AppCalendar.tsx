'use client';

/**
 * AppCalendar — gemeinsame FullCalendar-Komponente für Admin und Kunde
 * (US-IT6-02).
 *
 * Bibliotheks-Wahl: `@fullcalendar/react` (MIT, siehe ARCHITECTURE_IT6.md
 * §4.1). Dynamic-Import in den umschließenden Pages, damit FullCalendar
 * nicht im Server-Bundle landet.
 *
 * Modi:
 *   - `mode="admin"` — Wochen-/Tag-/Monatsansicht, Drag-to-create,
 *     Klick auf Buchungs-Events öffnet Detail-Popover.
 *   - `mode="customer"` — Monatsansicht. Tagesstatus (verfügbar / partial
 *     / unavailable). Klick auf verfügbaren Tag → onDaySelect.
 *
 * Locale: Deutsch durchgängig (date-fns/locale/de-Format passt zu
 * FullCalendar `locale="de"`).
 *
 * Mobile (< 768 px): Touch-Floor 44 px, im Admin-Modus Default
 * `timeGridDay`, im Customer-Modus weiterhin `dayGridMonth`.
 */

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import deLocale from '@fullcalendar/core/locales/de';
import type {
  EventClickArg,
  EventInput,
  DateSelectArg,
  EventContentArg,
  DayCellMountArg,
} from '@fullcalendar/core';
import { useEffect, useRef, useState } from 'react';
import type { CalendarEvent, AvailabilityCalendarDay } from '@/lib/schemas';

type Mode = 'admin' | 'customer';

interface AdminProps {
  mode: 'admin';
  /** Vom Server geladene Events (Buchungen + Verfügbarkeit + Buffer). */
  events: CalendarEvent[];
  /**
   * Range-Wechsel — wird ausgelöst, wenn der User per "Vor/Zurück" oder
   * View-Toggle die sichtbare Spanne ändert. Werte sind YYYY-MM-DD.
   */
  onRangeChange?: (from: string, to: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
  /** Drag-to-create: Range-Auswahl im freien Bereich. */
  onSelectRange?: (startIso: string, endIso: string) => void;
}

interface CustomerProps {
  mode: 'customer';
  /** Pro Tag: Status-Code aus dem öffentlichen Verfügbarkeits-Endpoint. */
  days: AvailabilityCalendarDay[];
  onRangeChange?: (from: string, to: string) => void;
  /** Klick auf einen verfügbaren Tag. Liefert YYYY-MM-DD. */
  onDaySelect?: (dateIso: string) => void;
  /** Heute hervorheben (Default true). */
  highlightToday?: boolean;
}

export type AppCalendarProps = AdminProps | CustomerProps;

const ADMIN_TONE: Record<string, { bg: string; border: string; text: string }> = {
  CONFIRMED: { bg: '#16a34a', border: '#166534', text: '#ffffff' },
  PENDING: { bg: '#3b82f6', border: '#1e40af', text: '#ffffff' },
  COUNTER_PROPOSED: { bg: '#f59e0b', border: '#b45309', text: '#1f2937' },
  COMPLETED: { bg: '#0ea5e9', border: '#0369a1', text: '#ffffff' },
  CANCELLED: { bg: '#6b7280', border: '#4b5563', text: '#ffffff' },
  REJECTED: { bg: '#9ca3af', border: '#6b7280', text: '#ffffff' },
};

function isoDate(d: Date): string {
  // Wir wollen die Local-Wallclock-Datumskomponente — FullCalendar liefert
  // Daten in der Browser-Zeitzone (Europe/Berlin auf Tom's Geräten).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function detectIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

function adminEventToFc(ev: CalendarEvent): EventInput {
  if (ev.type === 'AVAILABILITY') {
    return {
      id: ev.id,
      title: ev.title,
      start: ev.start,
      end: ev.end,
      display: 'background',
      color: '#bbf7d0',
    };
  }
  if (ev.type === 'BUFFER') {
    return {
      id: ev.id,
      title: ev.title,
      start: ev.start,
      end: ev.end,
      backgroundColor: '#9ca3af',
      borderColor: '#6b7280',
      textColor: '#ffffff',
      classNames: ['fc-buffer-event'],
    };
  }
  // BOOKING
  const tone = ADMIN_TONE[ev.status ?? 'PENDING'] ?? ADMIN_TONE.PENDING!;
  return {
    id: ev.id,
    title: ev.title,
    start: ev.start,
    end: ev.end,
    backgroundColor: tone.bg,
    borderColor: tone.border,
    textColor: tone.text,
    extendedProps: { status: ev.status, url: ev.url, type: ev.type },
  };
}

function customerDayToFc(day: AvailabilityCalendarDay): EventInput | null {
  // Customer-Modus: wir markieren den ganzen Tag mit einem
  // Background-Event in der passenden Farbe.
  if (day.status === 'available') {
    return {
      id: `avail-${day.date}`,
      start: day.date,
      allDay: true,
      display: 'background',
      backgroundColor: '#dcfce7', // grün-pastell
    };
  }
  if (day.status === 'partial') {
    return {
      id: `partial-${day.date}`,
      start: day.date,
      allDay: true,
      display: 'background',
      backgroundColor: '#fef3c7', // gelb-pastell
    };
  }
  return {
    id: `unavail-${day.date}`,
    start: day.date,
    allDay: true,
    display: 'background',
    backgroundColor: '#f3f4f6', // grau
  };
}

export function AppCalendar(props: AppCalendarProps) {
  const calRef = useRef<FullCalendar | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(detectIsMobile);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = () => setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Build events array
  const events: EventInput[] =
    props.mode === 'admin'
      ? props.events.map(adminEventToFc)
      : props.days
          .map(customerDayToFc)
          .filter((e): e is EventInput => e !== null);

  // initialView je nach Mode + Mobile
  const initialView =
    props.mode === 'admin'
      ? isMobile
        ? 'timeGridDay'
        : 'timeGridWeek'
      : 'dayGridMonth';

  const headerToolbar =
    props.mode === 'admin'
      ? {
          left: 'prev,next today',
          center: 'title',
          right: isMobile ? 'timeGridDay,dayGridMonth' : 'timeGridWeek,timeGridDay,dayGridMonth',
        }
      : {
          left: 'prev,next',
          center: 'title',
          right: 'today',
        };

  // Handlers
  const handleEventClick = (arg: EventClickArg) => {
    if (props.mode !== 'admin') {
      arg.jsEvent.preventDefault();
      return;
    }
    arg.jsEvent.preventDefault();
    const id = arg.event.id;
    const status = arg.event.extendedProps?.status as string | undefined;
    const found = props.events.find((e) => e.id === id);
    if (found && props.onEventClick) {
      props.onEventClick(found);
    } else if (status && props.onEventClick) {
      props.onEventClick({
        id,
        type: 'BOOKING',
        title: arg.event.title,
        start: arg.event.startStr,
        end: arg.event.endStr,
      } as CalendarEvent);
    }
  };

  const handleSelect = (arg: DateSelectArg) => {
    if (props.mode !== 'admin') return;
    if (!props.onSelectRange) return;
    props.onSelectRange(arg.startStr, arg.endStr);
    arg.view.calendar.unselect();
  };

  const handleDateClick = (arg: { dateStr: string; date: Date }) => {
    if (props.mode !== 'customer') return;
    if (!props.onDaySelect) return;
    // Nur klickbar, wenn Tag verfügbar oder partial.
    const dateStr = isoDate(arg.date);
    const day = props.days.find((d) => d.date === dateStr);
    if (!day) return;
    if (day.status === 'unavailable') return;
    props.onDaySelect(dateStr);
  };

  // Range-Change-Listener für Lazy-Load.
  const handleDatesSet = (arg: { start: Date; end: Date }) => {
    if (!('onRangeChange' in props) || !props.onRangeChange) return;
    // FullCalendar liefert end exklusiv → wir geben den letzten Tag inklusiv zurück.
    const fromIso = isoDate(arg.start);
    const lastDay = new Date(arg.end);
    lastDay.setDate(lastDay.getDate() - 1);
    const toIso = isoDate(lastDay);
    props.onRangeChange(fromIso, toIso);
  };

  const dayCellDidMount = (arg: DayCellMountArg) => {
    if (props.mode !== 'customer') return;
    const dateStr = isoDate(arg.date);
    const day = props.days.find((d) => d.date === dateStr);
    if (!day) return;
    if (day.status === 'unavailable') {
      arg.el.classList.add('app-cal-day--unavailable');
      arg.el.setAttribute('aria-disabled', 'true');
      arg.el.title = 'Nicht verfügbar';
    } else if (day.status === 'partial') {
      arg.el.classList.add('app-cal-day--partial');
      arg.el.title = 'Teilweise belegt';
    } else {
      arg.el.classList.add('app-cal-day--available');
      arg.el.title = 'Verfügbar';
    }
  };

  const eventContent = (arg: EventContentArg) => {
    // Bei BACKGROUND-Events: kein Inhalt, FullCalendar rendert den Hintergrund.
    if (arg.event.display === 'background') return null;
    return (
      <div className="px-1 py-0.5 text-xs leading-tight">
        <div className="font-semibold">{arg.timeText}</div>
        <div className="truncate">{arg.event.title}</div>
      </div>
    );
  };

  return (
    <div
      className="app-calendar"
      style={
        {
          // Touch-Floor 44 px (m4-Resolution Anhang B §17.8).
          '--app-cal-min-touch': '44px',
        } as React.CSSProperties
      }
    >
      <FullCalendar
        ref={calRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        locale={deLocale}
        timeZone="Europe/Berlin"
        initialView={initialView}
        headerToolbar={headerToolbar}
        height="auto"
        contentHeight="auto"
        firstDay={1}
        nowIndicator={true}
        slotMinTime="07:00:00"
        slotMaxTime="20:00:00"
        slotDuration="00:30:00"
        allDaySlot={false}
        weekNumbers={false}
        selectable={props.mode === 'admin'}
        selectMirror={true}
        editable={false}
        events={events}
        eventClick={handleEventClick}
        select={handleSelect}
        dateClick={handleDateClick}
        datesSet={handleDatesSet}
        dayCellDidMount={dayCellDidMount}
        eventContent={eventContent}
        buttonText={{
          today: 'Heute',
          month: 'Monat',
          week: 'Woche',
          day: 'Tag',
        }}
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }}
      />
      <style jsx global>{`
        .app-calendar .fc {
          font-family: inherit;
          font-size: 0.875rem;
        }
        .app-calendar .fc-button {
          background-color: #b08454;
          border-color: #b08454;
          color: #fffaf0;
          text-transform: none;
          min-height: var(--app-cal-min-touch, 44px);
        }
        .app-calendar .fc-button:hover {
          background-color: #8a5a2b;
          border-color: #8a5a2b;
        }
        .app-calendar .fc-button-primary:not(:disabled).fc-button-active,
        .app-calendar .fc-button-primary:not(:disabled):active {
          background-color: #5a3818;
          border-color: #5a3818;
        }
        .app-calendar .fc-toolbar-title {
          font-family: var(--font-playfair, serif);
          font-size: 1.25rem;
        }
        .app-calendar .fc-event {
          border-radius: 4px;
          font-size: 0.75rem;
        }
        .app-calendar .fc-daygrid-day {
          min-height: var(--app-cal-min-touch, 44px);
        }
        .app-calendar .app-cal-day--unavailable {
          background-color: #f3f4f6;
          color: #9ca3af;
          cursor: not-allowed;
        }
        .app-calendar .app-cal-day--partial {
          background-color: #fef3c7;
          cursor: pointer;
        }
        .app-calendar .app-cal-day--available {
          background-color: #ecfdf5;
          cursor: pointer;
        }
        .app-calendar .app-cal-day--available:hover {
          background-color: #d1fae5;
        }
        @media (max-width: 767px) {
          .app-calendar .fc-toolbar.fc-header-toolbar {
            flex-wrap: wrap;
            gap: 0.5rem;
          }
          .app-calendar .fc-button {
            padding: 0.5rem 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}
