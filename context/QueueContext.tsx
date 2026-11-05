'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  Order,
  OrderStatus,
  PushSubscriptionData,
  QueueRealtimeEvent,
  Restaurant,
} from '@/types/queue';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { soundManager } from '@/lib/audio';

const STORAGE_ORDERS_KEY = 'buzly_multitenant_orders_v3';
const STORAGE_RESTAURANTS_KEY = 'buzly_multitenant_restaurants_v3';
const BROADCAST_CHANNEL_NAME = 'buzly_realtime_queue_v3';

interface QueueContextType {
  orders: Order[];
  restaurants: Record<string, Restaurant>;
  isRestaurantsLoaded: boolean;
  lastEvent: QueueRealtimeEvent | null;
  isSupabaseActive: boolean;
  networkStatus: 'connected' | 'reconnecting' | 'offline';
  getRestaurant: (slug: string) => Restaurant | undefined;
  updateRestaurant: (slug: string, data: Partial<Restaurant>) => Promise<void>;
  createRestaurant: (data: Omit<Restaurant, 'id' | 'createdAt'>) => Promise<Restaurant>;
  addOrder: (
    orderNumber: string,
    estimatedMinutes: number,
    notes?: string,
    customerPhone?: string,
    restaurantSlug?: string,
    options?: { replaceExisting?: boolean }
  ) => Promise<Order>;
  getActiveOrder: (orderNumber: string, restaurantSlug?: string) => Order | undefined;
  markReady: (orderId: string, restaurantSlug?: string) => Promise<void>;
  rePing: (orderId: string, restaurantSlug?: string) => Promise<void>;
  completeOrder: (orderId: string, restaurantSlug?: string) => Promise<void>;
  cancelOrder: (orderId: string, restaurantSlug?: string) => Promise<void>;
  submitOrderFeedback: (
    orderId: string,
    feedback: import('@/types/queue').OrderFeedback,
    restaurantSlug?: string
  ) => Promise<void>;
  archiveCompletedOrders: (restaurantSlug: string) => Promise<void>;
  registerPushSubscription: (
    orderNumber: string,
    sub: PushSubscriptionData,
    restaurantSlug?: string
  ) => Promise<void>;
  getOrdersForRestaurant: (slug: string) => Order[];
  getOrder: (orderNumber: string, restaurantSlug?: string) => Order | undefined;
  resetToDemoOrders: (slug?: string) => void;
  clearQueue: (slug?: string) => void;
  syncNow: () => Promise<void>;
  // Legacy aliases for phase 1/2 backwards compatibility
  preparingOrders: Order[];
  readyOrders: Order[];
  completedOrders: Order[];
}

const QueueContext = createContext<QueueContextType | undefined>(undefined);

async function triggerBackendPush(payload: {
  orderNumber: string;
  title: string;
  body: string;
  url?: string;
  subscription?: PushSubscriptionData | null;
}) {
  try {
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('Push delivery failed:', err);
  }
}

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 400): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 1) throw err;
    await new Promise((res) => setTimeout(res, delay));
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
}

function safeParseStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (err) {
    console.warn(`Self-healing storage: reset corrupted key "${key}":`, err);
    try {
      localStorage.removeItem(key);
    } catch {}
    return fallback;
  }
}

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurants, setRestaurants] = useState<Record<string, Restaurant>>({});
  const [isRestaurantsLoaded, setIsRestaurantsLoaded] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<QueueRealtimeEvent | null>(null);
  const [isSupabaseActive] = useState<boolean>(isSupabaseConfigured());
  const [networkStatus, setNetworkStatus] = useState<'connected' | 'reconnecting' | 'offline'>('connected');
  const channelRef = useRef<BroadcastChannel | null>(null);
  const tabIdRef = useRef<string>('');
  const ordersRef = useRef<Order[]>([]);
  const pendingOptimisticOrdersRef = useRef<Map<string, Order>>(new Map());
  const fetchedSlugsRef = useRef<Set<string>>(new Set());

  // Keep ordersRef synchronized with state
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // 1. Initialize from localStorage with self-healing recovery
  useEffect(() => {
    tabIdRef.current = 'tab_' + Math.random().toString(36).substring(2, 9);

    if (typeof window !== 'undefined') {
      const storedRest = safeParseStorage<Record<string, Restaurant>>(
        STORAGE_RESTAURANTS_KEY,
        {}
      );
      if (storedRest && typeof storedRest === 'object') {
        setRestaurants(storedRest);
      }

      const storedOrders = safeParseStorage<Order[] | null>(
        STORAGE_ORDERS_KEY,
        null
      );
      if (Array.isArray(storedOrders)) {
        setOrders(storedOrders);
      } else {
        setOrders([]);
      }

      if (!isSupabaseConfigured()) {
        setIsRestaurantsLoaded(true);
      }
    }
  }, []);

  const saveAndBroadcast = useCallback(
    (newOrders: Order[], event: QueueRealtimeEvent, newRestaurants?: Record<string, Restaurant>) => {
      const safeOrders = Array.isArray(newOrders) ? newOrders : [];
      // 0ms Optimistic UI update
      setOrders(safeOrders);
      setLastEvent(event);
      if (newRestaurants) setRestaurants(newRestaurants);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(safeOrders));
          if (newRestaurants) {
            localStorage.setItem(STORAGE_RESTAURANTS_KEY, JSON.stringify(newRestaurants));
          }
        } catch (e) {
          console.error('Storage save error:', e);
        }

        if (channelRef.current) {
          channelRef.current.postMessage(event);
        }

        // Cross-device Server Memory Bridge Sync with automatic retry wrapper
        retryWithBackoff(async () => {
          const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: event.type,
              order: event.order,
              orderId: event.orderId,
              orderNumber: event.orderNumber,
              restaurantSlug: event.restaurantSlug || 'demo-cafe',
              restaurant_slug: event.restaurantSlug || 'demo-cafe',
              feedback: event.feedback,
              orders: safeOrders,
            }),
          });
          if (!res.ok) throw new Error('Failed to post to /api/orders');
          return res;
        }).catch((err) => {
          console.warn('Background sync retry exhausted:', err);
        });
      }
    },
    []
  );

  // 2. Setup BroadcastChannel and storage events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let bc: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        channelRef.current = bc;

        bc.onmessage = (msgEvent: MessageEvent<QueueRealtimeEvent>) => {
          const ev = msgEvent.data;
          if (!ev || ev.sourceTabId === tabIdRef.current) return;

          setLastEvent(ev);

          try {
            const raw = localStorage.getItem(STORAGE_ORDERS_KEY);
            if (raw) setOrders(JSON.parse(raw));

            const rawRest = localStorage.getItem(STORAGE_RESTAURANTS_KEY);
            if (rawRest) setRestaurants(JSON.parse(rawRest));
          } catch {
            // Ignore
          }
        };
      }
    } catch {
      // Fallback
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_ORDERS_KEY && e.newValue) {
        try {
          setOrders(JSON.parse(e.newValue));
        } catch {}
      }
      if (e.key === STORAGE_RESTAURANTS_KEY && e.newValue) {
        try {
          setRestaurants(JSON.parse(e.newValue));
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // 3. Supabase Live Query & Realtime Subscription
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;

    // Load restaurants (Security: omit raw staff_pin from client bundle)
    (async () => {
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select('id, slug, name, logo_url, theme_color, whatsapp_fallback_enabled, created_at');

        if (!error && data && data.length > 0) {
          const restMap: Record<string, Restaurant> = {};
          data.forEach((r) => {
            restMap[r.slug] = {
              id: r.id,
              slug: r.slug,
              name: r.name,
              logoUrl: r.logo_url,
              themeColor: r.theme_color || '#10B981',
              whatsappFallbackEnabled: r.whatsapp_fallback_enabled ?? true,
              createdAt: r.created_at,
            };
          });
          setRestaurants((prev) => ({ ...prev, ...restMap }));
        }
      } catch (err) {
        console.warn('Supabase restaurants load error:', err);
      } finally {
        setIsRestaurantsLoaded(true);
      }
    })();

    // Load orders_queue
    supabase
      .from('orders_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const dbOrders: Order[] = data.map((row) => ({
            id: row.id,
            orderNumber: row.order_number,
            restaurantSlug: row.restaurant_slug || 'demo-cafe',
            customerName: row.customer_name,
            customerPhone: row.customer_phone,
            notes: row.notes,
            status: row.status as OrderStatus,
            estimatedMinutes: row.estimated_mins,
            pushSubscription: row.push_subscription,
            rePingCount: row.ping_count || 0,
            createdAt: row.created_at,
            readyAt: row.ready_at,
            completedAt: row.completed_at,
            lastPingAt: row.last_ping_at,
          }));

          setOrders(dbOrders);
          localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(dbOrders));
        }
      });

    // Realtime subscription
    const channel = supabase
      .channel('realtime_multitenant_orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders_queue' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new;
            const newOrder: Order = {
              id: row.id,
              orderNumber: row.order_number,
              restaurantSlug: row.restaurant_slug || 'demo-cafe',
              restaurant_slug: row.restaurant_slug || 'demo-cafe',
              restaurantId: row.restaurant_id,
              restaurant_id: row.restaurant_id,
              customerName: row.customer_name,
              customerPhone: row.customer_phone,
              notes: row.notes,
              status: row.status as OrderStatus,
              estimatedMinutes: row.estimated_mins,
              pushSubscription: row.push_subscription,
              rePingCount: row.ping_count || 0,
              createdAt: row.created_at,
              created_at: row.created_at,
              readyAt: row.ready_at,
              completedAt: row.completed_at,
              lastPingAt: row.last_ping_at,
            };

            setOrders((prev) => {
              const safe = Array.isArray(prev) ? prev : [];
              // Check if matching optimistic order exists
              const optimisticIndex = safe.findIndex(
                (o) =>
                  (o.id.startsWith('temp-') || o.id.startsWith('ord_')) &&
                  o.orderNumber === newOrder.orderNumber &&
                  (o.restaurantSlug || o.restaurant_slug || '').toLowerCase() === (newOrder.restaurantSlug || newOrder.restaurant_slug || '').toLowerCase()
              );

              let next: Order[];
              if (optimisticIndex !== -1) {
                pendingOptimisticOrdersRef.current.delete(safe[optimisticIndex].id);
                next = [...safe];
                next[optimisticIndex] = newOrder;
              } else if (!safe.some((o) => o.id === newOrder.id)) {
                next = [newOrder, ...safe];
              } else {
                next = safe;
              }

              try {
                localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(next));
              } catch {}
              return next;
            });
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new;
            setOrders((prev) => {
              const safe = Array.isArray(prev) ? prev : [];
              const next = safe.map((o) => {
                const matchSlug =
                  (o.restaurantSlug || o.restaurant_slug || '').toLowerCase() ===
                  (row.restaurant_slug || 'demo-cafe').toLowerCase();
                if (o.id === row.id || (o.orderNumber === row.order_number && matchSlug)) {
                  return {
                    ...o,
                    status: row.status as OrderStatus,
                    readyAt: row.ready_at,
                    completedAt: row.completed_at,
                    rePingCount: row.ping_count ?? o.rePingCount,
                    lastPingAt: row.last_ping_at ?? o.lastPingAt,
                    pushSubscription: row.push_subscription ?? o.pushSubscription,
                  };
                }
                return o;
              });
              try {
                localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(next));
              } catch {}
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, []);

  // 3.1 Hybrid Dual-Sync Engine (Cross-Device Server Heartbeat + WebSocket Fallback)
  const syncNow = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const res = await fetch('/api/orders', {
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        setNetworkStatus('connected');
        const data = await res.json();
        if (data && Array.isArray(data.orders)) {
          setOrders((prev) => {
            const safePrev = Array.isArray(prev) ? prev : [];
            const serverOrders: Order[] = data.orders;

            // Self-healing: Detect if an order moved to 'ready' or was re-pinged while device was asleep
            serverOrders.forEach((newOrd: Order) => {
              const prevOrd = safePrev.find(
                (p) =>
                  p.id === newOrd.id ||
                  (p.orderNumber === newOrd.orderNumber &&
                    (p.restaurantSlug || p.restaurant_slug || '').toLowerCase() ===
                      (newOrd.restaurantSlug || newOrd.restaurant_slug || '').toLowerCase())
              );
              if (
                prevOrd &&
                ((prevOrd.status === 'preparing' && newOrd.status === 'ready') ||
                  (newOrd.rePingCount > (prevOrd.rePingCount || 0)))
              ) {
                setLastEvent({
                  type:
                    prevOrd.status === 'preparing' && newOrd.status === 'ready'
                      ? 'ORDER_READY'
                      : 'ORDER_REPING',
                  restaurantSlug: newOrd.restaurantSlug,
                  orderId: newOrd.id,
                  orderNumber: newOrd.orderNumber,
                  order: newOrd,
                  timestamp: Date.now(),
                  sourceTabId: 'heartbeat-sync',
                });
              }
            });

            // Preserve pending optimistic orders that server hasn't committed yet
            const pendingList = Array.from(pendingOptimisticOrdersRef.current.values());
            const stillPending: Order[] = [];
            for (const p of pendingList) {
              const pSlug = (p.restaurantSlug || p.restaurant_slug || '').toLowerCase();
              const existsOnServer = serverOrders.some(
                (so) =>
                  so.orderNumber === p.orderNumber &&
                  (so.restaurantSlug || so.restaurant_slug || '').toLowerCase() === pSlug &&
                  (so.status === 'preparing' || so.status === 'ready')
              );
              if (existsOnServer) {
                pendingOptimisticOrdersRef.current.delete(p.id);
              } else {
                stillPending.push(p);
              }
            }

            // Merge server orders with unconfirmed pending optimistic orders
            let merged = [...serverOrders];
            for (const p of stillPending) {
              const pSlug = (p.restaurantSlug || p.restaurant_slug || '').toLowerCase();
              if (
                !merged.some(
                  (m) =>
                    m.id === p.id ||
                    (m.orderNumber === p.orderNumber &&
                      (m.restaurantSlug || m.restaurant_slug || '').toLowerCase() === pSlug)
                )
              ) {
                merged = [p, ...merged];
              }
            }

            const prevDigest = safePrev.map((o) => `${o.id}-${o.status}-${o.rePingCount}`).join('|');
            const nextDigest = merged.map((o: Order) => `${o.id}-${o.status}-${o.rePingCount}`).join('|');
            if (prevDigest !== nextDigest) {
              try {
                localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(merged));
              } catch {}
              return merged;
            }
            return safePrev;
          });
        }
      } else {
        setNetworkStatus('reconnecting');
      }
    } catch {
      setNetworkStatus('reconnecting');
    }
  }, []);

  // Active 3-second heartbeat polling
  useEffect(() => {
    if (typeof window === 'undefined') return;
    syncNow();
    const interval = setInterval(syncNow, 3000);
    return () => clearInterval(interval);
  }, [syncNow]);

  // Background Tab & Lock-Screen Reconnection Recovery (visibilitychange & focus)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleRecovery = () => {
      if (document.visibilityState === 'visible') {
        syncNow();
        soundManager.unlock().catch(() => {});
      }
    };

    const handleFocus = () => {
      syncNow();
      soundManager.unlock().catch(() => {});
    };

    document.addEventListener('visibilitychange', handleRecovery);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleRecovery);
      window.removeEventListener('focus', handleFocus);
    };
  }, [syncNow]);

  // 4. Multi-Tenant Restaurant Helpers
  const getRestaurant = useCallback(
    (slug: string): Restaurant | undefined => {
      if (!slug) return undefined;
      const cleanSlug = slug.toLowerCase().trim();
      if (restaurants[cleanSlug]) {
        return restaurants[cleanSlug];
      }
      if (typeof window !== 'undefined' && !fetchedSlugsRef.current.has(cleanSlug)) {
        fetchedSlugsRef.current.add(cleanSlug);
        fetch(`/api/restaurants/${cleanSlug}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.success && data?.restaurant) {
              setRestaurants((prev) => ({ ...prev, [cleanSlug]: data.restaurant }));
            }
          })
          .catch(() => {});
      }
      return undefined;
    },
    [restaurants]
  );

  const updateRestaurant = useCallback(
    async (slug: string, data: Partial<Restaurant>) => {
      const cleanSlug = slug.toLowerCase();
      const current = getRestaurant(cleanSlug);
      const updated: Restaurant = {
        id: current?.id || `res_${cleanSlug}`,
        slug: cleanSlug,
        name: current?.name || cleanSlug,
        themeColor: current?.themeColor || '#10B981',
        whatsappFallbackEnabled: current?.whatsappFallbackEnabled ?? true,
        createdAt: current?.createdAt || new Date().toISOString(),
        ...current,
        ...data,
      };

      const nextRestaurants = {
        ...restaurants,
        [cleanSlug]: updated,
      };

      saveAndBroadcast(orders, {
        type: 'RESTAURANT_UPDATED',
        restaurantSlug: cleanSlug,
        restaurant: updated,
        timestamp: Date.now(),
        sourceTabId: tabIdRef.current,
      }, nextRestaurants);

      if (isSupabaseConfigured() && supabase) {
        supabase
          .from('restaurants')
          .upsert({
            slug: cleanSlug,
            name: updated.name,
            logo_url: updated.logoUrl,
            theme_color: updated.themeColor,
            staff_pin: updated.staffPin,
            whatsapp_fallback_enabled: updated.whatsappFallbackEnabled,
          })
          .then();
      }
    },
    [getRestaurant, orders, restaurants, saveAndBroadcast]
  );

  const createRestaurant = useCallback(
    async (data: Omit<Restaurant, 'id' | 'createdAt'>): Promise<Restaurant> => {
      const slug = data.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
      const newRest: Restaurant = {
        ...data,
        id: 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        slug,
        createdAt: new Date().toISOString(),
      };

      const nextRestaurants = {
        ...restaurants,
        [slug]: newRest,
      };

      saveAndBroadcast(
        orders,
        {
          type: 'RESTAURANT_CREATED',
          restaurantSlug: slug,
          restaurant: newRest,
          timestamp: Date.now(),
          sourceTabId: tabIdRef.current,
        },
        nextRestaurants
      );

      if (isSupabaseConfigured() && supabase) {
        supabase
          .from('restaurants')
          .insert({
            slug,
            name: newRest.name,
            logo_url: newRest.logoUrl,
            theme_color: newRest.themeColor,
            staff_pin: newRest.staffPin,
            whatsapp_fallback_enabled: newRest.whatsappFallbackEnabled,
          })
          .then();
      }

      return newRest;
    },
    [orders, restaurants, saveAndBroadcast]
  );

  // 4.1 Duplicate Prevention Helper: Check if order is active within the last 18 hours
  const getActiveOrder = useCallback(
    (orderNumber: string, restaurantSlug?: string): Order | undefined => {
      const clean = orderNumber.trim().toLowerCase();
      const slug = (restaurantSlug || 'demo-cafe').toLowerCase().trim();
      const cutoff = Date.now() - 18 * 60 * 60 * 1000;
      const safeOrders = Array.isArray(orders) ? orders : [];
      return safeOrders.find((o) => {
        if (!o) return false;
        const ordSlug = (o.restaurantSlug || o.restaurant_slug || '').toLowerCase().trim();
        const createdTime = new Date(o.createdAt || o.created_at || Date.now()).getTime();
        return (
          o.orderNumber.toLowerCase() === clean &&
          ordSlug === slug &&
          (o.status === 'preparing' || o.status === 'ready') &&
          createdTime > cutoff
        );
      });
    },
    [orders]
  );

  // 5. Action: Add Order with Duplicate Guard & 0ms Optimistic Confirmation
  const addOrder = useCallback(
    async (
      orderNumber: string,
      estimatedMinutes: number = 10,
      notes?: string,
      customerPhone?: string,
      restaurantSlug: string = 'demo-cafe',
      options?: { replaceExisting?: boolean }
    ): Promise<Order> => {
      const cleanNum = orderNumber.trim();
      const slug = (restaurantSlug || 'demo-cafe').toLowerCase().trim();
      const rest = getRestaurant(slug);

      // Check if duplicate active order exists and caller didn't explicitly replace
      const existingActive = getActiveOrder(cleanNum, slug);
      if (existingActive && !options?.replaceExisting) {
        return existingActive;
      }

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const nowIso = new Date().toISOString();

      const optimisticOrder: Order = {
        id: tempId,
        orderNumber: cleanNum,
        restaurantSlug: slug,
        restaurant_slug: slug,
        restaurantId: rest?.id || `res_${slug}`,
        restaurant_id: rest?.id || `res_${slug}`,
        customerName: undefined,
        customerPhone: customerPhone ? customerPhone.trim() : undefined,
        notes: notes ? notes.trim() : undefined,
        status: 'preparing',
        estimatedMinutes: estimatedMinutes || 10,
        createdAt: nowIso,
        created_at: nowIso,
        rePingCount: 0,
      };

      // 1. Register in pending optimistic map
      pendingOptimisticOrdersRef.current.set(tempId, optimisticOrder);

      // 2. Compute next state immediately
      const currentOrders = Array.isArray(ordersRef.current) ? ordersRef.current : [];
      const filtered = currentOrders.filter(
        (o) =>
          !(
            (o.restaurantSlug || o.restaurant_slug || '').toLowerCase() === slug &&
            o.orderNumber.toLowerCase() === cleanNum.toLowerCase() &&
            (o.status === 'preparing' || o.status === 'ready')
          )
      );
      const nextOrders = [optimisticOrder, ...filtered];

      // Save to localStorage immediately
      try {
        localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(nextOrders));
      } catch {}

      // 0ms Optimistic UI update
      setOrders(nextOrders);

      const event: QueueRealtimeEvent = {
        type: 'ORDER_ADDED',
        restaurantSlug: slug,
        orderId: tempId,
        orderNumber: cleanNum,
        order: optimisticOrder,
        timestamp: Date.now(),
        sourceTabId: tabIdRef.current,
      };
      setLastEvent(event);

      if (channelRef.current) {
        channelRef.current.postMessage(event);
      }

      soundManager.playSuccessTone();

      // 3. Asynchronously sync to API and Supabase
      (async () => {
        try {
          const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'ORDER_ADDED',
              order: optimisticOrder,
              orderId: tempId,
              orderNumber: cleanNum,
              restaurantSlug: slug,
              restaurant_slug: slug,
              restaurant_id: rest?.id || `res_${slug}`,
              orders: nextOrders,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const confirmedOrder = data.updatedOrder || data.order;
            if (confirmedOrder && confirmedOrder.id) {
              pendingOptimisticOrdersRef.current.delete(tempId);
              setOrders((prev) => {
                const safe = Array.isArray(prev) ? prev : [];
                const updated = safe.map((o) =>
                  o.id === tempId ? { ...o, id: confirmedOrder.id } : o
                );
                try {
                  localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(updated));
                } catch {}
                return updated;
              });
            }
          }
        } catch (err) {
          console.warn('API POST order failed, keeping optimistic order:', err);
        }

        // Supabase insert if active
        if (isSupabaseConfigured() && supabase) {
          try {
            const { data, error } = await supabase
              .from('orders_queue')
              .insert({
                order_number: optimisticOrder.orderNumber,
                restaurant_slug: slug,
                restaurant_id: rest?.id,
                customer_phone: optimisticOrder.customerPhone,
                notes: optimisticOrder.notes,
                status: 'preparing',
                estimated_mins: optimisticOrder.estimatedMinutes,
              })
              .select()
              .single();

            if (!error && data && data.id) {
              pendingOptimisticOrdersRef.current.delete(tempId);
              setOrders((prev) => {
                const safe = Array.isArray(prev) ? prev : [];
                const updated = safe.map((o) =>
                  o.id === tempId ? { ...o, id: data.id } : o
                );
                try {
                  localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(updated));
                } catch {}
                return updated;
              });
            }
          } catch (err) {
            console.warn('Supabase insert queued:', err);
          }
        }
      })();

      return optimisticOrder;
    },
    [getActiveOrder, getRestaurant]
  );

  // 6. Action: Mark Ready
  const markReady = useCallback(
    async (orderId: string, restaurantSlug?: string) => {
      const nowIso = new Date().toISOString();
      const currentOrders = Array.isArray(ordersRef.current) ? ordersRef.current : [];
      let targetOrder: Order | undefined;

      const next = currentOrders.map((ord) => {
        const matchSlug = restaurantSlug
          ? (ord.restaurantSlug || ord.restaurant_slug || '').toLowerCase() === restaurantSlug.toLowerCase()
          : true;
        if ((ord.id === orderId || ord.orderNumber === orderId) && matchSlug) {
          targetOrder = {
            ...ord,
            status: 'ready' as OrderStatus,
            readyAt: nowIso,
            lastPingAt: nowIso,
          };
          return targetOrder;
        }
        return ord;
      });

      if (targetOrder) {
        const rest = getRestaurant(targetOrder.restaurantSlug);

        saveAndBroadcast(next, {
          type: 'ORDER_READY',
          restaurantSlug: targetOrder.restaurantSlug,
          orderId: targetOrder.id,
          orderNumber: targetOrder.orderNumber,
          order: targetOrder,
          timestamp: Date.now(),
          sourceTabId: tabIdRef.current,
        });

        if (isSupabaseConfigured() && supabase) {
          supabase
            .from('orders_queue')
            .update({
              status: 'ready',
              ready_at: nowIso,
              last_ping_at: nowIso,
            })
            .eq('order_number', targetOrder.orderNumber)
            .eq('restaurant_slug', targetOrder.restaurantSlug)
            .then();
        }

        triggerBackendPush({
          orderNumber: targetOrder.orderNumber,
          title: `طلبك #${targetOrder.orderNumber} جاهز للاستلام! 🍔 (${rest?.name || targetOrder.restaurantSlug})`,
          body: 'تفضل بالتوجه إلى الكاونتر لاستلام وجبتك وهي ساخنة ولذيذة.',
          url: `/${targetOrder.restaurantSlug}/track/${encodeURIComponent(targetOrder.orderNumber)}`,
          subscription: targetOrder.pushSubscription,
        });
      }
    },
    [getRestaurant, saveAndBroadcast]
  );

  // 7. Action: Re-Ping
  const rePing = useCallback(
    async (orderId: string, restaurantSlug?: string) => {
      const nowIso = new Date().toISOString();
      const currentOrders = Array.isArray(ordersRef.current) ? ordersRef.current : [];
      let targetOrder: Order | undefined;

      const next = currentOrders.map((ord) => {
        const matchSlug = restaurantSlug
          ? (ord.restaurantSlug || ord.restaurant_slug || '').toLowerCase() === restaurantSlug.toLowerCase()
          : true;
        if ((ord.id === orderId || ord.orderNumber === orderId) && matchSlug) {
          targetOrder = {
            ...ord,
            rePingCount: (ord.rePingCount || 0) + 1,
            lastPingAt: nowIso,
          };
          return targetOrder;
        }
        return ord;
      });

      if (targetOrder) {
        const rest = getRestaurant(targetOrder.restaurantSlug);

        saveAndBroadcast(next, {
          type: 'ORDER_REPING',
          restaurantSlug: targetOrder.restaurantSlug,
          orderId: targetOrder.id,
          orderNumber: targetOrder.orderNumber,
          order: targetOrder,
          timestamp: Date.now(),
          sourceTabId: tabIdRef.current,
        });

        if (isSupabaseConfigured() && supabase) {
          supabase
            .from('orders_queue')
            .update({
              ping_count: targetOrder.rePingCount,
              last_ping_at: nowIso,
            })
            .eq('order_number', targetOrder.orderNumber)
            .eq('restaurant_slug', targetOrder.restaurantSlug)
            .then();
        }

        triggerBackendPush({
          orderNumber: targetOrder.orderNumber,
          title: `تذكير: طلبك #${targetOrder.orderNumber} بانتظارك! 🔔 (${rest?.name || targetOrder.restaurantSlug})`,
          body: 'يرجى مراجعة الكاونتر لاستلام طلبك.',
          url: `/${targetOrder.restaurantSlug}/track/${encodeURIComponent(targetOrder.orderNumber)}`,
          subscription: targetOrder.pushSubscription,
        });
      }
    },
    [getRestaurant, saveAndBroadcast]
  );

  // 8. Action: Complete Order
  const completeOrder = useCallback(
    async (orderId: string, restaurantSlug?: string) => {
      const nowIso = new Date().toISOString();
      const currentOrders = Array.isArray(ordersRef.current) ? ordersRef.current : [];
      let targetOrder: Order | undefined;

      const next = currentOrders.map((ord) => {
        const matchSlug = restaurantSlug
          ? (ord.restaurantSlug || ord.restaurant_slug || '').toLowerCase() === restaurantSlug.toLowerCase()
          : true;
        if ((ord.id === orderId || ord.orderNumber === orderId) && matchSlug) {
          targetOrder = {
            ...ord,
            status: 'completed' as OrderStatus,
            completedAt: nowIso,
          };
          return targetOrder;
        }
        return ord;
      });

      if (targetOrder) {
        saveAndBroadcast(next, {
          type: 'ORDER_COMPLETED',
          restaurantSlug: targetOrder.restaurantSlug,
          orderId: targetOrder.id,
          orderNumber: targetOrder.orderNumber,
          order: targetOrder,
          timestamp: Date.now(),
          sourceTabId: tabIdRef.current,
        });

        if (isSupabaseConfigured() && supabase) {
          supabase
            .from('orders_queue')
            .update({
              status: 'completed',
              completed_at: nowIso,
            })
            .eq('order_number', targetOrder.orderNumber)
            .eq('restaurant_slug', targetOrder.restaurantSlug)
            .then();
        }
      }

      soundManager.playSuccessTone();
    },
    [saveAndBroadcast]
  );

  // 8.1 Action: Submit Order Feedback
  const submitOrderFeedback = useCallback(
    async (orderId: string, feedback: import('@/types/queue').OrderFeedback, restaurantSlug?: string) => {
      const currentOrders = Array.isArray(ordersRef.current) ? ordersRef.current : [];
      let targetOrder: Order | undefined;

      const next = currentOrders.map((ord) => {
        const matchSlug = restaurantSlug
          ? (ord.restaurantSlug || ord.restaurant_slug || '').toLowerCase() === restaurantSlug.toLowerCase()
          : true;
        if ((ord.id === orderId || ord.orderNumber === orderId) && matchSlug) {
          targetOrder = {
            ...ord,
            feedback,
          };
          return targetOrder;
        }
        return ord;
      });

      if (targetOrder) {
        saveAndBroadcast(next, {
          type: 'ORDER_FEEDBACK',
          restaurantSlug: targetOrder.restaurantSlug,
          orderId: targetOrder.id,
          orderNumber: targetOrder.orderNumber,
          feedback,
          timestamp: Date.now(),
          sourceTabId: tabIdRef.current,
        });
      }

      soundManager.playSuccessTone();
    },
    [saveAndBroadcast]
  );

  // 9. Action: Auto-Archive Completed Orders
  const archiveCompletedOrders = useCallback(
    async (restaurantSlug: string) => {
      const slug = restaurantSlug.toLowerCase().trim();
      const currentOrders = Array.isArray(ordersRef.current) ? ordersRef.current : [];
      const next = currentOrders.filter(
        (ord) =>
          !(
            (ord.restaurantSlug || ord.restaurant_slug || '').toLowerCase() === slug &&
            ord.status === 'completed'
          )
      );

      saveAndBroadcast(next, {
        type: 'QUEUE_SYNC',
        restaurantSlug: slug,
        timestamp: Date.now(),
        sourceTabId: tabIdRef.current,
      });

      if (isSupabaseConfigured() && supabase) {
        supabase
          .from('orders_queue')
          .delete()
          .eq('restaurant_slug', slug)
          .eq('status', 'completed')
          .then();
      }

      soundManager.playSuccessTone();
    },
    [saveAndBroadcast]
  );

  // 10. Action: Cancel Order
  const cancelOrder = useCallback(
    async (orderId: string, restaurantSlug?: string) => {
      const currentOrders = Array.isArray(ordersRef.current) ? ordersRef.current : [];
      let deletedNum: string | undefined;
      let deletedSlug: string | undefined;

      const next = currentOrders.filter((ord) => {
        const matchSlug = restaurantSlug
          ? (ord.restaurantSlug || ord.restaurant_slug || '').toLowerCase() === restaurantSlug.toLowerCase()
          : true;
        if ((ord.id === orderId || ord.orderNumber === orderId) && matchSlug) {
          deletedNum = ord.orderNumber;
          deletedSlug = ord.restaurantSlug;
          return false;
        }
        return true;
      });

      if (deletedNum && deletedSlug && isSupabaseConfigured() && supabase) {
        supabase
          .from('orders_queue')
          .delete()
          .eq('order_number', deletedNum)
          .eq('restaurant_slug', deletedSlug)
          .then();
      }

      saveAndBroadcast(next, {
        type: 'ORDER_CANCELLED',
        restaurantSlug: deletedSlug,
        orderId,
        timestamp: Date.now(),
        sourceTabId: tabIdRef.current,
      });
    },
    [saveAndBroadcast]
  );

  // 11. Action: Register Push
  const registerPushSubscription = useCallback(
    async (orderNumber: string, sub: PushSubscriptionData, restaurantSlug?: string) => {
      const cleanNum = orderNumber.trim();
      const slug = (restaurantSlug || 'demo-cafe').toLowerCase().trim();
      const currentOrders = Array.isArray(ordersRef.current) ? ordersRef.current : [];

      const next = currentOrders.map((ord) => {
        const ordSlug = (ord.restaurantSlug || ord.restaurant_slug || '').toLowerCase();
        if (ord.orderNumber === cleanNum && ordSlug === slug) {
          return {
            ...ord,
            pushSubscription: sub,
          };
        }
        return ord;
      });

      saveAndBroadcast(next, {
        type: 'PUSH_REGISTERED',
        restaurantSlug: slug,
        orderNumber: cleanNum,
        timestamp: Date.now(),
        sourceTabId: tabIdRef.current,
      });

      if (isSupabaseConfigured() && supabase) {
        supabase
          .from('orders_queue')
          .update({ push_subscription: sub })
          .eq('order_number', cleanNum)
          .eq('restaurant_slug', slug)
          .then();
      }
    },
    [saveAndBroadcast]
  );

  // Filter active orders to exclude stale/unclosed orders older than 18 hours
  const getOrdersForRestaurant = useCallback(
    (slug: string): Order[] => {
      const cleanSlug = (slug || 'demo-cafe').toLowerCase().trim();
      const cutoff = Date.now() - 18 * 60 * 60 * 1000;
      const safeOrders = Array.isArray(orders) ? orders : [];
      return safeOrders.filter((o) => {
        if (!o) return false;
        const ordSlug = (o.restaurantSlug || o.restaurant_slug || '').toLowerCase().trim();
        if (ordSlug !== cleanSlug) return false;
        const createdTime = new Date(o.createdAt || o.created_at || Date.now()).getTime();
        if ((o.status === 'preparing' || o.status === 'ready') && createdTime <= cutoff) {
          return false;
        }
        return true;
      });
    },
    [orders]
  );

  const getOrder = useCallback(
    (orderNumber: string, restaurantSlug?: string): Order | undefined => {
      const clean = orderNumber.trim().toLowerCase();
      const safeOrders = Array.isArray(orders) ? orders : [];
      if (restaurantSlug) {
        const slug = restaurantSlug.toLowerCase().trim();
        return safeOrders.find((o) => {
          if (!o) return false;
          const ordSlug = (o.restaurantSlug || o.restaurant_slug || '').toLowerCase().trim();
          return o.orderNumber.toLowerCase() === clean && ordSlug === slug;
        });
      }
      return safeOrders.find((o) => o && o.orderNumber.toLowerCase() === clean);
    },
    [orders]
  );

  const clearQueue = useCallback(
    (slug: string = 'demo-cafe') => {
      const cleanSlug = slug.toLowerCase().trim();
      const currentOrders = Array.isArray(ordersRef.current) ? ordersRef.current : [];
      const next = currentOrders.filter(
        (o) => (o.restaurantSlug || o.restaurant_slug || '').toLowerCase() !== cleanSlug
      );
      saveAndBroadcast(next, {
        type: 'QUEUE_RESET',
        restaurantSlug: cleanSlug,
        timestamp: Date.now(),
        sourceTabId: tabIdRef.current,
      });
    },
    [saveAndBroadcast]
  );

  const resetToDemoOrders = useCallback(
    (slug: string = 'demo-cafe') => {
      clearQueue(slug);
    },
    [clearQueue]
  );

  // Backward compatibility filters with 18-hour cutoff
  const preparingOrders = useMemo(() => {
    const cutoff = Date.now() - 18 * 60 * 60 * 1000;
    return orders.filter((o) => o.status === 'preparing' && new Date(o.createdAt).getTime() > cutoff);
  }, [orders]);

  const readyOrders = useMemo(() => {
    const cutoff = Date.now() - 18 * 60 * 60 * 1000;
    return orders.filter((o) => o.status === 'ready' && new Date(o.createdAt).getTime() > cutoff);
  }, [orders]);

  const completedOrders = useMemo(
    () => orders.filter((o) => o.status === 'completed'),
    [orders]
  );

  const value = {
    orders,
    restaurants,
    isRestaurantsLoaded,
    lastEvent,
    isSupabaseActive,
    networkStatus,
    getRestaurant,
    updateRestaurant,
    createRestaurant,
    addOrder,
    getActiveOrder,
    markReady,
    rePing,
    completeOrder,
    cancelOrder,
    submitOrderFeedback,
    archiveCompletedOrders,
    registerPushSubscription,
    getOrdersForRestaurant,
    getOrder,
    resetToDemoOrders,
    clearQueue,
    syncNow,
    preparingOrders,
    readyOrders,
    completedOrders,
  };

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
};

export const useQueue = (): QueueContextType => {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueue must be used within a QueueProvider');
  }
  return context;
};

export const useQueueStore = useQueue;
