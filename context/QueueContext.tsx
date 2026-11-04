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

export const DEFAULT_RESTAURANT: Restaurant = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  slug: 'demo-cafe',
  name: 'ديمو كافيه & لاونج | Demo Cafe',
  logoUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=120&auto=format&fit=crop&q=80',
  themeColor: '#10B981',
  staffPin: '1234',
  whatsappFallbackEnabled: true,
  createdAt: new Date().toISOString(),
};

const INITIAL_DEMO_ORDERS: Order[] = [
  {
    id: 'demo-102',
    orderNumber: '102',
    restaurantSlug: 'demo-cafe',
    customerName: 'محمد أحمد',
    customerPhone: '966501112233',
    notes: '2x فلات وايت + كرواسون لوز',
    status: 'preparing',
    estimatedMinutes: 10,
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    rePingCount: 0,
  },
  {
    id: 'demo-104',
    orderNumber: '104',
    restaurantSlug: 'demo-cafe',
    customerName: 'سارة خالد',
    customerPhone: '966554443322',
    notes: 'سبانش لاتيه بارد إكسترا صوص',
    status: 'preparing',
    estimatedMinutes: 15,
    createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
    rePingCount: 0,
  },
  {
    id: 'demo-98',
    orderNumber: '98',
    restaurantSlug: 'demo-cafe',
    customerName: 'عبدالله السعد',
    customerPhone: '966598887766',
    notes: 'وجبة خفيفة سفري',
    status: 'ready',
    estimatedMinutes: 5,
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    readyAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    rePingCount: 1,
    lastPingAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-99',
    orderNumber: '99',
    restaurantSlug: 'demo-cafe',
    customerName: 'فهد',
    notes: 'عصير برتقال كولد بريس',
    status: 'ready',
    estimatedMinutes: 5,
    createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    readyAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    rePingCount: 0,
    lastPingAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-91',
    orderNumber: '91',
    restaurantSlug: 'demo-cafe',
    customerName: 'سلطان',
    notes: 'قهوة مقطرة V60 إثيوبية',
    status: 'completed',
    estimatedMinutes: 8,
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    readyAt: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 36 * 60 * 1000).toISOString(),
    rePingCount: 0,
  },
  {
    id: 'demo-92',
    orderNumber: '92',
    restaurantSlug: 'demo-cafe',
    customerName: 'نورة',
    customerPhone: '966532221100',
    notes: 'كورتادو + كوكيز شوكولاتة',
    status: 'completed',
    estimatedMinutes: 6,
    createdAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    readyAt: new Date(Date.now() - 49 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 47 * 60 * 1000).toISOString(),
    rePingCount: 0,
  },
];

