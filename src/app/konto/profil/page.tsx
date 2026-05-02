/**
 * /konto/profil — Profil-Bearbeitung (US-25 AC10).
 *
 * Server-Component lädt das Profil und gibt es an den Client-Form weiter.
 * E-Mail-Feld ist read-only (BUG-402-Fix v1.4.1).
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ProfileForm } from '@/components/customer/ProfileForm';
import { getServerCustomer } from '@/lib/customer-session';

export const metadata: Metadata = {
  title: 'Profil',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const me = await getServerCustomer();
  if (!me) redirect('/konto/login');

  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6">
        <Link
          href="/konto"
          className="text-sm text-baerenstark-wood underline-offset-2 hover:underline"
        >
          ← Zurück zur Übersicht
        </Link>
        <h1 className="mt-2 font-serif text-3xl font-bold text-baerenstark-bark">
          Mein Profil
        </h1>
        <p className="mt-1 text-sm text-baerenstark-bark/70">
          Aktualisiere deine persönlichen Daten.
        </p>
      </header>
      <div className="rounded-2xl border border-baerenstark-sand bg-white/85 p-6 shadow-card sm:p-8">
        <ProfileForm initialCustomer={me} />
      </div>
    </section>
  );
}
