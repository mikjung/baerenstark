import { SERVICE_LIST } from '@/lib/services';

export function ServiceGrid() {
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
          Sechs Kernleistungen rund ums Haus — alles aus einer Hand.
        </p>
      </div>

      <ul
        role="list"
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {SERVICE_LIST.map((service) => (
          <li key={service.slug}>
            <article
              aria-labelledby={`svc-${service.slug}`}
              className="flex h-full flex-col rounded-2xl border border-baerenstark-sand bg-white/70 p-6 shadow-soft transition-shadow hover:shadow-card"
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
              <p className="text-sm text-baerenstark-bark/80">
                {service.description}
              </p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
