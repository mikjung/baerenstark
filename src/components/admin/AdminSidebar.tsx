'use client';

/**
 * AdminSidebar — 3-Gruppen-Navigation für den Admin-Bereich (IT12-S14).
 *
 * Gruppen (admin-information-architecture.md §2):
 *   1. Kalender & Zeitmanagement
 *   2. Nutzerverwaltung
 *   3. Auswertungen
 *
 * Mobile (≤ 1024 px): kollabierter Akkordeon-Stack oben statt Sidebar.
 * Desktop: feste Sidebar links.
 *
 * Sprache: Deutsch (Sie-Form).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  icon: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Kalender & Zeitmanagement',
    icon: '📅',
    items: [
      { label: 'Kalender-Übersicht', href: '/admin/calendar' },
      // IT12-S14: Buchungsanfragen, Zeitfenster und Verfügbarkeit leben
      // im Dashboard als Tabs (AdminDashboard). Sidebar-Links nutzen
      // `?tab=…`-Query-Param, den das Dashboard auswertet.
      { label: 'Buchungsanfragen', href: '/admin/bookings' },
      { label: 'Zeitfenster', href: '/admin/slots' },
      { label: 'Verfügbarkeit', href: '/admin?tab=availability' },
    ],
  },
  {
    label: 'Nutzerverwaltung',
    icon: '👥',
    items: [
      { label: 'Kunden', href: '/admin/users' },
      { label: 'Marketing-Mails', href: '/admin/marketing' },
      { label: 'Admins', href: '/admin/admins' },
    ],
  },
  {
    label: 'Auswertungen',
    icon: '📊',
    items: [
      { label: 'Analytics', href: '/admin/analytics' },
      { label: 'Bewertungen', href: '/admin/reviews' },
    ],
  },
];

function isActive(currentPath: string, href: string): boolean {
  if (href === '/admin') return currentPath === '/admin';
  // Exakter Match oder Prefix mit Trenn-/Path-Boundary
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname() ?? '';
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile-Toggle */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-expanded={mobileOpen}
        aria-controls="admin-nav-list"
        className="mb-3 inline-flex items-center gap-2 rounded-md border border-baerenstark-sand bg-baerenstark-cream px-3 py-2 text-sm font-medium text-baerenstark-bark lg:hidden"
      >
        <span aria-hidden="true">{mobileOpen ? '✕' : '☰'}</span>
        Admin-Navigation
      </button>

      <nav
        id="admin-nav-list"
        aria-label="Admin-Navigation"
        className={[
          'rounded-lg border border-baerenstark-sand bg-white/70 p-3 lg:sticky lg:top-20 lg:block',
          mobileOpen ? 'block' : 'hidden lg:block',
        ].join(' ')}
      >
        <Link
          href="/admin"
          className={[
            'mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive(pathname, '/admin') &&
            !NAV_GROUPS.some((g) => g.items.some((i) => isActive(pathname, i.href)))
              ? 'bg-baerenstark-bark/10 text-baerenstark-bark border-l-4 border-baerenstark-bark'
              : 'text-baerenstark-bark/85 hover:bg-baerenstark-sand/40',
          ].join(' ')}
          aria-current={
            pathname === '/admin' ? 'page' : undefined
          }
        >
          <span aria-hidden="true">⌂</span> Dashboard
        </Link>

        {NAV_GROUPS.map((group) => {
          const groupActive = group.items.some((i) => isActive(pathname, i.href));
          return (
            <div key={group.label} className="mb-3">
              <div
                className={[
                  'mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide',
                  groupActive
                    ? 'bg-baerenstark-bark/10 text-baerenstark-bark border-l-4 border-baerenstark-bark'
                    : 'text-baerenstark-bark/70',
                ].join(' ')}
              >
                <span aria-hidden="true">{group.icon}</span>
                {group.label}
              </div>
              <ul role="list" className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={[
                          'block rounded-md px-3 py-2 text-sm transition-colors',
                          active
                            ? 'bg-baerenstark-cream/60 font-medium text-baerenstark-bark'
                            : 'text-baerenstark-bark/85 hover:bg-baerenstark-sand/40',
                        ].join(' ')}
                      >
                        ▸ {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </>
  );
}
