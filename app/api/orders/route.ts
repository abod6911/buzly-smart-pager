import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Order, OrderStatus, OrderFeedback } from '@/types/queue';
import { checkGeneralRateLimit } from '@/lib/security';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store',
};

// Global in-memory store fallback across all devices hitting this Next.js server instance
declare global {
  // eslint-disable-next-line no-var
  var __chimer_orders_store: Order[] | undefined;
  // eslint-disable-next-line no-var
  var __chimer_orders_last_updated: number | undefined;
}

function getStore(): Order[] {
  if (!globalThis.__chimer_orders_store || !Array.isArray(globalThis.__chimer_orders_store)) {
    globalThis.__chimer_orders_store = [];
    globalThis.__chimer_orders_last_updated = Date.now();
  }
  return globalThis.__chimer_orders_store;
}

function setStore(orders: Order[]) {
  globalThis.__chimer_orders_store = Array.isArray(orders) ? orders : [];
  globalThis.__chimer_orders_last_updated = Date.now();
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

function mapDbRowToOrder(row: any): Order {
  return {
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
    estimatedMinutes: row.estimated_mins || 10,
    pushSubscription: row.push_subscription,
    rePingCount: row.ping_count || 0,
    createdAt: row.created_at || new Date().toISOString(),
    created_at: row.created_at || new Date().toISOString(),
    readyAt: row.ready_at,
    completedAt: row.completed_at,
    lastPingAt: row.last_ping_at,
  };
}

// Zod Input Schemas for Anti-Abuse
const orderInputSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .min(1)
    .max(8)
    .regex(/^[0-9A-Za-z-]+$/, 'رقم الطلب يجب أن يتكون من أحرف وأرقام فقط بحد أقصى 8 خانات'),
  restaurantSlug: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'معرف المطعم غير صالح')
    .optional(),
  restaurant_slug: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'معرف المطعم غير صالح')
    .optional(),
  restaurantId: z.string().optional(),
  restaurant_id: z.string().optional(),
  estimatedMinutes: z.number().int().min(1).max(180).optional(),
  notes: z.string().max(300).optional(),
  customerPhone: z.string().max(30).optional(),
  customerName: z.string().max(100).optional(),
  status: z.enum(['preparing', 'ready', 'completed', 'cancelled']).optional(),
  createdAt: z.string().optional(),
  created_at: z.string().optional(),
});

