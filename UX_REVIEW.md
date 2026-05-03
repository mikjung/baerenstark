# UX/UI-Review — Bärenstark Hausservice

**Datum:** 2026-05-03
**Reviewer:** UX/UI-Senior (Heuristik-Review, Code-basiert, ohne Live-Klick-Test)
**Scope:** Public-Flow (Landing → Buchung), Kunden-Bereich (`/konto`), Admin-Bereich (`/admin/**`), Querschnitt (Designsystem, A11y, Mobile)
**Methode:** Quellcode-Sichtung + Nielsen-Heuristiken + projektspezifische Achsen (Conversion, Admin-Effizienz, Accessibility)

---

## Executive Summary

Die App ist solide gebaut: konsistente Token-Palette (`baerenstark-*` in `tailwind.config.ts`), durchgehend deutsche UI-Sprache, gute A11y-Grundlagen (`<label htmlFor>`, `aria-invalid`, `aria-describedby`, `role="radio"` an Slot-Kacheln, Skip-Link in `layout.tsx:50`) und ein klarer markenkonformer Look (Holz/Beige). Was die Conversion bremst: Der **Buchungs-Flow ist 4 Stufen lang und die Umschalter zwischen den Stufen sind statisch nummeriert** ("1. Wähle einen Tag" … "4. Deine Kontaktdaten" in `BookingClient.tsx`) — kein Stepper, kein Fortschritt, keine Übersicht, was als Nächstes kommt. Das Adress-Pflichtfeld kommt erst im Form-Schritt zum Vorschein und kann eingeloggte Kunden ohne Profil-Adresse überraschen. Im **Admin** sieht das Dashboard wie ein Engineer-Tool aus: oben Schnell-Links, darunter die "Bevorstehenden Termine", darunter wieder ein Tab-Set mit denselben Themen — Tom muss zwei Navigations-Logiken im Kopf haben. Die **drei wichtigsten Punkte**: (1) Buchungs-Flow als sichtbarer Stepper mit Conversion-Vertrauenssignalen oberhalb des Kalenders, (2) Admin-Dashboard auf eine flache Action-zentrierte IA umbauen (statt Tabs+Quick-Links parallel), (3) Designsystem-Tokens für Status-Banner und Buttons konsolidieren — aktuell mischen sich `baerenstark-*`, `red-700`, `amber-50`, `leaf` ohne klare Regel.

---

## Top 5 — Quick Wins (P0/P1, kleine Änderungen, große Wirkung)

### QW-1: Conversion-Vertrauenssignale oberhalb des Buchungs-Kalenders ergänzen
- **Was:** Auf `/buchung` direkt unter der H1 eine kompakte Vertrauensleiste einfügen: Sterne-Schnitt + Anzahl Bewertungen, "Persönlich von Tom Siefert", "Keine versteckten Kosten — Endpreis nach Besichtigung", direkter Anruf-CTA. Aktuell steht dort nur ein einleitender Satz (`src/app/buchung/page.tsx:19-31`) — die soziale Validierung von der Landing wird im Buchungs-Flow nicht wiederholt.
- **Warum (Heuristik):** #8 Ästhetik/Marke + projektspezifisch *Conversion-Pfad*. Erste Buchungs-Versuche brechen häufig im Kalender ab, weil dort jegliche Vertrauenssignale fehlen.
- **Wo:** `src/app/buchung/page.tsx`, kleine neue Komponente `BookingTrustBar.tsx` mit Daten aus `lib/reviews.ts` (REVIEWS_AVERAGE, REVIEWS_COUNT existiert bereits).
- **Aufwand:** S
- **Wirkung:** Erwartet 5–15 % weniger Drop-off zwischen `/buchung` und Slot-Auswahl.

### QW-2: Adress-Hinweis bei eingeloggten Kunden ohne Adresse VOR dem Kalender, nicht erst im Form
- **Was:** Der `showProfileAddressHint`-Banner erscheint aktuell erst ganz unten im `BookingForm` (`BookingForm.tsx:475-491`), nachdem der Kunde Tag, Dauer und Slot gewählt hat. Wenn die Adresse fehlt, ist das ein Frustmoment kurz vor Abschluss. Der Hinweis gehört nach oben — am besten als gelber Banner direkt unter der H1 von `BookingClient.tsx`, zusammen mit einem direkten "Adresse jetzt ergänzen"-Link.
- **Warum (Heuristik):** #5 Fehlervermeidung, #1 Sichtbarkeit Systemstatus. Die Adresse ist im Buchungs-Schema Pflicht — Kunde sollte das vor der Slot-Auswahl wissen.
- **Wo:** `src/app/buchung/BookingClient.tsx` (oberhalb von `<section aria-labelledby="calendar-heading">`).
- **Aufwand:** S
- **Wirkung:** Eliminiert eine ganze Klasse von "Fast-Buchungen" die im letzten Schritt scheitern.

