/**
 * Iteration 7 / US-IT7-04 — Admin-Bootstrap-Reset (BLOCKER).
 *
 * **Zweck:** Tom (oder ein Engineer) wird via einmaligem CLI-Run als
 * ACTIVE-Admin in der Datenbank wiederhergestellt — ohne dass der
 * F1-Bootstrap-Pfad (`/api/admin/setup`) benötigt wird. Das Skript
 * upserted in der `users`-Tabelle und ist idempotent.
 *
 * Sicherheits-Schichten:
 *   1. ENV `ALLOW_ADMIN_PROMOTE=true` ist Pflicht (analog ALLOW_USER_WIPE).
 *   2. CLI-only — kein HTTP-Endpoint, kein Public-Pfad.
 *   3. m4-IT7 (Shell-History-Schutz):
 *        - Ohne `--password=` wird das Passwort interaktiv aus stdin gelesen
 *          (ohne Echo, falls TTY); landet damit NICHT in der Shell-History.
 *        - Mit `--password=` wird ein prominenter WARN-Hinweis gedruckt
 *          („Das Passwort steht in deiner Shell-History — sofort ändern!").
 *
 * Aufruf (interaktiv, bevorzugt):
 *
 *   ALLOW_ADMIN_PROMOTE=true npx tsx scripts/promote-admin.ts \
 *     hausservice-baerenstark@outlook.com
 *
 *   → Skript fragt im Terminal nach dem Passwort (kein Echo bei TTY).
 *
 * Aufruf (legacy / nur falls Shell-History egal):
 *
 *   ALLOW_ADMIN_PROMOTE=true npx tsx scripts/promote-admin.ts \
 *     hausservice-baerenstark@outlook.com --password=Temp1234!Change
 *
 * Verhalten:
 *   - User existiert nicht UND Passwort gesetzt → CREATE mit
 *     `status='ACTIVE'`, `passwordHash=bcrypt(pwd, 12)`, `createdById=NULL`.
 *   - User existiert nicht UND kein Passwort → ABORT (Hinweis ans Terminal).
 *   - User existiert UND `--password` gesetzt → UPDATE `status='ACTIVE'` +
 *     `passwordHash=bcrypt(pwd, 12)`.
 *   - User existiert UND kein `--password` → UPDATE `status='ACTIVE'`,
 *     Hash bleibt unverändert.
 *
 * Idempotent — zweiter Run mit gleicher Email + gleichem Pwd ändert nichts
 * Substantielles, gibt nur „password-updated"/"already-active" als Output.
 *
 * F1/F2-Garantien:
 *   - F1 (Bootstrap-Allowlist): bleibt unangetastet. Nach erstem Run ist
 *     `count(users) >= 1` → `/api/admin/setup` antwortet weiter mit 410 GONE.
 *   - F2 (Letzter-Admin-Race): nicht relevant, das Skript aktiviert (setzt
 *     `status='ACTIVE'`), deaktiviert aber nie. Lock-out-Risiko = 0.
 */

import bcrypt from 'bcryptjs';
import * as readline from 'node:readline';
import { Writable } from 'node:stream';
import { prisma } from '../src/lib/prisma';

const MIN_PASSWORD_LENGTH = 12;

interface ParsedArgs {
  email: string;
  password: string | null;
  passwordFromCli: boolean;
}

