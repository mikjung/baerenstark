'use client';

/**
 * FileUpload — US-18 + IT11 / US-IT11-04.
 *
 * Verhalten (IT11-Update gegenüber Bestand):
 *   - **MIME-spezifische Limits** statt einheitliches 20 MB:
 *     Bilder bis 10 MB, Videos bis 50 MB, PDFs bis 10 MB. Helper:
 *     `getUploadLimitForType()` aus `@/lib/schemas`.
 *   - **Min-Size-Check (1 Byte):** 0-Byte-Dateien werden inline abgelehnt.
 *   - **Parallel-Upload-Limit (max 3):** Semaphore puffert weitere Uploads
 *     in einer FIFO-Queue (Status `pending` → `uploading` → `success`/`error`).
 *   - **Inline-Retry-Button** auf jedem Error-Entry.
 *   - Drop-Zone-Hinweis: „Bilder bis 10 MB · Videos bis 50 MB · max. 5 Dateien".
 *
 * Bestand:
 *   - Bis zu 5 Dateien parallel verwaltbar (`UPLOAD_MAX_FILES_PER_BOOKING`).
 *   - Status pro Datei: pending | uploading | success | error.
 *   - Bei `BLOB_NOT_CONFIGURED` blendet die Komponente die Upload-Sektion aus
 *     und zeigt einen Hinweistext (kein Buchungs-Block).
 *   - Drag-and-Drop und Datei-Picker.
 *   - `attachmentIds` der erfolgreich hochgeladenen Dateien werden via
 *     `onAttachmentsChange` an den Form-Container kommuniziert.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ApiClientError, uploadFile } from '@/lib/api-client';
import {
  UPLOAD_ACCEPTED_CONTENT_TYPES,
  UPLOAD_MAX_FILES_PER_BOOKING,
  UPLOAD_MAX_PARALLEL,
  UPLOAD_MAX_IMAGE_BYTES,
  UPLOAD_MAX_VIDEO_BYTES,
  getUploadLimitForType,
} from '@/lib/schemas';

type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

interface UploadEntry {
  /** Lokale UUID — kein Server-Wert. */
  localId: string;
  file: File;
  status: UploadStatus;
  /**
   * IT13-S05 — Direct-Upload-Fortschritt 0–100 für die laufende Übertragung
   * Browser → Vercel Blob. `undefined` solange kein Update angekommen ist.
   */
  progress?: number;
  /** Server-side ID (vorhanden, wenn status === 'success'). */
  attachmentId?: string;
  url?: string;
  error?: string;
}

interface FileUploadProps {
  /** Wird aufgerufen, sobald sich die Liste der erfolgreich hochgeladenen IDs ändert. */
  onAttachmentsChange: (attachmentIds: string[]) => void;
  /** Optional: blendet die Sektion komplett aus (z.B. Server-Side gemeldet). */
  hideSection?: boolean;
}

const ACCEPT_ATTR = UPLOAD_ACCEPTED_CONTENT_TYPES.join(',');
const MAX_FILES = UPLOAD_MAX_FILES_PER_BOOKING;
const HINT_LINE = `Bilder bis ${humanSize(UPLOAD_MAX_IMAGE_BYTES)} · Videos bis ${humanSize(UPLOAD_MAX_VIDEO_BYTES)} · max. ${MAX_FILES} Dateien`;

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImageType(type: string): boolean {
  return type.startsWith('image/');
}

function isVideoType(type: string): boolean {
  return type.startsWith('video/');
}

