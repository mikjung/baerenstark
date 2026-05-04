'use client';

/**
 * MarketingEmailComposer — 6-Step-Wizard für die Marketing-E-Mail
 * (IT12-S15 + Phase-2-Revision).
 *
 * Steps (marketing-email-flow.md §3.2):
 *   1. Empfänger-Auswahl mit Service-Filter (Hard-Cap 50)
 *   2. Subject + Body (Plain-Text, char-Counter ≤ 5000)
 *   3. Pflicht-Footer-Vorschau (read-only)
 *   4. Test-Send-an-mich
 *   5. Sender-Confirm-Dialog mit UWG-Pflicht-Checkbox
 *   6. Sending + Result-Summary
 *
 * Auto-Save (Debounce 1.5s) → POST /api/admin/marketing/emails mit
 * status='draft'. Test-Send setzt einen vorhandenen Draft voraus.
 *
 * Phase-2-Revision: Hard-Cap 50 (synchroner Send, kein Polling),
 * Pflicht-Footer wird vom Backend automatisch angefügt — Frontend zeigt
 * ihn nur als read-only-Block in Step 3.
 *
 * Sprache: deutsch (Sie-Form).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import {
  ApiClientError,
  createMarketingEmail,
  fetchMarketingRecipients,
  type MarketingRecipient,
  sendMarketingEmail,
  testSendMarketingEmail,
} from '@/lib/api-client';
import { SERVICE_LIST, type Service } from '@/lib/services';

const HARD_CAP = 50;
const SUBJECT_MAX = 200;
const BODY_MAX = 5000;
const AUTO_SAVE_DEBOUNCE_MS = 1500;

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_TITLES: Record<Step, string> = {
  1: 'Empfänger prüfen',
  2: 'Nachricht verfassen',
  3: 'Pflicht-Footer prüfen',
  4: 'Test-Mail senden',
  5: 'Bestätigen & senden',
  6: 'Versand-Bericht',
};

interface SendResult {
  intendedRecipients: number;
  actualRecipients: number;
  successCount: number;
  failureCount: number;
  status: 'sent' | 'partial_failure' | 'failed';
  failedRecipients?: { email: string; errorMessage: string }[];
  /**
   * IT12-Bugfix BUG-001 — bei 422 INVALID_RECIPIENTS reicht das Backend
   * optional eine Liste der ausgeschlossenen Empfänger durch (z.B. wenn
   * der Bestandskunden-Status verloren ging oder Unsubscribe gesetzt
   * wurde). Wenn vorhanden, zeigt das Failure-Banner sie an.
   */
  excludedRecipients?: { customerId: string; reason: string }[];
}

