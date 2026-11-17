import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  checkPinLockout,
  recordPinFailure,
  recordPinSuccess,
  createSuperAdminToken,
  verifySuperAdminToken,
  SUPER_ADMIN_COOKIE_NAME,
} from '@/lib/security';
import crypto from 'crypto';

const masterPinSchema = z.object({
  pin: z.string().trim().min(1).max(64),
});

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = masterPinSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'الرمز المدخل غير صالح' },
        { status: 400 }
      );
    }

    const { pin } = parseResult.data;
    const clientIp = getClientIp(req);
    const rateLimitKey = `${clientIp}:master_super_admin`;

    // 1. Anti-Brute-Force Lockout Guard
    const lockoutStatus = checkPinLockout(rateLimitKey);
    if (!lockoutStatus.allowed) {
      return NextResponse.json(
        {
          success: false,
          locked: true,
          retryAfterSeconds: lockoutStatus.retryAfterSeconds,
          error: `تم حظر المحاولات مؤقتاً بسبب تكرار الأخطاء (حماية قصوى). يرجى الانتظار ${Math.ceil(
            (lockoutStatus.retryAfterSeconds || 900) / 60
          )} دقيقة.`,
        },
        { status: 429 }
      );
    }

    // 2. Expected Master Secret (From Env or Fallback)
    const expectedPin = process.env.MASTER_ADMIN_PIN || '8888';

    // Constant-time comparison
    const pinBuffer = Buffer.from(pin);
    const expectedBuffer = Buffer.from(expectedPin);
    const isValid =
      pinBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(pinBuffer, expectedBuffer);

    if (!isValid) {
      const failureResult = recordPinFailure(rateLimitKey);
      if (failureResult.locked) {
        return NextResponse.json(
          {
            success: false,
            locked: true,
            retryAfterSeconds: failureResult.retryAfterSeconds,
            error: 'تم تجاوز الحد الأقصى للمحاولات (5 محاولات). تم إقفال لوحة المالك لمدة 15 دقيقة لحمايتها.',
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          remainingAttempts: failureResult.remainingAttempts,
          error: `رمز المرور غير صحيح. يتبقى لديك ${failureResult.remainingAttempts} محاولات قبل الإغلاق الأمني.`,
        },
        { status: 401 }
      );
    }

    // 3. Success: issue Super Admin token
    recordPinSuccess(rateLimitKey);
    const token = createSuperAdminToken();

    const response = NextResponse.json(
      {
        success: true,
        message: 'تم التحقق من هوية مالك المنصة بنجاح',
        token,
      },
      { status: 200 }
    );

    response.cookies.set({
      name: SUPER_ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    console.error('Verify master pin error:', err);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ في الخادم أثناء التحقق' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const cookieToken = req.cookies.get(SUPER_ADMIN_COOKIE_NAME)?.value;
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
  const token = cookieToken || authHeader;

  if (token && verifySuperAdminToken(token)) {
    return NextResponse.json({ authenticated: true });
  }

  return NextResponse.json({ authenticated: false }, { status: 401 });
}
