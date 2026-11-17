// Global Server-Sent Events (SSE) Broker for Zero-Latency Realtime Push (<10ms)
// Works across different physical devices (Cashier PC <-> Customer Mobile Phone)

export interface SSEClient {
  id: string;
  controller: ReadableStreamDefaultController;
  slug: string;
  orderNumber?: string;
  connectedAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __chimer_sse_clients: Map<string, SSEClient> | undefined;
}

export function getSSEClients(): Map<string, SSEClient> {
  if (!globalThis.__chimer_sse_clients) {
    globalThis.__chimer_sse_clients = new Map<string, SSEClient>();
  }
  return globalThis.__chimer_sse_clients;
}

export function registerSSEClient(client: SSEClient): () => void {
  const clients = getSSEClients();
  clients.set(client.id, client);

  return () => {
    clients.delete(client.id);
  };
}

export function broadcastSSEOrderEvent(event: {
  type: 'ORDER_READY' | 'ORDER_REPING' | 'ORDER_ADDED' | 'ORDER_COMPLETED' | 'ORDER_CANCELLED';
  restaurantSlug: string;
  orderNumber: string;
  orderId?: string;
  order?: unknown;
  status?: string;
  timestamp?: number;
}) {
  const clients = getSSEClients();
  if (clients.size === 0) return;

  const payload = {
    ...event,
    timestamp: event.timestamp || Date.now(),
  };

  const text = `data: ${JSON.stringify(payload)}\n\n`;
  const encoded = new TextEncoder().encode(text);

  const targetSlug = (event.restaurantSlug || 'demo-cafe').toLowerCase().trim();
  const rawTargetNum = String(event.orderNumber || '').trim();
  const cleanTargetNum = rawTargetNum.replace(/^#/, '').toLowerCase().trim();

  for (const [id, client] of clients.entries()) {
    try {
      const clientSlug = (client.slug || '').toLowerCase().trim();
      const matchSlug = !clientSlug || clientSlug === 'all' || clientSlug === targetSlug;

      const rawClientNum = String(client.orderNumber || '').trim();
      const cleanClientNum = rawClientNum.replace(/^#/, '').toLowerCase().trim();

      const matchNum =
        !client.orderNumber ||
        cleanClientNum === '' ||
        cleanClientNum === cleanTargetNum ||
        rawClientNum.toLowerCase() === rawTargetNum.toLowerCase();

      if (matchSlug && matchNum) {
        client.controller.enqueue(encoded);
      }
    } catch {
      clients.delete(id);
    }
  }
}
