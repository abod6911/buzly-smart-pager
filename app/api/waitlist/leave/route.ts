import { NextRequest, NextResponse } from 'next/server';
import { getGuestTokenFromRequest, hashGuestToken } from '@/lib/waitlist-security';
import { buildGuestProjection, findEntryByTokenHash, updateEntryById } from '@/lib/waitlist-store';
import { notifyHostStand, pingRestaurantQueueMoved } from '@/lib/waitlist-sse';

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

  if (entry.status === 'seated' || entry.status === 'no_show' || entry.status === 'left') {
    const projection = await buildGuestProjection(entry);
    return NextResponse.json({ ticket: projection });
  }

  const updated = await updateEntryById(entry.id, entry.restaurantSlug, {
    status: 'left',
    resolvedAt: new Date().toISOString(),
  });

  if (!updated) {
    return NextResponse.json({ error: 'Failed to leave line' }, { status: 500 });
  }

  notifyHostStand(updated.restaurantSlug, 'guest_left');
  pingRestaurantQueueMoved(updated.restaurantSlug, updated.channelId);

  const projection = await buildGuestProjection(updated);
  return NextResponse.json({ ticket: projection });
}
