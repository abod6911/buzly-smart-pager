import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireHostSession } from '@/lib/waitlist-security';
import { registerWaitlistHostClient } from '@/lib/waitlist-sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = requireHostSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let cleanup: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      cleanup = registerWaitlistHostClient({
        id: crypto.randomUUID(),
        controller,
        restaurantSlug: session.restaurantSlug,
        connectedAt: Date.now(),
      });

      const enc = new TextEncoder();
      controller.enqueue(
        enc.encode(`data: ${JSON.stringify({ type: 'HOST_CONNECTED', ts: Date.now() })}\n\n`)
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
