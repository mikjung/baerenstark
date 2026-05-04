import { redirect } from 'next/navigation';
import { requireActiveAdmin } from '@/lib/require-admin';

// Tab "Zeitfenster" liegt direkt im Admin-Dashboard. Diese Route leitet
// dorthin um, damit alte Links / Bookmarks weiterhin funktionieren.
//
// IT14 / US-IT14-S02 Schicht 3 — `requireActiveAdmin()` als Defense-in-Depth.
export default async function AdminSlotsRedirect() {
  await requireActiveAdmin();
  redirect('/admin');
}
