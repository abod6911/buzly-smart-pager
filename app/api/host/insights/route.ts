import { NextRequest, NextResponse } from 'next/server';
import { requireHostSession } from '@/lib/waitlist-security';
import { getOrGenerateOwnerBrief } from '@/lib/ai-brief';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = requireHostSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const brief = await getOrGenerateOwnerBrief(session.restaurantSlug);
  return NextResponse.json({ brief }, { headers: { 'Cache-Control': 'no-store' } });
}
