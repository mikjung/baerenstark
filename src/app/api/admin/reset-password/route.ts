import type { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';

const Schema = z.object({
  token: z.string().min(1),
  password: z.string().min(12, 'Mindestens 12 Zeichen.'),
});

export async function POST(req: NextRequest) {
  try {
    const body = Schema.safeParse(await req.json());
    if (!body.success) {
      const first = body.error.issues[0];
      return apiError({ code: 'VALIDATION_ERROR', message: first.message, field: String(first.path[0] ?? '') });
    }

    const user = await prisma.user.findFirst({
      where: { resetToken: body.data.token },
    });

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return apiError({ code: 'GONE', message: 'Der Reset-Link ist ungültig oder abgelaufen. Bitte erneut anfordern.' });
    }

    const hash = await bcrypt.hash(body.data.password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash, resetToken: null, resetTokenExpiry: null },
    });

    return apiSuccess({ reset: true });
  } catch (err) {
    console.error('[admin/reset-password]', err);
    return apiError({ code: 'INTERNAL_ERROR', message: 'Interner Fehler.' });
  }
}
