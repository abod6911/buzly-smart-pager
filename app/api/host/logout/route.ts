import { NextResponse } from 'next/server';
import { clearHostSessionCookie } from '@/lib/waitlist-security';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearHostSessionCookie(res);
  return res;
}
