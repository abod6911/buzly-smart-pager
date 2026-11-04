-- ==============================================================================
-- BUZLY SMART RESTAURANT PAGER - SUPABASE SCHEMA & REALTIME SETUP
-- Run this script in the Supabase SQL Editor to provision tables & realtime.
-- ==============================================================================

-- 1. Create table for orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(30) NOT NULL,
    customer_name VARCHAR(100),
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing', 'ready', 'completed', 'cancelled')),
    estimated_minutes INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ready_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    re_ping_count INTEGER NOT NULL DEFAULT 0,
    last_ping_at TIMESTAMPTZ
);

-- 2. Create index on order_number and status for sub-millisecond lookups
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 4. Create public access policies (allows cashier & customers to read/update orders)
-- In production with authentication, you can restrict INSERT/UPDATE to authenticated staff roles.
DROP POLICY IF EXISTS "Public can view active orders" ON public.orders;
CREATE POLICY "Public can view active orders"
    ON public.orders
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Public can insert new orders" ON public.orders;
CREATE POLICY "Public can insert new orders"
    ON public.orders
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update orders" ON public.orders;
CREATE POLICY "Public can update orders"
    ON public.orders
    FOR UPDATE
    USING (true);

DROP POLICY IF EXISTS "Public can delete orders" ON public.orders;
CREATE POLICY "Public can delete orders"
    ON public.orders
    FOR DELETE
    USING (true);

-- 5. Enable Supabase Realtime Publication for the orders table
-- This allows instant push events directly to client browsers!
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
END $$;

-- 6. Insert sample seed orders for immediate preview
INSERT INTO public.orders (order_number, notes, status, estimated_minutes, created_at, re_ping_count)
VALUES 
  ('102', 'برجر كلاسيك + بطاطس حجم عائلي', 'preparing', 10, NOW() - INTERVAL '4 minutes', 0),
  ('104', 'شاورما دجاج إكسترا ثوم', 'preparing', 15, NOW() - INTERVAL '8 minutes', 0),
  ('98', 'وجبة سريعة سفري', 'ready', 5, NOW() - INTERVAL '12 minutes', 1),
  ('99', 'مشروبات باردة وعصير برتقال', 'ready', 5, NOW() - INTERVAL '15 minutes', 0)
ON CONFLICT DO NOTHING;
