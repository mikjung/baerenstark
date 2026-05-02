'use client';

import { useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { ApiClientError, createSlot } from '@/lib/api-client';

interface SlotFormProps {
  onCreated: () => void;
}

interface Errors {
  date?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  general?: string;
}

function combineToIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  // "2026-05-15T08:00" → Browser-Local-Time.
  const local = `${date}T${time}`;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function SlotForm({ onCreated }: SlotFormProps) {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  function clientValidate(): Errors {
    const e: Errors = {};
    if (!date) e.date = 'Bitte ein Datum wählen';
    if (!startTime) e.startTime = 'Bitte Startzeit angeben';
    if (!endTime) e.endTime = 'Bitte Endzeit angeben';
    if (description.length > 500) e.description = 'Maximal 500 Zeichen';
    if (date && startTime && endTime) {
      const start = new Date(`${date}T${startTime}`);
      const end = new Date(`${date}T${endTime}`);
      if (Number.isNaN(start.getTime())) e.startTime = 'Ungültige Startzeit';
      if (Number.isNaN(end.getTime())) e.endTime = 'Ungültige Endzeit';
      if (
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime()) &&
        end <= start
      ) {
        e.endTime = 'Endzeit muss nach Startzeit liegen';
      }
    }
    return e;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSuccess(false);
    const v = clientValidate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    const startsAt = combineToIso(date, startTime);
    const endsAt = combineToIso(date, endTime);
    if (!startsAt || !endsAt) {
      setErrors({ general: 'Ungültige Zeitangaben.' });
      return;
    }

    setSubmitting(true);
    try {
      await createSlot({
        startsAt,
        endsAt,
        description: description.trim() || undefined,
      });
      setSuccess(true);
      setDate('');
      setStartTime('');
      setEndTime('');
      setDescription('');
      onCreated();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'OVERLAP') {
          setErrors({
            general:
              'Dieses Zeitfenster überschneidet sich mit einem bestehenden. Bitte Zeit anpassen.',
          });
        } else if (err.code === 'VALIDATION_ERROR' && err.field) {
          // Map Backend-Felder auf UI-Felder
          if (err.field === 'startsAt') setErrors({ startTime: err.message });
          else if (err.field === 'endsAt') setErrors({ endTime: err.message });
          else if (err.field === 'description') setErrors({ description: err.message });
          else setErrors({ general: err.message });
        } else if (err.code === 'UNAUTHORIZED') {
          setErrors({ general: 'Sitzung abgelaufen. Bitte erneut anmelden.' });
        } else {
          setErrors({ general: err.message });
        }
      } else {
        setErrors({ general: 'Unbekannter Fehler. Bitte erneut versuchen.' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-busy={submitting || undefined}
      className="rounded-2xl border border-baerenstark-sand bg-white/80 p-5 shadow-soft"
    >
      <h3 className="mb-4 font-serif text-lg font-semibold text-baerenstark-bark">
        Neues Zeitfenster
      </h3>

      {success && (
        <div className="mb-4">
          <Banner tone="success" role="status">
            Zeitfenster wurde angelegt.
          </Banner>
        </div>
      )}

      {errors.general && (
        <div className="mb-4">
          <Banner tone="error" role="alert">
            {errors.general}
          </Banner>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label="Datum"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={errors.date}
        />
        <Input
          label="Startzeit"
          type="time"
          required
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          error={errors.startTime}
        />
        <Input
          label="Endzeit"
          type="time"
          required
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          error={errors.endTime}
        />
      </div>

      <div className="mt-4">
        <Textarea
          label="Beschreibung (optional)"
          rows={2}
          maxLength={500}
          placeholder="z. B. Vormittag, ab 14 Uhr"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
        />
      </div>

      <div className="mt-5 flex justify-end">
        <Button type="submit" isLoading={submitting}>
          Zeitfenster anlegen
        </Button>
      </div>
    </form>
  );
}
