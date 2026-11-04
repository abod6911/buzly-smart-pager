'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Order, OrderStatus, QueueRealtimeEvent } from '@/types/queue';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { soundManager } from '@/lib/audio';

const STORAGE_KEY = 'buzly_active_queue_v1';
const BROADCAST_CHANNEL_NAME = 'buzly_realtime_queue';

// Initial demo orders for instant zero-config testing
const INITIAL_DEMO_ORDERS: Order[] = [
  {
    id: 'demo-102',
    orderNumber: '102',
    customerName: 'محمد أحمد',
    notes: 'برجر أنجوس كلاسيك + بطاطس حجم عائلي',
    status: 'preparing',
    estimatedMinutes: 10,
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    rePingCount: 0,
  },
  {
    id: 'demo-104',
    orderNumber: '104',
    customerName: 'سارة خالد',
    notes: 'شاورما دجاج إكسترا صوص ثوم',
    status: 'preparing',
    estimatedMinutes: 15,
    createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
    rePingCount: 0,
  },
  {
    id: 'demo-98',
    orderNumber: '98',
    customerName: 'عبدالله',
    notes: 'وجبة سريعة سفري',
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
    customerName: 'فهد',
    notes: 'عصير برتقال طازج + كوكيز',
    status: 'ready',
    estimatedMinutes: 5,
    createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    readyAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    rePingCount: 0,
    lastPingAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
  },
];

interface QueueContextType {
  orders: Order[];
  preparingOrders: Order[];
  readyOrders: Order[];
  completedOrders: Order[];
  lastEvent: QueueRealtimeEvent | null;
  isSupabaseActive: boolean;
  addOrder: (orderNumber: string, estimatedMinutes: number, notes?: string) => Promise<Order>;
  markReady: (orderId: string) => Promise<void>;
  rePing: (orderId: string) => Promise<void>;
  completeOrder: (orderId: string) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  getOrder: (orderNumber: string) => Order | undefined;
  resetToDemoOrders: () => void;
  clearQueue: () => void;
}

