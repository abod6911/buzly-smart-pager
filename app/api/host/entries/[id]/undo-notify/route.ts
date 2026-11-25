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

  if (existing.status !== 'called' && existing.status !== 'on_my_way') {
    return NextResponse.json(
      { error: `Cannot undo notify from status '${existing.status}'` },
      { status: 409 }
    );
  }

  // Preserves original joined_at so exact FIFO queue position is restored
  const updated = await updateEntryById(id, session.restaurantSlug, {
    status: 'waiting',
    calledAt: null,
    acknowledgedAt: null,
  });

  if (!updated) {
    return NextResponse.json({ error: 'Undo failed' }, { status: 500 });
  }

  notifyTicketChannel(updated.channelId, {
    type: 'TICKET_UNDONE',
    status: 'waiting',
    calledAt: null,
    claimDeadlineAt: null,
  });

  pingRestaurantQueueMoved(session.restaurantSlug, updated.channelId);
  notifyHostStand(session.restaurantSlug, 'notify_undone');

  return NextResponse.json({ entry: updated });
}
