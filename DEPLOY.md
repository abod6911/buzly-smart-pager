# Chimer Digital Buzzer & Smart Waitlist — Production Deployment Guide

## 1. Required Environment Variables (Vercel / `.env.local`)

```env
# Supabase Project
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Host Stand Session Security
HOST_SESSION_SECRET=replace-with-32-byte-random-hex
HOST_STAFF_EMAIL=host@yourrestaurant.com
HOST_STAFF_PASSWORD=strong-staff-password

# Optional: End-of-Day AI Owner Brief (falls back to deterministic stats if omitted)
OPENAI_API_KEY=sk-...
```

> **Security Note:** Never expose `SUPABASE_SERVICE_ROLE_KEY` or `HOST_SESSION_SECRET` to the browser (`NEXT_PUBLIC_*`).

---

## 2. Supabase PostgreSQL Migration & RLS

1. Open your Supabase Dashboard → **SQL Editor**.
2. Paste and run the full contents of `supabase_waitlist_schema.sql`.
3. Verify that **Row Level Security (RLS)** is enabled on:
   - `public.waitlist_entries`
   - `public.waitlist_ai_briefs`
   - `public.waitlist_staff_profiles`
4. Confirm `waitlist_entries` is **NOT** added to the public `supabase_realtime` publication (guest updates use scoped per-ticket channels).

---

## 3. Create First Staff Account

1. In Supabase Dashboard → **Authentication → Users**, click **Add User** and create your host email/password.
2. Copy the created user's `id` (UUID) and insert their staff profile:

```sql
INSERT INTO public.waitlist_staff_profiles (user_id, email, restaurant_slug, role, display_name)
VALUES ('<USER_UUID>', 'host@yourrestaurant.com', 'demo-cafe', 'owner', 'Main Host Stand');
```

---

## 4. Deploy to Vercel

1. Connect your repository to Vercel and add all environment variables from Step 1.
2. Run build verification locally before deploying:
   ```bash
   npx tsc --noEmit && npm run build
   ```
3. Once deployed, visit `/host/door-sign` and click **Print Sign** to place the QR stand at your restaurant entrance.
