import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// Default VAPID keys fallback for immediate testing
const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BPEhFElgcbeGL_YQ4svRzW5n174EW1MZL2rrTGD6IrrfuEB4qlp-gnHt2LA821tuRbU6Mlrd1JHvYAo2isHrl10';

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || '6hQOZdoNFuJdWmOo5ITNiNywR1WIJ43l1MdDUGK9Iro';

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@buzly.app';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.warn('VAPID setup warning:', err);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      subscription: directSubscription,
      orderNumber,
      title = 'طلبك جاهز للاستلام! 🍔',
      body: messageBody = 'تفضل بالتوجه إلى الكاونتر لاستلام وجبتك وهي ساخنة ولذيذة.',
      url,
    } = body;

    let targetSubscription = directSubscription;

    // If no direct subscription was passed, fetch from Supabase orders_queue by orderNumber
    if (!targetSubscription && orderNumber && isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('orders_queue')
        .select('push_subscription')
        .eq('order_number', String(orderNumber).trim())
        .single();

      if (!error && data?.push_subscription) {
        targetSubscription = data.push_subscription;
      }
    }

    if (!targetSubscription || !targetSubscription.endpoint) {
      return NextResponse.json(
        {
          success: false,
          message: 'No push subscription found for this order. Customer might be using in-tab notifications.',
        },
        { status: 200 } // Graceful 200 so UI doesn't break
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
    console.error('Web Push delivery error:', error);

    // If subscription has expired or unsubscribed (410 Gone / 404)
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
