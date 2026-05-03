import type { Metadata } from 'next';
import { Hero } from '@/components/home/Hero';
import { ServiceGrid } from '@/components/home/ServiceGrid';
import { About } from '@/components/home/About';
import { ReviewSection } from '@/components/home/ReviewSection';
import { JsonLd } from '@/components/seo/JsonLd';
import { localBusinessJsonLd } from '@/lib/seo/jsonLd';

export const metadata: Metadata = {
  title: 'Bärenstark Hausservice — Ihr Haus in bärenstarken Händen in Darmstadt',
  description:
    'Entrümpelung, Reinigung, Grünflächenpflege und mehr in Darmstadt und Umgebung. Zuverlässig, fair, transparent — direkt online buchen.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Bärenstark Hausservice — Hausservice in Darmstadt',
    description:
      'Entrümpelung, Entkernung, Reinigung, Grünflächenpflege, Mülltonnenservice und Schrottabfuhr in Darmstadt und Umgebung.',
    type: 'website',
    locale: 'de_DE',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bärenstark Hausservice — Hausservice in Darmstadt',
    description:
      'Zuverlässige Hausservice-Leistungen in Darmstadt — Entrümpelung, Reinigung, Grünflächenpflege.',
  },
};

export const revalidate = 600;

export default function HomePage() {
  return (
    <>
      <JsonLd data={localBusinessJsonLd()} />
      <Hero />
      <ServiceGrid />
      <About />
      <ReviewSection />
    </>
  );
}
