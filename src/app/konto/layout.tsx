/**
 * Layout für `/konto/*` — minimal: nutzt das Root-Layout (Header + Footer)
 * und fügt nur einen schmalen Container drumherum.
 *
 * Auth-Schutz erfolgt:
 *   - Generell via `src/middleware.ts` (Edge) — leitet nicht-eingeloggte
 *     Nutzer auf `/konto/login` um.
 *   - Pages, die explizit Daten via `GET /api/customer/me` o.ä. laden,
 *     prüfen Server-side noch einmal (Tiefe-Verteidigung).
 *
 * Diese Layout-Komponente ist absichtlich schlank, damit Auth-Sub-Pages
 * (Login / Registrieren / Passwort-vergessen) ihre eigene zentrierte
 * Card-Optik beibehalten.
 */

import type { ReactNode } from 'react';

export default function KontoLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
