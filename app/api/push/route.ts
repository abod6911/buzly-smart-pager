import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { z } from 'zod';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { checkGeneralRateLimit } from '@/lib/security';

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BPEhFElgcbeGL_YQ4svRzW5n174EW1MZL2rrTGD6IrrfuEB4qlp-gnHt2LA821tuRbU6Mlrd1JHvYAo2isHrl10';

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || '6hQOZdoNFuJdWmOo5ITNiNywR1WIJ43l1MdDUGK9Iro';

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@chimer.app';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.warn('VAPID setup warning:', err);
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

const pushPayloadSchema = z.object({
  subscription: z
    .object({
      endpoint: z.string().url('رابط إشعار غير صالح'),
      keys: z.object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
      }),
    })
    .optional(),
  orderNumber: z
    .string()
    .trim()
    .min(1)
    .max(8)
    .regex(/^[0-9A-Za-z-]+$/)
    .optional(),
  title: z.string().max(100).optional(),
  body: z.string().max(300).optional(),
  url: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  let requestedOrderNumber: string | undefined;
  try {
    const ip = getClientIp(req);
    // Rate limit: 20 push requests per minute per IP
    const rl = checkGeneralRateLimit(`push_req:${ip}`, 20, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'تم تجاوز معدل إرسال الإشعارات المسموح' },
        { status: 429, headers: { 'Retry-After': String(rl.resetSeconds) } }
      );
    }

    const rawBody = await req.json();
    const parseResult = pushPayloadSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: parseResult.error.issues[0]?.message || 'بيانات الإشعار غير صالحة',
        },
        { status: 400 }
      );
    }

    const {
      subscription: directSubscription,
      orderNumber,
      title = 'طلبك جاهز للاستلام',
      body: messageBody = 'تفضل بالتوجه إلى الكاونتر لاستلام وجبتك وهي ساخنة ولذيذة.',
      url,
    } = parseResult.data;

    requestedOrderNumber = orderNumber;

    let targetSubscription = directSubscription;

    // If no direct subscription was passed, fetch from Supabase orders_queue by orderNumber
    if (!targetSubscription && orderNumber && isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('orders_queue')
        .select('push_subscription')
        .eq('order_number', String(orderNumber).trim())
        .maybeSingle();

      if (!error && data?.push_subscription) {
        targetSubscription = data.push_subscription as typeof directSubscription;
      }
    }

    if (!targetSubscription || !targetSubscription.endpoint) {
      return NextResponse.json(
        {
          success: false,
          message: 'No push subscription found for this order. Customer might be using in-tab notifications.',
        },
        { status: 200 }
      );
    }

    const payload = JSON.stringify({
      title,
      body: messageBody,
      orderNumber,
      url: url || (orderNumber ? `/track/${encodeURIComponent(orderNumber)}` : '/track'),
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      timestamp: Date.now(),
    });

    const pushResult = await webpush.sendNotification(targetSubscription, payload, {
      TTL: 60 * 60, // 1 hour TTL
      urgency: 'high',
    });

    return NextResponse.json({
      success: true,
      statusCode: pushResult.statusCode,
      message: 'Push notification sent successfully',
    });
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string };
    const statusCode = error.statusCode;

    // Graceful auto-prune for 410 Gone / 404 Not Found dead push subscriptions
    if (statusCode === 410 || statusCode === 404) {
      if (requestedOrderNumber && isSupabaseConfigured() && supabase) {
        try {
          await supabase
            .from('orders_queue')
            .update({ push_subscription: null })
            .eq('order_number', String(requestedOrderNumber).trim());
        } catch {}
      }

      return NextResponse.json(
        {
          success: true,
          ok: true,
          pruned: true,
          statusCode,
          message: 'Dead push subscription pruned cleanly without blocking caller',
        },
        { status: 200 }
      );
    }

    console.warn('Web Push delivery warning:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send web push notification',
        statusCode: error.statusCode,
      },
      { status: 200 }
    );
  }
}
