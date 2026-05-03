/**
 * Iteration 6 / US-IT6-01 — Multi-Admin-Verwaltung.
 *
 * GET  /api/admin/admins         → Liste aller Admins (auch DISABLED).
 * POST /api/admin/admins         → Legt neuen Admin an (Email-Allowlist
 *                                  via UNIQUE-Constraint, kein Allowlist-
 *                                  Gate hier — der eingeloggte Admin ist
 *                                  bereits authorisiert).
 *
 * Sortierung: `createdAt asc`.
 */

import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  CreateAdminSchema,
  AdminListItemSchema,
} from '@/lib/schemas';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { requireAdmin, isAdminError } from '@/lib/require-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface AdminRow {
  id: string;
  email: string;
  name: string;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  createdById: string | null;
}

function toListItem(u: AdminRow) {
  return AdminListItemSchema.parse({
    id: u.id,
    name: u.name,
    email: u.email,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdById: u.createdById,
  });
}

export async function GET(): Promise<Response> {
  try {
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const admins = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        createdById: true,
      },
    });

    return apiSuccess({
      data: admins.map(toListItem),
      total: admins.length,
    });
  } catch (err) {
    return internalError(err);
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }

    const data = CreateAdminSchema.parse(json);
    const email = data.email.trim().toLowerCase();

    const passwordHash = await bcrypt.hash(data.password, 10);

    let created;
    try {
      created = await prisma.user.create({
        data: {
          email,
          name: data.name.trim(),
          passwordHash,
          status: 'ACTIVE',
          createdById: me.id,
        },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          createdById: true,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return apiError({
          code: 'CONFLICT',
          message: 'E-Mail-Adresse ist bereits vergeben.',
          field: 'email',
        });
      }
      throw err;
    }

    return apiSuccess(toListItem(created), 201);
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
