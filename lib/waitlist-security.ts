import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const GUEST_TICKET_COOKIE = 'chimer_ticket_token';
export const HOST_SESSION_COOKIE = 'chimer_host_token';
export const GUEST_TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24 hours
export const HOST_TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12 hours

const HOST_SECRET =
  process.env.HOST_SESSION_SECRET ||
  process.env.STAFF_TOKEN_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'chimer-waitlist-host-secret-2026-dev';

const DEFAULT_HOST_EMAIL = process.env.HOST_STAFF_EMAIL || 'host@chimer.app';
const DEFAULT_HOST_PASSWORD = process.env.HOST_STAFF_PASSWORD || 'chimer-host-2026';

/**
 * Generates a cryptographically secure 256-bit opaque guest ticket token
 * and its SHA-256 hash. Raw token is NEVER stored in the database.
 */
export function generateGuestTicketToken(): {
  rawToken: string;
  tokenHash: string;
  channelId: string;
} {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashGuestToken(rawToken);
  const channelId = crypto.randomBytes(16).toString('hex');
  return { rawToken, tokenHash, channelId };
}

export function hashGuestToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function setGuestTicketCookie(res: NextResponse, rawToken: string): void {
  res.cookies.set(GUEST_TICKET_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: GUEST_TOKEN_TTL_SECONDS,
  });
}

export function clearGuestTicketCookie(res: NextResponse): void {
  res.cookies.set(GUEST_TICKET_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function getGuestTokenFromRequest(req: NextRequest): string | null {
  const cookieVal = req.cookies.get(GUEST_TICKET_COOKIE)?.value;
  if (!cookieVal || !/^[a-f0-9]{64}$/i.test(cookieVal)) {
    return null;
  }
  return cookieVal;
}

// -----------------------------------------------------------------------------
// Host Stand Authentication (Supabase Auth + HMAC HttpOnly Session Cookie)
// -----------------------------------------------------------------------------

export interface HostSessionPayload {
  email: string;
  restaurantSlug: string;
  role: 'host' | 'manager' | 'owner';
  iat: number;
  exp: number;
}

export function createHostSessionToken(payload: Omit<HostSessionPayload, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000);
  const full: HostSessionPayload = {
    ...payload,
    iat: now,
    exp: now + HOST_TOKEN_TTL_SECONDS,
  };
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', HOST_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  return `${headerB64}.${payloadB64}.${sig}`;
}

export function verifyHostSessionToken(token: string): HostSessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', HOST_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    const sigBuf = Buffer.from(sig, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as HostSessionPayload;

    if (parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setHostSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(HOST_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: HOST_TOKEN_TTL_SECONDS,
  });
}

export function clearHostSessionCookie(res: NextResponse): void {
  res.cookies.set(HOST_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function requireHostSession(req: NextRequest): HostSessionPayload | null {
  const token = req.cookies.get(HOST_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyHostSessionToken(token);
}

/**
 * Verifies host credentials via Supabase Auth (when configured and user exists)
 * with secure fallback to configured server-side staff credentials for local/dev.
 */
export async function authenticateHostCredentials(
  email: string,
  password: string
): Promise<{
  authenticated: boolean;
  email: string;
  restaurantSlug: string;
  role: 'host' | 'manager' | 'owner';
}> {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Try Supabase Auth if configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http') && !supabaseUrl.includes('placeholder')) {
    try {
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await client.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (!error && data.user) {
        // Check waitlist_staff_profiles if service role is available
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceKey) {
          const adminClient = createClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false },
          });
          const { data: profile } = await adminClient
            .from('waitlist_staff_profiles')
            .select('restaurant_slug, role, is_active')
            .eq('user_id', data.user.id)
            .maybeSingle();

          if (profile && profile.is_active) {
            return {
              authenticated: true,
              email: normalizedEmail,
              restaurantSlug: profile.restaurant_slug || 'demo-cafe',
              role: (profile.role as 'host' | 'manager' | 'owner') || 'host',
            };
          }
        }
        return {
          authenticated: true,
          email: normalizedEmail,
          restaurantSlug: 'demo-cafe',
          role: 'host',
        };
      }
    } catch {
      // Fall through to configured staff credentials check
    }
  }

  // 2. Constant-time check against configured staff credentials
  const expectedEmail = DEFAULT_HOST_EMAIL.trim().toLowerCase();
  const emailMatch = normalizedEmail === expectedEmail;
  const passBuf = Buffer.from(password, 'utf8');
  const expBuf = Buffer.from(DEFAULT_HOST_PASSWORD, 'utf8');
  const passMatch =
    passBuf.length === expBuf.length && crypto.timingSafeEqual(passBuf, expBuf);

  if (emailMatch && passMatch) {
    return {
      authenticated: true,
      email: normalizedEmail,
      restaurantSlug: 'demo-cafe',
      role: 'host',
    };
  }

  return {
    authenticated: false,
    email: normalizedEmail,
    restaurantSlug: 'demo-cafe',
    role: 'host',
  };
}
