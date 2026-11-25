import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getLiveJoinEstimate, getRestaurantDisplayName } from '@/lib/waitlist-store';
import { SeatingPreference } from '@/types/waitlist';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  slug: z.string().trim().min(1).max(50).regex(/^[a-z0-9-]+$/).default('demo-cafe'),
  partySize: z.coerce.number().int().min(1).max(20).default(2),
  seating: z.enum(['inside', 'patio', 'either']).default('either'),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    slug: searchParams.get('slug') || 'demo-cafe',
    partySize: searchParams.get('partySize') || '2',
    seating: searchParams.get('seating') || 'either',
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const { slug, partySize, seating } = parsed.data;
  const [estimate, restaurantName] = await Promise.all([
    getLiveJoinEstimate(slug, partySize, seating as SeatingPreference),
    getRestaurantDisplayName(slug),
  ]);

  return NextResponse.json(
    {
      ...estimate,
      restaurantSlug: slug,
      restaurantName,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