### QW-3: Admin-Dashboard — doppelte Navigation entwirren
- **Was:** `AdminDashboard.tsx` zeigt oben fünf `QuickLink`-Buttons (Kalender, Admins, Nutzer, Analytics, Bewertungen, `:66-71`) und darunter ein `role="tablist"` mit vier Tabs (Buchungsanfragen, Zeitfenster, Verfügbarkeit, Bewertungen, `:75-96`). "Bewertungen" taucht doppelt auf. Die Quick-Links wirken wie eine zweite Top-Nav, sind aber visuell schwächer (graue Buttons). Konsolidieren: Eine einzige horizontale Sektions-Navigation oben (Sticky), die alle Bereiche auflistet — Tabs als Sub-Navigation nur dort wo Inhalte wirklich verwandt sind (z.B. innerhalb "Buchungen" als Status-Filter, der existiert bereits in `BookingTable.tsx:202`).
- **Warum (Heuristik):** #4 Konsistenz, #6 Erkennen statt Erinnern, projektspezifisch *Admin-Effizienz*.
- **Wo:** `src/components/admin/AdminDashboard.tsx`.
- **Aufwand:** S–M
- **Wirkung:** Tom findet alle Funktionen über genau eine Liste; reduziert Klick-Pfade um 1–2 Klicks pro Wechsel.

### QW-4: Status-Banner auf Designsystem-Tokens umstellen (nicht generisches `red-700`/`amber-50`)
- **Was:** `Banner.tsx` mappt Tones auf Tailwind-Default-Farben (`bg-red-50 border-red-400 text-red-900` etc., `:5-10`). Der Rest des Designs nutzt `baerenstark-*`-Tokens. In `Button.tsx:20` wird die danger-Variante über `bg-red-700` gelöst, in `Input.tsx:71` Errors via `border-red-500`. Es gibt aktuell keine semantischen Tokens (`destructive`, `warning`, `success`) im `tailwind.config.ts`. Eintragen: `error: '#B23A3A'`, `warning: '#C8801A'`, `success: '#3F7A4D'`, `info: '#3D6B8C'` in markenkonformen Sättigungen, dann im Banner und in Input/Button referenzieren.
- **Warum (Heuristik):** #4 Konsistenz, #8 Marke. Das aktuelle Mischsystem wirkt nicht "Bärenstark".
- **Wo:** `tailwind.config.ts`, `src/components/ui/Banner.tsx`, `src/components/ui/Button.tsx`, `src/components/ui/Input.tsx`.
- **Aufwand:** S
- **Wirkung:** Ein konsistenter Look, weniger Cognitive Dissonance zwischen Marken-Header und Fehler-Banner.

### QW-5: Telefonnummer in der Mobile-Hauptnavigation sichtbar machen
- **Was:** Im `Header.tsx:35` ist der `tel:`-Link hinter `hidden ... lg:inline-flex` — auf Mobile (Toms Hauptzielgruppe Darmstädter Älterer!) ist die Nummer nur über das Hero (`Hero.tsx:34`) oder im Footer erreichbar. Auf einer Service-Seite, auf `/buchung` oder `/konto` muss man zum Footer scrollen. Stattdessen: Dezenter Telefon-Icon-Button im Mobile-Header (44×44 Tap-Target), der `tel:` öffnet — keine Nummer, nur Icon, spart Platz.
- **Warum (Heuristik):** #2 Match zur realen Welt (ältere Kunden rufen lieber an), #7 Effizienz/Mobile-First.
- **Wo:** `src/components/layout/Header.tsx`.
- **Aufwand:** S
- **Wirkung:** Klare, konstant erreichbare Conversion-Alternative für telefon-affine Kunden.

---

## Top 5 — Strategische Verbesserungen (P1/P2, größerer Umbau, hoher Impact)

