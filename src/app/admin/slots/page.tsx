import { redirect } from 'next/navigation';

// Tab "Zeitfenster" liegt direkt im Admin-Dashboard. Diese Route leitet
// dorthin um, damit alte Links / Bookmarks weiterhin funktionieren.
export default function AdminSlotsRedirect() {
  redirect('/admin');
}
