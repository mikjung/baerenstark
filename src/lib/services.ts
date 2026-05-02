/**
 * Service-Liste — Single Source of Truth für die UI.
 *
 * Slugs werden in der Datenbank persistiert und in der API als enum validiert
 * (siehe contracts/zod-schemas.ts → SERVICES). Hier ergänzen wir Anzeige-
 * Metadaten (Label, Beschreibung, Icon, Preis, Vorher/Nachher-Details) für
 * die Service-Karten (US-01), Formulare (US-04), Service-Popups (US-23) und
 * Preis-Anzeigen (US-20).
 *
 * Iteration 3:
 *  - `'sonstiges'` als individuelle Anfrage-Kategorie (US-19).
 *  - `priceFrom / priceUnit / priceNote` für Service-Preise (US-20).
 *  - `details.before / details.after / details.includes` für Service-Popups (US-23).
 */

export const SERVICES = [
  'entruempelung',
  'entkernung',
  'reinigung',
  'gruenflaechenpflege',
  'muelltonnenservice',
  'entsorgung',
  'sonstiges', // IT3 / US-19
] as const;

export type Service = (typeof SERVICES)[number];

/** US-20 — Einheit der Preisangabe. */
export type PriceUnit = 'hour' | 'task';

/** US-23 — Vorher/Nachher-Details für das Service-Popup. */
export interface ServiceDetails {
  /** Ausgangslage (Vorher). */
  before: string;
  /** Ergebnis (Nachher). */
  after: string;
  /** Was ist im Service inbegriffen — Aufzählung mit Häkchen. */
  includes: string[];
}

export interface ServiceInfo {
  slug: Service;
  label: string;
  short: string;
  description: string;
  icon: string;
  // US-20:
  /** Stundenpreis bzw. Pauschalpreis (null bei "Sonstiges"). */
  priceFrom: number | null;
  /** Einheit für die Preis-Anzeige (`'hour'` → "ab X €/Std.", `'task'` → "ab X €/Einsatz"). */
  priceUnit: PriceUnit | null;
  /** Disclaimer / Hinweistext zum Preis. */
  priceNote: string;
  // US-23:
  details: ServiceDetails;
}

