import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getGuestTokenFromRequest, hashGuestToken } from '@/lib/waitlist-security';
import { findEntryByTokenHash } from '@/lib/waitlist-store';
import { registerWaitlistGuestClient } from '@/lib/waitlist-sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const rawToken = getGuestTokenFromRequest(req);
  if (!rawToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entry = await findEntryByTokenHash(hashGuestToken(rawToken));
  if (!entry) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  let cleanup: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const clientId = crypto.randomUUID();
      cleanup = registerWaitlistGuestClient({
        id: clientId,
        controller,
        channelId: entry.channelId,
        restaurantSlug: entry.restaurantSlug,
        connectedAt: Date.now(),
      });

      const enc = new TextEncoder();
      controller.enqueue(
        enc.encode(`data: ${JSON.stringify({ type: 'CONNECTED', ts: Date.now() })}\n\n`)
      );

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          if (heartbeat) clearInterval(heartbeat);
          if (cleanup) cleanup();
        }
      }, 15000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
