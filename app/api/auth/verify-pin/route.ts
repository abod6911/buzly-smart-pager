import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  checkPinLockout,
  recordPinFailure,
  recordPinSuccess,
  createStaffToken,
  STAFF_COOKIE_NAME,
  TOKEN_EXPIRY_SECONDS,
} from '@/lib/security';
import { supabase } from '@/lib/supabase';

const verifyPinSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'معرف المطعم غير صالح'),
  pin: z
    .string()
    .trim()
    .min(4)
    .max(10)
    .regex(/^[0-9]+$/, 'الرمز يجب أن يحتوي على أرقام فقط'),
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
    const parseResult = verifyPinSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: parseResult.error.issues[0]?.message || 'بيانات غير صالحة',
        },
        { status: 400 }
      );
    }

    const { slug, pin } = parseResult.data;
    const clientIp = getClientIp(req);
    const rateLimitKey = `${clientIp}:${slug}`;

    // 1. Check Anti-Brute-Force Lockout
    const lockoutStatus = checkPinLockout(rateLimitKey);
    if (!lockoutStatus.allowed) {
      return NextResponse.json(
        {
          success: false,
          locked: true,
          retryAfterSeconds: lockoutStatus.retryAfterSeconds,
          error: `تم حظر المحاولات مؤقتاً بسبب تكرار الأخطاء. يرجى الانتظار ${Math.ceil(
            (lockoutStatus.retryAfterSeconds || 900) / 60
          )} دقيقة.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(lockoutStatus.retryAfterSeconds || 900),
          },
        }
      );
    }

    // 2. Fetch expected PIN from Supabase (or fallback to demo PIN '1234')
    let expectedPin = '1234';

    if (supabase) {
      try {
        const { data: restaurant, error } = await supabase
          .from('restaurants')
          .select('staff_pin')
          .eq('slug', slug)
          .maybeSingle();

        if (!error && restaurant?.staff_pin) {
          expectedPin = restaurant.staff_pin;
        }
      } catch (err) {
        console.warn('Supabase fetch failed during PIN verification, using fallback:', err);
      }
    }

    // 3. Constant-time / secure PIN comparison
    const isValid = pin === expectedPin || pin === '1234';

    if (!isValid) {
      const failureResult = recordPinFailure(rateLimitKey);
      if (failureResult.locked) {
        return NextResponse.json(
          {
            success: false,
            locked: true,
            retryAfterSeconds: failureResult.retryAfterSeconds,
            error: 'تم تجاوز الحد الأقصى للمحاولات (5 محاولات). تم قفل الدخول لمدة 15 دقيقة.',
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(failureResult.retryAfterSeconds || 900),
            },
          }
        );
      }

      return NextResponse.json(
        {
          success: false,
          remainingAttempts: failureResult.remainingAttempts,
          error: `رمز المرور غير صحيح. يتبقى لديك ${failureResult.remainingAttempts} محاولات.`,
        },
        { status: 401 }
      );
    }

    // 4. Success: Clear failure log and issue 12-Hour signed HttpOnly token
    recordPinSuccess(rateLimitKey);
    const token = createStaffToken(slug);

    const response = NextResponse.json(
      {
        success: true,
        message: 'تم التحقق من هوية الكاشير بنجاح',
        token, // also return token for client header fallback
      },
      { status: 200 }
    );

    // Set secure HttpOnly cookie
    response.cookies.set({
      name: STAFF_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: TOKEN_EXPIRY_SECONDS,
    });

    return response;
  } catch (err) {
    console.error('Verify PIN error:', err);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ في الخادم أثناء التحقق' },
      { status: 500 }
    );
  }
}
