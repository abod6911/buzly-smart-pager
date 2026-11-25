import { NextRequest, NextResponse } from 'next/server';
import { requireHostSession } from '@/lib/waitlist-security';
import { getEntryById, updateEntryById } from '@/lib/waitlist-store';
import {
  notifyHostStand,
  notifyTicketChannel,
  pingRestaurantQueueMoved,
} from '@/lib/waitlist-sse';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = requireHostSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await getEntryById(id, session.restaurantSlug);
  if (!existing) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  if (
    existing.status !== 'waiting' &&
    existing.status !== 'called' &&
    existing.status !== 'on_my_way'
  ) {
    return NextResponse.json(
      { error: `Entry is already resolved ('${existing.status}')` },
      { status: 409 }
    );
  }

  const updated = await updateEntryById(id, session.restaurantSlug, {
    status: 'seated',
    resolvedAt: new Date().toISOString(),
  });

  if (!updated) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  notifyTicketChannel(updated.channelId, {
    type: 'TICKET_STATUS',
    status: 'seated',
    calledAt: updated.calledAt,
    claimDeadlineAt: null,
  });

  pingRestaurantQueueMoved(session.restaurantSlug, updated.channelId);
  notifyHostStand(session.restaurantSlug, 'entry_seated');

  return NextResponse.json({ entry: updated });
}
