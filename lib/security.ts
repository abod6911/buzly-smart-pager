import crypto from 'crypto';

// -----------------------------------------------------------------------------
// CHIMER ENTERPRISE SECURITY UTILITIES
// -----------------------------------------------------------------------------

const TOKEN_SECRET =
  process.env.STAFF_TOKEN_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'chimer-secure-staff-session-secret-salt-2026';

export const STAFF_COOKIE_NAME = 'chimer_staff_token';
export const TOKEN_EXPIRY_SECONDS = 12 * 60 * 60; // 12 Hours

// In-Memory Rate Limiter & PIN Lockout Store
interface PinAttemptRecord {
  failures: number[];
  lockedUntil?: number;
}

const pinAttemptStore = new Map<string, PinAttemptRecord>();
const generalRateLimitStore = new Map<string, number[]>();

// Periodically clean up stale entries (every 10 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of pinAttemptStore.entries()) {
      if (record.lockedUntil && record.lockedUntil < now) {
        pinAttemptStore.delete(key);
      } else if (!record.lockedUntil) {
        const recent = record.failures.filter((t) => now - t < 10 * 60 * 1000);
        if (recent.length === 0) pinAttemptStore.delete(key);
      }
    }
    for (const [key, timestamps] of generalRateLimitStore.entries()) {
      const recent = timestamps.filter((t) => now - t < 5 * 60 * 1000);
      if (recent.length === 0) generalRateLimitStore.delete(key);
      else generalRateLimitStore.set(key, recent);
    }
  }, 10 * 60 * 1000);
}

/**
 * Checks PIN Brute-force lockout for a specific client/IP and restaurant
 * Rules: 5 failures within 10 minutes triggers 15-minute complete lockout
 */
export function checkPinLockout(identifier: string): {
  allowed: boolean;
  locked: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  const record = pinAttemptStore.get(identifier);

  if (record?.lockedUntil && record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      allowed: false,
      locked: true,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  // Filter failures within last 10 minutes
  const recentFailures = (record?.failures || []).filter(
    (t) => now - t < 10 * 60 * 1000
  );

  const remaining = Math.max(0, 5 - recentFailures.length);
  return {
    allowed: remaining > 0,
    locked: false,
    remainingAttempts: remaining,
  };
}

/**
 * Records a failed PIN attempt; locks out if failures reach 5
 */
export function recordPinFailure(identifier: string): {
  locked: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  let record = pinAttemptStore.get(identifier);
  if (!record) {
    record = { failures: [] };
    pinAttemptStore.set(identifier, record);
  }

  // Keep only failures from last 10 minutes
  record.failures = record.failures.filter((t) => now - t < 10 * 60 * 1000);
  record.failures.push(now);

  if (record.failures.length >= 5) {
    record.lockedUntil = now + 15 * 60 * 1000; // 15 Minutes
    return {
      locked: true,
      remainingAttempts: 0,
      retryAfterSeconds: 15 * 60,
    };
  }

  return {
    locked: false,
    remainingAttempts: Math.max(0, 5 - record.failures.length),
  };
}

/**
 * Clears failures on successful authentication
 */
export function recordPinSuccess(identifier: string): void {
  pinAttemptStore.delete(identifier);
}

/**
 * General sliding-window rate limiter for APIs (e.g. order creation / push subscriptions)
 */
export function checkGeneralRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): { allowed: boolean; remaining: number; resetSeconds: number } {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  let timestamps = generalRateLimitStore.get(key) || [];

  timestamps = timestamps.filter((t) => now - t < windowMs);

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0];
    const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { allowed: false, remaining: 0, resetSeconds };
  }

  timestamps.push(now);
  generalRateLimitStore.set(key, timestamps);
  return {
    allowed: true,
    remaining: maxRequests - timestamps.length,
    resetSeconds: windowSeconds,
  };
}

// -----------------------------------------------------------------------------
// Cryptographic Signed Staff Session Tokens (HMAC-SHA256)
// -----------------------------------------------------------------------------

export interface StaffTokenPayload {
  slug: string;
  role: 'staff' | 'admin';
  exp: number; // UNIX epoch timestamp (seconds)
  iat: number;
}

export function createStaffToken(slug: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: StaffTokenPayload = {
    slug,
    role: 'staff',
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS,
  };

  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
    'base64url'
  );
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  return `${headerB64}.${payloadB64}.${signature}`;
}

export function verifyStaffToken(token: string): {
  valid: boolean;
  slug?: string;
  expired?: boolean;
} {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false };

    const [headerB64, payloadB64, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
      )
    ) {
      return { valid: false };
    }

    const payload: StaffTokenPayload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    );

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return { valid: false, expired: true, slug: payload.slug };
    }

    return { valid: true, slug: payload.slug };
  } catch {
    return { valid: false };
  }
}