function usage(): never {
  console.error(
    '\nUsage:\n' +
      '  ALLOW_ADMIN_PROMOTE=true npx tsx scripts/promote-admin.ts <email> [--password=<pwd>]\n\n' +
      'Beispiele:\n' +
      '  # Interaktiv (bevorzugt — kein Shell-History-Leak):\n' +
      '  ALLOW_ADMIN_PROMOTE=true npx tsx scripts/promote-admin.ts tom@example.de\n\n' +
      '  # Mit explizitem Passwort (NICHT empfohlen — Shell-History!):\n' +
      '  ALLOW_ADMIN_PROMOTE=true npx tsx scripts/promote-admin.ts tom@example.de --password=Temp1234!Change\n',
  );
  process.exit(1);
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const positional: string[] = [];
  let password: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith('--password=')) {
      password = arg.slice('--password='.length);
    } else if (arg === '--password') {
      // `--password` ohne Wert ist Tippfehler — abort.
      console.error(
        '[promote-admin] FEHLER — `--password` ohne Wert. Schreibweise: `--password=<pwd>`.',
      );
      usage();
    } else if (arg.startsWith('--')) {
      console.error(`[promote-admin] Unbekanntes Flag: ${arg}`);
      usage();
    } else {
      positional.push(arg);
    }
  }
  if (positional.length === 0) usage();
  if (positional.length > 1) {
    console.error('[promote-admin] FEHLER — nur eine Email-Adresse erwartet.');
    usage();
  }
  return {
    email: positional[0]!.trim().toLowerCase(),
    password,
    passwordFromCli: password !== null,
  };
}

/**
 * Liest ein Passwort von stdin. Bei TTY wird der Echo unterdrückt
 * (typische "kein-Echo"-Eingabe), sonst wird einfach line-buffered gelesen.
 */
async function readPasswordFromStdin(prompt: string): Promise<string> {
  // Wir nutzen einen "Mute"-Stream als Output-Sink, der NICHT auf den
  // Bildschirm schreibt — readline emittiert dann nichts. Den Prompt selbst
  // schreiben wir manuell auf stderr (bleibt nicht in Shell-History).
  process.stderr.write(prompt);

  const muted = new Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: muted,
    terminal: true,
  });

  // Terminal Echo aus, falls TTY.
  const isTTY = !!process.stdin.isTTY;
  if (isTTY && typeof process.stdin.setRawMode === 'function') {
    // setRawMode erlaubt char-weises Lesen ohne Echo; wir nutzen aber
    // trotzdem readline für die Eingabe-Logik. Der Mute-Stream verhindert
    // Echo bereits — setRawMode(true) hier nur als Hardening; auf manchen
    // Terminals würde das die Eingabe stören, also bewusst NICHT setzen.
  }

  const answer: string = await new Promise((resolve) => {
    rl.question('', (input) => {
      resolve(input);
      rl.close();
    });
  });

  // Newline für sauberes Terminal-Layout.
  process.stderr.write('\n');
  return answer;
}

