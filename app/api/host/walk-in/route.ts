import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateGuestTicketToken, requireHostSession } from '@/lib/waitlist-security';
import { createWaitlistEntry } from '@/lib/waitlist-store';
import { notifyHostStand, pingRestaurantQueueMoved } from '@/lib/waitlist-sse';

export const dynamic = 'force-dynamic';

const walkInSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  partySize: z.coerce.number().int().min(1).max(20),
  seatingPreference: z.enum(['inside', 'patio', 'either']).default('either'),
  phoneNumber: z
    .string()
    .trim()
    .max(30)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function POST(req: NextRequest) {
  const session = requireHostSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = walkInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid walk-in details' },
      { status: 400 }
    );
  }

  const { tokenHash, channelId } = generateGuestTicketToken();
  const entry = await createWaitlistEntry({
    restaurantSlug: session.restaurantSlug,
    guestName: parsed.data.name,
    partySize: parsed.data.partySize,
    seatingPreference: parsed.data.seatingPreference,
    phoneNumber: parsed.data.phoneNumber,
    tokenHash,
    channelId,
    source: 'walk_in',
  });

  notifyHostStand(session.restaurantSlug, 'walk_in_added');
  pingRestaurantQueueMoved(session.restaurantSlug);

  return NextResponse.json({ entry }, { status: 201 });
}