### SV-1: Buchungs-Flow als Stepper mit Inline-Zusammenfassung umbauen
- **Was:** Aktuell sind die vier Sektionen ("1. Tag", "2. Dauer", "3. Zeitfenster", "4. Daten") gleichzeitig sichtbar und nur per Smooth-Scroll verbunden (`BookingClient.tsx:196-221`). Auf Mobile ist das eine sehr lange Seite mit ungeführter Reise. Einbauen: Sticky-Stepper oben (Tag → Dauer → Slot → Daten), dazu ein kompaktes "Deine Auswahl"-Pill oben, das den aktuellen Zustand anzeigt ("Mo 12. Mai · 2 Stunden · 09:00–11:00"). Vor jeder Sektion Pfeil-Cues "Weiter zu Schritt X". Sektionen, die noch nicht relevant sind, werden eingeklappt (Disclosure).
- **Warum (Heuristik):** #1 Systemstatus, #6 Erkennen statt Erinnern, *Conversion*.
- **Wo:** `src/app/buchung/BookingClient.tsx`, neue `components/booking/BookingStepper.tsx`.
- **Aufwand:** M
- **Wirkung:** Drop-off zwischen Slot-Auswahl und Form-Submit reduziert sich messbar; Mobile-Reise wird greifbar.

### SV-2: Admin-Dashboard als rollenzentrierte "Was muss ich heute tun?"-Ansicht
- **Was:** Aktueller Aufbau ist datenzentriert (Tabelle aller Buchungen, Tabelle aller Slots …). Tom-zentrierte Sicht: Oben "Heute zu erledigen" (offene Anfragen, fällige Bestätigungen, Zahlungs-Erinnerungen), darunter "Diese Woche" (kommende Termine wie bisher), Sekundär-Bereiche per Sub-Nav. `UpcomingBookingsList.tsx` ist gut, aber es fehlt die "Action-Inbox" — die `BookingTable` ist im Tab versteckt. Auch fehlt eine optische Markierung, *welche* Buchungen Aktion brauchen (z.B. neue Anfrage > 24 h ohne Reaktion → roter Indikator).
- **Warum (Heuristik):** #6 Erkennen statt Erinnern, *Admin-Effizienz*.
- **Wo:** `src/components/admin/AdminDashboard.tsx`, `UpcomingBookingsList.tsx`, evtl. neue `AdminInbox.tsx`.
- **Aufwand:** M–L
- **Wirkung:** Tom landet auf `/admin` und weiß sofort, was zu tun ist — keine Suche durch Tabs.

### SV-3: Buchungs-Karten in Admin reduzieren — primäre Aktion herausstellen
- **Was:** Eine Buchungskarte in `BookingTable.tsx:258-535` zeigt parallel: Status-Badges, Mail-Status, Slot-gelöscht-Status, finalen Preis-Editor, Payment-Editor, FinalPriceEditor, bis zu vier Action-Buttons (Mail erneut, Gegenvorschlag, Bestätigen, Ablehnen) und einen Counter-Proposal-Block. Das ist visuell überladen — Tom muss bei jeder Karte mental scannen, was relevant ist. Strategie: Karte komprimieren (Name, Datum, Service, ein Status-Badge), primäre Action (z.B. "Bestätigen" für PENDING) als großer Button oben rechts, Sekundäres in einem "..."-Menü oder im Detail-Drawer (`UserDetailDrawer.tsx`-Pattern wiederverwenden).
- **Warum (Heuristik):** #4 Konsistenz, #6 Erkennen, *Admin-Effizienz*.
- **Wo:** `src/components/admin/BookingTable.tsx`, `PaymentEditor.tsx`, `FinalPriceEditor.tsx`.
- **Aufwand:** M
- **Wirkung:** Schnellere Entscheidungen, weniger Fehlklicks (z.B. "Ablehnen" statt "Bestätigen").

### SV-4: Designsystem-Konsolidierung — Component-Library statt Ad-hoc-Klassen
- **Was:** Es existieren `Button`, `Input`, `Banner`, `Badge`, `Card`, `ConfirmDialog`, `Skeleton` in `components/ui/` — aber viele Seiten bauen Buttons inline mit eigenen Tailwind-Klassen, z.B. der "Anrufen"-Button in `Hero.tsx:33-39`, der "Termin buchen"-Link im `Header.tsx:28-33`, die "Jetzt bezahlen"-Link in `CustomerBookingCard.tsx:215-220`, die OAuth-Buttons in `LoginForm.tsx:209-238` (Facebook nutzt `bg-[#1877F2]` direkt, nicht über die Button-Component). Ergebnis: drei verschiedene Höhen, drei Hover-States. Einbauen: `<Button as="a" href="…">`-Polymorphie + IconButton + AnchorButton-Variante; alle Inline-Implementations migrieren.
- **Warum (Heuristik):** #4 Konsistenz, #8 Marke.
- **Wo:** `src/components/ui/Button.tsx` (erweitern), Verbraucher-Komponenten migrieren.
- **Aufwand:** M
- **Wirkung:** Visuelle Kohärenz, leichteres Refactoring späterer Theme-Änderungen.

