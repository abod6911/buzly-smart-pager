import { NextRequest, NextResponse } from 'next/server';
import {
  getRestaurantsStore,
  saveRestaurantToStore,
  deleteRestaurantFromStore,
} from '@/lib/restaurantStore';
import {
  verifySuperAdminToken,
  SUPER_ADMIN_COOKIE_NAME,
  verifyStaffToken,
  STAFF_COOKIE_NAME,
} from '@/lib/security';
import { Restaurant } from '@/types/queue';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isSuperAdmin(req: NextRequest): boolean {
  const token = req.cookies.get(SUPER_ADMIN_COOKIE_NAME)?.value;
  return Boolean(token && verifySuperAdminToken(token));
}

export async function GET(req: NextRequest) {
  const store = getRestaurantsStore();
  const owner = isSuperAdmin(req);

  // Never expose staffPin to unauthenticated callers
  const sanitizedStore: Record<string, Omit<Restaurant, 'staffPin'> & { staffPin?: string }> = {};
  for (const [slug, rest] of Object.entries(store)) {
    if (owner) {
      sanitizedStore[slug] = rest;
    } else {
      const { staffPin: _pin, ...publicFields } = rest;
      sanitizedStore[slug] = publicFields;
    }
  }

  return NextResponse.json(
    {
      success: true,
      restaurants: sanitizedStore,
      count: Object.keys(sanitizedStore).length,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurant, action } = body;
    const owner = isSuperAdmin(req);

    if (action === 'DELETE' && body.slug) {
      if (!owner) {
        return NextResponse.json(
          { success: false, error: 'غير مصرح — يتطلب صلاحية المالك' },
          { status: 401 }
        );
      }
      const ok = await deleteRestaurantFromStore(body.slug);
      return NextResponse.json({ success: ok });
    }

    if (!restaurant || !restaurant.slug || !restaurant.name) {
      return NextResponse.json(
        { success: false, error: 'بيانات المتجر غير مكتملة' },
        { status: 400 }
      );
    }

    const store = getRestaurantsStore();
    const cleanSlug = String(restaurant.slug).toLowerCase().trim();
    const alreadyExists = Boolean(store[cleanSlug]);

    if (alreadyExists && !owner) {
      const staffCookie = req.cookies.get(STAFF_COOKIE_NAME)?.value;
      const staffVerified = staffCookie ? verifyStaffToken(staffCookie) : { valid: false };
      if (!staffVerified.valid || staffVerified.slug !== cleanSlug) {
        return NextResponse.json(
          { success: false, error: 'غير مصرح بتعديل هذا الفرع' },
          { status: 401 }
        );
      }
    }

    const saved = await saveRestaurantToStore(restaurant as Restaurant);
    return NextResponse.json({ success: true, restaurant: saved });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
