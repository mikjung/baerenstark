# Bärenstark Hausservice — Website

Frontend + Backend in einem Next.js 14 Projekt (App Router, TypeScript, Tailwind CSS).
Slogan: **„Ihr Haus in bärenstarken Händen!"**

## Schnellstart (lokal)

```bash
# 1) Abhängigkeiten installieren
npm install

# 2) Env-Datei aus Vorlage kopieren
cp .env.example .env.local
# → AUTH_SECRET / NEXTAUTH_SECRET mit  openssl rand -base64 32  setzen
# → DATABASE_URL kann lokal "file:./dev.db" bleiben

# 3) DB migrieren
npm run prisma:migrate

# 4) Dev-Server
npm run dev
# → http://localhost:3000
```

Beim ersten Aufruf von [`/admin/login`](http://localhost:3000/admin/login)
prüft die Seite, ob ein Admin-Account existiert. Wenn nicht, wirst du auf
`/admin/setup` weitergeleitet — dort legst du das Initial-Passwort selbst fest.

## Wichtige Skripte

| Befehl                  | Zweck                                                  |
| ----------------------- | ------------------------------------------------------ |
| `npm run dev`           | Dev-Server (mit HMR) auf Port 3000                     |
| `npm run build`         | Produktiv-Build (inkl. `prisma migrate deploy`)        |
| `npm run start`         | Produktiv-Server starten                               |
| `npm run lint`          | ESLint                                                 |
| `npm run prisma:studio` | Prisma Studio (DB-GUI) — nur Dev                       |

## Umgebungsvariablen

Siehe `.env.example`. Pflicht für lokale Entwicklung:

- `DATABASE_URL`, `DIRECT_DATABASE_URL` — bei lokaler Entwicklung `file:./dev.db`.
- `NEXTAUTH_URL` (`http://localhost:3000`) und `NEXTAUTH_SECRET`/`AUTH_SECRET`.
- `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_TO_ADMIN` — ohne diese Werte schickt
  der Mail-Versand keinen echten Versand, aber das Buchungsformular
  funktioniert weiterhin (Backend dokumentiert Fallback).

## Frontend-Struktur

```
src/
├── app/
│   ├── layout.tsx           # Root-Layout: Header, Footer, Skip-Link
│   ├── page.tsx             # Startseite (US-01, US-02): Hero + ServiceGrid + About
│   ├── buchung/
│   │   ├── page.tsx         # Buchungsseite (US-03/US-04)
│   │   └── BookingClient.tsx
│   ├── impressum/page.tsx   # Statisch (US-12)
│   ├── datenschutz/page.tsx # Statisch (US-12)
│   └── admin/
│       ├── login/page.tsx   # US-07
│       ├── setup/page.tsx   # Setup-Wizard
│       ├── page.tsx         # Admin-Dashboard mit Tabs (US-05/US-06)
│       ├── slots/page.tsx   # Redirect → /admin
│       └── bookings/page.tsx# Redirect → /admin
├── components/
│   ├── ui/                  # Button, Card, Badge, Input, Banner, ConfirmDialog, Skeleton
│   ├── layout/              # Header, Footer
│   ├── home/                # Hero, ServiceGrid, About
│   ├── booking/             # SlotList, BookingForm
│   └── admin/               # AdminDashboard, AdminSlotManager, SlotForm,
│                            # SlotTable, BookingTable
└── lib/
    ├── api-client.ts        # Typed Fetch-Wrapper für alle API-Endpunkte
    ├── schemas.ts           # Re-Export der Zod-Schemas aus contracts/
    ├── services.ts          # Service-Liste mit Labels und Icons
    ├── format.ts            # Datums-/Zeit-Formatierung (Europe/Berlin)
    └── contact.ts           # Hardcodierte Kontaktdaten
```

## Page → User-Story Mapping

| Pfad                      | Story         | Highlight                                                            |
| ------------------------- | ------------- | -------------------------------------------------------------------- |
| `/`                       | US-01, US-02  | Hero, 6 Service-Karten, About-Section, Footer mit `tel:`-Link        |
| `/buchung`                | US-03, US-04  | Slot-Auswahl (Loading/Error/Empty/Booked) + Buchungsformular         |
| `/impressum`              | US-12         | Statisches Impressum-Template                                        |
| `/datenschutz`            | US-12         | Datenschutzerklärung mit DSGVO-Pflichtangaben                        |
| `/admin/login`            | US-07         | Login + Setup-Pre-Check                                              |
| `/admin/setup`            | Initial-Setup | Setup-Wizard für Initial-Passwort                                    |
| `/admin`                  | US-05, US-06  | Tab "Buchungsanfragen" + Tab "Zeitfenster" mit Mail-Status-Anzeige   |

## UI-States (siehe ARCHITECTURE.md §10)

Jede dynamische Page implementiert vier States:

- **Loading** — Skeleton-Cards
- **Error** — Banner mit Retry und Telefon-Fallback
- **Empty** — Hinweisbox mit Telefon-CTA
- **Populated** — Inhalt mit `Belegt`/`Frei`/`Bestätigt`-Badges

Speziell auf `/buchung`:

- **Conflict (409)** — „Zeitfenster nicht mehr verfügbar — bitte neu wählen."
- **Rate-Limit (429)** — „Zu viele Anfragen, bitte später erneut."
- **Validation-Error** — Inline-Fehler unter dem betroffenen Feld.

## Auth-Flow (Frontend-Sicht)

- Token lebt in einem **HttpOnly-Cookie** (NextAuth, `next-auth.session-token`).
- Frontend fetcht alle API-Endpunkte **same-origin** mit `credentials: 'same-origin'`.
- `signIn()`/`signOut()` aus `next-auth/react` werden für Login/Logout genutzt.
- `callbackUrl`-Parameter wird auf relative Pfade gefiltert (Open-Redirect-Schutz).

## Accessibility

- WCAG 2.1 AA als Floor.
- Sichtbarer Fokus-Ring (`focus-visible:ring-2`).
- Skip-Link ganz oben im Layout („Zum Hauptinhalt springen").
- Alle Telefon-Links als `tel:`, alle E-Mails als `mailto:`.
- Form-Errors via `role="alert"` + `aria-describedby`.
- Toast-/Status-Messages in Live-Regions (`role="status"`, `aria-live="polite"`).

## Bekannte Annahmen

- Browser des Admins läuft in `Europe/Berlin` (Slot-Eingabe via `<input type="datetime-local">`).
- Logo liegt unter `/public/logo.png` und wird vom Source `images/logo.png` kopiert.
- Tom liefert die finalen Texte für Impressum.