### SV-5: Mobile-Tap-Targets systematisch auf 44 px hochziehen + Touch-Spacing
- **Was:** `Button` size="sm" liefert `px-3 py-1.5 text-sm` (`Button.tsx:24`) — vertikal sind das ~32 px, unter dem Apple-/WCAG-Floor von 44 px. Wird aber häufig genutzt: in `BookingTable` Action-Buttons, in `SlotTable` Lösch-Button, im `CustomerBookingCard` "Stornieren". `min-h-[44px]` taucht bisher nur in `AdminDashboard.tsx:112` (QuickLink) und einer weiteren Stelle auf — ist nicht systemisch. Außerdem: Slot-Kacheln in `TimeSlotPicker.tsx:202-211` (`px-3 py-3`) sind ok, aber liegen in einem 2-Spalten-Grid mit `gap-2` — Daumen können die falsche Kachel treffen.
- **Warum (Heuristik):** #7 Effizienz/Mobile-First, A11y (WCAG 2.5.5).
- **Wo:** `src/components/ui/Button.tsx`, `src/components/booking/TimeSlotPicker.tsx` (gap erhöhen), querschnittlich.
- **Aufwand:** M
- **Wirkung:** Weniger Mis-Taps auf Mobile, weniger Daumen-Verspannung.

---

## Findings nach Bereich

### Public-Flow (Landing → Buchung)

- **[Major]** `BookingClient.tsx:267-414` — Der Flow scrollt nach jeder Auswahl programmatisch zur nächsten Sektion (`scrollIntoView`). Auf Mobile mit Sticky-Header (`Header.tsx:8`) wird die nächste Section-H2 vom Header verdeckt — Kunde landet im Inhalt ohne Kontext, was zu tun ist. Fix: scroll-margin-top oder Stepper-Pattern (siehe SV-1).
- **[Major]** `BookingClient.tsx:265` — Wenn `defaultService` per `?service=`-Query gesetzt ist, erscheint ein Banner "Service vorausgewählt — du kannst ihn unten jederzeit ändern." Im langen Flow vergisst der Kunde den Banner; das Service-Feld liegt in Sektion 4. Besser: Service-Pill in der Stepper-Zusammenfassung ständig sichtbar.
- **[Major]** `BookingForm.tsx:172-194` — Erfolgsmeldung "Deine Anfrage wurde erfolgreich übermittelt!" ersetzt das Form, aber die anderen Sektionen (Kalender, Dauer, Slot) bleiben oben mit der vorherigen Auswahl gefüllt. Visuell wirkt die Buchung als "halb fertig". Besser: Nach Erfolg auf eine eigene `/buchung/bestaetigt`-Seite leiten (existiert bereits!) und mit großem Vertrauenssignal + Tom-Foto + "Was passiert als Nächstes?" abschließen.
- **[Minor]** `Hero.tsx:38` und mehrere Stellen — Emoji als Icon (`📞`). Ältere Darmstädter Kunden sehen Emojis je nach Gerät unterschiedlich (Win 10 alte Emojis sehen schmalbrüstig aus). SVG-Icons (z.B. via `lucide-react`) sind robuster und marken-tauglicher.
- **[Minor]** `BookingCalendar.tsx:243-264` — Legende unter dem Kalender ist informativ, aber sehr klein (`text-xs text-baerenstark-bark/80`) und farblich wenig kontrastreich (Grau auf Cream). Bei Sonnenlicht auf Smartphone schwer lesbar. Kontrast hochziehen, Legende oberhalb (vor dem Kalender) — sonst sehen Kunden den ersten Tag nicht und wissen nicht, was die Farben bedeuten.
- **[Minor]** `TimeSlotPicker.tsx:202-209` — Selektierter Slot ist `bg-leaf` (grün) statt einer Marken-Farbe wie `baerenstark-wood`. Ein eigener "selected"-Akzent passt besser zum Holz-/Beige-Theme; Grün signalisiert "verfügbar", nicht "ausgewählt" — die beiden Bedeutungen kollidieren.
- **[Minor]** `DurationPicker.tsx:53-55` — Preisrange `priceFrom * hours` bis `priceFrom * hours * 2` ist sehr breit (Faktor 2 Schwankung). Für Kunden ist "ca. 60–120 €" weniger hilfreich als "ab 60 €, nach Besichtigung individuell". Range-Logik wirkt willkürlich; Anker-Preis "ab X €" ist klarer.
- **[Minor]** `ServiceGrid.tsx:36-80` — Service-Karten sind komplett klickbar (Detail-Modal), aber das Modal ist die einzige Conversion-Geste. Kunden, die direkt buchen wollen, müssen erst Modal öffnen, lesen, schließen, dann zum Header-Button navigieren. Karten sollten zwei sichtbare CTAs haben: "Mehr erfahren" + "Direkt buchen mit diesem Service".
- **[Minor]** `BookingForm.tsx:594-611` — Der "Zurücksetzen"-Ghost-Button steht visuell auf Augenhöhe mit "Anfrage absenden". Mobile-User können versehentlich zurücksetzen und alle eingegebenen Daten verlieren. "Zurücksetzen" entweder als kleines Text-Link oben oder mit Confirm-Dialog absichern.

