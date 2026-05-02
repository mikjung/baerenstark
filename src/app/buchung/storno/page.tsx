import { Suspense } from 'react';
import type { Metadata } from 'next';
import { StornoClient } from './StornoClient';
import { SkeletonCard } from '@/components/ui/Skeleton';

export const metadata: Metadata = {
  title: 'Anfrage storniert',
  description: 'Deine Buchungsanfrage bei Bärenstark Hausservice wurde storniert.',
  robots: { index: false, follow: false },
};

export default function StornoPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-20">
      <Suspense
        fallback={
          <div className="space-y-4">
            <SkeletonCard />
          </div>
        }
      >
        <StornoClient />
      </Suspense>
    </div>
  );
}
