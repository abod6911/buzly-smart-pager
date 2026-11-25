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
      { error: `Cannot mark no-show from status '${existing.status}'` },
      { status: 409 }
    );
  }

  const updated = await updateEntryById(id, session.restaurantSlug, {
    status: 'no_show',
    resolvedAt: new Date().toISOString(),
  });

  if (!updated) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  notifyTicketChannel(updated.channelId, {
    type: 'TICKET_STATUS',
    status: 'no_show',
    calledAt: updated.calledAt,
    claimDeadlineAt: null,
  });

  pingRestaurantQueueMoved(session.restaurantSlug, updated.channelId);
  notifyHostStand(session.restaurantSlug, 'entry_no_show');

  return NextResponse.json({ entry: updated });
}
