/**
 * US-22 — Statische Kunden-Bewertungen für die Startseite.
 *
 * Diese Daten sind in Iteration 3 fest im Code hinterlegt; in Iteration 4
 * (US-29) wird ein Backend-Modell eingeführt, das diese Datenstruktur 1:1
 * übernimmt — Engineers tauschen dann nur die Datenquelle.
 */

import type { Service } from './services';

export interface Review {
  /** Stabile ID — wird nur als React-Key verwendet. */
  id: string;
  /** Anzeigename, datenschutzkonform abgekürzt (z.B. "Maria S."). */
  customerName: string;
  /** Service-Slug oder 'allgemein' für übergreifende Bewertungen. */
  service: Service | 'allgemein';
  /** Sterne 1–5. */
  stars: 1 | 2 | 3 | 4 | 5;
  /** Kurztext (max ~300 Zeichen, in der UI auf 120 visuell beschnitten). */
  text: string;
  /** ISO-Datum YYYY-MM-DD, für Sortierung. */
  date: string;
}

/**
 * 10 simulierte Bewertungen mit Mix aus 4- und 5-Sterne-Wertungen.
 * Verteilung: 6×5 + 4×4 = 46/10 = 4.6 → ~4.5 Schnitt für die Anzeige.
 */
export const REVIEWS: readonly Review[] = [
  {
    id: 'r1',
    customerName: 'Maria S.',
    service: 'entruempelung',
    stars: 5,
    text: 'Tom hat unsere Wohnung nach dem Auszug meiner Mutter innerhalb von zwei Tagen komplett entrümpelt. Pünktlich, freundlich und sehr fair im Preis.',
    date: '2026-04-20',
  },
  {
    id: 'r2',
    customerName: 'Peter K.',
    service: 'gruenflaechenpflege',
    stars: 5,
    text: 'Hecke geschnitten, Rasen gemäht, Beete von Unkraut befreit — Garten sieht aus wie neu. Klare Empfehlung für die Grünflächenpflege.',
    date: '2026-04-12',
  },
  {
    id: 'r3',
    customerName: 'Sabine M.',
    service: 'reinigung',
    stars: 4,
    text: 'Sehr saubere Arbeit nach unserer Renovierung. Ein paar Ecken hätten noch etwas Aufmerksamkeit gebrauchen können, sonst absolut zufrieden.',
    date: '2026-04-05',
  },
  {
    id: 'r4',
    customerName: 'Thomas B.',
    service: 'entkernung',
    stars: 5,
    text: 'Wir haben eine Etage entkernen lassen. Tom hat alles sauber abgewickelt, Material getrennt und nach Plan abgeliefert. Top!',
    date: '2026-03-28',
  },
  {
    id: 'r5',
    customerName: 'Andrea L.',
    service: 'muelltonnenservice',
    stars: 5,
    text: 'Während meiner zwei Wochen Urlaub hat sich Tom verlässlich um meine Mülltonnen gekümmert. So einfach kann das sein.',
    date: '2026-03-22',
  },
  {
    id: 'r6',
    customerName: 'Jens R.',
    service: 'entsorgung',
    stars: 4,
    text: 'Alteisen aus der Werkstatt wurde fachgerecht abgeholt und verwertet. Faire Abrechnung, alles transparent erklärt.',
    date: '2026-03-15',
  },
  {
    id: 'r7',
    customerName: 'Christine H.',
    service: 'entruempelung',
    stars: 5,
    text: 'Komplette Haushaltsauflösung nach Todesfall — sensibel, respektvoll und sehr schnell. Tom geht mit Empathie an die Sache ran.',
    date: '2026-03-08',
  },
  {
    id: 'r8',
    customerName: 'Markus W.',
    service: 'reinigung',
    stars: 5,
    text: 'Bauschluss-Reinigung nach dem Umbau — Räume waren übergabefertig. Auf den Punkt, freundliches Auftreten, gerne wieder.',
    date: '2026-02-28',
  },
  {
    id: 'r9',
    customerName: 'Petra F.',
    service: 'gruenflaechenpflege',
    stars: 4,
    text: 'Heckenschnitt war super, beim Abtransport des Grünschnitts hat es einen Tag gedauert. Insgesamt aber sehr zufrieden.',
    date: '2026-02-18',
  },
  {
    id: 'r10',
    customerName: 'Daniel O.',
    service: 'allgemein',
    stars: 4,
    text: 'Spontane Hilfe bei einer Räumung am Wochenende. Verlässlich, fair, packt mit an — so muss Hausservice sein.',
    date: '2026-02-10',
  },
];

/** Durchschnittliche Sternebewertung, gerundet auf eine Nachkommastelle. */
export const REVIEWS_AVERAGE: number = Math.round(
  (REVIEWS.reduce((sum, r) => sum + r.stars, 0) / REVIEWS.length) * 10,
) / 10;

/** Anzahl der Bewertungen. */
export const REVIEWS_COUNT = REVIEWS.length;
