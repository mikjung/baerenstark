import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="mb-4 font-serif text-4xl font-bold text-baerenstark-bark sm:text-5xl">
        404
      </h1>
      <p className="mb-2 text-lg font-medium text-baerenstark-bark">
        Diese Seite gibt&apos;s nicht.
      </p>
      <p className="mb-6 text-sm text-baerenstark-bark/70">
        Vielleicht wurde der Link verändert oder die Seite ist umgezogen.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-baerenstark-wood px-5 py-2.5 text-sm font-medium text-baerenstark-cream hover:bg-baerenstark-bark"
      >
        Zur Startseite
      </Link>
    </section>
  );
}
