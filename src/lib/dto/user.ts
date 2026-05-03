/**
 * DTO-Helper für `CustomerUser`-Selects.
 *
 * **F3-Resolution (siehe `ARCHITECTURE_IT6.md` Anhang B §17.3):**
 * Engineering-Convention „setze `select` per Hand" ist nicht durchsetzbar.
 * Diese Datei ist die **zentrale Wahrheit** für CustomerUser-Selects.
 *
 * **F3-Erweiterung IT7 (siehe `ARCHITECTURE_IT7.md` §6):**
 * Public-Helper darf NIEMALS die folgenden Felder ausliefern:
 *   - `passwordHash`             (Geheimnis — Hash, nie API-facing)
 *   - `verificationToken`        (Single-use Klartext-Token)
 *   - `verificationTokenExpiry`  (Hint auf User-Existenz)
 *   - `oauthId`                  (Provider-spezifische ID)
 *   - `adminNote` / `adminRating` (interne Admin-Felder, IT6)
 *
 * Regel:
 *   - Jeder Code-Pfad in `src/app/api/customer/*` und in
 *     `src/lib/customer-portal.ts`, der `prisma.customerUser.find*`
 *     aufruft, MUSS einen dieser Helper als `select` übergeben.
 *   - Direkter `findUnique({ where })` ohne `select` ist **verboten**.
 *   - Der CI-Test `tests/architecture/no-raw-customer-user-find.test.ts`
 *     (siehe §17.3.4) blockt PRs, die das umgehen.
 *   - `scripts/check-dto-leaks.ts` scannt zusätzlich auf forbidden field
 *     names im Source und ist Pflicht-Gate vor Merge.
 *
 * `selectCustomerUserPublic()`  → keine internen / sensiblen Felder.
 * `selectCustomerUserAdmin()`   → öffentliche Felder + interne Felder.
 *                                  Nur `/api/admin/users*` darf das nutzen.
 */

import type { Prisma } from '@prisma/client';

/**
 * Public-/Customer-Select.
 *
 * Enthält **niemals**:
 *   - `adminNote` / `adminRating`     — interne Admin-Felder (IT6).
 *   - `verificationToken`             — Single-use Klartext-Token.
 *   - `verificationTokenExpiry`       — Existenz-Hint, intern.
 *   - `oauthId`                       — Provider-User-ID.
 *
 * Strukturell garantiert via `satisfies Prisma.CustomerUserSelect` — selbst
 * wenn das Schema später um sensible Felder ergänzt wird, fällt jeder
 * Vergessene Eintrag bei Code-Review auf.
 *
 * `passwordHash` wird ausnahmsweise mitgezogen, damit der Mapper
 * `toCustomerPublic()` daraus `hasPassword` ableiten kann — wird aber
 * NIE in der Response durchgereicht.
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
    // IT9 / US-IT9-02 — Default-Adresse des Kunden. ALLE Customer-API-Pfade,
    // die `toCustomerPublic()` aufrufen (login, register, oauth-finalize,
    // /me), bekommen diese Felder. Drei MÜSSEN gemeinsam im Select sein,
    // sonst wirft `CustomerUserPublicSchema.parse()` mit `Required`.
    streetAndNumber: true,
    postalCode: true,
    city: true,
    createdAt: true,
    // BEWUSST AUSGESCHLOSSEN (F3-Erweiterung IT7):
    //   passwordHash:           im Select, NIE in Response (Mapper raus).
    //   verificationToken:      false (Geheimnis).
    //   verificationTokenExpiry false (Existenz-Hint).
    //   emailVerifiedAt:        intern, wird nicht im Public-Schema geführt.
    //   oauthId:                false (Provider-spezifisch).
    //   adminNote / adminRating false (Admin-only, IT6 §17.3).
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
    emailVerifiedAt: true,
    oauthProvider: true,
    avatarUrl: true,
    // IT6 / US-IT6-07 — interne Felder, NUR Admin:
    adminNote: true,
    adminRating: true,
    // IT9 / US-IT9-02 — Tom darf die Adresse im Admin-Drawer LESEN
    // (read-only). Edit-Pfad bleibt customer-only.
    streetAndNumber: true,
    postalCode: true,
    city: true,
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
