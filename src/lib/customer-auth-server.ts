/**
 * Node-only Helper für Kunden-Auth.
 *
 * Importiert `customer-auth.ts` (Edge-safe) UND Prisma. Diese Datei darf
 * NIE aus der Edge-Middleware geladen werden — sonst zieht Prisma in den
 * Edge-Build.
 */

import type { NextRequest } from 'next/server';
import type { CustomerUser } from '@prisma/client';
import { prisma } from './prisma';
import {
  readCustomerSessionFromRequest,
  type CustomerSession,
} from './customer-auth';

/**
 * Liest die Session aus dem Cookie UND lädt den vollen `CustomerUser` aus
 * der DB. Liefert `null`, wenn:
 *   - kein Cookie gesetzt ist,
 *   - das JWT ungültig/abgelaufen ist,
 *   - der Customer in der DB nicht (mehr) existiert.
 *
 * Engineers-Hinweis: NIEMALS den `passwordHash` im Response zurückgeben.
 * Konsumenten von `getCustomerFromRequest()` sollten das Ergebnis durch
 * `toCustomerPublic()` schicken, bevor er an den Client geht.
 */
export async function getCustomerFromRequest(
  req: NextRequest,
): Promise<CustomerUser | null> {
  const session: CustomerSession | null =
    await readCustomerSessionFromRequest(req);
  if (!session) return null;

  const user = await prisma.customerUser.findUnique({
    where: { id: session.customerId },
  });
  return user;
}

/**
 * Maps einen DB-`CustomerUser` auf die öffentliche API-Form
 * (`CustomerUserPublicSchema`). Entfernt `passwordHash` und alle
 * Token-Felder. Iteration 5 fügt `oauthProvider`, `avatarUrl` und das
 * abgeleitete `hasPassword` hinzu (US-31 AC6 — Profil-Seite zeigt das
 * Pw-Feld nur, wenn ein lokales Passwort gesetzt ist).
 */
export function toCustomerPublic(user: CustomerUser): {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  emailVerified: boolean;
  createdAt: string;
  oauthProvider: string | null;
  avatarUrl: string | null;
  hasPassword: boolean;
} {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
    oauthProvider: user.oauthProvider,
    avatarUrl: user.avatarUrl,
    hasPassword: user.passwordHash !== null && user.passwordHash !== undefined,
  };
}
