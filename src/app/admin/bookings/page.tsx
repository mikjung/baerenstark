import { redirect } from 'next/navigation';

// Tab "Buchungsanfragen" liegt direkt im Admin-Dashboard. Diese Route leitet
// dorthin um.
export default function AdminBookingsRedirect() {
  redirect('/admin');
}