// GET: High-Scale Targeted Orders Retrieval (Zero-Latency Cached/Non-cached Delivery)
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  // High-capacity rate limit: 1,200 reads per minute per IP for busy restaurants
  const rl = checkGeneralRateLimit(`get_orders:${ip}`, 1200, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'تم تجاوز معدل الطلبات المسموح به' },
      { status: 429, headers: { 'Retry-After': String(rl.resetSeconds), ...NO_CACHE_HEADERS } }
    );
  }

  const { searchParams } = new URL(req.url);
  const rawSlug = searchParams.get('slug')?.toLowerCase();
  const rawOrderNumber = searchParams.get('orderNumber')?.trim();

  // Sanitize query params
  const slug = rawSlug && /^[a-z0-9-]+$/.test(rawSlug) ? rawSlug : undefined;
  const orderNumber =
    rawOrderNumber && /^[0-9A-Za-z-]+$/.test(rawOrderNumber) && rawOrderNumber.length <= 8
      ? rawOrderNumber
      : undefined;

  const currentStore = getStore();

  // Fast-Path: If customer is polling their specific order, check memory store first
  if (slug && orderNumber) {
    const storeMatch = currentStore.find(
      (o) =>
        o.orderNumber.toLowerCase() === orderNumber.toLowerCase() &&
        (o.restaurantSlug || o.restaurant_slug || '').toLowerCase() === slug
    );

    // If memory store already has the order in 'ready' or 'completed' state, deliver in 0ms
    if (storeMatch && (storeMatch.status === 'ready' || storeMatch.status === 'completed')) {
      return NextResponse.json(
        {
          success: true,
          order: storeMatch,
          source: 'memory-fast-path',
          lastUpdated: globalThis.__chimer_orders_last_updated || Date.now(),
          serverTime: new Date().toISOString(),
        },
        { headers: NO_CACHE_HEADERS }
      );
    }
  }

  // 1. Supabase Fast DB Query (Targeted O(1) or Active Window O(N<=100))
  if (isSupabaseConfigured() && supabase) {
    try {
      if (slug && orderNumber) {
        // Targeted single customer order lookup
        const { data: dbRow, error } = await supabase
          .from('orders_queue')
          .select('*')
          .eq('restaurant_slug', slug)
          .eq('order_number', orderNumber)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && dbRow) {
          const mappedOrder = mapDbRowToOrder(dbRow);
          // Re-overlay any optimistic memory status if newer
          const storeMatch = currentStore.find(
            (o) =>
              o.orderNumber.toLowerCase() === orderNumber.toLowerCase() &&
              (o.restaurantSlug || o.restaurant_slug || '').toLowerCase() === slug
          );
          if (storeMatch) {
            if (storeMatch.status === 'ready' && mappedOrder.status === 'preparing') {
              mappedOrder.status = 'ready';
              mappedOrder.readyAt = storeMatch.readyAt || mappedOrder.readyAt;
            }
            mappedOrder.rePingCount = Math.max(storeMatch.rePingCount || 0, mappedOrder.rePingCount || 0);
          }

          return NextResponse.json(
            {
              success: true,
              order: mappedOrder,
              lastUpdated: Date.now(),
              serverTime: new Date().toISOString(),
            },
            { headers: NO_CACHE_HEADERS }
          );
        }
      } else if (slug) {
        // Active orders only: preparing and ready (plus recently completed within active window)
        const { data: dbRows, error } = await supabase
          .from('orders_queue')
          .select('*')
          .eq('restaurant_slug', slug)
          .in('status', ['preparing', 'ready', 'completed'])
          .order('created_at', { ascending: false })
          .limit(100);

        if (!error && dbRows && dbRows.length > 0) {
          const mappedOrders = dbRows.map(mapDbRowToOrder);
          return NextResponse.json(
            {
              success: true,
              orders: mappedOrders,
              count: mappedOrders.length,
              lastUpdated: Date.now(),
              serverTime: new Date().toISOString(),
            },
            { headers: NO_CACHE_HEADERS }
          );
        }
      }
    } catch (dbErr) {
      console.warn('Supabase orders fetch warning, falling back to memory store:', dbErr);
    }
  }

  // 2. In-Memory Store Fallback
  let store = getStore();
  if (!Array.isArray(store)) {
    store = [];
  }

  if (slug) {
    store = store.filter(
      (o) => (o.restaurantSlug || o.restaurant_slug || '').toLowerCase() === slug
    );
  }

  if (orderNumber) {
    const single = store.find(
      (o) => o.orderNumber.toLowerCase() === orderNumber.toLowerCase()
    );
    if (!single) {
      return NextResponse.json(
        {
          success: false,
          message: 'Order not found',
          order: null,
          serverTime: new Date().toISOString(),
        },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }
    return NextResponse.json(
      {
        success: true,
        order: single,
        lastUpdated: globalThis.__chimer_orders_last_updated || Date.now(),
        serverTime: new Date().toISOString(),
      },
      { headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      success: true,
      orders: store,
      count: store.length,
      lastUpdated: globalThis.__chimer_orders_last_updated || Date.now(),
      serverTime: new Date().toISOString(),
    },
    { headers: NO_CACHE_HEADERS }
  );
}

// PATCH: Instant Non-Blocking Parallel Status Update (Zero-Latency Signal B)
export async function PATCH(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkGeneralRateLimit(`patch_order:${ip}`, 1200, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'تم تجاوز معدل الطلبات المسموح به' },
        { status: 429, headers: { 'Retry-After': String(rl.resetSeconds), ...NO_CACHE_HEADERS } }
      );
    }

    const body = await req.json();
    const {
      action,
      orderId,
      orderNumber,
      restaurantSlug,
      status = 'ready',
      readyAt,
      lastPingAt,
      ping_count,
    } = body;

    const targetSlug = (restaurantSlug || '').toLowerCase().trim();
    const targetNumber = String(orderNumber || '').trim();
    const nowIso = new Date().toISOString();

    const store = getStore();
    let updatedOrder: Order | undefined;
    const isRePing = action === 'ORDER_REPING' || action === 'REPING';

    const next = store.map((o) => {
      const matchSlug = targetSlug
        ? (o.restaurantSlug || o.restaurant_slug || '').toLowerCase() === targetSlug
        : true;
      const matchId =
        (orderId && o.id === orderId) || (targetNumber && o.orderNumber === targetNumber);
      if (matchId && matchSlug) {
        updatedOrder = {
          ...o,
          status: (status as OrderStatus) || 'ready',
          readyAt: readyAt || o.readyAt || nowIso,
          lastPingAt: lastPingAt || nowIso,
          rePingCount:
            typeof ping_count === 'number'
              ? ping_count
              : isRePing
              ? (o.rePingCount || 0) + 1
              : o.rePingCount,
        };
        return updatedOrder;
      }
      return o;
    });

    if (updatedOrder) {
      setStore(next);
    }

    // Fire-and-forget Supabase update in background without blocking response
    if (isSupabaseConfigured() && supabase && (targetNumber || orderId)) {
      const updateData: Record<string, any> = {
        status: (status as OrderStatus) || 'ready',
        ready_at: readyAt || nowIso,
        last_ping_at: lastPingAt || nowIso,
      };
      if (typeof ping_count === 'number') {
        updateData.ping_count = ping_count;
      } else if (isRePing && updatedOrder) {
        updateData.ping_count = updatedOrder.rePingCount;
      }

      let query = supabase.from('orders_queue').update(updateData);
      if (targetNumber) {
        query = query.eq('order_number', targetNumber);
      } else if (orderId) {
        query = query.eq('id', orderId);
      }
      if (targetSlug) {
        query = query.eq('restaurant_slug', targetSlug);
      }
      Promise.resolve(query).catch((e) => console.warn('Supabase PATCH sync warning:', e));
    }

    return NextResponse.json(
      {
        success: true,
        updatedOrder,
        order: updatedOrder,
        lastUpdated: globalThis.__chimer_orders_last_updated,
        serverTime: nowIso,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

// POST: Add, update status, reping, complete, or sync orders with Anti-Abuse
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const body = await req.json();
    const { action, order, orderId, orderNumber, restaurantSlug, feedback, orders } = body;
    const store = getStore();
    const nowIso = new Date().toISOString();

    let updatedOrder: Order | undefined;

    switch (action) {
      case 'ADD':
      case 'ORDER_ADDED': {
        // High capacity rate limit: 1,200 per minute per IP for high-speed POS cashier operations
        const rl = checkGeneralRateLimit(`add_order:${ip}`, 1200, 60);
        if (!rl.allowed) {
          return NextResponse.json(
            { success: false, error: 'تم تجاوز الحد الأقصى لإنشاء الطلبات' },
            { status: 429, headers: { 'Retry-After': String(rl.resetSeconds) } }
          );
        }

        const rawData = order || body;
        const validation = orderInputSchema.safeParse(rawData);
        if (!validation.success) {
          return NextResponse.json(
            {
              success: false,
              error: validation.error.issues[0]?.message || 'بيانات الطلب غير صالحة',
            },
            { status: 400 }
          );
        }

        const validated = validation.data;
        const targetSlug = (
          validated.restaurantSlug ||
          validated.restaurant_slug ||
          rawData.restaurantSlug ||
          rawData.restaurant_slug ||
          restaurantSlug ||
          'demo-cafe'
        )
          .toLowerCase()
          .trim();

        const targetRestId =
          validated.restaurantId ||
          validated.restaurant_id ||
          rawData.restaurantId ||
          rawData.restaurant_id ||
          `res-${targetSlug}`;

        const finalId =
          rawData.id && !rawData.id.startsWith('temp-')
            ? rawData.id
            : `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        const newOrder: Order = {
          id: finalId,
          orderNumber: validated.orderNumber,
          restaurantSlug: targetSlug,
          restaurant_slug: targetSlug,
          restaurantId: targetRestId,
          restaurant_id: targetRestId,
          customerName: validated.customerName,
          customerPhone: validated.customerPhone,
          notes: validated.notes,
          status: validated.status || 'preparing',
          estimatedMinutes: validated.estimatedMinutes || 10,
          rePingCount: 0,
          createdAt: rawData.createdAt || rawData.created_at || nowIso,
          created_at: rawData.created_at || rawData.createdAt || nowIso,
        };

        // Filter out if duplicate number in same restaurant that is still active
        const filtered = store.filter(
          (o) =>
            !(
              (o.restaurantSlug || o.restaurant_slug || '').toLowerCase() === newOrder.restaurantSlug.toLowerCase() &&
              o.orderNumber.toLowerCase() === newOrder.orderNumber.toLowerCase() &&
              (o.status === 'preparing' || o.status === 'ready')
            )
        );
        const next = [newOrder, ...filtered];
        setStore(next);
        updatedOrder = newOrder;

        // Persist to Supabase if active
        if (isSupabaseConfigured() && supabase) {
          supabase
            .from('orders_queue')
            .upsert({
              order_number: newOrder.orderNumber,
              restaurant_slug: targetSlug,
              customer_name: newOrder.customerName,
              customer_phone: newOrder.customerPhone,
              notes: newOrder.notes,
              status: newOrder.status,
              estimated_mins: newOrder.estimatedMinutes,
              ping_count: 0,
              created_at: newOrder.createdAt,
            })
            .then();

          // Instant Realtime Broadcast to room
          try {
            const roomChannel = supabase.channel(`room_${targetSlug}`);
            roomChannel.send({
              type: 'broadcast',
              event: 'order_update',
              payload: newOrder,
            });
          } catch {}
        }
        break;
      }

      case 'READY':
      case 'ORDER_READY': {
        const targetSlug = (restaurantSlug || '').toLowerCase();
        const next = store.map((o) => {
          const matchSlug = targetSlug ? o.restaurantSlug.toLowerCase() === targetSlug : true;
          const matchId = o.id === orderId || o.orderNumber === orderNumber;
          if (matchId && matchSlug) {
            updatedOrder = {
              ...o,
              status: 'ready' as OrderStatus,
              readyAt: o.readyAt || nowIso,
            };
            return updatedOrder;
          }
          return o;
        });
        setStore(next);

        if (isSupabaseConfigured() && supabase) {
          supabase
            .from('orders_queue')
            .update({ status: 'ready', ready_at: nowIso })
            .match({
              order_number: orderNumber || updatedOrder?.orderNumber,
              ...(targetSlug ? { restaurant_slug: targetSlug } : {}),
            })
            .then();

          if (targetSlug && updatedOrder) {
            try {
              const roomChannel = supabase.channel(`room_${targetSlug}`);
              roomChannel.send({
                type: 'broadcast',
                event: 'order_update',
                payload: updatedOrder,
              });
            } catch {}
          }
        }
        break;
      }

      case 'REPING':
      case 'ORDER_REPING': {
        const targetSlug = (restaurantSlug || '').toLowerCase();
        const next = store.map((o) => {
          const matchSlug = targetSlug ? o.restaurantSlug.toLowerCase() === targetSlug : true;
          const matchId = o.id === orderId || o.orderNumber === orderNumber;
          if (matchId && matchSlug) {
            updatedOrder = {
              ...o,
              rePingCount: (o.rePingCount || 0) + 1,
              lastPingAt: nowIso,
            };
            return updatedOrder;
          }
          return o;
        });
        setStore(next);

        if (isSupabaseConfigured() && supabase && updatedOrder) {
          supabase
            .from('orders_queue')
            .update({ ping_count: updatedOrder.rePingCount, last_ping_at: nowIso })
            .match({
              order_number: orderNumber || updatedOrder.orderNumber,
              ...(targetSlug ? { restaurant_slug: targetSlug } : {}),
            })
            .then();

          if (targetSlug) {
            try {
              const roomChannel = supabase.channel(`room_${targetSlug}`);
              roomChannel.send({
                type: 'broadcast',
                event: 'order_update',
                payload: updatedOrder,
              });
            } catch {}
          }
        }
        break;
      }

      case 'COMPLETE':
      case 'ORDER_COMPLETED': {
        const targetSlug = (restaurantSlug || '').toLowerCase();
        const next = store.map((o) => {
          const matchSlug = targetSlug ? o.restaurantSlug.toLowerCase() === targetSlug : true;
          const matchId = o.id === orderId || o.orderNumber === orderNumber;
          if (matchId && matchSlug) {
            updatedOrder = {
              ...o,
              status: 'completed' as OrderStatus,
              completedAt: nowIso,
            };
            return updatedOrder;
          }
          return o;
        });
        setStore(next);

        if (isSupabaseConfigured() && supabase) {
          supabase
            .from('orders_queue')
            .update({ status: 'completed', completed_at: nowIso })
            .match({
              order_number: orderNumber || updatedOrder?.orderNumber,
              ...(targetSlug ? { restaurant_slug: targetSlug } : {}),
            })
            .then();

          if (targetSlug && updatedOrder) {
            try {
              const roomChannel = supabase.channel(`room_${targetSlug}`);
              roomChannel.send({
                type: 'broadcast',
                event: 'order_update',
                payload: updatedOrder,
              });
            } catch {}
          }
        }
        break;
      }

      case 'CANCEL':
      case 'ORDER_CANCELLED': {
        const targetSlug = (restaurantSlug || '').toLowerCase();
        const next = store.filter((o) => {
          const matchSlug = targetSlug ? o.restaurantSlug.toLowerCase() === targetSlug : true;
          const matchId = o.id === orderId || o.orderNumber === orderNumber;
          return !(matchId && matchSlug);
        });
        setStore(next);

        if (isSupabaseConfigured() && supabase) {
          supabase
            .from('orders_queue')
            .update({ status: 'cancelled' })
            .match({
              order_number: orderNumber,
              ...(targetSlug ? { restaurant_slug: targetSlug } : {}),
            })
            .then();
        }
        break;
      }

      case 'FEEDBACK':
      case 'ORDER_FEEDBACK': {
        const targetSlug = (restaurantSlug || '').toLowerCase();
        const next = store.map((o) => {
          const matchSlug = targetSlug ? o.restaurantSlug.toLowerCase() === targetSlug : true;
          const matchId = o.id === orderId || o.orderNumber === orderNumber;
          if (matchId && matchSlug) {
            updatedOrder = {
              ...o,
              feedback: feedback as OrderFeedback,
            };
            return updatedOrder;
          }
          return o;
        });
        setStore(next);
        break;
      }

      case 'ARCHIVE_COMPLETED': {
        const targetSlug = (restaurantSlug || 'demo-cafe').toLowerCase();
        const next = store.filter(
          (o) => !(o.restaurantSlug.toLowerCase() === targetSlug && o.status === 'completed')
        );
        setStore(next);
        break;
      }

      case 'SYNC_ALL':
      case 'QUEUE_SYNC': {
        if (Array.isArray(orders)) {
          if (restaurantSlug) {
            const targetSlug = restaurantSlug.toLowerCase().trim();
            const otherTenantOrders = store.filter(
              (o) => (o.restaurantSlug || o.restaurant_slug || '').toLowerCase() !== targetSlug
            );
            const next = [...orders, ...otherTenantOrders];
            setStore(next);
          } else {
            const orderMap = new Map<string, Order>();
            store.forEach((o) => orderMap.set(o.id, o));
            orders.forEach((o: Order) => orderMap.set(o.id, o));
            setStore(Array.from(orderMap.values()));
          }
        }
        break;
      }

      case 'RESET_DEMO':
      case 'QUEUE_RESET': {
        if (restaurantSlug) {
          const targetSlug = restaurantSlug.toLowerCase().trim();
          const next = store.filter(
            (o) => (o.restaurantSlug || o.restaurant_slug || '').toLowerCase() !== targetSlug
          );
          setStore(next);
        } else {
          setStore([]);
        }
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
    }

    return NextResponse.json(
      {
        success: true,
        updatedOrder,
        order: updatedOrder,
        tempId: order?.id || orderId,
        orders: getStore(),
        lastUpdated: globalThis.__chimer_orders_last_updated,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
