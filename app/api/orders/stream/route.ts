import { NextRequest } from 'next/server';
import { registerSSEClient, SSEClient } from '@/lib/sse-broker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const paramSlug = searchParams.get('slug')?.toLowerCase()?.trim();
  const rawSlug = paramSlug === 'all' || !paramSlug ? '' : paramSlug;
  const rawOrderNumber = searchParams.get('orderNumber')?.trim();

  let unregister: (() => void) | null = null;
  const clientId = `sse_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const stream = new ReadableStream({
    start(controller) {
      const client: SSEClient = {
        id: clientId,
        controller,
        slug: rawSlug,
        orderNumber: rawOrderNumber || undefined,
        connectedAt: Date.now(),
      };

      unregister = registerSSEClient(client);

      // Send immediate connection confirmation packet
      const welcome = `data: ${JSON.stringify({ type: 'CONNECTED', clientId, timestamp: Date.now() })}\n\n`;
      controller.enqueue(new TextEncoder().encode(welcome));

      // Periodic keep-alive comment so proxy/mobile carrier doesn't close TCP connection
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': keep-alive\n\n'));
        } catch {
          clearInterval(keepAliveInterval);
        }
      }, 15000);

      // Store interval on controller if needed
      (controller as unknown as { _keepAlive?: NodeJS.Timeout })._keepAlive = keepAliveInterval;
    },
    cancel(controller) {
      const customCtrl = controller as unknown as { _keepAlive?: NodeJS.Timeout };
      if (customCtrl._keepAlive) {
        clearInterval(customCtrl._keepAlive);
      }
      if (unregister) {
        unregister();
        unregister = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
