/**
 * Iteration 6 / US-IT6-01 — Multi-Admin (PATCH + DELETE).
 *
 * PATCH  /api/admin/admins/:id  → Edit Name/Email/Status. Status-Wechsel
 *                                  zu DISABLED nutzt `disableAdminSafely()`
 *                                  (F2-Resolution, §17.2).
 * DELETE /api/admin/admins/:id  → Soft-Delete (= status='DISABLED'),
 *                                  identisch zu PATCH mit { status: 'DISABLED' }.
 *
 * Lock-out-Schutz:
 *   - SELF_MUTATION_FORBIDDEN: eingeloggter Admin kann sich nicht selbst
 *     deaktivieren oder löschen.
 *   - LAST_ADMIN_LOCK: letzter aktiver Admin kann nicht deaktiviert werden
 *     (atomar via Conditional UPDATE).
 */

import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  UpdateAdminSchema,
  AdminListItemSchema,
} from '@/lib/schemas';
import { apiError, apiSuccess, apiNoContent, internalError, zodErrorResponse } from '@/lib/api';
import { requireAdmin, isAdminError } from '@/lib/require-admin';
import { disableAdminSafely } from '@/lib/admin-status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function loadListItem(id: string) {
  const u = await prisma.user.findUnique({
    where: { id },
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
  if (!u) return null;
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

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const { id: targetId } = await ctx.params;
    if (!targetId) {
      return apiError({ code: 'NOT_FOUND', message: 'Admin nicht gefunden.' });
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }
    const body = UpdateAdminSchema.parse(json);

    // Self-Mutation-Check (Lock-out-Schutz).
    if (body.status === 'DISABLED' && targetId === me.id) {
      return apiError({
        code: 'SELF_MUTATION_FORBIDDEN',
        message:
          'Selbst-Deaktivierung ist verboten. Bitte einen anderen Admin um die Aktion bitten.',
      });
    }

    // Existenz prüfen.
    const existing = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, status: true, email: true },
    });
    if (!existing) {
      return apiError({ code: 'NOT_FOUND', message: 'Admin nicht gefunden.' });
    }

    // Status-Wechsel zu DISABLED — atomar via Helper (F2).
    if (body.status === 'DISABLED') {
      const ok = await disableAdminSafely(targetId);
      if (!ok) {
        // Entweder bereits DISABLED → idempotent 200; oder letzter aktiver
        // Admin → 409 LAST_ADMIN_LOCK.
        const after = await prisma.user.findUnique({
          where: { id: targetId },
          select: { status: true },
        });
        if (!after) {
          return apiError({ code: 'NOT_FOUND', message: 'Admin nicht gefunden.' });
        }
        if (after.status === 'DISABLED') {
          // Idempotent: 200 mit aktuellem Datensatz.
          const item = await loadListItem(targetId);
          return apiSuccess(item);
        }
        return apiError({
          code: 'LAST_ADMIN_LOCK',
          message: 'Mindestens ein aktiver Admin muss übrig bleiben.',
        });
      }

      // Falls zusätzlich Name/Email mitgeschickt — separat updaten.
      if (body.name !== undefined || body.email !== undefined) {
        try {
          await prisma.user.update({
            where: { id: targetId },
            data: {
              ...(body.name !== undefined ? { name: body.name } : {}),
              ...(body.email !== undefined ? { email: body.email.trim().toLowerCase() } : {}),
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
      }
      const item = await loadListItem(targetId);
      return apiSuccess(item);
    }

    // Status-Wechsel zu ACTIVE oder Name/Email-only-Update.
    try {
      const updated = await prisma.user.update({
        where: { id: targetId },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.email !== undefined ? { email: body.email.trim().toLowerCase() } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
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
      return apiSuccess(
        AdminListItemSchema.parse({
          id: updated.id,
          name: updated.name,
          email: updated.email,
          status: updated.status,
          createdAt: updated.createdAt.toISOString(),
          lastLoginAt: updated.lastLoginAt ? updated.lastLoginAt.toISOString() : null,
          createdById: updated.createdById,
        }),
      );
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
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const { id: targetId } = await ctx.params;
    if (!targetId) {
      return apiError({ code: 'NOT_FOUND', message: 'Admin nicht gefunden.' });
    }

    if (targetId === me.id) {
      return apiError({
        code: 'SELF_MUTATION_FORBIDDEN',
        message: 'Selbst-Löschen ist verboten.',
      });
    }

    const existing = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, status: true },
    });
    if (!existing) {
      return apiError({ code: 'NOT_FOUND', message: 'Admin nicht gefunden.' });
    }

    if (existing.status === 'DISABLED') {
      // Bereits soft-deleted → idempotent.
      return apiNoContent();
    }

    const ok = await disableAdminSafely(targetId);
    if (!ok) {
      const after = await prisma.user.findUnique({
        where: { id: targetId },
        select: { status: true },
      });
      if (after?.status === 'DISABLED') {
        return apiNoContent();
      }
      return apiError({
        code: 'LAST_ADMIN_LOCK',
        message: 'Mindestens ein aktiver Admin muss übrig bleiben.',
      });
    }

    return apiNoContent();
  } catch (err) {
    return internalError(err);
  }
}
