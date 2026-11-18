import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifySuperAdminToken, SUPER_ADMIN_COOKIE_NAME } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  // Verify super admin session
  const cookie = req.cookies.get(SUPER_ADMIN_COOKIE_NAME);
  if (!cookie?.value || !verifySuperAdminToken(cookie.value)) {
    return NextResponse.json({ success: false, error: 'غير مصرح' }, { status: 401 });
  }

  const isPasswordCustomized = Boolean(process.env.MASTER_ADMIN_PASSWORD);
  const isUserCustomized = Boolean(process.env.MASTER_ADMIN_USER);
  const isSecretCustomized = Boolean(process.env.STAFF_TOKEN_SECRET);
  const isSupabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  // Generate strong production values for one-click setup
  const randomChars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  let generatedPassword = 'Buzly@';
  for (let i = 0; i < 12; i++) {
    generatedPassword += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
  }
  generatedPassword += '#2026';

  const generatedSecret = crypto.randomBytes(32).toString('hex');
  const recommendedUser = 'admin_buzly';

  return NextResponse.json({
    success: true,
    status: {
      isPasswordCustomized,
      isUserCustomized,
      isSecretCustomized,
      isSupabaseConfigured,
      currentUsername: process.env.MASTER_ADMIN_USER || 'owner (افتراضي)',
    },
    generated: {
      recommendedUser,
      generatedPassword,
      generatedSecret,
    },
  });
}
