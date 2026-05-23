import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AnfrageForm } from '@/components/anfrage/AnfrageForm';
import { CONTACT } from '@/lib/contact';
import { SERVICES, type Service } from '@/lib/services';

export const metadata: Metadata = {
  title: 'Anfrage stellen',
  description:
    'Schildern Sie uns Ihr Anliegen — wir melden uns zeitnah per E-Mail oder Telefon.',
};

interface PageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

function pickService(value: string | string[] | undefined): Service | null {
  if (typeof value !== 'string') return null;
  return (SERVICES as readonly string[]).includes(value) ? (value as Service) : null;
}

export default function AnfragePage({ searchParams }: PageProps) {
  const defaultService = pickService(searchParams?.service);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <h1 className="mb-3 font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl">
          Anfrage stellen
        </h1>
        <p className="max-w-2xl text-base text-baerenstark-bark/80 sm:text-lg">
          Beschreiben Sie uns Ihr Anliegen — wir melden uns zeitnah zurück.
          Lieber direkt telefonieren?{' '}
          <a
            href={`tel:${CONTACT.phoneTel}`}
            className="font-medium text-baerenstark-wood underline-offset-2 hover:underline"
          >
            {CONTACT.phoneDisplay}
          </a>
          .
        </p>
      </header>
      <Suspense fallback={null}>
        <AnfrageForm defaultService={defaultService} variant="page" />
      </Suspense>
    </div>
  );
}
