/**
 * Service-Liste — Single Source of Truth für die UI.
 *
 * Slugs werden in der Datenbank persistiert und in der API als enum validiert
 * (siehe contracts/zod-schemas.ts → SERVICES). Hier ergänzen wir Anzeige-
 * Metadaten (Label, Beschreibung, Icon) für die Service-Karten (US-01) und
 * Formulare (US-04).
 */

export const SERVICES = [
  'entruempelung',
  'entkernung',
  'reinigung',
  'gruenflaechenpflege',
  'muelltonnenservice',
  'entsorgung',
] as const;

export type Service = (typeof SERVICES)[number];

export interface ServiceInfo {
  slug: Service;
  label: string;
  short: string;
  description: string;
  icon: string;
}

export const SERVICE_LIST: readonly ServiceInfo[] = [
  {
    slug: 'entruempelung',
    label: 'Entrümpelungen',
    short: 'Wohnungen, Keller, Dachböden, Garagen.',
    description:
      'Ob Haushaltsauflösung oder Keller leer räumen — wir packen an, sortieren und entsorgen fachgerecht.',
    icon: '📦',
  },
  {
    slug: 'entkernung',
    label: 'Entkernungsarbeiten',
    short: 'Sauber bis zum Rohbau zurück.',
    description:
      'Vor dem Umbau: Wir entkernen Räume und Etagen, demontieren Einbauten und bereiten alles für die nächste Bauphase vor.',
    icon: '🛠️',
  },
  {
    slug: 'reinigung',
    label: 'Reinigungsarbeiten',
    short: 'Bauschluss-, Grund- oder Endreinigung.',
    description:
      'Egal ob Wohnung, Büro oder Außenbereich — wir hinterlassen Räume sauber und übergabefertig.',
    icon: '🧽',
  },
  {
    slug: 'gruenflaechenpflege',
    label: 'Grünflächenpflege',
    short: 'Hecken, Rasen, Beete in Form.',
    description:
      'Heckenschnitt, Rasenmähen, Unkraut entfernen, Laub wegräumen — wir halten Ihren Garten gepflegt.',
    icon: '🌿',
  },
  {
    slug: 'muelltonnenservice',
    label: 'Mülltonnenservice',
    short: 'Tonnen rausstellen und reinholen.',
    description:
      'Verlässlicher Service zu Ihrem Abfuhrtermin — wir kümmern uns ums Rausstellen und Reinholen, auch bei Abwesenheit.',
    icon: '🗑️',
  },
  {
    slug: 'entsorgung',
    label: 'Entsorgung Schrott & Metalle',
    short: 'Fachgerechte Verwertung.',
    description:
      'Alteisen, Maschinen, Metallreste — wir holen ab und entsorgen ressourcenschonend.',
    icon: '♻️',
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
