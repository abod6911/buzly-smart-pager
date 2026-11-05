-- ==============================================================================
-- HIGH-SCALE COMPOSITE INDEXES FOR 10,000+ DAILY ORDERS
-- Description: Composite Postgres indexes optimized for high-volume order throughput,
-- sub-millisecond targeted order lookups, and fast active queue window queries.
-- ==============================================================================

-- 1. Ultra-fast targeted lookup for single customer tracking page (O(1))
CREATE INDEX IF NOT EXISTS idx_orders_customer_lookup
    ON public.orders_queue (restaurant_slug, order_number, status);

-- 2. Composite index for active order queue queries on Cashier and TV screens
CREATE INDEX IF NOT EXISTS idx_orders_active_feed
    ON public.orders_queue (restaurant_slug, status, created_at DESC);

-- 3. Composite index by restaurant_id, status, and order_number
CREATE INDEX IF NOT EXISTS idx_orders_lookup
    ON public.orders_queue (restaurant_id, status, order_number, created_at DESC);

-- 4. Fast restaurant slug lookup
CREATE INDEX IF NOT EXISTS idx_restaurants_slug_active
    ON public.restaurants (slug);