const QueueContext = createContext<QueueContextType | undefined>(undefined);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [lastEvent, setLastEvent] = useState<QueueRealtimeEvent | null>(null);
  const [isSupabaseActive] = useState<boolean>(isSupabaseConfigured());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const tabIdRef = useRef<string>('');

  // 1. Initialize orders from LocalStorage or default demo
  useEffect(() => {
    tabIdRef.current = 'tab_' + Math.random().toString(36).substring(2, 9);

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setOrders(parsed);
          } else {
            setOrders(INITIAL_DEMO_ORDERS);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DEMO_ORDERS));
          }
        } else {
          setOrders(INITIAL_DEMO_ORDERS);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DEMO_ORDERS));
        }
      } catch (err) {
        console.warn('LocalStorage error:', err);
        setOrders(INITIAL_DEMO_ORDERS);
      }
    }
  }, []);

  // Helper to persist and broadcast
  const saveAndBroadcast = useCallback((newOrders: Order[], event: QueueRealtimeEvent) => {
    setOrders(newOrders);
    setLastEvent(event);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrders));
      } catch (e) {
        console.error('Error saving orders to localStorage', e);
      }

      // Broadcast across browser tabs
      if (channelRef.current) {
        channelRef.current.postMessage(event);
      }
    }
  }, []);

  // 2. Setup BroadcastChannel and storage listener for instant cross-tab sync
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

          // Refresh from localStorage on any broadcast
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
              const freshOrders = JSON.parse(raw);
              setOrders(freshOrders);
            }
          } catch {
            // Ignore
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not supported, falling back to storage events', e);
    }

    // Storage event fallback (for browsers or tabs across distinct contexts)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          if (Array.isArray(updated)) {
            setOrders(updated);
          }
        } catch {
          // Ignore
        }
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // 3. Supabase Realtime Subscription (if configured)
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;

    const sbChannel = supabase
      .channel('buzly_orders_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          // Transform Postgres row to Order format
          if (payload.eventType === 'INSERT') {
            const row = payload.new;
            const newOrder: Order = {
              id: row.id,
              orderNumber: row.order_number,
              customerName: row.customer_name,
              notes: row.notes,
              status: row.status as OrderStatus,
              estimatedMinutes: row.estimated_minutes,
              createdAt: row.created_at,
              readyAt: row.ready_at,
              completedAt: row.completed_at,
              rePingCount: row.re_ping_count || 0,
              lastPingAt: row.last_ping_at,
            };
            setOrders((prev) => {
              if (prev.some((o) => o.id === newOrder.id)) return prev;
              const next = [newOrder, ...prev];
              localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
              return next;
            });
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new;
            setOrders((prev) => {
              const next = prev.map((o) => {
                if (o.id === row.id || o.orderNumber === row.order_number) {
                  return {
                    ...o,
                    status: row.status as OrderStatus,
                    readyAt: row.ready_at,
                    completedAt: row.completed_at,
                    rePingCount: row.re_ping_count || o.rePingCount,
                    lastPingAt: row.last_ping_at || o.lastPingAt,
                  };
                }
                return o;
              });
              localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(sbChannel);
      }
    };
  }, []);

  // 4. Action: Add Order
  const addOrder = useCallback(
    async (orderNumber: string, estimatedMinutes: number = 10, notes?: string): Promise<Order> => {
      const cleanNum = orderNumber.trim();
      const newOrder: Order = {
        id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        orderNumber: cleanNum,
        notes: notes || undefined,
        status: 'preparing',
        estimatedMinutes: estimatedMinutes || 10,
        createdAt: new Date().toISOString(),
        rePingCount: 0,
      };

      // If Supabase is connected, insert asynchronously to DB
      if (isSupabaseConfigured() && supabase) {
        supabase
          .from('orders')
          .insert({
            order_number: newOrder.orderNumber,
            notes: newOrder.notes,
            status: 'preparing',
            estimated_minutes: newOrder.estimatedMinutes,
          })
          .then(({ data, error }) => {
            if (error) console.error('Supabase insert error:', error);
          });
      }

      setOrders((prev) => {
        // Remove duplicate if same active number existed
        const filtered = prev.filter((o) => o.orderNumber !== cleanNum || o.status === 'completed');
        const next = [newOrder, ...filtered];
        saveAndBroadcast(next, {
          type: 'ORDER_ADDED',
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

  // 5. Action: Mark Order Ready (Triggers customer buzzer chime!)
  const markReady = useCallback(
    async (orderId: string) => {
      const nowIso = new Date().toISOString();

      setOrders((prev) => {
        let targetOrder: Order | undefined;
        const next = prev.map((ord) => {
          if (ord.id === orderId || ord.orderNumber === orderId) {
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
          saveAndBroadcast(next, {
            type: 'ORDER_READY',
            orderId: targetOrder.id,
            orderNumber: targetOrder.orderNumber,
            order: targetOrder,
            timestamp: Date.now(),
            sourceTabId: tabIdRef.current,
          });

          // Also update Supabase
          if (isSupabaseConfigured() && supabase) {
            supabase
              .from('orders')
              .update({
                status: 'ready',
                ready_at: nowIso,
                last_ping_at: nowIso,
              })
              .eq('order_number', targetOrder.orderNumber);
          }
        }

        return next;
      });
    },
    [saveAndBroadcast]
  );

  // 6. Action: Re-Ping Customer (Sends repeated alert chime)
  const rePing = useCallback(
    async (orderId: string) => {
      const nowIso = new Date().toISOString();

      setOrders((prev) => {
        let targetOrder: Order | undefined;
        const next = prev.map((ord) => {
          if (ord.id === orderId || ord.orderNumber === orderId) {
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
          saveAndBroadcast(next, {
            type: 'ORDER_REPING',
            orderId: targetOrder.id,
            orderNumber: targetOrder.orderNumber,
            order: targetOrder,
            timestamp: Date.now(),
            sourceTabId: tabIdRef.current,
          });

          // Supabase update
          if (isSupabaseConfigured() && supabase) {
            supabase
              .from('orders')
              .update({
                re_ping_count: targetOrder.rePingCount,
                last_ping_at: nowIso,
              })
              .eq('order_number', targetOrder.orderNumber);
          }
        }

        return next;
      });
    },
    [saveAndBroadcast]
  );

  // 7. Action: Complete Order (Customer picked up)
  const completeOrder = useCallback(
    async (orderId: string) => {
      const nowIso = new Date().toISOString();

      setOrders((prev) => {
        let targetOrder: Order | undefined;
        const next = prev.map((ord) => {
          if (ord.id === orderId || ord.orderNumber === orderId) {
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
            orderId: targetOrder.id,
            orderNumber: targetOrder.orderNumber,
            order: targetOrder,
            timestamp: Date.now(),
            sourceTabId: tabIdRef.current,
          });

          if (isSupabaseConfigured() && supabase) {
            supabase
              .from('orders')
              .update({
                status: 'completed',
                completed_at: nowIso,
              })
              .eq('order_number', targetOrder.orderNumber);
          }
        }

        return next;
      });

      soundManager.playSuccessTone();
    },
    [saveAndBroadcast]
  );

  // 8. Action: Cancel Order
  const cancelOrder = useCallback(
    async (orderId: string) => {
      setOrders((prev) => {
        const next = prev.filter((ord) => ord.id !== orderId && ord.orderNumber !== orderId);
        saveAndBroadcast(next, {
          type: 'ORDER_CANCELLED',
          orderId,
          timestamp: Date.now(),
          sourceTabId: tabIdRef.current,
        });
        return next;
      });
    },
    [saveAndBroadcast]
  );

  // 9. Helper: Get order by orderNumber
  const getOrder = useCallback(
    (orderNumber: string): Order | undefined => {
      const clean = orderNumber.trim();
      return orders.find((o) => o.orderNumber === clean);
    },
    [orders]
  );

  // 10. Reset to demo orders
  const resetToDemoOrders = useCallback(() => {
    saveAndBroadcast(INITIAL_DEMO_ORDERS, {
      type: 'QUEUE_RESET',
      orders: INITIAL_DEMO_ORDERS,
      timestamp: Date.now(),
      sourceTabId: tabIdRef.current,
    });
  }, [saveAndBroadcast]);

  // 11. Clear all active orders
  const clearQueue = useCallback(() => {
    saveAndBroadcast([], {
      type: 'QUEUE_RESET',
      orders: [],
      timestamp: Date.now(),
      sourceTabId: tabIdRef.current,
    });
  }, [saveAndBroadcast]);

  // Derived collections
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
    preparingOrders,
    readyOrders,
    completedOrders,
    lastEvent,
    isSupabaseActive,
    addOrder,
    markReady,
    rePing,
    completeOrder,
    cancelOrder,
    getOrder,
    resetToDemoOrders,
    clearQueue,
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
