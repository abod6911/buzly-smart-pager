-- ==============================================================================
-- CHIMER PRODUCTION RESET & MIGRATION SCRIPT
-- Description: Complete purge of test/mock data and clean production template setup.
-- ==============================================================================

-- 1. Ensure schema tables exist with proper constraints and indexes
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    logo_url TEXT,
    theme_color TEXT DEFAULT '#10B981',
    staff_pin TEXT DEFAULT '1234',
    whatsapp_fallback_enabled BOOLEAN DEFAULT true,
    chime_theme TEXT DEFAULT 'hospitality',
    voice_announce_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL,
    restaurant_slug TEXT NOT NULL REFERENCES public.restaurants(slug) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing', 'ready', 'completed', 'cancelled')),
    estimated_mins INTEGER DEFAULT 10,
    push_subscription JSONB,
    ping_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ready_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_ping_at TIMESTAMPTZ
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_slug_status 
    ON public.orders_queue (restaurant_slug, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_lookup 
    ON public.orders_queue (restaurant_slug, order_number);

CREATE INDEX IF NOT EXISTS idx_restaurants_slug 
    ON public.restaurants (slug);

-- 2. PURGE ALL TEST / MOCK / DUMMY ORDERS
-- This completely empties the active and historical order queues
TRUNCATE TABLE public.orders_queue CASCADE;

-- 3. PRODUCTION RESTAURANT TEMPLATE
-- Upserts a clean production-ready restaurant without any fake/demo orders
INSERT INTO public.restaurants (
    slug,
    name,
    logo_url,
    theme_color,
    staff_pin,
    whatsapp_fallback_enabled,
    chime_theme,
    voice_announce_enabled,
    created_at
) VALUES (
    'demo-cafe',
    'كافيه التجربة | Demo Cafe',
    NULL,
    '#10B981',
    '1234',
    true,
    'hospitality',
    true,
    NOW()
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    theme_color = EXCLUDED.theme_color,
    staff_pin = EXCLUDED.staff_pin,
    whatsapp_fallback_enabled = EXCLUDED.whatsapp_fallback_enabled,
    chime_theme = EXCLUDED.chime_theme,
    voice_announce_enabled = EXCLUDED.voice_announce_enabled;

-- 4. Enable Supabase Realtime Publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'orders_queue'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders_queue;
    END IF;
END $$;

-- 5. Row-Level Security (RLS) Policies
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders_queue ENABLE ROW LEVEL SECURITY;

-- Allow public read & write access for active tenant operations
DROP POLICY IF EXISTS "Public read access for restaurants" ON public.restaurants;
CREATE POLICY "Public read access for restaurants" 
    ON public.restaurants FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Public insert/update for restaurants" ON public.restaurants;
CREATE POLICY "Public insert/update for restaurants" 
    ON public.restaurants FOR ALL 
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for orders_queue" ON public.orders_queue;
CREATE POLICY "Public access for orders_queue" 
    ON public.orders_queue FOR ALL 
    USING (true) WITH CHECK (true);

-- Verification Query:
-- SELECT slug, name, created_at FROM public.restaurants;
-- SELECT COUNT(*) as total_orders FROM public.orders_queue; -- Should be 0
