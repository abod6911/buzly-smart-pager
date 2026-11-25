import { NextRequest, NextResponse } from 'next/server';
import { requireHostSession } from '@/lib/waitlist-security';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = requireHostSession(req);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    session: {
      email: session.email,
      restaurantSlug: session.restaurantSlug,
      role: session.role,
    },
  });
}
