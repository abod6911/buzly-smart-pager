import { NextRequest, NextResponse } from 'next/server';
import { getGuestTokenFromRequest, hashGuestToken } from '@/lib/waitlist-security';
import { buildGuestProjection, findEntryByTokenHash, updateEntryById } from '@/lib/waitlist-store';
import { notifyHostStand } from '@/lib/waitlist-sse';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const rawToken = getGuestTokenFromRequest(req);
  if (!rawToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entry = await findEntryByTokenHash(hashGuestToken(rawToken));
  if (!entry) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  if (entry.status !== 'called' && entry.status !== 'on_my_way') {
    return NextResponse.json(
      { error: 'Ticket is not currently called' },
      { status: 409 }
    );
  }

  const updated =
    entry.status === 'on_my_way'
      ? entry
      : await updateEntryById(entry.id, entry.restaurantSlug, {
          status: 'on_my_way',
          acknowledgedAt: new Date().toISOString(),
        });

  if (!updated) {
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }

  notifyHostStand(updated.restaurantSlug, 'guest_on_my_way');
  const projection = await buildGuestProjection(updated);
  return NextResponse.json({ ticket: projection });
}
