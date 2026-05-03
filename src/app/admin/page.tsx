/**
 * /admin — Admin-Dashboard (geschützt via middleware + Server-Side-Auth-Check).
 *
 * Server-Component: prüft Session, leitet zu /admin/login um, falls nicht
 * authentifiziert. Rendert das Client-Dashboard mit Tabs für Buchungen und
 * Zeitfenster.
 */

import { requireActiveAdmin } from '@/lib/require-admin';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

export const metadata = {
  title: 'Admin-Bereich',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // D2: Status-Check (DISABLED → redirect /admin/login?error=account_disabled).
  await requireActiveAdmin();
  return <AdminDashboard />;
}
