import { Suspense } from 'react';
import type { Metadata } from 'next';
import { BestaetigtClient } from './BestaetigtClient';
import { SkeletonCard } from '@/components/ui/Skeleton';

export const metadata: Metadata = {
  title: 'Termin bestätigt',
  description: 'Dein Alternativtermin bei Bärenstark Hausservice ist bestätigt.',
  robots: { index: false, follow: false },
};

export default function BestaetigtPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-20">
      <Suspense
        fallback={
          <div className="space-y-4">
            <SkeletonCard />
          </div>
        }
      >
        <BestaetigtClient />
      </Suspense>
    </div>
  );
}
