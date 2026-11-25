-- ==============================================================================
-- CHIMER DIGITAL BUZZER & SMART WAITLIST - POSTGRESQL SCHEMA & STRICT RLS
-- Additive migration: does NOT modify or drop existing Chimer order tables.
-- ==============================================================================

-- 1. Waitlist Entries Table ("The Clipboard")
CREATE TABLE IF NOT EXISTS public.waitlist_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    restaurant_slug TEXT NOT NULL DEFAULT 'demo-cafe',
    ticket_number INTEGER NOT NULL,
    guest_name TEXT NOT NULL CHECK (char_length(guest_name) BETWEEN 1 AND 80),
    party_size INTEGER NOT NULL CHECK (party_size BETWEEN 1 AND 20),
    seating_preference TEXT NOT NULL DEFAULT 'either' CHECK (seating_preference IN ('inside', 'patio', 'either')),
    phone_number TEXT CHECK (phone_number IS NULL OR char_length(phone_number) <= 30),
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'on_my_way', 'seated', 'no_show', 'left')),
    token_hash TEXT NOT NULL UNIQUE,
    channel_id TEXT NOT NULL UNIQUE,
    quoted_wait_minutes INTEGER NOT NULL DEFAULT 15 CHECK (quoted_wait_minutes >= 0),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    called_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    source TEXT NOT NULL DEFAULT 'qr' CHECK (source IN ('qr', 'walk_in')),
    created_date DATE NOT NULL DEFAULT (timezone('utc'::text, now()))::date
);

-- High-scale indexes for FIFO queue ordering, daily ticket numbering, and token lookup
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_active_queue
    ON public.waitlist_entries(restaurant_slug, created_date, status, joined_at ASC);
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_token_hash
    ON public.waitlist_entries(token_hash);
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_ticket_num
    ON public.waitlist_entries(restaurant_slug, created_date, ticket_number DESC);

-- 2. End-of-Day AI Owner Insights Cache Table
CREATE TABLE IF NOT EXISTS public.waitlist_ai_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    restaurant_slug TEXT NOT NULL DEFAULT 'demo-cafe',
    service_date DATE NOT NULL,
    data_fingerprint TEXT NOT NULL,
    summary_where_lost TEXT NOT NULL,
    recommendations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    model_used TEXT NOT NULL DEFAULT 'deterministic-stats',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (restaurant_slug, service_date, data_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_ai_briefs_lookup
    ON public.waitlist_ai_briefs(restaurant_slug, service_date, data_fingerprint);

-- 3. Staff Profiles Table (linked to Supabase auth.users for Host Stand authorization)
CREATE TABLE IF NOT EXISTS public.waitlist_staff_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    restaurant_slug TEXT NOT NULL DEFAULT 'demo-cafe',
    role TEXT NOT NULL DEFAULT 'host' CHECK (role IN ('host', 'manager', 'owner')),
    display_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Enable Strict Row Level Security (RLS)
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_ai_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_staff_profiles ENABLE ROW LEVEL SECURITY;

-- Drop any old policies if re-running
DROP POLICY IF EXISTS "Deny anon all on waitlist_entries" ON public.waitlist_entries;
DROP POLICY IF EXISTS "Staff can read restaurant waitlist_entries" ON public.waitlist_entries;
DROP POLICY IF EXISTS "Staff can insert restaurant waitlist_entries" ON public.waitlist_entries;
DROP POLICY IF EXISTS "Staff can update restaurant waitlist_entries" ON public.waitlist_entries;

DROP POLICY IF EXISTS "Staff can read restaurant waitlist_ai_briefs" ON public.waitlist_ai_briefs;
DROP POLICY IF EXISTS "Staff can insert restaurant waitlist_ai_briefs" ON public.waitlist_ai_briefs;

DROP POLICY IF EXISTS "Staff can read own profile" ON public.waitlist_staff_profiles;

-- Note: With RLS enabled and NO anon policy, anonymous Supabase clients (`anon` key)
-- are strictly BLOCKED from SELECT, INSERT, UPDATE, DELETE on all waitlist tables.
-- Guest operations are mediated exclusively via Next.js server API routes using HttpOnly token hashes.

CREATE POLICY "Staff can read restaurant waitlist_entries"
    ON public.waitlist_entries FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.waitlist_staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.is_active = true
              AND sp.restaurant_slug = waitlist_entries.restaurant_slug
        )
    );

CREATE POLICY "Staff can insert restaurant waitlist_entries"
    ON public.waitlist_entries FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.waitlist_staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.is_active = true
              AND sp.restaurant_slug = waitlist_entries.restaurant_slug
        )
    );

CREATE POLICY "Staff can update restaurant waitlist_entries"
    ON public.waitlist_entries FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.waitlist_staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.is_active = true
              AND sp.restaurant_slug = waitlist_entries.restaurant_slug
        )
    );

CREATE POLICY "Staff can read restaurant waitlist_ai_briefs"
    ON public.waitlist_ai_briefs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.waitlist_staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.is_active = true
              AND sp.restaurant_slug = waitlist_ai_briefs.restaurant_slug
        )
    );

CREATE POLICY "Staff can insert restaurant waitlist_ai_briefs"
    ON public.waitlist_ai_briefs FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.waitlist_staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.is_active = true
              AND sp.restaurant_slug = waitlist_ai_briefs.restaurant_slug
        )
    );

CREATE POLICY "Staff can read own profile"
    ON public.waitlist_staff_profiles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- IMPORTANT: Do NOT add waitlist_entries to public supabase_realtime publication
-- to prevent unfiltered broadcast of guest names/phones to anonymous listeners.
-- Real-time updates use scoped per-ticket channels and authenticated host streams.
