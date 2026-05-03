'use client';

/**
 * Iteration 3 — Verfügbarkeits-Verwaltung im Admin-Bereich.
 * Iteration 5 (US-34) — Buffer-Konfiguration ergänzt.
 *
 * Sub-Komponenten:
 *   - <AvailabilityTemplateForm /> — Standard-Wochenvorlage mit Zeitfenster
 *     und Slot-Dauer pro Tag (US-17).
 *   - <DayOverrideManager /> — Tages-Überschreibungen (Urlaub etc.).
 *   - <BufferConfigForm /> — Buffer-Zeit nach bestätigten Buchungen (IT5 / US-34).
 *
 * Die alte `WeeklyAvailability`-API (`/api/availability`) bleibt zwar im
 * Backend für Kompatibilität bestehen, wird aber von der UI nicht mehr genutzt.
 */

import { AvailabilityTemplateForm } from './AvailabilityTemplateForm';
import { BufferConfigForm } from './BufferConfigForm';
import { DayOverrideManager } from './DayOverrideManager';

export function WeeklyAvailabilityForm() {
  return (
    <div className="space-y-8">
      <BufferConfigForm />
      <hr className="border-baerenstark-sand" />
      <AvailabilityTemplateForm />
      <hr className="border-baerenstark-sand" />
      <DayOverrideManager />
    </div>
  );
}
