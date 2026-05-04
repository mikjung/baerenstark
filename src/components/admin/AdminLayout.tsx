'use client';

/**
 * AdminLayout — Wrapper für alle `/admin/*`-Routen mit 3-Gruppen-Sidebar
 * + Welcome-Hint-Banner (IT12-S14).
 */

import { ReactNode } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminWelcomeHintBanner } from './AdminWelcomeHintBanner';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
        <aside>
          <AdminSidebar />
        </aside>
        <main>
          <AdminWelcomeHintBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
