import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkGeneralRateLimit } from '@/lib/security';
import { generateGuestTicketToken, setGuestTicketCookie } from '@/lib/waitlist-security';
import { buildGuestProjection, createWaitlistEntry } from '@/lib/waitlist-store';
import { notifyHostStand, pingRestaurantQueueMoved } from '@/lib/waitlist-sse';

export const dynamic = 'force-dynamic';

const joinSchema = z.object({
  restaurantSlug: z.string().trim().min(1).max(50).regex(/^[a-z0-9-]+$/).default('demo-cafe'),
  name: z.string().trim().min(1, 'Please enter your name').max(80),
  partySize: z.coerce.number().int().min(1).max(20),
  seatingPreference: z.enum(['inside', 'patio', 'either']).default('either'),
  phoneNumber: z
    .string()
    .trim()
    .max(30)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() || '127.0.0.1';
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkGeneralRateLimit(`wl_join:${ip}`, 30, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many join attempts. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid join details' },
      { status: 400 }
    );
  }

  const { restaurantSlug, name, partySize, seatingPreference, phoneNumber } = parsed.data;
  const { rawToken, tokenHash, channelId } = generateGuestTicketToken();

  const entry = await createWaitlistEntry({
    restaurantSlug,
    guestName: name,
    partySize,
    seatingPreference,
    phoneNumber,
    tokenHash,
    channelId,
    source: 'qr',
  });

  const projection = await buildGuestProjection(entry);

  notifyHostStand(restaurantSlug, 'guest_joined');
  pingRestaurantQueueMoved(restaurantSlug, entry.channelId);

  const res = NextResponse.json({ ticket: projection }, { status: 201 });
  setGuestTicketCookie(res, rawToken);
  return res;
}
