import Link from 'next/link';
import { CONTACT } from '@/lib/contact';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-baerenstark-sand/70 bg-baerenstark-bark text-baerenstark-cream">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
        <section aria-labelledby="footer-contact">
          <h2 id="footer-contact" className="mb-3 font-serif text-lg font-semibold">
            Kontakt
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <span className="block text-baerenstark-cream/70">Telefon</span>
              <a
                href={`tel:${CONTACT.phoneTel}`}
                className="text-baerenstark-accent underline-offset-2 hover:underline"
                aria-label={`${CONTACT.ownerName} anrufen unter ${CONTACT.phoneDisplay}`}
              >
                {CONTACT.phoneDisplay}
              </a>
            </li>
            <li>
              <span className="block text-baerenstark-cream/70">E-Mail</span>
              <a
                href={`mailto:${CONTACT.email}`}
                className="break-all text-baerenstark-accent underline-offset-2 hover:underline"
              >
                {CONTACT.email}
              </a>
            </li>
            <li>
              <span className="block text-baerenstark-cream/70">Einzugsgebiet</span>
              <span>{CONTACT.region}</span>
            </li>
            <li>
              <span className="block text-baerenstark-cream/70">Inhaber</span>
              <span>{CONTACT.ownerName}</span>
            </li>
          </ul>
        </section>

        <section aria-labelledby="footer-links">
          <h2 id="footer-links" className="mb-3 font-serif text-lg font-semibold">
            Service
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/" className="hover:text-baerenstark-accent">
                Startseite
              </Link>
            </li>
            <li>
              <Link href="/buchung" className="hover:text-baerenstark-accent">
                Termin buchen
              </Link>
            </li>
          </ul>
        </section>

        <section aria-labelledby="footer-legal">
          <h2 id="footer-legal" className="mb-3 font-serif text-lg font-semibold">
            Rechtliches
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/impressum" className="hover:text-baerenstark-accent">
                Impressum
              </Link>
            </li>
            <li>
              <Link href="/datenschutz" className="hover:text-baerenstark-accent">
                Datenschutz
              </Link>
            </li>
          </ul>
        </section>
      </div>
      <div className="border-t border-baerenstark-cream/10 px-4 py-4 text-center text-xs text-baerenstark-cream/70 sm:px-6">
        © {new Date().getFullYear()} Bärenstark Hausservice — {CONTACT.ownerName}
      </div>
    </footer>
  );
}
