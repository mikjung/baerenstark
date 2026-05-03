'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Banner } from '@/components/ui/Banner';

const REDIRECT_DELAY_SECONDS = 2;

export function OAuthSuccessClient() {
  const router = useRouter();
  const params = useSearchParams();
  const isSuccess = params.get('oauth') === 'success';

  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_DELAY_SECONDS);

  useEffect(() => {
    if (!isSuccess) return;
    if (secondsLeft <= 0) {
      router.replace('/konto');
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [isSuccess, secondsLeft, router]);

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-center">
        <Image
          src="/logo.png"
          alt="Bärenstark Logo"
          width={72}
          height={72}
          className="h-16 w-16 rounded-md object-contain"
        />
      </div>
      <div className="rounded-2xl border border-baerenstark-sand bg-white/85 p-6 shadow-card sm:p-8">
        {isSuccess ? (
          <Banner tone="success" title="Willkommen!" role="status">
            <p className="mb-2">Du bist erfolgreich angemeldet.</p>
            <p className="text-sm">
              Du wirst in {secondsLeft} Sekunde{secondsLeft === 1 ? '' : 'n'}{' '}
              weitergeleitet …
            </p>
            <p className="mt-3">
              <Link
                href="/konto"
                className="text-baerenstark-wood underline-offset-2 hover:underline"
              >
                Sofort zum Konto
              </Link>
            </p>
          </Banner>
        ) : (
          <Banner tone="info" title="Keine aktive Anmeldung erkannt" role="status">
            <p>
              Bitte melde dich erneut an.
            </p>
            <p className="mt-3">
              <Link
                href="/konto/login"
                className="text-baerenstark-wood underline-offset-2 hover:underline"
              >
                Zum Login
              </Link>
            </p>
          </Banner>
        )}
      </div>
    </section>
  );
}