export const SERVICE_LIST: readonly ServiceInfo[] = [
  {
    slug: 'entruempelung',
    label: 'Entrümpelungen',
    short: 'Wohnungen, Keller, Dachböden, Garagen.',
    description:
      'Ob Haushaltsauflösung oder Keller leer räumen — wir packen an, sortieren und entsorgen fachgerecht.',
    icon: '📦',
    priceFrom: 35,
    priceUnit: 'hour',
    priceNote: 'Endpreis nach Besichtigung',
    details: {
      before:
        'Vollgestellte Räume, jahrelang gewachsene Sammlungen, schwere Möbel, kein Durchkommen mehr.',
      after:
        'Besenrein übergebene Räume, fachgerecht entsorgt — alles wiederverwertbar, wo es möglich ist.',
      includes: [
        'Sortierung wertvoller Gegenstände',
        'Demontage von Möbeln und Einbauten',
        'Fachgerechte Entsorgung (Sperrmüll, Wertstoff, Sondermüll)',
        'Besenreine Übergabe',
        'Transparente Endabrechnung nach Aufwand',
      ],
    },
  },
  {
    slug: 'entkernung',
    label: 'Entkernungsarbeiten',
    short: 'Sauber bis zum Rohbau zurück.',
    description:
      'Vor dem Umbau: Wir entkernen Räume und Etagen, demontieren Einbauten und bereiten alles für die nächste Bauphase vor.',
    icon: '🛠️',
    priceFrom: 45,
    priceUnit: 'hour',
    priceNote: 'Individuell nach Aufwand',
    details: {
      before:
        'Bestehende Innenausbauten, Bodenbeläge, sanitäre Anlagen oder abgehängte Decken stehen dem Umbau im Weg.',
      after:
        'Räume sind bis zum Rohbau zurückgeführt — bereit für den nächsten Bauschritt.',
      includes: [
        'Demontage von Einbauten, Türen, Bodenbelägen',
        'Rückbau nichttragender Wände',
        'Trennung der Materialien für Recycling',
        'Sichtprüfung der Bausubstanz',
        'Abtransport und Entsorgung',
      ],
    },
  },
  {
    slug: 'reinigung',
    label: 'Reinigungsarbeiten',
    short: 'Bauschluss-, Grund- oder Endreinigung.',
    description:
      'Egal ob Wohnung, Büro oder Außenbereich — wir hinterlassen Räume sauber und übergabefertig.',
    icon: '🧽',
    priceFrom: 25,
    priceUnit: 'hour',
    priceNote: 'Zzgl. Reinigungsmittel falls benötigt',
    details: {
      before:
        'Bauschmutz, fettige Küchen, vernachlässigte Bäder oder verschmutzte Außenflächen.',
      after:
        'Glänzende Oberflächen, frische Räume, übergabefertig — der erste Eindruck stimmt wieder.',
      includes: [
        'Grund- und Endreinigung',
        'Bauschluss-Reinigung',
        'Fenster, Rahmen, Glasflächen',
        'Sanitärbereiche und Küchen',
        'Mitgebrachte oder vorhandene Reinigungsmittel nach Wunsch',
      ],
    },
  },
  {
    slug: 'gruenflaechenpflege',
    label: 'Grünflächenpflege',
    short: 'Hecken, Rasen, Beete in Form.',
    description:
      'Heckenschnitt, Rasenmähen, Unkraut entfernen, Laub wegräumen — wir halten deinen Garten gepflegt.',
    icon: '🌿',
    priceFrom: 30,
    priceUnit: 'hour',
    priceNote: 'Inkl. Standard-Werkzeug',
    details: {
      before:
        'Wuchernde Hecken, hoher Rasen, überwachsene Beete, Laub und Astwerk auf den Wegen.',
      after:
        'Geschnittene Hecken, gemähter Rasen, gepflegte Beete — der Garten wirkt wieder ordentlich.',
      includes: [
        'Heckenschnitt (Form- und Pflegeschnitt)',
        'Rasenmähen und Kantenschnitt',
        'Unkraut jäten in Beeten und Fugen',
        'Laub- und Astentfernung',
        'Entsorgung des Grünschnitts',
      ],
    },
  },
  {
    slug: 'muelltonnenservice',
    label: 'Mülltonnenservice',
    short: 'Tonnen rausstellen und reinholen.',
    description:
      'Verlässlicher Service zu deinem Abfuhrtermin — wir kümmern uns ums Rausstellen und Reinholen, auch bei Abwesenheit.',
    icon: '🗑️',
    priceFrom: 20,
    priceUnit: 'task',
    priceNote: 'Pro Einsatz, je nach Tonnenanzahl',
    details: {
      before:
        'Du bist im Urlaub oder beruflich unterwegs — die Tonnen können nicht rechtzeitig rausgestellt werden.',
      after:
        'Tonnen stehen pünktlich draußen und sind nach der Abfuhr wieder am Stellplatz — ohne dein Zutun.',
      includes: [
        'Rausstellen am Vorabend des Abfuhrtermins',
        'Reinholen am selben oder folgenden Tag',
        'Auf Wunsch auch regelmäßig im Abo',
        'Zuverlässige Erinnerung an den Termin',
        'Ersatz bei kurzfristiger Verhinderung',
      ],
    },
  },
  {
    slug: 'entsorgung',
    label: 'Entsorgung Schrott & Metalle',
    short: 'Fachgerechte Verwertung.',
    description:
      'Alteisen, Maschinen, Metallreste — wir holen ab und entsorgen ressourcenschonend.',
    icon: '♻️',
    priceFrom: 40,
    priceUnit: 'hour',
    priceNote: 'Zzgl. Materialwert',
    details: {
      before:
        'Alteisen, ausgediente Maschinen, Metallreste oder kaputte Werkzeuge sammeln sich an und nehmen Platz weg.',
      after:
        'Metalle sind abgeholt und der Wertstoff-Verwertung zugeführt — Platz ist wieder da.',
      includes: [
        'Abholung von Schrott und Metallen',
        'Sortierung nach Materialart',
        'Fachgerechte Verwertung (Wertstoffhof / Verwerter)',
        'Auf Wunsch Demontage größerer Teile',
        'Transparente Mengen- und Wertangabe',
      ],
    },
  },
  {
    slug: 'sonstiges',
    label: 'Sonstiges / Individuelle Anfrage',
    short: 'Dein Anliegen passt nicht in eine Kategorie?',
    description:
      'Beschreib uns dein Anliegen — Tom prüft es individuell und meldet sich mit einem maßgeschneiderten Angebot.',
    icon: '✏️',
    priceFrom: null,
    priceUnit: null,
    priceNote: 'Auf Anfrage',
    details: {
      before:
        'Du hast ein besonderes Anliegen, das sich nicht eindeutig kategorisieren lässt — z.B. eine Mischung aus mehreren Services oder etwas ganz anderes.',
      after:
        'Tom prüft deine Anfrage individuell und meldet sich mit einem maßgeschneiderten Angebot bei dir.',
      includes: [
        'Individuelle Beratung',
        'Maßgeschneidertes Angebot',
        'Flexible Terminplanung',
        'Direkte Rücksprache mit Tom',
      ],
    },
  },
];

const SERVICE_BY_SLUG: Record<Service, ServiceInfo> = SERVICE_LIST.reduce(
  (acc, s) => {
    acc[s.slug] = s;
    return acc;
  },
  {} as Record<Service, ServiceInfo>,
);

export const SERVICE_LABELS: Record<Service, string> = SERVICES.reduce(
  (acc, slug) => {
    acc[slug] = SERVICE_BY_SLUG[slug].label;
    return acc;
  },
  {} as Record<Service, string>,
);

export const SERVICE_DESCRIPTIONS: Record<Service, string> = SERVICES.reduce(
  (acc, slug) => {
    acc[slug] = SERVICE_BY_SLUG[slug].description;
    return acc;
  },
  {} as Record<Service, string>,
);

export function getServiceInfo(slug: Service): ServiceInfo {
  return SERVICE_BY_SLUG[slug];
}

export function getServiceLabel(slug: Service | string): string {
  if ((SERVICES as readonly string[]).includes(slug)) {
    return SERVICE_BY_SLUG[slug as Service].label;
  }
  return slug;
}

/**
 * US-20 — formatiert den Preis für die Anzeige auf Service-Karten und Popups.
 * Beispiele:
 *   priceFrom=35, priceUnit='hour' → "ab 35 €/Std."
 *   priceFrom=20, priceUnit='task' → "ab 20 €/Einsatz"
 *   priceFrom=null                  → "Auf Anfrage"
 */
export function formatPrice(info: Pick<ServiceInfo, 'priceFrom' | 'priceUnit'>): string {
  if (info.priceFrom == null || info.priceUnit == null) {
    return 'Auf Anfrage';
  }
  const unit = info.priceUnit === 'hour' ? '€/Std.' : '€/Einsatz';
  return `ab ${info.priceFrom} ${unit}`;
}
