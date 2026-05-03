/**
 * Iteration 6 / F3-Resolution + m2-Resolution + IT7-Erweiterung — DTO-Leak-Check.
 *
 * Architektur-Test ohne externe Test-Library: scannt
 *   - `src/app/api/customer/**`
 *   - `src/lib/customer-portal.ts`, `src/lib/customer-auth-server.ts`
 *
 * auf folgende Anti-Patterns:
 *   1. (F3) `prisma.customerUser.find*` ohne `selectCustomerUserPublic()`
 *      oder `select:` mit `selectCustomerUserPublic` Reference.
 *   2. (m2) `sort` mit Verweis auf interne Felder
 *      (`adminRating`, `adminNote`, `finalPriceEur`).
 *   3. (F3-IT7) Forbidden Field Names in Object-Literals / JSON-Builder im
 *      Customer-Pfad: `passwordHash`, `verificationToken`,
 *      `verificationTokenExpiry`, `oauthId`, `adminNote`, `adminRating`.
 *      Heuristik: jede Source-Zeile, die `<feldname>:` enthält und nicht
 *      explizit als „intern" markiert ist (`select`-Block, Mapper-Drop)
 *      bekommt einen Treffer.
 *
 * Exit-Code 1 bei Treffern. Wird in CI vor Merge ausgeführt.
 *
 * Aufruf: `npx tsx scripts/check-dto-leaks.ts`
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

/**
 * IT7-Erweiterung: Diese Feldnamen dürfen in Customer-Response-Pfaden
 * NIEMALS in Object-Literals / NextResponse.json()-Bodies auftauchen.
 * Erlaubt sind sie:
 *   - in `select`-Blöcken (DB-Read; F3-Helper schützt)
 *   - in Drop-Mapper-Pfaden (z.B. `delete obj.passwordHash`)
 */
const FORBIDDEN_FIELDS = [
  'passwordHash',
  'verificationToken',
  'verificationTokenExpiry',
  'oauthId',
  'adminNote',
  'adminRating',
];

interface Offender {
  file: string;
  line: number;
  text: string;
  rule: 'F3' | 'm2' | 'F3-IT7';
}

async function walk(dir: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (
        e.name === 'node_modules' ||
        e.name === '.next' ||
        e.name === 'dist'
      )
        continue;
      await walk(full, out);
    } else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) {
      out.push(full);
    }
  }
}

