-- ==============================================================================
-- BUZLY SMART RESTAURANT PAGER - PHASE 2 SUPABASE SCHEMA & REALTIME SETUP
-- Run this script in the Supabase SQL Editor to provision tables & realtime.
-- ==============================================================================

-- 1. Create table for orders_queue with push_subscription and ping_count
CREATE TABLE IF NOT EXISTS public.orders_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL,
    customer_name TEXT,
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

-- 2. Create sub-millisecond query indexes
CREATE INDEX IF NOT EXISTS idx_orders_queue_order_number ON public.orders_queue(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_queue_status ON public.orders_queue(status);
CREATE INDEX IF NOT EXISTS idx_orders_queue_created_at ON public.orders_queue(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.orders_queue ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for MVP / Commercial testing
DROP POLICY IF EXISTS "Public can view active orders_queue" ON public.orders_queue;
CREATE POLICY "Public can view active orders_queue"
    ON public.orders_queue
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Public can insert new orders_queue" ON public.orders_queue;
CREATE POLICY "Public can insert new orders_queue"
    ON public.orders_queue
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update orders_queue" ON public.orders_queue;
CREATE POLICY "Public can update orders_queue"
    ON public.orders_queue
    FOR UPDATE
    USING (true);

DROP POLICY IF EXISTS "Public can delete orders_queue" ON public.orders_queue;
CREATE POLICY "Public can delete orders_queue"
    ON public.orders_queue
    FOR DELETE
    USING (true);

-- 5. Enable Supabase Realtime Publication for orders_queue
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'orders_queue'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders_queue;
    END IF;
END $$;

-- 6. Insert rich initial seed data for immediate testing
INSERT INTO public.orders_queue (order_number, notes, status, estimated_mins, created_at, ping_count)
VALUES 
  ('102', 'برجر أنجوس كلاسيك + بطاطس حجم عائلي', 'preparing', 10, NOW() - INTERVAL '4 minutes', 0),
  ('104', 'شاورما دجاج إكسترا صوص ثوم', 'preparing', 15, NOW() - INTERVAL '7 minutes', 0),
  ('98', 'وجبة سريعة سفري', 'ready', 5, NOW() - INTERVAL '12 minutes', 1),
  ('99', 'عصير برتقال طازج + كوكيز', 'ready', 5, NOW() - INTERVAL '14 minutes', 0)
ON CONFLICT DO NOTHING;