### Kunden-Bereich (`/konto`)

- **[Major]** `RegisterForm.tsx:304-344` — Adress-Section ist als `<fieldset>` nett strukturiert, aber das "optional"-Label und der Hinweis "Wird für Terminbuchungen benötigt — du kannst sie auch später im Profil ergänzen" sind widersprüchlich: optional, aber für Buchungen Pflicht. Die meisten Kunden registrieren sich ja gerade *um* zu buchen. Klarere Sprache: "Empfohlen — bei der Buchung sowieso nötig" mit aktivem Toggle "Adresse jetzt eintragen (spart dir Zeit beim Buchen)".
- **[Major]** `LoginForm.tsx:208-238` — Die OAuth-Buttons unter dem Form sind Hauptpfade laut PROJECT.md (Tom-O-Auth-Stories). Aktuell kommt das E-Mail-Form zuerst und die OAuth-Buttons darunter. Wenn OAuth in Produktion noch nicht stabil ist (siehe US-IT9-04), ist das ok — sobald OAuth grün, sollten die Provider-Buttons nach oben rutschen oder zumindest gleich prominent sein. Aktuell impliziert die Reihenfolge "Email-Login ist primär" — das widerspricht dem Setup-Ziel.
- **[Minor]** `CustomerDashboard.tsx:234-254` — Empty-State ist freundlich, aber das Emoji `📋` ist unmarkiert. Ein Bär-Icon oder eine Holz-Illustration würde Marke transportieren.
- **[Minor]** `CustomerBookingCard.tsx:204-211` — Wenn 24-h-Frist überschritten ist, erscheint nur ein Mini-Text ("Stornierung nur bis 24 Stunden vor dem Termin möglich…"). Der Telefonnummer-Link ist Plain-Text (`0157-74787512`), nicht klickbar — sollte `tel:`-Link sein. Außerdem wäre ein Button "Anrufen, um zu stornieren" stärker als ein Hinweis.
- **[Minor]** `ProfileForm.tsx:96-104` — `defaultValues` werden aus `initialCustomer` gelesen — aber wenn der Kunde die Adressfelder leert und speichert, bleibt der Form-State nicht synchron mit dem Server (außer `router.refresh()` läuft). Risiko: Kunde sieht alte Werte zurück. Sollte explizit `reset()` mit Server-Response laufen.
- **[Minor]** `CustomerHeaderMenu.tsx:74-81` — "Abmelden"-Button im Header ist Text-only (`text-baerenstark-bark/70`), wirkt wie ein Skip-Link. Touch-Target unter 44 px (`px-2 py-2 text-sm` ≈ 32 px hoch). Auf Mobile riskant für Mis-Taps.

### Admin-Bereich (`/admin`)

