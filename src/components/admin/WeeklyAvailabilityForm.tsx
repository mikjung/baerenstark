'use client';

/**
 * Iteration 3 — Verfügbarkeits-Verwaltung im Admin-Bereich.
 *
 * Ersetzt die alte Mo–So-Toggle-Variante (US-15) durch:
 *   - <AvailabilityTemplateForm /> — Standard-Wochenvorlage mit Zeitfenster
 *     und Slot-Dauer pro Tag (US-17, neue API).
 *   - <DayOverrideManager /> — Tages-Überschreibungen (Urlaub etc.).
 *
 * Die alte `WeeklyAvailability`-API (`/api/availability`) bleibt zwar im
 * Backend für Kompatibilität bestehen, wird aber von der UI nicht mehr genutzt.
 */

import { AvailabilityTemplateForm } from './AvailabilityTemplateForm';
import { DayOverrideManager } from './DayOverrideManager';

export function WeeklyAvailabilityForm() {
  return (
    <div className="space-y-8">
      <AvailabilityTemplateForm />
      <hr className="border-baerenstark-sand" />
      <DayOverrideManager />
    </div>
  );
}
