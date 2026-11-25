import { WaitlistStatus } from '@/types/waitlist';

export interface WaitlistGuestSSEClient {
  id: string;
  controller: ReadableStreamDefaultController;
  channelId: string;
  restaurantSlug: string;
  connectedAt: number;
}

export interface WaitlistHostSSEClient {
  id: string;
  controller: ReadableStreamDefaultController;
  restaurantSlug: string;
  connectedAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __chimer_wl_guest_clients: Map<string, WaitlistGuestSSEClient> | undefined;
  // eslint-disable-next-line no-var
  var __chimer_wl_host_clients: Map<string, WaitlistHostSSEClient> | undefined;
}

function getGuestClients(): Map<string, WaitlistGuestSSEClient> {
  if (!globalThis.__chimer_wl_guest_clients) {
    globalThis.__chimer_wl_guest_clients = new Map();
  }
  return globalThis.__chimer_wl_guest_clients;
}

function getHostClients(): Map<string, WaitlistHostSSEClient> {
  if (!globalThis.__chimer_wl_host_clients) {
    globalThis.__chimer_wl_host_clients = new Map();
  }
  return globalThis.__chimer_wl_host_clients;
}

export function registerWaitlistGuestClient(client: WaitlistGuestSSEClient): () => void {
  const clients = getGuestClients();
  clients.set(client.id, client);
  return () => clients.delete(client.id);
}

export function registerWaitlistHostClient(client: WaitlistHostSSEClient): () => void {
  const clients = getHostClients();
  clients.set(client.id, client);
  return () => clients.delete(client.id);
}

/**
 * Sends a targeted status event ONLY to the specific ticket's opaque channelId.
 * Zero cross-guest PII is ever broadcast.
 */
export function notifyTicketChannel(
  channelId: string,
  payload: {
    type: 'TICKET_CALLED' | 'TICKET_UNDONE' | 'TICKET_STATUS';
    status: WaitlistStatus;
    calledAt: string | null;
    claimDeadlineAt: string | null;
  }
): void {
  const clients = getGuestClients();
  const encoded = new TextEncoder().encode(
    `data: ${JSON.stringify({ ...payload, ts: Date.now() })}\n\n`
  );

  for (const [id, client] of clients.entries()) {
    if (client.channelId === channelId) {
      try {
        client.controller.enqueue(encoded);
      } catch {
        clients.delete(id);
      }
    }
  }
}

/**
 * Broadcasts an anonymous, zero-PII queue-moved ping to waiting guests of a restaurant
 * so their clients immediately re-fetch their own HttpOnly-authenticated `/api/waitlist/my-ticket`.
 */
export function pingRestaurantQueueMoved(restaurantSlug: string, excludeChannelId?: string): void {
  const clients = getGuestClients();
  const encoded = new TextEncoder().encode(
    `data: ${JSON.stringify({ type: 'QUEUE_MOVED', ts: Date.now() })}\n\n`
  );

  for (const [id, client] of clients.entries()) {
    if (client.restaurantSlug === restaurantSlug && client.channelId !== excludeChannelId) {
      try {
        client.controller.enqueue(encoded);
      } catch {
        clients.delete(id);
      }
    }
  }
}

/**
 * Notifies authenticated Host Stand tablets of any waitlist state change.
 */
export function notifyHostStand(restaurantSlug: string, reason: string): void {
  const clients = getHostClients();
  const encoded = new TextEncoder().encode(
    `data: ${JSON.stringify({ type: 'HOST_REFRESH', reason, ts: Date.now() })}\n\n`
  );

  for (const [id, client] of clients.entries()) {
    if (client.restaurantSlug === restaurantSlug) {
      try {
        client.controller.enqueue(encoded);
      } catch {
        clients.delete(id);
      }
    }
  }
}
