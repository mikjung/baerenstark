/**
 * Alias-Route für `/api/customer/verify` — gleiches Verhalten unter zweitem
 * Pfad. Implementierung ist in `../verify/route.ts`; hier nur die Re-Export-
 * Brücke, damit beide URLs (US-IT7-01-Spec und ältere Frontend-Helper)
 * bedient werden.
 */

import type { NextRequest } from 'next/server';
import { GET as verifyGet } from '../verify/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<Response> {
  return verifyGet(req);
}
