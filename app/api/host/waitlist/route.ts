import { NextRequest, NextResponse } from 'next/server';
import { requireHostSession } from '@/lib/waitlist-security';
import { getRestaurantDisplayName, listHostWaitlist } from '@/lib/waitlist-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = requireHostSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [data, restaurantName] = await Promise.all([
    listHostWaitlist(session.restaurantSlug),
    getRestaurantDisplayName(session.restaurantSlug),
  ]);

  return NextResponse.json(
    {
      ...data,
      restaurantSlug: session.restaurantSlug,
      restaurantName,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
