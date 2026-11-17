import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  checkSuperAdminLockout,
  recordSuperAdminFailure,
  recordSuperAdminSuccess,
  createSuperAdminToken,
  verifySuperAdminToken,
  SUPER_ADMIN_COOKIE_NAME,
} from '@/lib/security';
import crypto from 'crypto';

const masterAuthSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().trim().min(1).max(128),
});

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      // Dummy compare to avoid timing leak
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // Artificial delay against high-frequency bot probing
  await new Promise((r) => setTimeout(r, 650));

  try {
    const body = await req.json();
    const parseResult = masterAuthSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'بيانات الدخول غير مكتملة أو غير صالحة' },
        { status: 400 }
      );
    }

    const { username, password } = parseResult.data;
    const clientIp = getClientIp(req);

    // 1. Strict 3-Strike Lockout Check
    const lockoutStatus = checkSuperAdminLockout(clientIp);
    if (!lockoutStatus.allowed) {
      return NextResponse.json(
        {
          success: false,
          locked: true,
          retryAfterSeconds: lockoutStatus.retryAfterSeconds,
          error: `تم إقفال الدخول للوحة المالك وحظر عنوانك الأمني مؤقتاً بسبب تكرار الأخطاء (حماية مشددة). يرجى الانتظار ${Math.ceil(
            (lockoutStatus.retryAfterSeconds || 1800) / 60
          )} دقيقة للمحاولة مجدداً.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(lockoutStatus.retryAfterSeconds || 1800),
          },
        }
      );
    }

    // 2. Expected Master Credentials
    // Username defaults to 'owner' (or process.env.MASTER_ADMIN_USER)
    // Password defaults to 'Buzly@Owner#2026!' (or process.env.MASTER_ADMIN_PASSWORD)
    const expectedUsername = (process.env.MASTER_ADMIN_USER || 'owner').trim();
    const expectedPassword = (process.env.MASTER_ADMIN_PASSWORD || 'Buzly@Owner#2026!').trim();

    const isUserValid = safeCompare(username, expectedUsername);
    const isPassValid = safeCompare(password, expectedPassword);

    if (!isUserValid || !isPassValid) {
      const failureResult = recordSuperAdminFailure(clientIp);

      if (failureResult.locked) {
        return NextResponse.json(
          {
            success: false,
            locked: true,
            retryAfterSeconds: failureResult.retryAfterSeconds,
            error: 'تم تجاوز الحد الأقصى للمحاولات (3 محاولات غير مصرح بها). تم إقفال النظام وحظر هذا الجهاز لمدة 30 دقيقة.',
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          remainingAttempts: failureResult.remainingAttempts,
          error: `معرف المالك أو مفتاح التشفير السري غير صحيح. يتبقى لديك ${failureResult.remainingAttempts} محاولة قبل الحظر الأمني التام.`,
        },
        { status: 401 }
      );
    }

    // 3. Authentication Succeeded -> Issue Secure Token
    recordSuperAdminSuccess(clientIp);
    const token = createSuperAdminToken();

    const response = NextResponse.json(
      {
        success: true,
        message: 'تم فك التشفير والتحقق من هوية مالك المنصة بنجاح',
        token,
      },
      { status: 200 }
    );

    // Set hardened HttpOnly cookie
    response.cookies.set({
      name: SUPER_ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 4 * 60 * 60, // 4 Hours
    });

    return response;
  } catch (err) {
    console.error('Verify master error:', err);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ غير متوقع في الخادم الأمني' },
      { status: 500 }
    );
  }
}

// Check session status
export async function GET(req: NextRequest) {
  const cookieToken = req.cookies.get(SUPER_ADMIN_COOKIE_NAME)?.value;
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
  const token = cookieToken || authHeader;

  if (token && verifySuperAdminToken(token)) {
    return NextResponse.json({ authenticated: true });
  }

  return NextResponse.json({ authenticated: false }, { status: 401 });
}

// Destroy session
export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'تم إنهاء الجلسة وتطهير التوكن' });
  response.cookies.set({
    name: SUPER_ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}