interface QueueContextType {
  orders: Order[];
  restaurants: Record<string, Restaurant>;
  lastEvent: QueueRealtimeEvent | null;
  isSupabaseActive: boolean;
  getRestaurant: (slug: string) => Restaurant;
  updateRestaurant: (slug: string, data: Partial<Restaurant>) => Promise<void>;
  createRestaurant: (data: Omit<Restaurant, 'id' | 'createdAt'>) => Promise<Restaurant>;
  addOrder: (
    orderNumber: string,
    estimatedMinutes: number,
    notes?: string,
    customerPhone?: string,
    restaurantSlug?: string
  ) => Promise<Order>;
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

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurants, setRestaurants] = useState<Record<string, Restaurant>>({
    'demo-cafe': DEFAULT_RESTAURANT,
  });
  const [lastEvent, setLastEvent] = useState<QueueRealtimeEvent | null>(null);
  const [isSupabaseActive] = useState<boolean>(isSupabaseConfigured());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const tabIdRef = useRef<string>('');

  // 1. Initialize from localStorage
  useEffect(() => {
    tabIdRef.current = 'tab_' + Math.random().toString(36).substring(2, 9);

    if (typeof window !== 'undefined') {
      try {
        const storedRest = localStorage.getItem(STORAGE_RESTAURANTS_KEY);
        if (storedRest) {
          setRestaurants(JSON.parse(storedRest));
        } else {
          setRestaurants({ 'demo-cafe': DEFAULT_RESTAURANT });
          localStorage.setItem(
            STORAGE_RESTAURANTS_KEY,
            JSON.stringify({ 'demo-cafe': DEFAULT_RESTAURANT })
          );
        }

        const storedOrders = localStorage.getItem(STORAGE_ORDERS_KEY);
        if (storedOrders) {
          const parsed = JSON.parse(storedOrders);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setOrders(parsed);
          } else {
            setOrders(INITIAL_DEMO_ORDERS);
            localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(INITIAL_DEMO_ORDERS));
          }
        } else {
          setOrders(INITIAL_DEMO_ORDERS);
          localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(INITIAL_DEMO_ORDERS));
        }
      } catch (err) {
        console.warn('Storage init warning:', err);
        setOrders(INITIAL_DEMO_ORDERS);
      }
    }
  }, []);

  const saveAndBroadcast = useCallback(
    (newOrders: Order[], event: QueueRealtimeEvent, newRestaurants?: Record<string, Restaurant>) => {
      setOrders(newOrders);
      setLastEvent(event);
      if (newRestaurants) setRestaurants(newRestaurants);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(newOrders));
          if (newRestaurants) {
            localStorage.setItem(STORAGE_RESTAURANTS_KEY, JSON.stringify(newRestaurants));
          }
        } catch (e) {
          console.error('Storage save error:', e);
        }

        if (channelRef.current) {
          channelRef.current.postMessage(event);
        }
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

    // Load restaurants
    supabase
      .from('restaurants')
      .select('*')
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const restMap: Record<string, Restaurant> = {};
          data.forEach((r) => {
            restMap[r.slug] = {
              id: r.id,
              slug: r.slug,
              name: r.name,
              logoUrl: r.logo_url,
              themeColor: r.theme_color || '#10B981',
              staffPin: r.staff_pin || '1234',
              whatsappFallbackEnabled: r.whatsapp_fallback_enabled ?? true,
              createdAt: r.created_at,
            };
          });
          setRestaurants((prev) => ({ ...prev, ...restMap }));
        }
      });

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
            };
            setOrders((prev) => {
              if (prev.some((o) => o.id === newOrder.id)) return prev;
              const next = [newOrder, ...prev];
              localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(next));
              return next;
            });
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new;
            setOrders((prev) => {
              const next = prev.map((o) => {
                if (o.id === row.id || (o.orderNumber === row.order_number && o.restaurantSlug === row.restaurant_slug)) {
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
              localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(next));
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

  // 4. Multi-Tenant Restaurant Helpers
  const getRestaurant = useCallback(
    (slug: string): Restaurant => {
      const cleanSlug = slug.toLowerCase();
      if (restaurants[cleanSlug]) {
        return restaurants[cleanSlug];
      }
      return {
        ...DEFAULT_RESTAURANT,
        id: `res-${cleanSlug}`,
        slug: cleanSlug,
        name: cleanSlug.replace(/-/g, ' ').toUpperCase(),
      };
    },
    [restaurants]
  );

  const updateRestaurant = useCallback(
    async (slug: string, data: Partial<Restaurant>) => {
      const cleanSlug = slug.toLowerCase();
      const current = getRestaurant(cleanSlug);
      const updated: Restaurant = { ...current, ...data };

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

  // 5. Action: Add Order
  const addOrder = useCallback(
    async (
      orderNumber: string,
      estimatedMinutes: number = 10,
      notes?: string,
      customerPhone?: string,
      restaurantSlug: string = 'demo-cafe'
    ): Promise<Order> => {
      const cleanNum = orderNumber.trim();
      const slug = restaurantSlug.toLowerCase();

      const newOrder: Order = {
        id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        orderNumber: cleanNum,
        restaurantSlug: slug,
        customerName: undefined,
        customerPhone: customerPhone ? customerPhone.trim() : undefined,
        notes: notes ? notes.trim() : undefined,
        status: 'preparing',
        estimatedMinutes: estimatedMinutes || 10,
        createdAt: new Date().toISOString(),
        rePingCount: 0,
      };

      if (isSupabaseConfigured() && supabase) {
        supabase
          .from('orders_queue')
          .insert({
            order_number: newOrder.orderNumber,
            restaurant_slug: slug,
            customer_phone: newOrder.customerPhone,
            notes: newOrder.notes,
            status: 'preparing',
            estimated_mins: newOrder.estimatedMinutes,
          })
          .then();
      }

      setOrders((prev) => {
        const filtered = prev.filter(
          (o) => !(o.orderNumber === cleanNum && o.restaurantSlug === slug) || o.status === 'completed'
        );
        const next = [newOrder, ...filtered];
        saveAndBroadcast(next, {
          type: 'ORDER_ADDED',
          restaurantSlug: slug,
          orderId: newOrder.id,
          orderNumber: newOrder.orderNumber,
          order: newOrder,
          timestamp: Date.now(),
          sourceTabId: tabIdRef.current,
        });
        return next;
      });

      soundManager.playSuccessTone();
      return newOrder;
    },
    [saveAndBroadcast]
  );

  // 6. Action: Mark Ready
  const markReady = useCallback(
    async (orderId: string, restaurantSlug?: string) => {
      const nowIso = new Date().toISOString();

      setOrders((prev) => {
        let targetOrder: Order | undefined;
        const next = prev.map((ord) => {
          const matchSlug = restaurantSlug ? ord.restaurantSlug === restaurantSlug : true;
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
            title: `طلبك #${targetOrder.orderNumber} جاهز للاستلام! 🍔 (${rest.name})`,
            body: 'تفضل بالتوجه إلى الكاونتر لاستلام وجبتك وهي ساخنة ولذيذة.',
            url: `/${targetOrder.restaurantSlug}/track/${encodeURIComponent(targetOrder.orderNumber)}`,
            subscription: targetOrder.pushSubscription,
          });
        }

        return next;
      });
    },
    [getRestaurant, saveAndBroadcast]
  );

  // 7. Action: Re-Ping
  const rePing = useCallback(
    async (orderId: string, restaurantSlug?: string) => {
      const nowIso = new Date().toISOString();

      setOrders((prev) => {
        let targetOrder: Order | undefined;
        const next = prev.map((ord) => {
          const matchSlug = restaurantSlug ? ord.restaurantSlug === restaurantSlug : true;
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
            title: `تذكير: طلبك #${targetOrder.orderNumber} بانتظارك! 🔔 (${rest.name})`,
            body: 'يرجى مراجعة الكاونتر لاستلام طلبك.',
            url: `/${targetOrder.restaurantSlug}/track/${encodeURIComponent(targetOrder.orderNumber)}`,
            subscription: targetOrder.pushSubscription,
          });
        }

        return next;
      });
    },
    [getRestaurant, saveAndBroadcast]
  );

  // 8. Action: Complete Order
  const completeOrder = useCallback(
    async (orderId: string, restaurantSlug?: string) => {
      const nowIso = new Date().toISOString();

      setOrders((prev) => {
        let targetOrder: Order | undefined;
        const next = prev.map((ord) => {
          const matchSlug = restaurantSlug ? ord.restaurantSlug === restaurantSlug : true;
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

        return next;
      });

      soundManager.playSuccessTone();
    },
    [saveAndBroadcast]
  );

  // 8.1 Action: Submit Order Feedback
  const submitOrderFeedback = useCallback(
    async (orderId: string, feedback: import('@/types/queue').OrderFeedback, restaurantSlug?: string) => {
      setOrders((prev) => {
        let targetOrder: Order | undefined;
        const next = prev.map((ord) => {
          const matchSlug = restaurantSlug ? ord.restaurantSlug === restaurantSlug : true;
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

        return next;
      });

      soundManager.playSuccessTone();
    },
    [saveAndBroadcast]
  );

  // 9. Action: Auto-Archive Completed Orders
  const archiveCompletedOrders = useCallback(
    async (restaurantSlug: string) => {
      const slug = restaurantSlug.toLowerCase();
      setOrders((prev) => {
        const next = prev.filter(
          (ord) => !(ord.restaurantSlug === slug && ord.status === 'completed')
        );
        saveAndBroadcast(next, {
          type: 'QUEUE_SYNC',
          restaurantSlug: slug,
          timestamp: Date.now(),
          sourceTabId: tabIdRef.current,
        });
        return next;
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
      setOrders((prev) => {
        let deletedNum: string | undefined;
        let deletedSlug: string | undefined;

        const next = prev.filter((ord) => {
          const matchSlug = restaurantSlug ? ord.restaurantSlug === restaurantSlug : true;
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
        return next;
      });
    },
    [saveAndBroadcast]
  );

  // 11. Action: Register Push
  const registerPushSubscription = useCallback(
    async (orderNumber: string, sub: PushSubscriptionData, restaurantSlug?: string) => {
      const cleanNum = orderNumber.trim();
      const slug = (restaurantSlug || 'demo-cafe').toLowerCase();

      setOrders((prev) => {
        const next = prev.map((ord) => {
          if (ord.orderNumber === cleanNum && ord.restaurantSlug === slug) {
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

        return next;
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

  const getOrdersForRestaurant = useCallback(
    (slug: string): Order[] => {
      const cleanSlug = slug.toLowerCase();
      return orders.filter((o) => o.restaurantSlug === cleanSlug);
    },
    [orders]
  );

  const getOrder = useCallback(
    (orderNumber: string, restaurantSlug?: string): Order | undefined => {
      const clean = orderNumber.trim();
      if (restaurantSlug) {
        const slug = restaurantSlug.toLowerCase();
        return orders.find((o) => o.orderNumber === clean && o.restaurantSlug === slug);
      }
      return orders.find((o) => o.orderNumber === clean);
    },
    [orders]
  );

  const resetToDemoOrders = useCallback(
    (slug: string = 'demo-cafe') => {
      const cleanSlug = slug.toLowerCase();
      setOrders((prev) => {
        const otherOrders = prev.filter((o) => o.restaurantSlug !== cleanSlug);
        const demoOrdersWithSlug = INITIAL_DEMO_ORDERS.map((o) => ({
          ...o,
          restaurantSlug: cleanSlug,
        }));
        const next = [...demoOrdersWithSlug, ...otherOrders];
        saveAndBroadcast(next, {
          type: 'QUEUE_RESET',
          restaurantSlug: cleanSlug,
          timestamp: Date.now(),
          sourceTabId: tabIdRef.current,
        });
        return next;
      });
    },
    [saveAndBroadcast]
  );

  const clearQueue = useCallback(
    (slug: string = 'demo-cafe') => {
      const cleanSlug = slug.toLowerCase();
      setOrders((prev) => {
        const next = prev.filter((o) => o.restaurantSlug !== cleanSlug);
        saveAndBroadcast(next, {
          type: 'QUEUE_RESET',
          restaurantSlug: cleanSlug,
          timestamp: Date.now(),
          sourceTabId: tabIdRef.current,
        });
        return next;
      });
    },
    [saveAndBroadcast]
  );

  // Backward compatibility filters
  const preparingOrders = useMemo(
    () => orders.filter((o) => o.status === 'preparing'),
    [orders]
  );
  const readyOrders = useMemo(
    () => orders.filter((o) => o.status === 'ready'),
    [orders]
  );
  const completedOrders = useMemo(
    () => orders.filter((o) => o.status === 'completed'),
    [orders]
  );

  const value = {
    orders,
    restaurants,
    lastEvent,
    isSupabaseActive,
    getRestaurant,
    updateRestaurant,
    createRestaurant,
    addOrder,
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
