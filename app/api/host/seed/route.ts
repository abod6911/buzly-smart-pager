import { NextRequest, NextResponse } from 'next/server';
import { requireHostSession } from '@/lib/waitlist-security';
import { seedSaturdayBrunchRush } from '@/lib/waitlist-store';
import { notifyHostStand } from '@/lib/waitlist-sse';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = requireHostSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await seedSaturdayBrunchRush(session.restaurantSlug);
  if (result.inserted > 0) {
    notifyHostStand(session.restaurantSlug, 'seeded_rush');
  }
  return NextResponse.json(result);
}