async function main(): Promise<void> {
  // 1. ENV-Guard.
  const allowed = (process.env.ALLOW_ADMIN_PROMOTE ?? '').toLowerCase();
  if (allowed !== 'true' && allowed !== '1') {
    console.error(
      '\n[promote-admin] PROMOTE_NOT_ALLOWED:\n' +
        '  Setze ENV `ALLOW_ADMIN_PROMOTE=true`, um das Skript auszuführen.\n' +
        '  Beispiel:\n' +
        '    ALLOW_ADMIN_PROMOTE=true npx tsx scripts/promote-admin.ts tom@example.de\n',
    );
    process.exit(1);
  }

  // 2. Args parsen.
  const args = parseArgs(process.argv.slice(2));

  // 3. m4-IT7: Shell-History-Warnung wenn Passwort über CLI kam.
  if (args.passwordFromCli) {
    console.error(
      '\n[promote-admin] ⚠️  WARNUNG — Shell-History-Leak möglich.\n' +
        '  Du hast `--password=...` als CLI-Argument gesetzt. Der vollständige\n' +
        '  Befehl steht in deiner Shell-History (z.B. ~/.zsh_history).\n' +
        '  Bitte ändere das Passwort SOFORT nach dem Login über\n' +
        '  /admin/passwort-vergessen — sonst ist es weiter angreifbar.\n' +
        '  (zsh: `fc -p`; bash: `history -d <line>`)\n',
    );
  }

  // 4. Lookup.
  const existing = await prisma.user.findUnique({
    where: { email: args.email },
    select: { id: true, email: true, name: true, status: true },
  });

  // 5. Passwort bestimmen.
  //    - explizit via --password → nimm diesen.
  //    - sonst, falls kein User existiert → interaktiv abfragen (PFLICHT).
  //    - sonst, falls bestehender User → optional interaktiv abfragen.
  let plaintextPwd: string | null = args.password;
  if (!plaintextPwd && !existing) {
    // Neuer User — Passwort ist Pflicht.
    if (!process.stdin.isTTY) {
      console.error(
        '[promote-admin] ABORT — neuer Admin braucht ein Passwort, aber stdin ist kein TTY.\n' +
          '  Bitte interaktiv ausführen oder `--password=<pwd>` setzen.',
      );
      process.exit(1);
    }
    plaintextPwd = await readPasswordFromStdin(
      `[promote-admin] Neuer Admin "${args.email}" — Passwort eingeben (mind. ${MIN_PASSWORD_LENGTH} Zeichen): `,
    );
  } else if (!plaintextPwd && existing) {
    // Bestehender User — Passwort optional. Nur fragen, wenn TTY.
    if (process.stdin.isTTY) {
      const answer = await readPasswordFromStdin(
        `[promote-admin] User "${args.email}" existiert bereits.\n` +
          `  Neues Passwort eingeben (Enter = Hash unverändert lassen): `,
      );
      plaintextPwd = answer.length > 0 ? answer : null;
    }
  }

  // 6. Passwort-Validierung (falls vorhanden).
  if (plaintextPwd !== null && plaintextPwd.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `[promote-admin] ABORT — Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`,
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  const passwordHash = plaintextPwd
    ? await bcrypt.hash(plaintextPwd, 12)
    : null;

  // 7. Upsert.
  let outcome: 'created' | 'activated' | 'password-updated' | 'no-op';
  let result: { id: string; email: string; name: string; status: string };

  if (existing) {
    // Update-Pfad. status=ACTIVE setzen + ggf. passwordHash überschreiben.
    const wasAlreadyActive = existing.status === 'ACTIVE';
    const updated = await prisma.user.update({
      where: { email: args.email },
      data: {
        status: 'ACTIVE',
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: { id: true, email: true, name: true, status: true },
    });
    result = updated;
    if (passwordHash) {
      outcome = wasAlreadyActive ? 'password-updated' : 'activated';
    } else {
      outcome = wasAlreadyActive ? 'no-op' : 'activated';
    }
  } else {
    // Create-Pfad. Passwort ist Pflicht (oben enforced).
    if (!passwordHash) {
      console.error('[promote-admin] ABORT — neuer Admin braucht ein Passwort.');
      await prisma.$disconnect();
      process.exit(1);
    }
    const created = await prisma.user.create({
      data: {
        email: args.email,
        name: args.email.split('@')[0]!,
        passwordHash,
        status: 'ACTIVE',
        // createdById bleibt NULL (Bootstrap-Pfad).
      },
      select: { id: true, email: true, name: true, status: true },
    });
    result = created;
    outcome = 'created';
  }

  // 8. Output.
  const verbMap: Record<typeof outcome, string> = {
    created: 'CREATE — neuer Admin angelegt',
    activated: 'UPDATE — User aktiviert (status=ACTIVE)',
    'password-updated': 'UPDATE — Passwort aktualisiert (status bleibt ACTIVE)',
    'no-op': 'NO-OP — User war bereits ACTIVE, kein neues Passwort übergeben',
  };
  console.log(`\n[promote-admin] ${verbMap[outcome]}: ${result.email}`);
  console.log(JSON.stringify(result, null, 2));

  if (passwordHash && plaintextPwd) {
    console.log(
      '\n>>> Passwort gesetzt. Bitte SOFORT nach dem ersten Login\n' +
        '    über /admin/passwort-vergessen ändern.',
    );
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[promote-admin] FATAL', err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
