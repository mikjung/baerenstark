/**
 * AuthCardShell — gemeinsamer Wrapper für die Auth-Seiten unter `/konto/*`.
 *
 * Layout: Logo oben, zentriertes Card-Layout, Braun/Beige-Farbschema.
 * Server-Component (kein Client-State); Forms werden als Children eingefügt.
 */

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface AuthCardShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Optionaler Footer-Slot unter der Card (Login-Link etc.). */
  footer?: ReactNode;
}

export function AuthCardShell({ title, subtitle, children, footer }: AuthCardShellProps) {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-center">
        <Link
          href="/"
          aria-label="Bärenstark Hausservice — Startseite"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
        >
          <Image
            src="/logo.png"
            alt=""
            width={72}
            height={72}
            className="h-16 w-16 rounded-md object-contain"
            priority
          />
        </Link>
      </div>
      <div className="rounded-2xl border border-baerenstark-sand bg-white/85 p-6 shadow-card sm:p-8">
        <h1 className="mb-2 font-serif text-2xl font-bold text-baerenstark-bark">
          {title}
        </h1>
        {subtitle && (
          <p className="mb-6 text-sm text-baerenstark-bark/80">{subtitle}</p>
        )}
        {children}
      </div>
      {footer && <div className="mt-4 text-center text-sm">{footer}</div>}
    </section>
  );
}
