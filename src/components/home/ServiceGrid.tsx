'use client';

/**
 * Service-Grid auf der Startseite.
 *
 * Iteration 3:
 *  - US-20: Preis-Anzeige unter dem Beschreibungstext.
 *  - US-23: Klick auf Karte öffnet ServiceDetailModal mit Vorher/Nachher.
 */

import { useState } from 'react';
import { ServiceDetailModal } from './ServiceDetailModal';
import { formatPrice, SERVICE_LIST, type ServiceInfo } from '@/lib/services';

export function ServiceGrid() {
  const [activeService, setActiveService] = useState<ServiceInfo | null>(null);

  return (
    <section
      aria-labelledby="services-title"
      className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16"
    >
      <div className="mb-8 text-center sm:mb-10">
        <h2
          id="services-title"
          className="mb-3 font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl"
        >
          Unsere Services
        </h2>
        <p className="mx-auto max-w-2xl text-base text-baerenstark-bark/80">
          Sieben Bereiche rund ums Haus — alles aus einer Hand. Klick auf eine
          Karte für Details und Preise.
        </p>
      </div>

      <ul
        role="list"
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {SERVICE_LIST.map((service) => (
          <li key={service.slug}>
            <button
              type="button"
              onClick={() => setActiveService(service)}
              aria-haspopup="dialog"
              aria-label={`${service.label} — Details öffnen`}
              className={[
                'group flex h-full w-full flex-col rounded-2xl border border-baerenstark-sand bg-white/70 p-6 text-left shadow-soft transition-all',
                'hover:-translate-y-0.5 hover:shadow-card hover:border-baerenstark-wood',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent',
              ].join(' ')}
            >
              <div
                className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-baerenstark-sand/60 text-2xl"
                aria-hidden="true"
              >
                {service.icon}
              </div>
              <h3
                id={`svc-${service.slug}`}
                className="mb-2 font-serif text-xl font-semibold text-baerenstark-bark"
              >
                {service.label}
              </h3>
              <p className="mb-2 text-sm font-medium text-baerenstark-wood">
                {service.short}
              </p>
              <p className="mb-3 text-sm text-baerenstark-bark/80">
                {service.description}
              </p>
              <p className="mt-auto text-sm font-semibold text-leaf">
                {formatPrice(service)}
              </p>
              <span className="mt-2 text-xs text-baerenstark-wood underline-offset-2 group-hover:underline">
                Mehr erfahren →
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center text-xs text-baerenstark-bark/60">
        * Endpreise nach individueller Besichtigung. Richtpreise gelten für die
        Region Darmstadt.
      </p>

      <ServiceDetailModal
        service={activeService}
        onClose={() => setActiveService(null)}
      />
    </section>
  );
}
