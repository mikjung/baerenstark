/**
 * Service-Slug → Bild-Mapping (IT12-S02).
 *
 * Single Source of Truth für Hero-Bilder auf `/services/[slug]`.
 * Slugs entsprechen 1:1 dem `SERVICES`-Array aus `src/lib/services.ts`
 * (Phase-2-Revision: keine Plurale, keine `-arbeiten`-Suffixe).
 *
 * Umlaute in Dateinamen: `next/image` URL-encodiert sie automatisch beim
 * Rendering (`%C3%BC`, `%C3%A4`). Vercel-CDN liefert die Files dann korrekt
 * aus, vorausgesetzt die Disk-Filenames sind die Original-Unicode-Zeichen.
 *
 * `sonstiges` ist absichtlich NICHT in der Map — diese Anfrage-Kategorie
 * hat keine Detail-Page (siehe `getServiceBySlug`).
 *
 * Spec: ARCHITECTURE_IT12.md §R.2 + §2,
 * frontend-requirements-iteration-12.md §IT12-S02,
 * ux-spec-iteration-12.md §3.2.2.
 */

export const SERVICE_IMAGE_MAP: Record<string, string> = {
  gruenflaechenpflege: '/grünflächenpflege.png',
  entruempelung: '/entruemplungen.png',
  entkernung: '/entkernungsarbeiten.png',
  reinigung: '/reinigungsarbeiten.png',
  muelltonnenservice: '/mülltonnenservice.png',
  entsorgung: '/metal_schrott.png',
};

export function getServiceImage(slug: string): string | null {
  return SERVICE_IMAGE_MAP[slug] ?? null;
}
