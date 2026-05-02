/**
 * Re-Export der geteilten Zod-Schemas aus contracts/zod-schemas.ts.
 *
 * Diese Datei dient als kanonischer Import-Pfad innerhalb der App
 * (`@/lib/schemas`). Die Definitionen leben in
 * /contracts/zod-schemas.ts (Single Source of Truth für FE/BE-Vertrag).
 */

export * from '../../contracts/zod-schemas';
