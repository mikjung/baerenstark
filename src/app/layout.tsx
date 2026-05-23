import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { HeaderOffsetSync } from '@/components/layout/HeaderOffsetSync';
import { Footer } from '@/components/layout/Footer';
import { Toaster } from '@/components/ui/Toast';
import { AnfrageDialogProvider } from '@/components/anfrage/AnfrageDialogProvider';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
});

export const metadata: Metadata = {
  title: {
    default: 'Bärenstark Hausservice — Ihr Haus in Bärenstarken Händen',
    template: '%s · Bärenstark Hausservice',
  },
  description:
    'Bärenstark Hausservice in Darmstadt: Entrümpelungen, Entkernung, Reinigung, Grünflächenpflege, Mülltonnenservice, Schrott- und Metallentsorgung. Zuverlässig, fair, transparent.',
  applicationName: 'Bärenstark Hausservice',
  robots: {
    index: true,
    follow: true,
    nocache: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F5EBDD',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={`${inter.variable} ${playfair.variable}`}>
      <body className="flex min-h-screen flex-col bg-baerenstark-cream font-sans text-baerenstark-bark">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-baerenstark-bark focus:px-3 focus:py-2 focus:text-baerenstark-cream"
        >
          Zum Hauptinhalt springen
        </a>
        <AnfrageDialogProvider>
          <Header />
          <HeaderOffsetSync />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </AnfrageDialogProvider>
        <Toaster />
      </body>
    </html>
  );
}
