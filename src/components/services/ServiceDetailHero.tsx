'use client';

/**
 * ServiceDetailHero — Foto-Hero auf der Service-Detailseite (IT12-S02).
 *
 * Variants:
 *   - `with-image`: Bild aus `SERVICE_IMAGE_MAP` (next/image, priority).
 *   - `fallback`: Sand-Hintergrund mit großem Icon, falls Bild fehlt
 *     (`onError`) oder kein Mapping existiert (z. B. `sonstiges`).
 *
 * Spec: component-library-iteration-12.md §1, ARCHITECTURE_IT12.md §2.
 */

import Image from 'next/image';
import { useState } from 'react';
import { getServiceImage } from '@/lib/service-images';

interface ServiceDetailHeroProps {
  serviceSlug: string;
  serviceName: string;
  /** Fallback-Icon (Emoji oder Symbol-String aus `services.ts`). */
  fallbackIcon: string;
  /** LCP-relevant — `true` für Above-the-Fold-Hero. */
  priority?: boolean;
}

export function ServiceDetailHero({
  serviceSlug,
  serviceName,
  fallbackIcon,
  priority = true,
}: ServiceDetailHeroProps) {
  const imageSrc = getServiceImage(serviceSlug);
  const [errored, setErrored] = useState(false);

  const showFallback = !imageSrc || errored;

  if (showFallback) {
    return (
      <div
        role="img"
        aria-label={`${serviceName} — Bild folgt in Kürze`}
        className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border border-baerenstark-sand bg-baerenstark-sand/40 shadow-md sm:aspect-[3/2] sm:rounded-xl"
      >
        <span aria-hidden="true" className="text-7xl text-baerenstark-bark/40">
          {fallbackIcon}
        </span>
        <span className="absolute bottom-3 text-sm text-baerenstark-bark/60">
          Bild folgt in Kürze.
        </span>
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-baerenstark-sand bg-baerenstark-cream/40 shadow-md sm:aspect-[3/2] sm:rounded-xl">
      <Image
        src={imageSrc}
        alt={`${serviceName} — Beispielbild`}
        fill
        sizes="(max-width: 1024px) 100vw, 60vw"
        quality={85}
        priority={priority}
        onError={() => setErrored(true)}
        className="object-cover transition-transform duration-200 ease-out motion-safe:hover:scale-[1.02]"
      />
    </div>
  );
}
