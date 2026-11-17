import { NextResponse } from 'next/server';
import { STAFF_COOKIE_NAME } from '@/lib/security';

function clearSession() {
  const res = NextResponse.json(
    { success: true, message: 'تم إغلاق الجلسة وقفل الشاشة بنجاح' },
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

export async function POST() {
  return clearSession();
}

export async function GET() {
  return clearSession();
}

export async function DELETE() {
  return clearSession();
}
