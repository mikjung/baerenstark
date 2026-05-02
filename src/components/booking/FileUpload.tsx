'use client';

/**
 * US-18 — Datei-Upload mit Drag-and-Drop, Vorschau, Pro-Datei-Status.
 *
 * Verhalten:
 *   - Bis zu 5 Dateien parallel verwaltbar (UPLOAD_MAX_FILES_PER_BOOKING).
 *   - Jede Datei wird einzeln via POST /api/upload hochgeladen.
 *   - Status pro Datei: pending | uploading | success | error.
 *   - Bei BLOB_NOT_CONFIGURED-Antwort des Servers blendet die Komponente
 *     die Upload-Sektion aus und zeigt nur einen Hinweistext (keine Sperre
 *     der Buchung — Anhänge sind optional).
 *   - Bei 413 / 415 Inline-Fehler pro Datei.
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
  UPLOAD_MAX_FILE_BYTES,
  UPLOAD_MAX_FILES_PER_BOOKING,
} from '@/lib/schemas';

type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

interface UploadEntry {
  /** Lokale UUID — kein Server-Wert. */
  localId: string;
  file: File;
  status: UploadStatus;
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
const MAX_BYTES = UPLOAD_MAX_FILE_BYTES;
const MAX_FILES = UPLOAD_MAX_FILES_PER_BOOKING;

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

function clientSideValidate(file: File): string | null {
  if (file.size > MAX_BYTES) {
    return `Datei ist zu groß (max. ${humanSize(MAX_BYTES)}).`;
  }
  if (
    file.type &&
    !UPLOAD_ACCEPTED_CONTENT_TYPES.includes(file.type as (typeof UPLOAD_ACCEPTED_CONTENT_TYPES)[number])
  ) {
    return `Dateityp "${file.type || 'unbekannt'}" wird nicht unterstützt.`;
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
        const rejected: { file: File; reason: string }[] = [];

        for (const file of arr.slice(0, remaining)) {
          const validationError = clientSideValidate(file);
          if (validationError) {
            rejected.push({ file, reason: validationError });
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
            text: `Es können maximal ${MAX_FILES} Dateien hochgeladen werden — ${arr.length - remaining} Datei(en) wurden ignoriert.`,
          });
        }
        if (rejected.length > 0) {
          // Rejected werden als error-Einträge gezeigt, damit der User sieht, warum.
          for (const r of rejected) {
            accepted.push({
              localId: localIdFor(r.file),
              file: r.file,
              status: 'error',
              error: r.reason,
            });
          }
        }

        // Trigger Upload für alle akzeptierten Pending-Einträge nach State-Update.
        // Wir starten in einem Microtask, um den State-Update sicher abzuwarten.
        queueMicrotask(() => {
          for (const entry of accepted) {
            if (entry.status === 'pending') {
              void startUpload(entry.localId, entry.file);
            }
          }
        });

        return [...prev, ...accepted];
      });
    },
    [blobUnavailable],
  );

  async function startUpload(localId: string, file: File) {
    setEntries((prev) =>
      prev.map((e) => (e.localId === localId ? { ...e, status: 'uploading' } : e)),
    );
    try {
      const res = await uploadFile(file);
      setEntries((prev) =>
        prev.map((e) =>
          e.localId === localId
            ? {
                ...e,
                status: 'success',
                attachmentId: res.attachmentId,
                url: res.url,
              }
            : e,
        ),
      );
    } catch (err) {
      let message = 'Upload fehlgeschlagen.';
      let code: string | null = null;
      if (err instanceof ApiClientError) {
        code = err.code;
        if (err.code === 'PAYLOAD_TOO_LARGE') {
          message = `Datei ist zu groß (max. ${humanSize(MAX_BYTES)}).`;
        } else if (err.code === 'UNSUPPORTED_MEDIA_TYPE') {
          message = 'Dieser Dateityp wird nicht unterstützt.';
        } else if (err.code === 'RATE_LIMITED') {
          message = 'Zu viele Uploads — bitte später erneut versuchen.';
        } else if (err.code === 'NETWORK_ERROR') {
          message = 'Verbindungsfehler — bitte erneut versuchen.';
        } else if (err.code === 'BLOB_NOT_CONFIGURED') {
          // Blob-Storage ist nicht konfiguriert — wir blenden die Sektion aus.
          setBlobUnavailable(true);
          // Alle erfolgreichen Anhänge werden verworfen, da sie nicht persistiert werden können.
          setEntries([]);
          return;
        } else {
          message = err.message || message;
        }
      }
      setEntries((prev) =>
        prev.map((e) =>
          e.localId === localId
            ? { ...e, status: 'error', error: message + (code ? ` (${code})` : '') }
            : e,
        ),
      );
    }
  }

  function removeEntry(localId: string) {
    setEntries((prev) => prev.filter((e) => e.localId !== localId));
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
        <span className="text-xs text-baerenstark-bark/60">
          Erlaubte Formate: JPG, PNG, PDF, MP4 · Max. {MAX_FILES} Dateien, je {humanSize(MAX_BYTES)}
        </span>
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
                  {entry.status === 'uploading' && ' · wird hochgeladen…'}
                  {entry.status === 'success' && ' · hochgeladen'}
                  {entry.status === 'pending' && ' · in Warteschlange'}
                </p>
                {entry.status === 'error' && entry.error && (
                  <p role="alert" className="mt-1 text-xs font-medium text-red-700">
                    {entry.error}
                  </p>
                )}
                {(entry.status === 'uploading' || entry.status === 'pending') && (
                  <div
                    className="mt-1 h-1 w-full overflow-hidden rounded bg-baerenstark-sand/40"
                    aria-hidden="true"
                  >
                    <div
                      className={[
                        'h-full bg-leaf transition-all',
                        entry.status === 'uploading' ? 'animate-pulse w-3/4' : 'w-1/6',
                      ].join(' ')}
                    />
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeEntry(entry.localId)}
                aria-label={`Datei "${entry.file.name}" entfernen`}
              >
                Entfernen
              </Button>
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