- **[Blocker für Effizienz]** `AdminDashboard.tsx:62-96` — siehe QW-3 + SV-2: doppelte Navigation (5 QuickLinks + 4 Tabs), "Bewertungen" doppelt. Tom muss zwei Strukturen mental halten.
- **[Major]** `BookingTable.tsx:258-535` — Karten sind information-dichte Walls of Text. Eine PENDING-Buchung zeigt parallel sechs Badges (Status, Preis, Mail-fail, Slot-deleted, Counter-Proposal, optional Anhang-Count), bis zu vier Buttons, einen Payment-Editor und einen FinalPriceEditor. Aktion ist nicht visuell hervorgehoben. Siehe SV-3.
- **[Major]** `SlotForm.tsx:114-187` — "Neues Zeitfenster"-Form ist immer aufgeklappt oberhalb der Liste. Sobald 30+ Slots existieren, scrollt Tom jedes Mal an der Form vorbei. Form sollte einklappbar sein ("+ Neues Zeitfenster anlegen") oder als Floating-Action-Button rechts unten.
- **[Major]** `WeeklyAvailabilityForm.tsx:21-30` — Verfügbarkeits-Tab kombiniert drei Form-Bereiche untereinander (BufferConfig + WochenTemplate + DayOverrides), getrennt mit `<hr />`. Kein erklärender Header pro Sektion, kein "Was bewirkt was?". Tom als Nicht-Techniker braucht hier Inline-Hilfe ("Buffer = wie viel Pause zwischen Aufträgen", "Wochenvorlage = dein Standard-Arbeitstag", "Tages-Überschreibungen = Urlaub/Krank-Tage"). Ein Tabbed-Layout oder Collapsible-Sections mit Erklärungstext würde die Verwirrung deutlich senken.
- **[Major]** `UpcomingBookingsList.tsx:107-137` — Die Liste zeigt Datum + Zeit + Name + Service, aber keine Adresse. Tom *muss* aber wissen, wo er hinfährt (war ja der ganze Sinn von US-IT9-02). Ergebnis: Tom klickt auf "Buchungen"-Tab, scrollt zur Karte, kopiert Adresse. Adresse direkt in der Upcoming-List anzeigen, idealerweise mit `tel:`-Link am Kunden-Namen + Maps-Link an der Adresse.
- **[Major]** `BookingTable.tsx:325-331` — Telefon-Link entfernt Sonderzeichen (`tel:${b.customerPhone.replace(/[^+\d]/g, '')}`) — gut. Aber die Mailadresse ist nur in der Karte (`:336-345`) — keine Quick-Action "WhatsApp", "Adresse kopieren", "in Maps öffnen". Im Mobile-Workflow Toms (er ist auf der Baustelle und ruft an) wären das die wichtigsten Funktionen.
- **[Minor]** `AdminDashboard.tsx:44-50` — Header zeigt "Admin-Bereich" + Subtitle, aber nicht den eingeloggten Admin-Namen. Bei mehreren Admins (US-IT6-01) wichtig: "Eingeloggt als Tom Siefert".
- **[Minor]** `UserTable.tsx:186-235` — Tabelle hat keine Adress-Spalte, obwohl die Adresse jetzt im Schema lebt (US-IT9-02). Tom kann nicht filtern/sortieren nach "Kunden in 64283 Darmstadt" — das wäre operativ wertvoll.
- **[Minor]** `AdminCalendarView.tsx` (gesamt) — FullCalendar ist mächtig, aber für Tom mobil schwer bedienbar (kleine Klickflächen im Wochenraster). Default-View `timeGridDay` auf Mobile ist gut. Empfehlung: Mobile-spezifische Vereinfachung — pro Tag eine vertikale Karten-Liste statt Zeitraster.
- **[Minor]** `error.tsx:36-72` — Error-Boundary ist gut gemacht. Aber die Fehler-ID (`error.digest`) wird nur als Mono-Text angezeigt; Tom kann sie nicht "Per E-Mail an Entwicklung senden". Ein "Fehler an Entwicklung melden"-Button mit `mailto:`-Link wäre eine konkrete Brücke.

### Querschnitt (Designsystem, Accessibility, Mobile)

