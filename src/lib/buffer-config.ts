/**
 * Buffer-Config-Helper (Iteration 5 / US-34).
 *
 * Singleton-Pattern: genau ein Datensatz in `buffer_config`. Bei erstem
 * Aufruf wird der Datensatz on-the-fly mit Default 30 Minuten angelegt.
 *
 * Engineers-Hinweis: alle Aufrufer nutzen ausschließlich `getBufferConfig()`
 * und `setBufferConfig()` — kein direkter Prisma-Zugriff auf `bufferConfig`
 * außerhalb dieser Datei.
 */

import { prisma } from './prisma';
import { BUFFER_MINUTES_DEFAULT } from './schemas';

export interface BufferConfigSnapshot {
  bufferMinutes: number;
  updatedAt: Date;
}

/**
 * Liest den globalen Buffer-Wert. Seedet on-the-fly mit Default
 * `BUFFER_MINUTES_DEFAULT` (30 Min), falls noch kein Datensatz existiert.
 */
export async function getBufferConfig(): Promise<BufferConfigSnapshot> {
  let cfg = await prisma.bufferConfig.findFirst();
  if (!cfg) {
    cfg = await prisma.bufferConfig.create({
      data: { bufferMinutes: BUFFER_MINUTES_DEFAULT },
    });
  }
  return { bufferMinutes: cfg.bufferMinutes, updatedAt: cfg.updatedAt };
}

/**
 * Aktualisiert den globalen Buffer-Wert. Wenn noch kein Datensatz existiert,
 * wird er angelegt. Whitelist-Validierung passiert im API-Layer (Zod) — hier
 * vertrauen wir dem aufrufenden Code.
 */
export async function setBufferConfig(
  value: number,
): Promise<BufferConfigSnapshot> {
  const existing = await prisma.bufferConfig.findFirst();
  const cfg = existing
    ? await prisma.bufferConfig.update({
        where: { id: existing.id },
        data: { bufferMinutes: value },
      })
    : await prisma.bufferConfig.create({
        data: { bufferMinutes: value },
      });
  return { bufferMinutes: cfg.bufferMinutes, updatedAt: cfg.updatedAt };
}
