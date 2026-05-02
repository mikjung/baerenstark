/**
 * /admin — Admin-Dashboard (geschützt via middleware + Server-Side-Auth-Check).
 *
 * Server-Component: prüft Session, leitet zu /admin/login um, falls nicht
 * authentifiziert. Rendert das Client-Dashboard mit Tabs für Buchungen und
 * Zeitfenster.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

export const metadata = {
  title: 'Admin-Bereich',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/admin/login');
  }
  return <AdminDashboard />;
}