- **[Major / Designsystem]** Token-Drift: `tailwind.config.ts:11-26` definiert `baerenstark-*`-Palette + zwei Top-Level-Aliase (`leaf`, `amber-accent`). Die Banner-Komponente nutzt nicht-Marken-Farben (`Banner.tsx:5-10` → `bg-blue-50` / `bg-green-50` / `bg-amber-50` / `bg-red-50`). Resultat: Erfolgs-Banner ist hell-grün und sticht aus dem Holz/Beige-Look raus. Lösung siehe QW-4.
- **[Major / Designsystem]** Doppelte Slot-Picker-Implementations: `BookingCalendar.tsx` (FullCalendar-basiert, Customer-Mode) und `Calendar.tsx` (Legacy für Re-Booking) — zwei verschiedene Kalender-Komponenten im Buchungs-Flow. Verwirrend für Wartung; sollte langfristig konsolidiert werden (auch wenn FullCalendar bleibt).
- **[Major / A11y]** `BookingForm.tsx:564-571` — Datenschutz-Checkbox nutzt `<input type="checkbox">` direkt mit `accent-baerenstark-wood`. Touch-Target ist `h-5 w-5` (20 px), unter WCAG-Floor. Sollte ein gewrapptes Klick-Label haben das den Tap-Bereich auf 44 px erweitert (passiert teilweise via `<label>` — aber das `<label>` hat `flex items-start gap-3`, der Klickbereich ist nur die direkte Box).
- **[Major / A11y]** `Banner.tsx:24` — `border-l-4` (linker Akzentstreifen) ist die einzige farbliche Status-Differenzierung neben dem Background. Für rot/grün-blinde Nutzer reicht das nicht. Status-Icons (z.B. `<CheckCircle>` / `<AlertTriangle>`) ergänzen.
- **[Major / Mobile]** Header ist Sticky (`Header.tsx:8` `sticky top-0`) — gut. Aber bei Smooth-Scroll im Buchungs-Flow verdeckt er die Section-Headers. CSS `scroll-margin-top: 5rem` auf den Section-Anker-IDs einbauen.
- **[Minor / A11y]** Viele Status-Indikatoren nur via Emoji (`📞`, `📅`, `📍`, `📋`). Screen-Reader sprechen sie nicht konsistent aus; durchgängig `aria-hidden="true"` + Text-Label verwenden (passiert teilweise: `Hero.tsx:38` ohne aria-hidden, `Footer.tsx` ok). Systemisch durchziehen.
- **[Minor / A11y]** `StarRatingInput.tsx` (nicht voll gelesen) — Sterne-Rating-UIs müssen als Radio-Group umgesetzt sein, sonst Screen-Reader-unbedienbar. Quick-Check empfohlen.
- **[Minor / Mobile]** `CounterProposalDialog` öffnet als Modal, nutzt `document.body.style.overflow = 'hidden'` (`:80`). Auf iOS kann das den Hintergrund-Scroll trotzdem erlauben (bekanntes Safari-Problem). `body-scroll-lock` oder `position: fixed`-Workaround einbauen.
- **[Minor / Konsistenz]** Datums-Formatierung: `formatBerlinDateShort`, `formatDateShort`, `formatDateTime`, `formatSlotRange`, `formatSlotRangeCompact`, lokale `formatDate` in `UpcomingBookingsList.tsx:21-32` und in `DayOverrideManager.tsx:44-48` — viele konkurrierende Helfer. Eine zentrale `format()`-API mit Modi (`'date-short'`, `'date-long'`, `'date-time'`, `'range'`) räumt das auf.
- **[Minor / SEO+UX]** `/buchung` hat `metadata.description` (`page.tsx:9-11`) aber keine sichtbare H1-Subtitle, die Search-Snippets oder Social-Cards transportieren würde. Hero-Subtitle dort ergänzen würde dem User sofort Kontext geben.

---

## Empfehlung für nächste Iterationen

### Iteration A — "Conversion + Trust" (1 Sprint)
- QW-1 (Trust-Bar oben in `/buchung`)
- QW-2 (Adress-Hinweis vor Kalender)
- QW-4 (Banner-Tokens konsolidieren)
- QW-5 (Telefon-Icon im Mobile-Header)
- Major-Fixes: scroll-margin-top, BookingForm-Erfolg auf `/buchung/bestaetigt` umleiten, Service-Card mit Doppel-CTA

**Risiko:** Niedrig — alles additive UI-Änderungen, keine API-Verträge betroffen.
**Begründung Reihenfolge:** Conversion ist Toms wichtigster Kanal; Quick Wins zuerst, weil sie sofortige Wirkung zeigen und Vertrauen für die strategischen Umbauten schaffen.

### Iteration B — "Buchungs-Flow neu denken" (1 Sprint)
- SV-1 (Stepper + Auswahl-Pill)
- SV-5 (44-px-Tap-Targets systemisch)
- Mobile-A11y-Major-Fixes (Datenschutz-Checkbox-Klickfläche, Status-Icons in Banner)

**Risiko:** Mittel — Stepper-Umbau betrifft die kritischste Reise; gute QA-Test-Pässe nötig.
**Begründung Reihenfolge:** Aufbauend auf Iteration A; man hat die Trust-Signale bereits, jetzt geht es um die Reise selbst.

### Iteration C — "Admin-Effizienz" (1–2 Sprints)
- QW-3 (Nav konsolidieren)
- SV-2 (Tom-zentrierte Inbox-Sicht)
- SV-3 (Karten reduzieren + Detail-Drawer)
- WeeklyAvailability mit Inline-Hilfe + Sub-Tabs
- Adresse + Maps-Link in UpcomingBookings
- Slot-Form einklappbar

**Risiko:** Mittel — viele zusammengehörige Änderungen am Admin; Tom muss neu lernen, daher zusammen ausrollen mit kurzem Walkthrough.
**Begründung Reihenfolge:** Admin-Effizienz ist Toms zweitwichtigster Kanal; nach den User-facing Fixes kann man hier mit längerem Atem umbauen.

