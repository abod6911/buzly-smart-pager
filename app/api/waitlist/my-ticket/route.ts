import { NextRequest, NextResponse } from 'next/server';
import { getGuestTokenFromRequest, hashGuestToken } from '@/lib/waitlist-security';
import { buildGuestProjection, findEntryByTokenHash } from '@/lib/waitlist-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const rawToken = getGuestTokenFromRequest(req);
  if (!rawToken) {
    return NextResponse.json({ error: 'No active ticket session' }, { status: 401 });
  }

  const tokenHash = hashGuestToken(rawToken);
  const entry = await findEntryByTokenHash(tokenHash);
  if (!entry) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const projection = await buildGuestProjection(entry);
  return NextResponse.json(
    { ticket: projection },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
