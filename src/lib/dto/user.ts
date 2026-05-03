/**
 * Iteration 6 / US-IT6-07 — DTO-Helper für `CustomerUser`-Selects.
 *
 * **F3-Resolution (siehe `ARCHITECTURE_IT6.md` Anhang B §17.3):**
 * Engineering-Convention „setze `select` per Hand" ist nicht durchsetzbar.
 * Diese Datei ist die **zentrale Wahrheit** für CustomerUser-Selects.
 *
 * Regel:
 *   - Jeder Code-Pfad in `src/app/api/customer/*` und in
 *     `src/lib/customer-portal.ts`, der `prisma.customerUser.find*`
 *     aufruft, MUSS einen dieser Helper als `select` übergeben.
 *   - Direkter `findUnique({ where })` ohne `select` ist **verboten**.
 *   - Der CI-Test `tests/architecture/no-raw-customer-user-find.test.ts`
 *     (siehe §17.3.4) blockt PRs, die das umgehen.
 *
 * `selectCustomerUserPublic()`  → keine internen Felder (`adminNote`,
 *                                  `adminRating`).
 * `selectCustomerUserAdmin()`   → öffentliche Felder + interne Felder.
 *                                  Nur `/api/admin/users*` darf das nutzen.
 */

import type { Prisma } from '@prisma/client';

/**
 * Public-/Customer-Select.
 *
 * Enthält **niemals** `adminNote` oder `adminRating`. Strukturell garantiert,
 * dass keine internen Felder rausgehen — selbst wenn das Schema später
 * erweitert wird (per `satisfies Prisma.CustomerUserSelect` typt
 * TypeScript jeden Feldzugriff).
 *
 * Auch `passwordHash`, `verificationToken`, `resetToken`, `resetTokenExpiry`,
 * `verificationTokenExpiry`, `oauthId` werden NICHT gewählt. Wir leiten
 * `hasPassword` im Mapper aus `passwordHash !== null` ab.
 */
export const selectCustomerUserPublic = () =>
  ({
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
    emailVerified: true,
    oauthProvider: true,
    avatarUrl: true,
    // Hinweis: passwordHash kommt mit, damit Mapper `hasPassword` ableiten
    // kann — aber NICHT in der Response. Mapper muss explizit raus-mappen.
    passwordHash: true,
    createdAt: true,
  }) satisfies Prisma.CustomerUserSelect;

/**
 * Admin-Select. Erweitert Public um die internen Felder.
 * Wird ausschließlich in `/api/admin/users*`-Endpoints verwendet.
 */
export const selectCustomerUserAdmin = () =>
  ({
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
    emailVerified: true,
    oauthProvider: true,
    avatarUrl: true,
    // IT6 / US-IT6-07 — interne Felder, NUR Admin:
    adminNote: true,
    adminRating: true,
    createdAt: true,
    updatedAt: true,
  }) satisfies Prisma.CustomerUserSelect;

/**
 * Type-Aliases. TypeScript zwingt die Caller, das richtige Shape zu
 * importieren — kein „raw row"-Pass-Through aus Prisma.
 */
export type CustomerUserPublicRow = Prisma.CustomerUserGetPayload<{
  select: ReturnType<typeof selectCustomerUserPublic>;
}>;

export type CustomerUserAdminRow = Prisma.CustomerUserGetPayload<{
  select: ReturnType<typeof selectCustomerUserAdmin>;
}>;
