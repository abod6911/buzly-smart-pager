import { Restaurant } from '@/types/queue';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

declare global {
  // eslint-disable-next-line no-var
  var __chimer_restaurants_store: Record<string, Restaurant> | undefined;
}

export const SEED_RESTAURANTS: Record<string, Restaurant> = {
  'demo-cafe': {
    id: 'res_demo-cafe',
    slug: 'demo-cafe',
    name: 'كافيه دي مو (Demo Cafe)',
    logoUrl: '/logo.png',
    themeColor: '#10B981',
    staffPin: '1234',
    whatsappFallbackEnabled: true,
    chimeTheme: 'hospitality',
    voiceAnnounceEnabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    isPaused: false,
  },
  'test': {
    id: 'res_test',
    slug: 'test',
    name: 'test',
    logoUrl: '/logo.png',
    themeColor: '#F59E0B',
    staffPin: '1234',
    whatsappFallbackEnabled: true,
    chimeTheme: 'hospitality',
    voiceAnnounceEnabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    isPaused: false,
  },
};

export function getRestaurantsStore(): Record<string, Restaurant> {
  if (!globalThis.__chimer_restaurants_store || typeof globalThis.__chimer_restaurants_store !== 'object') {
    globalThis.__chimer_restaurants_store = { ...SEED_RESTAURANTS };
  }
  return globalThis.__chimer_restaurants_store;
}

export async function getRestaurantFromStore(slug: string): Promise<Restaurant | null> {
  if (!slug) return null;
  const cleanSlug = slug.toLowerCase().trim();
  const store = getRestaurantsStore();

  if (store[cleanSlug]) {
    return store[cleanSlug];
  }

  // Fallback to Supabase if configured
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('slug', cleanSlug)
        .maybeSingle();

      if (!error && data) {
        const mapped: Restaurant = {
          id: data.id,
          slug: data.slug,
          name: data.name,
          logoUrl: data.logo_url || '/logo.png',
          themeColor: data.theme_color || '#10B981',
          staffPin: data.staff_pin || '1234',
          whatsappFallbackEnabled: data.whatsapp_fallback_enabled ?? true,
          chimeTheme: data.chime_theme || 'hospitality',
          voiceAnnounceEnabled: data.voice_announce_enabled ?? true,
          createdAt: data.created_at || new Date().toISOString(),
          isPaused: data.is_paused ?? false,
          notes: data.notes || '',
        };
        store[cleanSlug] = mapped;
        return mapped;
      }
    } catch (err) {
      console.warn('Supabase getRestaurant error:', err);
    }
  }

  return null;
}

export async function saveRestaurantToStore(restaurant: Restaurant): Promise<Restaurant> {
  const cleanSlug = restaurant.slug.toLowerCase().trim();
  const store = getRestaurantsStore();
  const cleanRest: Restaurant = {
    ...restaurant,
    slug: cleanSlug,
  };
  store[cleanSlug] = cleanRest;

  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('restaurants').upsert({
        slug: cleanSlug,
        name: cleanRest.name,
        logo_url: cleanRest.logoUrl,
        theme_color: cleanRest.themeColor,
        staff_pin: cleanRest.staffPin,
        whatsapp_fallback_enabled: cleanRest.whatsappFallbackEnabled,
        created_at: cleanRest.createdAt,
      });
    } catch (err) {
      console.warn('Supabase saveRestaurant error:', err);
    }
  }

  return cleanRest;
}

export async function deleteRestaurantFromStore(slug: string): Promise<boolean> {
  const cleanSlug = slug.toLowerCase().trim();
  const store = getRestaurantsStore();
  if (cleanSlug === 'demo-cafe') {
    return false; // prevent deleting demo seed
  }
  delete store[cleanSlug];

  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('restaurants').delete().eq('slug', cleanSlug);
    } catch (err) {
      console.warn('Supabase deleteRestaurant error:', err);
    }
  }

  return true;
}