async function scanFile(file: string): Promise<Offender[]> {
  const content = await fs.readFile(file, 'utf8');
  const lines = content.split('\n');
  const offenders: Offender[] = [];

  // F3: nur in Customer-Pfaden prüfen.
  const isCustomerPath =
    file.includes('/src/app/api/customer/') ||
    file.endsWith('/src/lib/customer-portal.ts') ||
    file.endsWith('/src/lib/customer-auth-server.ts');

  if (isCustomerPath) {
    // Match prisma.customerUser.find{Unique,First,Many} ohne
    // selectCustomerUserPublic in der nahen Umgebung (next 30 lines).
    for (let i = 0; i < lines.length; i++) {
      const m = /prisma\.customerUser\.find(Unique|First|Many)\b/.exec(lines[i]);
      if (m) {
        // Schaue im Block um den Match herum (bis nächster `;` oder `})`).
        const block = lines.slice(i, Math.min(lines.length, i + 30)).join('\n');
        // Wir akzeptieren `selectCustomerUserPublic` ODER eine inline-
        // select-Definition mit den Public-Felder-Limits. Strikt: muss
        // den Helper-Namen enthalten.
        if (!/selectCustomerUserPublic/.test(block)) {
          offenders.push({
            file,
            line: i + 1,
            text: lines[i].trim().slice(0, 140),
            rule: 'F3',
          });
        }
      }
    }

    // m2: sort-Param mit Bezug auf interne Felder.
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/sort.*(adminRating|adminNote|finalPriceEur)/.test(l)) {
        offenders.push({
          file,
          line: i + 1,
          text: l.trim().slice(0, 140),
          rule: 'm2',
        });
      }
    }

    // F3-IT7: forbidden field names in JSON-Builder / Object-Literal in
    // Response-bauenden Code-Stellen. Wir markieren die Datei zeilenweise
    // und überspringen Stellen, die offensichtlich erlaubt sind:
    //   - in `select:`-Blöcken (Prisma-Read-Helper; geschützt durch F3-Helper)
    //   - in Kommentaren (`//` oder `*`)
    //   - in `delete`-/`omit`-Pfaden (Mapper, der das Feld AKTIV entfernt)
    //   - in `data: {`-Blöcken (Prisma-WRITE — kein API-Output, hier Pflicht).
    let inSelectBlock = false;
    let inDataBlock = false;
    let braceDepth = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const trimmed = l.trim();
      // Block-Tracker: `select: {` öffnet, schließendes `}` auf gleicher Tiefe schließt.
      if (/(\W|^)select\s*:\s*\{/.test(l)) {
        inSelectBlock = true;
        braceDepth = (l.match(/\{/g) ?? []).length - (l.match(/\}/g) ?? []).length;
      } else if (/(\W|^)data\s*:\s*\{/.test(l)) {
        inDataBlock = true;
        braceDepth = (l.match(/\{/g) ?? []).length - (l.match(/\}/g) ?? []).length;
      } else if (inSelectBlock || inDataBlock) {
        const opens = (l.match(/\{/g) ?? []).length;
        const closes = (l.match(/\}/g) ?? []).length;
        braceDepth += opens - closes;
        if (braceDepth <= 0) {
          inSelectBlock = false;
          inDataBlock = false;
          braceDepth = 0;
        }
      }
      if (inSelectBlock || inDataBlock) continue;
      // Kommentar überspringen.
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
      // delete obj.passwordHash o.ä. überspringen.
      if (/\bdelete\s+\w+\.\w+/.test(l)) continue;

      for (const field of FORBIDDEN_FIELDS) {
        // Pattern: `<field>:` in Source — Object-Literal-Property.
        // Vermeidet false-positives bei String-Literalen ('passwordHash')
        // oder Type-Properties.
        const re = new RegExp(`\\b${field}\\s*:\\s*(?!//)`);
        if (re.test(l) && !/['"\`]/.test(l.split(field)[0] ?? '')) {
          offenders.push({
            file,
            line: i + 1,
            text: trimmed.slice(0, 140),
            rule: 'F3-IT7',
          });
        }
      }
    }
  }

  return offenders;
}

async function main(): Promise<void> {
  const files: string[] = [];
  await walk(path.join(ROOT, 'src', 'app', 'api', 'customer'), files);
  files.push(path.join(ROOT, 'src', 'lib', 'customer-portal.ts'));
  files.push(path.join(ROOT, 'src', 'lib', 'customer-auth-server.ts'));

  let allOffenders: Offender[] = [];
  for (const file of files) {
    const off = await scanFile(file);
    allOffenders = allOffenders.concat(off);
  }

  if (allOffenders.length === 0) {
    console.log('[check-dto-leaks] OK — keine Customer-DTO-Leaks gefunden.');
    process.exit(0);
  }

  console.error('[check-dto-leaks] FAIL — folgende Stellen verletzen die DTO-Konvention:');
  for (const o of allOffenders) {
    console.error(
      `  [${o.rule}] ${path.relative(ROOT, o.file)}:${o.line}  ${o.text}`,
    );
  }
  console.error(
    '\nFix:\n' +
      '  - F3: jeder `prisma.customerUser.find*` in /api/customer/* MUSS\n' +
      '        `selectCustomerUserPublic()` als select übergeben.\n' +
      '  - m2: kein `sort`-Parameter darf im Customer-Pfad auf Admin-only-\n' +
      '        Felder (`adminRating`, `adminNote`, `finalPriceEur`) abbilden.\n' +
      '  - F3-IT7: `passwordHash`/`verificationToken`/`oauthId` etc. dürfen\n' +
      '        in Customer-Response-Bodies NICHT erscheinen. Nutze\n' +
      '        `selectCustomerUserPublic()` + `toCustomerPublic()`-Mapper.\n',
  );
  process.exit(1);
}

main().catch((err) => {
  console.error('[check-dto-leaks] CRASH:', err);
  process.exit(2);
});