### Iteration D — "Designsystem-Reife" (1 Sprint, parallel zu A/B/C möglich)
- SV-4 (Polymorphes Button + Anchor + IconButton + OAuth-Button-Variante)
- Format-Helper-Konsolidierung
- Calendar-Komponenten konsolidieren (Legacy `Calendar.tsx` raus oder klar als Re-Booking-only markieren)

**Risiko:** Niedrig–mittel — kosmetisch, aber Test-Aufwand: jede Verbraucherstelle.
**Begründung Reihenfolge:** Kann nebenher laufen; nicht conversion-kritisch, aber zahlt langfristig auf Wartbarkeit ein.

---

## Nicht im Scope dieses Reviews

- **Performance-Metriken im Browser** (LCP, INP, CLS) — Code-Sichtung allein liefert keine Lab-Daten; Vercel Analytics oder Lighthouse-Run separat empfohlen.
- **Echte Nutzer-Tests** — Heuristik-Review ersetzt keine Beobachtung. Empfohlen: 5 Darmstädter Test-Kunden 50+ in Toms Zielgruppe einen Buchungsflow durchgehen lassen, dazu Tom selbst beim Wochenstart-Workflow im Admin filmen.
- **A/B-Tests** — Conversion-Vorhersagen sind heuristisch; reale Lift-Werte nur experimentell messbar.
- **Visuelles Design** (Farb-Komposition, Typo-Stufen-Audit, Logo-Varianten) — kein Hi-Fi-Design im Scope; nur strukturelle Empfehlungen.
- **Browser-Kompatibilität / Cross-Device-QA** — Annahme moderne Evergreen-Browser; iOS-Safari Edge-Cases (siehe Modal-Scroll-Lock) nur stichprobenartig erwähnt.
- **Inhaltliche Texte / SEO-Copy** — Microcopy nur dort kommentiert, wo sie ein UX-Problem produziert (z.B. "optional aber Pflicht"-Widerspruch im Register-Form). Vollständiger Tone-of-Voice-Audit separat.
- **Datenschutz/DSGVO-Compliance der Adress- und Buchungs-Speicherung** — strukturelle Anmerkungen vorhanden, aber kein juristischer Audit.
- **API-/Backend-Verträge** — fokussiert auf UI-Schicht; Verträge nur referenziert wenn sie UX direkt beeinflussen (z.B. Adress-Pflicht-Logik).

---

## Backlog-Anhang (nicht in den Top-Listen, aber notiert)

- `Hero.tsx:43-53` — Logo-Container mit `aspect-square w-full max-w-sm` ist auf sehr großen Screens überdimensioniert; Cap auf `max-w-xs` möglich.
- `Footer.tsx:59-69` — Service-Liste im Footer dupliziert die Hauptnavigation und macht den Footer mit 6 Items lang. Kürzen auf 3–4 Top-Services + "Alle Services →".
- `SlotForm.tsx:170-178` — Beschreibungs-Feld hat Placeholder "z. B. Vormittag, ab 14 Uhr" — was Tom hier reinschreibt, ist Kunden-sichtbar, sollte aber explizit gesagt werden ("Wird Kunden im Buchungs-Flow angezeigt").
- `RegisterForm.tsx:356-368` — Passwort-Stärke-Bar nutzt `aria-hidden="true"` — Screen-Reader-Nutzer bekommen kein Feedback. Stärke als Live-Region ergänzen.
- `BookingTable.tsx:202-224` — Status-Filter als "Pills"-Tabs gut umgesetzt, aber auf Mobile horizontal scrollbar einbauen (aktuell wrappen sie auf zwei Zeilen, was Card-Layout zerschießt).
- `AdminDashboard.tsx:108-117` — `QuickLink` benutzt `min-h-[44px]` (gut!) — als positives Beispiel für die systemische 44-px-Regel zu nutzen.
- `customer/AuthCardShell.tsx` — nicht detail-gelesen, aber Prüfen: nutzt es das Logo? Wenn ja, verschiedene Größen vermeiden zwischen Login/Register/Reset.
- `services/[slug]/page.tsx` — Service-Detail-Pages haben CTA `/buchung?service=<slug>` (Pre-Selection), das ist gut. Sollte in Telemetrie messbar sein, ob diese Pre-Selection wirklich genutzt wird.
- `admin/setup/page.tsx` — nicht gelesen; Setup-Flow für ersten Admin sollte Erfolgs-State + Direkt-Login haben (annehmen, ist so).
- Konsistenz: "Termin buchen" (Header), "Jetzt Termin buchen" (Hero), "Termin buchen" (Footer) — drei Varianten desselben CTA. Eine Sprache wählen.
