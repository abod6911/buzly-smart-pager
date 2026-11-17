import { NextRequest, NextResponse } from 'next/server';
import {
  getRestaurantsStore,
  saveRestaurantToStore,
  deleteRestaurantFromStore,
} from '@/lib/restaurantStore';
import { Restaurant } from '@/types/queue';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const store = getRestaurantsStore();
  return NextResponse.json(
    {
      success: true,
      restaurants: store,
      count: Object.keys(store).length,
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

    if (action === 'DELETE' && body.slug) {
      const ok = await deleteRestaurantFromStore(body.slug);
      return NextResponse.json({ success: ok });
    }

    if (!restaurant || !restaurant.slug || !restaurant.name) {
      return NextResponse.json(
        { success: false, error: 'بيانات المتجر غير مكتملة' },
        { status: 400 }
      );
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
