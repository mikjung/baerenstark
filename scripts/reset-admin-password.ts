/**
 * Setzt das Admin-Passwort zurück.
 * Aufruf: npx tsx scripts/reset-admin-password.ts <neues-passwort>
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  const newPassword = process.argv[2];
  if (!newPassword || newPassword.length < 12) {
    console.error('❌ Bitte ein Passwort mit mindestens 12 Zeichen angeben.');
    console.error('   Beispiel: npx tsx scripts/reset-admin-password.ts MeinNeuesPasswort2026!');
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, 10);
  const user = await db.user.updateMany({ data: { passwordHash: hash } });

  if (user.count === 0) {
    console.error('❌ Kein Admin-Account gefunden. Bitte zuerst /admin/setup aufrufen.');
    process.exit(1);
  }

  console.log('✅ Admin-Passwort wurde erfolgreich zurückgesetzt.');
  console.log('   Du kannst dich jetzt unter /admin/login einloggen.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
