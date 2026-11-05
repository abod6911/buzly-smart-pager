import { NextRequest, NextResponse } from 'next/server';
import {
  verifyStaffToken,
  STAFF_COOKIE_NAME,
} from '@/lib/security';

export async function GET(req: NextRequest) {
  // Check cookie first
  let token = req.cookies.get(STAFF_COOKIE_NAME)?.value;

  // Fallback to Authorization header: Bearer <token>
  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  const result = verifyStaffToken(token);
  if (!result.valid) {
    return NextResponse.json(
      { authenticated: false, expired: result.expired || false },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      slug: result.slug,
    },
    { status: 200 }
  );
}

export async function DELETE() {
  const res = NextResponse.json(
    { success: true, message: 'تم تسجيل الخروج بنجاح' },
    { status: 200 }
  );

  res.cookies.set({
    name: STAFF_COOKIE_NAME,
    value: '',
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
  });

  return res;
}
