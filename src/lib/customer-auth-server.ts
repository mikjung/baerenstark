/**
 * Node-only Helper für Kunden-Auth.
 *
 * Importiert `customer-auth.ts` (Edge-safe) UND Prisma. Diese Datei darf
 * NIE aus der Edge-Middleware geladen werden — sonst zieht Prisma in den
 * Edge-Build.
 *
 * IT6 / US-IT6-07 (F3-Resolution): nutzt `selectCustomerUserPublic()` —
 * `adminNote` und `adminRating` werden NIEMALS aus der DB gelesen, wenn
 * der Caller im Customer-Pfad ist. Der CI-Test
 * `tests/architecture/no-raw-customer-user-find.test.ts` erzwingt diese
 * Konvention.
 */

import type { NextRequest } from 'next/server';
import { prisma } from './prisma';
import {
  readCustomerSessionFromRequest,
  type CustomerSession,
} from './customer-auth';
import {
  selectCustomerUserPublic,
  type CustomerUserPublicRow,
} from './dto/user';

/**
 * Liest die Session aus dem Cookie UND lädt den `CustomerUser` aus der DB
 * mit dem **Public-Select**. Liefert `null`, wenn:
 *   - kein Cookie gesetzt ist,
 *   - das JWT ungültig/abgelaufen ist,
 *   - der Customer in der DB nicht (mehr) existiert.
 *
 * **Wichtig:** Das zurückgegebene Objekt enthält `passwordHash` (für die
 * `hasPassword`-Berechnung), aber NIEMALS `adminNote` oder `adminRating`.
 * Mapper `toCustomerPublic()` entfernt `passwordHash` aus der Response.
 */
export async function getCustomerFromRequest(
  req: NextRequest,
): Promise<CustomerUserPublicRow | null> {
  const session: CustomerSession | null =
    await readCustomerSessionFromRequest(req);
  if (!session) return null;

  const user = await prisma.customerUser.findUnique({
    where: { id: session.customerId },
    select: selectCustomerUserPublic(),
  });
  return user;
}

/**
 * Maps einen DB-`CustomerUser` auf die öffentliche API-Form
 * (`CustomerUserPublicSchema.strict()`). Entfernt `passwordHash`.
 *
 * IT6 (F3-Resolution): Output wird gegen das `.strict()`-Schema validiert,
 * bevor er ans Client-Objekt gereicht wird. Das stellt sicher, dass weder
 * `adminNote` noch `adminRating` (selbst bei zukünftigen Schema-Erweiterungen)
 * versehentlich durchlaufen.
 */
import { CustomerUserPublicSchema, type CustomerUserPublic } from './schemas';

export function toCustomerPublic(
  user: CustomerUserPublicRow,
): CustomerUserPublic {
  return CustomerUserPublicSchema.parse({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    emailVerified: user.emailVerified,
    oauthProvider: user.oauthProvider,
    avatarUrl: user.avatarUrl,
    hasPassword: user.passwordHash !== null && user.passwordHash !== undefined,
    // IT9 / US-IT9-02 — Default-Adresse mit-mappen.
    // Drei Felder MÜSSEN gemeinsam belegt werden, sonst wirft der Public-
    // Schema-Parse mit `Required` und Login/Register/oauth-finalize/me
    // crashen alle (extended Schemas erben von hier). `?? null` schützt
    // gegen alte Bestand-Rows ohne die neuen Felder (Prisma liefert
    // undefined statt null, wenn der Select neuer ist als die DB).
    streetAndNumber: user.streetAndNumber ?? null,
    postalCode: user.postalCode ?? null,
    city: user.city ?? null,
    createdAt: user.createdAt.toISOString(),
  });
}
