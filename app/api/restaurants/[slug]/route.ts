import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Restaurant } from '@/types/queue';

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

  // 1. Fetch from Supabase
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, slug, name, logo_url, theme_color, whatsapp_fallback_enabled, created_at')
        .eq('slug', slug)
        .maybeSingle();

      if (!error && data) {
        const restaurant: Restaurant = {
          id: data.id,
          slug: data.slug,
          name: data.name,
          logoUrl: data.logo_url || '/logo.png',
          themeColor: data.theme_color || '#10B981',
          whatsappFallbackEnabled: data.whatsapp_fallback_enabled ?? true,
          createdAt: data.created_at,
        };
        return NextResponse.json({ success: true, restaurant });
      }
    } catch (err) {
      console.warn('Supabase fetch error for restaurant slug:', slug, err);
    }
  }

  // Not found in database
  return NextResponse.json(
    {
      success: false,
      error: 'المتجر غير مسجل',
      restaurant: null,
    },
    { status: 404 }
  );
}
