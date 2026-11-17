import { NextRequest, NextResponse } from 'next/server';
import { getRestaurantFromStore } from '@/lib/restaurantStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await params;
  const slug = (rawSlug || '').toLowerCase().trim();

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { success: false, error: 'معرف المتجر غير صالح', restaurant: null },
      { status: 400 }
    );
  }

  const restaurant = await getRestaurantFromStore(slug);

  if (restaurant) {
    return NextResponse.json(
      { success: true, restaurant },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        },
      }
    );
  }

  // Not found in server store
  return NextResponse.json(
    {
      success: false,
      error: 'المتجر غير مسجل',
      restaurant: null,
    },
    {
      status: 404,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      },
    }
  );
}
