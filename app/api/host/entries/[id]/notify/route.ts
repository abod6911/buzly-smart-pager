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

  if (existing.status !== 'waiting') {
    return NextResponse.json(
      { error: `Cannot notify entry in status '${existing.status}'` },
      { status: 409 }
    );
  }

  const calledAt = new Date().toISOString();
  const claimDeadlineAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const updated = await updateEntryById(id, session.restaurantSlug, {
    status: 'called',
    calledAt,
    acknowledgedAt: null,
  });

  if (!updated) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  // Targeted sub-second buzz ONLY to this guest's opaque channelId
  notifyTicketChannel(updated.channelId, {
    type: 'TICKET_CALLED',
    status: 'called',
    calledAt,
    claimDeadlineAt,
  });

  // Anonymous ping to other waiting guests so their rank updates
  pingRestaurantQueueMoved(session.restaurantSlug, updated.channelId);
  notifyHostStand(session.restaurantSlug, 'entry_notified');

  return NextResponse.json({ entry: updated });
}
