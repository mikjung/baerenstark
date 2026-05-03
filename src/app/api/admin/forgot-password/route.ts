import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { sendPasswordResetEmail } from '@/lib/mail';
import { adminBaseUrl } from '@/lib/baseUrl';

const Schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  try {
    const body = Schema.safeParse(await req.json());
    if (!body.success) {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Ungültige E-Mail-Adresse.', field: 'email' });
    }

    const user = await prisma.user.findUnique({ where: { email: body.data.email } });

    // Immer 200 — kein User-Enumeration-Leak
    if (!user) return apiSuccess({ sent: true });

    const token = crypto.randomUUID().replace(/-/g, '');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 Stunde

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });

    const base = adminBaseUrl();
    const resetUrl = `${base}/admin/passwort-reset?token=${token}`;
    void sendPasswordResetEmail(user.email, resetUrl);

    return apiSuccess({ sent: true });
  } catch (err) {
    console.error('[admin/forgot-password]', err);
    return apiError({ code: 'INTERNAL_ERROR', message: 'Interner Fehler.' });
  }
}
