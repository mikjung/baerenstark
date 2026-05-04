import { redirect } from 'next/navigation';
import { requireActiveAdmin } from '@/lib/require-admin';

// Tab "Buchungsanfragen" liegt direkt im Admin-Dashboard. Diese Route leitet
// dorthin um.
//
// IT14 / US-IT14-S02 Schicht 3 — `requireActiveAdmin()` als Defense-in-Depth.
// Auch wenn die Server-Component nur redirected, holen wir uns den
// DISABLED-Check explizit, damit ein disabled Admin nicht via dieser Route
// die `/admin`-Seite trotzdem trifft (dort greift der Check zwar nochmal,
// aber Konsistenz mit den anderen Pages ist wichtig).
export default async function AdminBookingsRedirect() {
  await requireActiveAdmin();
  redirect('/admin');
}
