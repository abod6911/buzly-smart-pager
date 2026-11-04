-- ==============================================================================
-- BUZLY SMART RESTAURANT PAGER - PHASE 3 MULTI-TENANT SAAS SCHEMA & REALTIME
-- Run this script in the Supabase SQL Editor to provision multi-tenant tables.
-- ==============================================================================

-- 1. Create restaurants table (Tenants)
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    logo_url TEXT,
    theme_color TEXT NOT NULL DEFAULT '#10B981',
    staff_pin TEXT NOT NULL DEFAULT '1234',
    whatsapp_fallback_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for instant lookup by slug
CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON public.restaurants(slug);

-- 2. Create or Update orders_queue table to support Multi-Tenancy
CREATE TABLE IF NOT EXISTS public.orders_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    restaurant_slug TEXT NOT NULL DEFAULT 'demo-cafe',
    order_number TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing', 'ready', 'completed', 'cancelled')),
    estimated_mins INTEGER NOT NULL DEFAULT 10,
    push_subscription JSONB,
    ping_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ready_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_ping_at TIMESTAMPTZ
);

-- Multi-tenant query indexes
CREATE INDEX IF NOT EXISTS idx_orders_queue_slug ON public.orders_queue(restaurant_slug);
CREATE INDEX IF NOT EXISTS idx_orders_queue_status ON public.orders_queue(status);
CREATE INDEX IF NOT EXISTS idx_orders_queue_created_at ON public.orders_queue(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders_queue ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Public can view restaurants" ON public.restaurants;
CREATE POLICY "Public can view restaurants" ON public.restaurants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can update restaurants" ON public.restaurants;
CREATE POLICY "Public can update restaurants" ON public.restaurants FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public can insert restaurants" ON public.restaurants;
CREATE POLICY "Public can insert restaurants" ON public.restaurants FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view orders_queue" ON public.orders_queue;
CREATE POLICY "Public can view orders_queue" ON public.orders_queue FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can insert orders_queue" ON public.orders_queue;
CREATE POLICY "Public can insert orders_queue" ON public.orders_queue FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update orders_queue" ON public.orders_queue;
CREATE POLICY "Public can update orders_queue" ON public.orders_queue FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public can delete orders_queue" ON public.orders_queue;
CREATE POLICY "Public can delete orders_queue" ON public.orders_queue FOR DELETE USING (true);

-- 5. Enable Supabase Realtime Publication for both tables
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'restaurants'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurants;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'orders_queue'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders_queue;
    END IF;
END $$;

-- 6. Insert Pre-populated Demo Restaurant & Analytics-ready orders
INSERT INTO public.restaurants (id, slug, name, logo_url, theme_color, staff_pin, whatsapp_fallback_enabled)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'demo-cafe',
    'ديمو كافيه & لاونج | Demo Cafe',
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=120&auto=format&fit=crop&q=80',
    '#10B981',
    '1234',
    true
)
ON CONFLICT (slug) DO UPDATE 
SET name = EXCLUDED.name,
    staff_pin = EXCLUDED.staff_pin,
    theme_color = EXCLUDED.theme_color;

-- Seed orders for demo-cafe (Active and historical for analytics calculations)
INSERT INTO public.orders_queue (
    restaurant_id, restaurant_slug, order_number, customer_name, customer_phone, notes, status, estimated_mins, ping_count, created_at, ready_at, completed_at
) VALUES 
  -- Active preparing
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'demo-cafe', '102', 'محمد أحمد', '966501112233', '2x فلات وايت + كرواسون لوز', 'preparing', 10, 0, NOW() - INTERVAL '4 minutes', NULL, NULL),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'demo-cafe', '104', 'سارة خالد', '966554443322', 'سبانش لاتيه بارد إكسترا صوص', 'preparing', 15, 0, NOW() - INTERVAL '7 minutes', NULL, NULL),
  -- Active ready
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'demo-cafe', '98', 'عبدالله السعد', '966598887766', 'وجبة خفيفة سفري', 'ready', 5, 1, NOW() - INTERVAL '12 minutes', NOW() - INTERVAL '2 minutes', NULL),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'demo-cafe', '99', 'فهد', NULL, 'عصير برتقال كولد بريس', 'ready', 5, 0, NOW() - INTERVAL '14 minutes', NOW() - INTERVAL '1 minute', NULL),
  -- Historical completed orders for kitchen analytics KPIs
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'demo-cafe', '91', 'سلطان', NULL, 'قهوة مقطرة V60 إثيوبية', 'completed', 8, 0, NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '38 minutes', NOW() - INTERVAL '36 minutes'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'demo-cafe', '92', 'نورة', '966532221100', 'كورتادو + كوكيز شوكولاتة', 'completed', 6, 0, NOW() - INTERVAL '55 minutes', NOW() - INTERVAL '49 minutes', NOW() - INTERVAL '47 minutes'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'demo-cafe', '93', 'ريان', NULL, 'ماتشا لاتيه عضوي حليب شوفان', 'completed', 10, 1, NOW() - INTERVAL '80 minutes', NOW() - INTERVAL '71 minutes', NOW() - INTERVAL '68 minutes'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'demo-cafe', '94', 'خالد', NULL, 'ساندوتش حلومي مشوي مع زعتر', 'completed', 12, 0, NOW() - INTERVAL '110 minutes', NOW() - INTERVAL '98 minutes', NOW() - INTERVAL '95 minutes')
ON CONFLICT DO NOTHING;