export function MarketingEmailComposer() {
  // ----------- State -----------
  const [step, setStep] = useState<Step>(1);

  // Recipients
  const [recipients, setRecipients] = useState<MarketingRecipient[]>([]);
  const [recipientsTotal, setRecipientsTotal] = useState(0);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientsError, setRecipientsError] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState<Service[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dailyQuotaRemaining, setDailyQuotaRemaining] = useState<number | null>(null);

  // Compose
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Draft
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  // Test
  const [testState, setTestState] = useState<
    | { kind: 'idle' }
    | { kind: 'sending' }
    | { kind: 'sent'; sentTo: string }
    | { kind: 'failed'; message: string }
  >({ kind: 'idle' });

  // Confirm + Send
  const [compliantConfirmed, setCompliantConfirmed] = useState(false);
  const [sendState, setSendState] = useState<
    | { kind: 'idle' }
    | { kind: 'sending' }
    | { kind: 'done'; result: SendResult }
    | {
        kind: 'failed';
        message: string;
        excludedRecipients?: { customerId: string; reason: string }[];
      }
  >({ kind: 'idle' });

  // ----------- Recipients laden -----------
  const loadRecipients = async () => {
    setRecipientsLoading(true);
    setRecipientsError(null);
    try {
      const filterService =
        serviceFilter.length > 0 ? serviceFilter.join(',') : undefined;
      const res = await fetchMarketingRecipients({
        service: filterService,
        hasBooked: true,
        unsubscribed: false,
        search: searchQuery || undefined,
        limit: 200,
      });
      setRecipients(res.data);
      setRecipientsTotal(res.total);
      if (typeof res.dailyQuotaRemaining === 'number') {
        setDailyQuotaRemaining(res.dailyQuotaRemaining);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 404) {
          // TODO: backend not ready — Endpoint noch nicht deployed.
          setRecipientsError(
            'Empfänger-Endpoint ist noch nicht verfügbar. Bitte später erneut versuchen.',
          );
        } else {
          setRecipientsError(err.message);
        }
      } else {
        setRecipientsError(
          'Empfänger konnten nicht geladen werden. Bitte später erneut versuchen.',
        );
      }
    } finally {
      setRecipientsLoading(false);
    }
  };

  useEffect(() => {
    void loadRecipients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceFilter.join(','), searchQuery]);

  // ----------- Auto-Save Draft (Debounce) -----------
  // Wenn Subject/Body nicht leer, alle 1.5s nach letztem Edit Draft anlegen
  // (oder updaten, falls Backend das später unterstützt — aktuell legen
  // wir nur einmal an, danach kein Update). Der Test-Send-Button braucht
  // einen Draft-ID.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (subject.trim().length === 0 || body.trim().length === 0) return;
    if (selectedIds.size === 0 || selectedIds.size > HARD_CAP) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      // Nur einmaliges Anlegen — nach erstem Save bleiben wir auf der ID.
      // (Backend-Update-Endpoint nicht vorgesehen in IT12.)
      if (draftId) return;
      try {
        const res = await createMarketingEmail({
          subject: subject.trim(),
          body: body.trim(),
          recipientIds: Array.from(selectedIds),
          filterServices: serviceFilter,
          status: 'draft',
        });
        setDraftId(res.id);
        setDraftSavedAt(new Date());
        setDraftError(null);
      } catch (err) {
        if (err instanceof ApiClientError) {
          if (err.status === 404) {
            // TODO: backend not ready — Draft-Endpoint nicht verfügbar.
            setDraftError('Entwurf-Speichern noch nicht verfügbar.');
          } else {
            setDraftError(err.message);
          }
        } else {
          setDraftError('Entwurf konnte nicht gespeichert werden.');
        }
      }
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, body, selectedIds.size]);

  // ----------- Selection Helpers -----------
  const toggleRecipient = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= HARD_CAP) {
          // Hard-Cap: weiteren Klick blockieren
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    const next = new Set(selectedIds);
    for (const r of recipients) {
      if (r.unsubscribedAt) continue;
      if (next.size >= HARD_CAP) break;
      next.add(r.customerId);
    }
    setSelectedIds(next);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const overCap = selectedIds.size > HARD_CAP;
  const tooFew = selectedIds.size === 0;

  const canGoToStep2 = !overCap && !tooFew;
  const subjectValid = subject.trim().length > 0 && subject.length <= SUBJECT_MAX;
  const bodyValid = body.trim().length > 0 && body.length <= BODY_MAX;
  const canGoToStep3 = subjectValid && bodyValid;
  const canGoToStep5 = canGoToStep3;
  const canSend = canGoToStep5 && compliantConfirmed && !!draftId;

  // ----------- Test-Send -----------
  const handleTestSend = async () => {
    if (!draftId) return;
    setTestState({ kind: 'sending' });
    try {
      const res = await testSendMarketingEmail(draftId);
      setTestState({ kind: 'sent', sentTo: res.sentTo });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setTestState({
          kind: 'failed',
          message:
            err.status === 502
              ? 'E-Mail-Service ist gerade nicht erreichbar. Bitte später erneut versuchen.'
              : err.message,
        });
      } else {
        setTestState({
          kind: 'failed',
          message: 'Test-Versand fehlgeschlagen — bitte später erneut versuchen.',
        });
      }
    }
  };

  // ----------- Final Send -----------
  // IT12-Bugfix BUG-001: Send-Call sendet jetzt einen vollen Body
  // `{ recipientIds, subject, body }` (Backend erwartet das laut
  // SendBodySchema). Auch das deckt FIND-002 ab, weil der finale
  // Compose-Stand mitgesendet wird, falls Tom nach Auto-Save noch editiert.
  const handleConfirmSend = async () => {
    if (!draftId) return;
    setSendState({ kind: 'sending' });
    setStep(6);
    try {
      const res = await sendMarketingEmail(draftId, {
        recipientIds: Array.from(selectedIds),
        subject: subject.trim(),
        body: body.trim(),
      });
      setSendState({ kind: 'done', result: res });
    } catch (err) {
      if (err instanceof ApiClientError) {
        const subcode = err.subcode;
        let msg = err.message;
        let excludedRecipients:
          | { customerId: string; reason: string }[]
          | undefined;
        if (err.status === 413 || subcode === 'RECIPIENT_CAP_EXCEEDED') {
          msg =
            'Hard-Cap überschritten: max. 50 Empfänger pro Versand. Bitte Auswahl reduzieren.';
        } else if (err.status === 429 || subcode === 'DAILY_QUOTA_EXCEEDED') {
          msg = 'Tageskontingent überschritten. Bitte morgen erneut versuchen.';
        } else if (
          err.status === 422 ||
          subcode === 'INVALID_RECIPIENTS' ||
          subcode === 'NO_VALID_RECIPIENTS'
        ) {
          // Backend filtert auf Bestandskunden + nicht-unsubscribed.
          // Wenn alle/einige Empfänger inzwischen nicht mehr qualifizieren,
          // kommt 422 mit ausführlicher Fehlermeldung.
          msg =
            'Empfänger wurden ausgeschlossen, weil sie keine Bestandskunden mehr sind oder dem Erhalt widersprochen haben. Bitte die Empfänger-Auswahl erneut prüfen.';
          // err.detail ist nicht typisiert auf der ApiClientError-Klasse —
          // wir versuchen eine optionale `details`-Property zu lesen.
          const maybeList = (err as unknown as {
            details?: { excludedRecipients?: { customerId: string; reason: string }[] };
          }).details?.excludedRecipients;
          if (Array.isArray(maybeList)) {
            excludedRecipients = maybeList;
          }
        } else if (err.status === 502) {
          msg = 'E-Mail-Service nicht erreichbar. Bitte später erneut versuchen.';
        }
        setSendState({ kind: 'failed', message: msg, excludedRecipients });
      } else {
        setSendState({
          kind: 'failed',
          message: 'Versand fehlgeschlagen. Bitte später erneut versuchen.',
        });
      }
    }
  };

  // ----------- Render Helpers -----------
  const StepIndicator = useMemo(
    () => (
      <ol
        aria-label="Versand-Schritte"
        className="mb-6 flex flex-wrap gap-2 text-xs text-baerenstark-bark/70"
      >
        {([1, 2, 3, 4, 5, 6] as Step[]).map((s) => (
          <li
            key={s}
            aria-current={s === step ? 'step' : undefined}
            className={[
              'rounded-md px-2 py-1',
              s === step
                ? 'bg-baerenstark-wood text-baerenstark-cream font-semibold'
                : s < step
                  ? 'bg-baerenstark-cream text-baerenstark-bark'
                  : 'bg-baerenstark-sand/40',
            ].join(' ')}
          >
            {s}. {STEP_TITLES[s]}
          </li>
        ))}
      </ol>
    ),
    [step],
  );

  return (
    <section
      role="region"
      aria-labelledby="marketing-composer-title"
      className="rounded-2xl border border-baerenstark-sand bg-white/80 p-5 shadow-soft sm:p-7"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id="marketing-composer-title"
          className="font-serif text-2xl font-semibold text-baerenstark-bark"
        >
          Marketing-E-Mail versenden
        </h2>
        {dailyQuotaRemaining != null && (
          <p className="text-sm text-baerenstark-bark/70">
            Tageskontingent: {dailyQuotaRemaining} / 100 Mails verbleibend
          </p>
        )}
      </header>

      {StepIndicator}

      {step === 1 && (
        <Step1Recipients
          recipients={recipients}
          recipientsTotal={recipientsTotal}
          recipientsLoading={recipientsLoading}
          recipientsError={recipientsError}
          serviceFilter={serviceFilter}
          setServiceFilter={setServiceFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedIds={selectedIds}
          toggleRecipient={toggleRecipient}
          selectAllVisible={selectAllVisible}
          clearSelection={clearSelection}
          overCap={overCap}
          tooFew={tooFew}
          onContinue={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <Step2Compose
          subject={subject}
          setSubject={setSubject}
          body={body}
          setBody={setBody}
          draftSavedAt={draftSavedAt}
          draftError={draftError}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
          canContinue={canGoToStep3}
        />
      )}

      {step === 3 && (
        <Step3FooterPreview
          subject={subject}
          body={body}
          onBack={() => setStep(2)}
          onContinue={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <Step4TestSend
          testState={testState}
          draftId={draftId}
          handleTestSend={handleTestSend}
          onBack={() => setStep(3)}
          onContinue={() => setStep(5)}
        />
      )}

      {step === 5 && (
        <Step5Confirm
          recipientCount={selectedIds.size}
          subject={subject}
          compliantConfirmed={compliantConfirmed}
          setCompliantConfirmed={setCompliantConfirmed}
          canSend={canSend}
          draftId={draftId}
          onBack={() => setStep(4)}
          onConfirm={handleConfirmSend}
        />
      )}

      {step === 6 && <Step6Report sendState={sendState} />}
    </section>
  );
}

// ============================================================================
// Step 1
// ============================================================================

interface Step1Props {
  recipients: MarketingRecipient[];
  recipientsTotal: number;
  recipientsLoading: boolean;
  recipientsError: string | null;
  serviceFilter: Service[];
  setServiceFilter: (next: Service[]) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedIds: Set<string>;
  toggleRecipient: (id: string) => void;
  selectAllVisible: () => void;
  clearSelection: () => void;
  overCap: boolean;
  tooFew: boolean;
  onContinue: () => void;
}

function Step1Recipients({
  recipients,
  recipientsLoading,
  recipientsError,
  serviceFilter,
  setServiceFilter,
  searchQuery,
  setSearchQuery,
  selectedIds,
  toggleRecipient,
  selectAllVisible,
  clearSelection,
  overCap,
  tooFew,
  onContinue,
}: Step1Props) {
  const toggleService = (slug: Service) => {
    if (serviceFilter.includes(slug)) {
      setServiceFilter(serviceFilter.filter((s) => s !== slug));
    } else {
      setServiceFilter([...serviceFilter, slug]);
    }
  };

  return (
    <div>
      {overCap && (
        <Banner tone="warning" role="alert">
          <p className="font-semibold">
            Maximal 50 Empfänger pro Versand.
          </p>
          <p className="mt-1 text-sm">
            Bitte Selektion einschränken oder in mehreren Wellen senden. (Limit
            kommt von unserem aktuellen E-Mail-Anbieter und wird in einer
            kommenden Iteration erhöht.)
          </p>
        </Banner>
      )}

      <fieldset className="mt-4 rounded-lg border border-baerenstark-sand bg-baerenstark-cream/40 p-4">
        <legend className="px-1 text-sm font-medium text-baerenstark-bark">
          Nach Service filtern
        </legend>
        <div className="flex flex-wrap gap-2">
          {SERVICE_LIST.map((s) => (
            <button
              key={s.slug}
              type="button"
              aria-pressed={serviceFilter.includes(s.slug)}
              onClick={() => toggleService(s.slug)}
              className={[
                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                serviceFilter.includes(s.slug)
                  ? 'border-baerenstark-wood bg-baerenstark-wood text-baerenstark-cream'
                  : 'border-baerenstark-sand bg-white text-baerenstark-bark hover:bg-baerenstark-sand/40',
              ].join(' ')}
            >
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4">
        <Input
          label="Suche (Name oder E-Mail)"
          type="search"
          placeholder="z. B. Maria oder mustermann@…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-baerenstark-bark/80">
        <span>
          {selectedIds.size} ausgewählt {recipients.length > 0 && `· ${recipients.length} sichtbar`}
        </span>
        <button
          type="button"
          onClick={selectAllVisible}
          className="rounded-md border border-baerenstark-sand px-2 py-1 hover:bg-baerenstark-sand/40"
        >
          Alle (max 50) auswählen
        </button>
        <button
          type="button"
          onClick={clearSelection}
          className="rounded-md border border-baerenstark-sand px-2 py-1 hover:bg-baerenstark-sand/40"
        >
          Auswahl leeren
        </button>
      </div>

      {recipientsLoading && (
        <p className="mt-4 text-sm text-baerenstark-bark/70" role="status">
          Empfänger werden geladen …
        </p>
      )}

      {recipientsError && (
        <div className="mt-4">
          <Banner tone="error" role="alert">
            {recipientsError}
          </Banner>
        </div>
      )}

      {!recipientsLoading && !recipientsError && recipients.length === 0 && (
        <p className="mt-4 text-sm text-baerenstark-bark/70">
          Keine passenden Kunden gefunden. Bitte Filter anpassen.
        </p>
      )}

      {recipients.length > 0 && (
        <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-baerenstark-sand">
          <table className="w-full text-sm" role="table">
            <thead className="sticky top-0 bg-baerenstark-cream">
              <tr>
                <th scope="col" className="p-2 text-left">Auswahl</th>
                <th scope="col" className="p-2 text-left">Name</th>
                <th scope="col" className="p-2 text-left">E-Mail</th>
                <th scope="col" className="p-2 text-left">Genutzte Services</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => {
                const checked = selectedIds.has(r.customerId);
                const disabled = !!r.unsubscribedAt;
                return (
                  <tr
                    key={r.customerId}
                    className={[
                      'border-t border-baerenstark-sand/40',
                      disabled ? 'bg-baerenstark-sand/20' : '',
                    ].join(' ')}
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRecipient(r.customerId)}
                        disabled={disabled}
                        aria-label={`${r.firstName} ${r.lastName} auswählen`}
                        aria-disabled={disabled || undefined}
                        className="h-4 w-4 cursor-pointer accent-baerenstark-wood disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="p-2 text-baerenstark-bark">
                      {r.firstName} {r.lastName}
                    </td>
                    <td className="p-2 text-baerenstark-bark/80">
                      {r.email}
                      {disabled && (
                        <span className="ml-2 rounded bg-baerenstark-sand/60 px-1.5 py-0.5 text-xs text-baerenstark-bark/60">
                          Abgemeldet
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-xs text-baerenstark-bark/70">
                      {r.bookedServices.join(', ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          onClick={onContinue}
          disabled={tooFew || overCap}
        >
          Weiter →
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 2
// ============================================================================

interface Step2Props {
  subject: string;
  setSubject: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
  draftSavedAt: Date | null;
  draftError: string | null;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
}

function Step2Compose({
  subject,
  setSubject,
  body,
  setBody,
  draftSavedAt,
  draftError,
  onBack,
  onContinue,
  canContinue,
}: Step2Props) {
  return (
    <div>
      <Input
        label="Betreff"
        required
        maxLength={SUBJECT_MAX}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="z. B. Frühjahrs-Aktion Grünfläche"
      />
      <p className="-mt-2 text-xs text-baerenstark-bark/60">
        {subject.length} / {SUBJECT_MAX} Zeichen
      </p>

      <div className="mt-4">
        <Textarea
          label="Nachricht"
          required
          rows={10}
          maxLength={BODY_MAX}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Schreiben Sie hier den Hauptinhalt — Anrede und Signatur werden automatisch ergänzt."
          hint="Plain-Text. Anrede mit Vornamen und Signatur werden vom System hinzugefügt."
        />
        <p
          aria-live="polite"
          className="-mt-1 text-xs text-baerenstark-bark/60"
        >
          {body.length} / {BODY_MAX} Zeichen
        </p>
      </div>

      {draftError && (
        <div className="mt-3">
          <Banner tone="warning">{draftError}</Banner>
        </div>
      )}

      {draftSavedAt && !draftError && (
        <p
          aria-live="polite"
          className="mt-2 text-xs text-baerenstark-bark/60"
        >
          ✓ Entwurf gespeichert ({draftSavedAt.toLocaleTimeString('de-DE')})
        </p>
      )}

      <div className="mt-6 flex justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          ← Zurück
        </Button>
        <Button type="button" onClick={onContinue} disabled={!canContinue}>
          Weiter →
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 3 — Pflicht-Footer-Vorschau (DSGVO/UWG)
// ============================================================================

function Step3FooterPreview({
  subject,
  body,
  onBack,
  onContinue,
}: {
  subject: string;
  body: string;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div>
      <p className="mb-3 text-sm text-baerenstark-bark/80">
        So sieht Ihre E-Mail für Empfänger aus. Der Pflicht-Footer mit
        Abmelde-Link wird vom System automatisch angefügt — Sie können ihn
        nicht bearbeiten.
      </p>

      <article
        aria-label="E-Mail-Vorschau"
        className="rounded-lg border border-baerenstark-sand bg-baerenstark-cream/40 p-4 text-sm"
      >
        <p className="text-baerenstark-bark/70">
          <strong>Betreff:</strong> {subject || '—'}
        </p>
        <hr className="my-3 border-baerenstark-sand" />
        <p className="text-baerenstark-bark">Hallo {`{Vorname}`},</p>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-baerenstark-bark">
          {body || '—'}
        </pre>
        <p className="mt-3 text-baerenstark-bark">
          Ihr Bärenstark-Team
          <br />
          Tom Siefert
        </p>

        {/* Pflicht-Footer (read-only) */}
        <div
          role="note"
          aria-label="Pflicht-Footer wird automatisch angefügt"
          className="mt-5 select-none rounded-md border-l-4 border-baerenstark-bark/30 bg-baerenstark-sand/15 px-4 py-3 text-xs text-baerenstark-bark/70"
        >
          <div className="mb-1 flex items-center gap-1 font-semibold">
            <span aria-hidden="true">🔒</span>
            Pflicht-Footer (wird automatisch angefügt — UWG §7)
          </div>
          <p>
            Sie erhalten diese E-Mail, weil Sie bereits Kunde bei Bärenstark
            Hausservice waren. Sie können dem Erhalt weiterer Werbe-E-Mails
            jederzeit widersprechen: [Hier abmelden] (Link wird pro Empfänger
            generiert). Impressum: /impressum
          </p>
        </div>
      </article>

      <div className="mt-6 flex justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          ← Zurück
        </Button>
        <Button type="button" onClick={onContinue}>
          Weiter →
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 4 — Test-Send
// ============================================================================

interface Step4Props {
  testState:
    | { kind: 'idle' }
    | { kind: 'sending' }
    | { kind: 'sent'; sentTo: string }
    | { kind: 'failed'; message: string };
  draftId: string | null;
  handleTestSend: () => void;
  onBack: () => void;
  onContinue: () => void;
}

function Step4TestSend({
  testState,
  draftId,
  handleTestSend,
  onBack,
  onContinue,
}: Step4Props) {
  return (
    <div>
      <p className="mb-3 text-sm text-baerenstark-bark/80">
        Senden Sie sich die Mail zur Probe an Ihre Admin-Adresse — so sehen
        Sie sie genauso, wie Empfänger sie erhalten (inklusive Pflicht-Footer).
      </p>

      {!draftId && (
        <Banner tone="info">
          Entwurf wird automatisch gespeichert, sobald Empfänger, Betreff und
          Nachricht ausgefüllt sind. Danach ist der Test-Versand möglich.
        </Banner>
      )}

      <div className="mt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={handleTestSend}
          disabled={!draftId || testState.kind === 'sending'}
          isLoading={testState.kind === 'sending'}
        >
          Test an mich senden
        </Button>
      </div>

      {testState.kind === 'sent' && (
        <div className="mt-3">
          <Banner tone="success" role="status">
            Test-Mail an {testState.sentTo} versandt.
          </Banner>
        </div>
      )}
      {testState.kind === 'failed' && (
        <div className="mt-3">
          <Banner tone="error" role="alert">
            {testState.message}
          </Banner>
        </div>
      )}

      <div className="mt-6 flex justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          ← Zurück
        </Button>
        <Button type="button" onClick={onContinue}>
          Weiter →
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 5 — Confirm
// ============================================================================

interface Step5Props {
  recipientCount: number;
  subject: string;
  compliantConfirmed: boolean;
  setCompliantConfirmed: (v: boolean) => void;
  canSend: boolean;
  draftId: string | null;
  onBack: () => void;
  onConfirm: () => void;
}

function Step5Confirm({
  recipientCount,
  subject,
  compliantConfirmed,
  setCompliantConfirmed,
  canSend,
  draftId,
  onBack,
  onConfirm,
}: Step5Props) {
  return (
    <div role="alertdialog" aria-labelledby="confirm-title">
      <h3
        id="confirm-title"
        className="mb-3 font-serif text-xl font-semibold text-baerenstark-bark"
      >
        Sie werden eine Werbe-E-Mail an {recipientCount} Empfänger senden.
      </h3>
      <p className="mb-2 text-sm text-baerenstark-bark/85">
        Bitte bestätigen Sie, dass diese Empfänger Bestandskunden sind und
        nicht widersprochen haben.
      </p>
      <p className="mb-4 text-xs text-baerenstark-bark/70">
        Betreff: „{subject || '—'}". Diese Aktion kann nicht rückgängig
        gemacht werden.
      </p>

      <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-md border border-baerenstark-sand bg-baerenstark-sand/20 px-3 py-2 text-sm text-baerenstark-bark">
        <input
          type="checkbox"
          checked={compliantConfirmed}
          onChange={(e) => setCompliantConfirmed(e.target.checked)}
          required
          aria-required="true"
          className="mt-0.5 h-4 w-4 cursor-pointer accent-baerenstark-wood"
        />
        <span>
          Ich bestätige, dass alle ausgewählten Empfänger Bestandskunden im
          Sinne von § 7 UWG sind.
        </span>
      </label>

      {!draftId && (
        <Banner tone="warning">
          Entwurf wird gerade gespeichert — bitte einen Moment, dann erneut
          versuchen.
        </Banner>
      )}

      <div className="mt-6 flex justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onBack} autoFocus>
          Abbrechen
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={!canSend}
          aria-disabled={!canSend || undefined}
        >
          Senden
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 6 — Report
// ============================================================================

function Step6Report({
  sendState,
}: {
  sendState:
    | { kind: 'idle' }
    | { kind: 'sending' }
    | { kind: 'done'; result: SendResult }
    | {
        kind: 'failed';
        message: string;
        excludedRecipients?: { customerId: string; reason: string }[];
      };
}) {
  if (sendState.kind === 'sending') {
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-3">
        <span className="spinner h-5 w-5" aria-hidden="true" />
        <p className="text-baerenstark-bark/80">E-Mails werden versandt …</p>
      </div>
    );
  }

  if (sendState.kind === 'failed') {
    const excluded = sendState.excludedRecipients ?? [];
    return (
      <div>
        <Banner tone="error" role="alert" title="Versand fehlgeschlagen">
          <p>{sendState.message}</p>
        </Banner>
        {excluded.length > 0 && (
          <div className="mt-4 rounded-lg border border-baerenstark-sand bg-baerenstark-sand/20 p-4">
            <h4 className="mb-2 text-sm font-semibold text-baerenstark-bark">
              Ausgeschlossene Empfänger:
            </h4>
            <ul role="list" className="space-y-1 text-xs text-baerenstark-bark/80">
              {excluded.map((r) => (
                <li key={r.customerId}>
                  <span className="font-mono">{r.customerId}</span> — {r.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (sendState.kind === 'done') {
    const r = sendState.result;
    const tone =
      r.status === 'sent'
        ? 'success'
        : r.status === 'partial_failure'
          ? 'warning'
          : 'error';
    const headline =
      r.status === 'sent'
        ? `Alle ${r.successCount} E-Mails erfolgreich versandt`
        : r.status === 'partial_failure'
          ? `Versand abgeschlossen — ${r.failureCount} fehlgeschlagen`
          : 'Versand fehlgeschlagen';
    return (
      <div>
        <Banner
          tone={tone as 'success' | 'warning' | 'error'}
          role={r.status === 'sent' ? 'status' : 'alert'}
          title={headline}
        >
          <p>
            {r.successCount} erfolgreich · {r.failureCount} fehlgeschlagen ·
            insgesamt {r.intendedRecipients} Empfänger ausgewählt
            {r.actualRecipients !== r.intendedRecipients && (
              <> · {r.actualRecipients} tatsächlich angeschrieben</>
            )}
            .
          </p>
        </Banner>
        {r.failedRecipients && r.failedRecipients.length > 0 && (
          <div className="mt-4 rounded-lg border border-baerenstark-sand bg-baerenstark-sand/20 p-4">
            <h4 className="mb-2 text-sm font-semibold text-baerenstark-bark">
              Nicht zugestellt:
            </h4>
            <ul role="list" className="space-y-1 text-xs text-baerenstark-bark/80">
              {r.failedRecipients.map((f) => (
                <li key={f.email}>
                  <span className="font-mono">{f.email}</span> — {f.errorMessage}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-6">
          <Button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') window.location.reload();
            }}
          >
            Weitere E-Mail senden
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