function localIdFor(file: File): string {
  // Reicht für UI-Eindeutigkeit — kein kryptografischer Bedarf.
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * IT11 — clientseitige Validierung pro File. Liefert eine deutsche Fehlermeldung
 * oder `null` (akzeptiert).
 *
 *   - Empty (size === 0)              → „Diese Datei ist leer."
 *   - Type nicht in Whitelist         → „Dateityp 'x/y' wird nicht unterstützt."
 *   - Größe > MIME-Limit              → „Datei ist zu groß (Bilder: 10 MB, Videos: 50 MB)."
 */
function clientSideValidate(file: File): string | null {
  if (file.size === 0) {
    return 'Diese Datei ist leer.';
  }
  const accepted = UPLOAD_ACCEPTED_CONTENT_TYPES as ReadonlyArray<string>;
  if (file.type && !accepted.includes(file.type)) {
    return `Dateityp "${file.type || 'unbekannt'}" wird nicht unterstützt.`;
  }
  const limit = getUploadLimitForType(file.type);
  if (limit === null) {
    return `Dateityp "${file.type || 'unbekannt'}" wird nicht unterstützt.`;
  }
  if (file.size > limit) {
    return `Datei ist zu groß. Maximum: ${humanSize(limit)} (Ihre Datei: ${humanSize(
      file.size,
    )}).`;
  }
  return null;
}

export function FileUpload({ onAttachmentsChange, hideSection = false }: FileUploadProps) {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [globalNotice, setGlobalNotice] = useState<{
    tone: 'info' | 'warning' | 'error';
    text: string;
  } | null>(null);
  const [blobUnavailable, setBlobUnavailable] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const onAttachmentsChangeRef = useRef(onAttachmentsChange);

  // IT11 v3 — Parallel-Upload-Semaphore. Anzahl der aktuell laufenden
  // `startUpload()`-Promises (max `UPLOAD_MAX_PARALLEL`). Pending-Files in
  // FIFO-Reihenfolge starten, sobald ein Slot frei wird.
  const activeUploadsRef = useRef(0);
  const pendingQueueRef = useRef<Array<{ localId: string; file: File }>>([]);

  useEffect(() => {
    onAttachmentsChangeRef.current = onAttachmentsChange;
  }, [onAttachmentsChange]);

  // Sobald sich die erfolgreichen Uploads ändern, Parent informieren.
  useEffect(() => {
    const ids = entries
      .filter((e) => e.status === 'success' && e.attachmentId)
      .map((e) => e.attachmentId as string);
    onAttachmentsChangeRef.current(ids);
  }, [entries]);

  /**
   * Schedule-Helper — startet so viele Uploads aus der Queue, wie das
   * Parallel-Limit erlaubt. Wird nach `enqueueForUpload()` und nach jedem
   * `finally` eines abgeschlossenen Uploads aufgerufen.
   */
  const drainQueue = useCallback(() => {
    while (
      activeUploadsRef.current < UPLOAD_MAX_PARALLEL &&
      pendingQueueRef.current.length > 0
    ) {
      const next = pendingQueueRef.current.shift();
      if (!next) break;
      activeUploadsRef.current += 1;
      void runUpload(next.localId, next.file).finally(() => {
        activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1);
        drainQueue();
      });
    }
  }, []);

  const enqueueForUpload = useCallback(
    (localId: string, file: File) => {
      pendingQueueRef.current.push({ localId, file });
      drainQueue();
    },
    [drainQueue],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      if (blobUnavailable) return;
      const arr = Array.from(files);
      if (arr.length === 0) return;

      setEntries((prev) => {
        const remaining = MAX_FILES - prev.length;
        if (remaining <= 0) {
          setGlobalNotice({
            tone: 'warning',
            text: `Du kannst maximal ${MAX_FILES} Dateien anhängen.`,
          });
          return prev;
        }

        const accepted: UploadEntry[] = [];

        for (const file of arr.slice(0, remaining)) {
          const validationError = clientSideValidate(file);
          if (validationError) {
            accepted.push({
              localId: localIdFor(file),
              file,
              status: 'error',
              error: validationError,
            });
            continue;
          }
          accepted.push({
            localId: localIdFor(file),
            file,
            status: 'pending',
          });
        }

        if (arr.length > remaining) {
          setGlobalNotice({
            tone: 'warning',
            text: `Es können maximal ${MAX_FILES} Dateien hochgeladen werden — ${
              arr.length - remaining
            } Datei(en) wurden ignoriert.`,
          });
        }

        // Trigger Upload für alle akzeptierten Pending-Einträge nach State-Update.
        // Wir setzen sie via Semaphore in die Queue.
        queueMicrotask(() => {
          for (const entry of accepted) {
            if (entry.status === 'pending') {
              enqueueForUpload(entry.localId, entry.file);
            }
          }
        });

        return [...prev, ...accepted];
      });
    },
    [blobUnavailable, enqueueForUpload],
  );

  /**
   * Setzt den State für einen Eintrag auf `uploading`, ruft den API-Client und
   * persistiert das Ergebnis in den State. Wird intern von `drainQueue()`
   * aufgerufen — nicht direkt vom UI.
   *
   * IT13-S05 — Direct-Upload-Flow: `uploadFile()` ruft intern Token-Endpoint
   * → Vercel Blob (Browser-Direct) → Confirm-Endpoint. Der `onProgress`-
   * Callback liefert den Browser→Blob-Fortschritt in Prozent; wir spiegeln
   * ihn am Upload-Eintrag.
   */
  async function runUpload(localId: string, file: File) {
    setEntries((prev) =>
      prev.map((e) =>
        e.localId === localId ? { ...e, status: 'uploading', progress: 0 } : e,
      ),
    );
    try {
      const res = await uploadFile(file, {
        onProgress: ({ percentage }) => {
          // Defensive Klammerung: SDK kann auch >100 oder NaN liefern.
          const safe = Number.isFinite(percentage)
            ? Math.max(0, Math.min(100, Math.round(percentage)))
            : 0;
          setEntries((prev) =>
            prev.map((e) =>
              e.localId === localId ? { ...e, progress: safe } : e,
            ),
          );
        },
      });
      setEntries((prev) =>
        prev.map((e) =>
          e.localId === localId
            ? {
                ...e,
                status: 'success',
                progress: 100,
                attachmentId: res.attachmentId,
                url: res.url,
              }
            : e,
        ),
      );
    } catch (err) {
      // IT14-S08 — User-freundliche deutsche Error-Microcopy. NIEMALS rohe
      // Server-Codes (`BLOB_NOT_CONFIGURED`, `INTERNAL_ERROR`) im sichtbaren
      // Text. UX-Spec-Mapping siehe `ux-spec-iteration-14.md` §6.2.
      let message = 'Upload fehlgeschlagen. Bitte erneut versuchen.';
      if (err instanceof ApiClientError) {
        if (err.code === 'PAYLOAD_TOO_LARGE') {
          message = `Datei zu groß (max. ${humanSize(UPLOAD_MAX_IMAGE_BYTES)}).`;
        } else if (err.code === 'UNSUPPORTED_MEDIA_TYPE') {
          message =
            'Dieser Dateityp wird nicht unterstützt. Erlaubt: JPEG, PNG.';
        } else if (err.code === 'RATE_LIMITED') {
          message = 'Zu viele Uploads — bitte später erneut versuchen.';
        } else if (err.code === 'NETWORK_ERROR') {
          message =
            'Verbindung zum Bild-Speicher unterbrochen. Bitte erneut versuchen.';
        } else if (err.code === 'BLOB_NOT_CONFIGURED') {
          // Blob-Storage ist nicht konfiguriert — wir blenden die Sektion aus.
          setBlobUnavailable(true);
          setEntries([]);
          return;
        } else if (err.code === 'UNAUTHORIZED' || err.code === 'FORBIDDEN') {
          message = 'Upload-Sitzung abgelaufen. Bitte Datei erneut wählen.';
        } else if (err.code === 'VALIDATION_ERROR') {
          // Server-Magic-Bytes-Check / FILE_EMPTY etc.: Server-Message wird
          // bereits auf Deutsch geliefert. Falls leer → generischer Fallback.
          message = err.message || 'Datei wurde abgelehnt.';
        } else if (err.code === 'GONE' || err.subcode === 'UPLOAD_LEGACY') {
          message =
            'Bitte die Seite neu laden — der Upload-Pfad wurde aktualisiert.';
        }
        // Default-Fallback (z. B. INTERNAL_ERROR, unbekannte Codes): generische
        // deutsche Meldung. Wir geben die Server-Message NICHT durch, weil
        // sie englische Codes enthalten kann.
      }
      setEntries((prev) =>
        prev.map((e) =>
          e.localId === localId
            ? {
                ...e,
                status: 'error',
                progress: undefined,
                // KEIN ` (CODE)`-Suffix mehr (IT14-S08).
                error: message,
              }
            : e,
        ),
      );
    }
  }

  function removeEntry(localId: string) {
    setEntries((prev) => prev.filter((e) => e.localId !== localId));
  }

  /**
   * IT11 — Inline-Retry für gescheiterte Uploads. Nimmt einen Error-Entry und
   * setzt ihn zurück auf `pending`, dann zurück in die Upload-Queue.
   */
  function retryEntry(localId: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.localId === localId
          ? { ...e, status: 'pending', error: undefined, progress: undefined }
          : e,
      ),
    );
    const target = entries.find((e) => e.localId === localId);
    if (target) {
      enqueueForUpload(localId, target.file);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
  }

  function onPickerClick() {
    inputRef.current?.click();
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // Damit dasselbe Datei wieder gewählt werden kann
    e.target.value = '';
  }

  if (hideSection || blobUnavailable) {
    if (blobUnavailable) {
      return (
        <Banner tone="info" title="Datei-Anhänge derzeit nicht verfügbar">
          <p>
            Du kannst die Anfrage trotzdem ohne Anhang absenden. Tom wird sich
            zur Klärung mit dir in Verbindung setzen — alternativ kannst du uns
            Bilder oder Dokumente per E-Mail nachreichen.
          </p>
        </Banner>
      );
    }
    return null;
  }

  const reachedLimit = entries.length >= MAX_FILES;

  return (
    <section
      aria-labelledby={`${inputId}-heading`}
      className="rounded-lg border border-baerenstark-sand bg-baerenstark-cream/40 p-4"
    >
      <h3
        id={`${inputId}-heading`}
        className="mb-1 flex items-center gap-2 text-sm font-semibold text-baerenstark-bark"
      >
        <span aria-hidden="true">📎</span>
        Fotos / Dokumente hinzufügen (optional)
      </h3>
      <p className="mb-3 text-xs text-baerenstark-bark/70">
        Hilf Tom mit Bildern oder Dokumenten, dein Anliegen besser einzuschätzen.
      </p>

      {globalNotice && (
        <div className="mb-3">
          <Banner tone={globalNotice.tone} role="status">
            <div className="flex items-start justify-between gap-3">
              <span>{globalNotice.text}</span>
              <button
                type="button"
                onClick={() => setGlobalNotice(null)}
                aria-label="Hinweis schließen"
                className="text-xs underline-offset-2 hover:underline"
              >
                schließen
              </button>
            </div>
          </Banner>
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-label="Datei auswählen oder hierher ziehen"
        aria-disabled={reachedLimit || undefined}
        onClick={() => {
          if (!reachedLimit) onPickerClick();
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !reachedLimit) {
            e.preventDefault();
            onPickerClick();
          }
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={[
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent',
          reachedLimit
            ? 'cursor-not-allowed border-baerenstark-sand/50 bg-baerenstark-sand/10 text-baerenstark-bark/40'
            : dragOver
              ? 'cursor-pointer border-leaf bg-leaf/10 text-baerenstark-bark'
              : 'cursor-pointer border-baerenstark-sand bg-white/60 text-baerenstark-bark/80 hover:border-baerenstark-wood hover:bg-baerenstark-sand/30',
        ].join(' ')}
      >
        <span className="text-2xl" aria-hidden="true">
          {dragOver ? '⬇️' : '📁'}
        </span>
        <span className="font-medium">
          {reachedLimit
            ? `Maximum von ${MAX_FILES} Dateien erreicht`
            : 'Datei auswählen oder hierher ziehen'}
        </span>
        <span className="text-xs text-baerenstark-bark/60">{HINT_LINE}</span>
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        onChange={onInputChange}
        className="sr-only"
        disabled={reachedLimit}
        aria-hidden="true"
        tabIndex={-1}
      />

      {entries.length > 0 && (
        <ul role="list" className="mt-4 space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.localId}
              className={[
                'flex items-center gap-3 rounded-lg border bg-white/70 p-2 text-sm',
                entry.status === 'error'
                  ? 'border-red-300'
                  : 'border-baerenstark-sand',
              ].join(' ')}
            >
              <FilePreview file={entry.file} url={entry.url} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-baerenstark-bark">
                  {entry.file.name}
                </p>
                <p className="text-xs text-baerenstark-bark/60">
                  {humanSize(entry.file.size)}
                  {entry.status === 'uploading' &&
                    (typeof entry.progress === 'number'
                      ? ` · wird hochgeladen… ${entry.progress}%`
                      : ' · wird hochgeladen…')}
                  {entry.status === 'success' && ' · hochgeladen'}
                  {entry.status === 'pending' && ' · wartet…'}
                </p>
                {entry.status === 'error' && entry.error && (
                  <p
                    role="alert"
                    aria-live="polite"
                    className="mt-1 text-xs font-medium text-red-700"
                  >
                    {entry.error}
                  </p>
                )}
                {(entry.status === 'uploading' || entry.status === 'pending') && (
                  <div
                    className="mt-1 h-1 w-full overflow-hidden rounded bg-baerenstark-sand/40"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={
                      entry.status === 'uploading' && typeof entry.progress === 'number'
                        ? entry.progress
                        : undefined
                    }
                    aria-label={`Upload-Fortschritt für ${entry.file.name}`}
                  >
                    {/*
                      IT13-S05 — echter Progress-Wert aus
                      `@vercel/blob/client.put().onUploadProgress`. Solange
                      `pending` (in der Queue) zeigen wir nur einen schmalen
                      Indikator-Stub (1/6 Breite), kein animate-pulse.
                    */}
                    <div
                      className="h-full bg-leaf transition-[width] duration-200 ease-out"
                      style={{
                        width:
                          entry.status === 'uploading'
                            ? `${typeof entry.progress === 'number' ? entry.progress : 5}%`
                            : '16%',
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {entry.status === 'error' && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => retryEntry(entry.localId)}
                    aria-label={`Datei "${entry.file.name}" erneut hochladen`}
                  >
                    Erneut versuchen
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEntry(entry.localId)}
                  aria-label={`Datei "${entry.file.name}" entfernen`}
                >
                  Entfernen
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FilePreview({ file, url }: { file: File; url?: string }) {
  if (isImageType(file.type)) {
    // Wenn schon hochgeladen → Server-URL, sonst lokale ObjectURL
    return <ImageThumb file={file} serverUrl={url} />;
  }
  if (isVideoType(file.type)) {
    return (
      <span
        className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-baerenstark-sand/60 text-xl"
        aria-hidden="true"
      >
        🎬
      </span>
    );
  }
  if (file.type === 'application/pdf') {
    return (
      <span
        className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-baerenstark-sand/60 text-xl"
        aria-hidden="true"
      >
        📄
      </span>
    );
  }
  return (
    <span
      className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-baerenstark-sand/60 text-xl"
      aria-hidden="true"
    >
      📎
    </span>
  );
}

function ImageThumb({ file, serverUrl }: { file: File; serverUrl?: string }) {
  const [src, setSrc] = useState<string | null>(serverUrl ?? null);

  useEffect(() => {
    if (serverUrl) {
      setSrc(serverUrl);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, serverUrl]);

  if (!src) {
    return (
      <span
        className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-baerenstark-sand/60 text-xl"
        aria-hidden="true"
      >
        🖼️
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-12 w-12 flex-none rounded-md object-cover"
    />
  );
}
