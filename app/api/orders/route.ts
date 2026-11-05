import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Order, OrderStatus, OrderFeedback } from '@/types/queue';
import { checkGeneralRateLimit } from '@/lib/security';

// Global in-memory store shared across all devices hitting this Next.js server instance
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

// GET: Retrieve active orders or filter by slug / orderNumber
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  // Rate limit: 120 reads per minute per IP
  const rl = checkGeneralRateLimit(`get_orders:${ip}`, 120, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'تم تجاوز معدل الطلبات المسموح به' },
      { status: 429, headers: { 'Retry-After': String(rl.resetSeconds) } }
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
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      order: single,
      lastUpdated: globalThis.__chimer_orders_last_updated || Date.now(),
      serverTime: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    success: true,
    orders: store,
    count: store.length,
    lastUpdated: globalThis.__chimer_orders_last_updated || Date.now(),
    serverTime: new Date().toISOString(),
  });
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
        // High capacity rate limit for active POS cashier operation: 120 per minute per IP
        const rl = checkGeneralRateLimit(`add_order:${ip}`, 120, 60);
        if (!rl.allowed) {
          return NextResponse.json(
            { success: false, error: 'تم تجاوز الحد الأقصى لإنشاء الطلبات، يرجى الانتظار دقيقة' },
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
        break;
      }

      case 'READY':
      case 'ORDER_READY': {
        const next = store.map((o) => {
          const matchSlug = restaurantSlug ? o.restaurantSlug.toLowerCase() === restaurantSlug.toLowerCase() : true;
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
        break;
      }

      case 'REPING':
      case 'ORDER_REPING': {
        const next = store.map((o) => {
          const matchSlug = restaurantSlug ? o.restaurantSlug.toLowerCase() === restaurantSlug.toLowerCase() : true;
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
        break;
      }

      case 'COMPLETE':
      case 'ORDER_COMPLETED': {
        const next = store.map((o) => {
          const matchSlug = restaurantSlug ? o.restaurantSlug.toLowerCase() === restaurantSlug.toLowerCase() : true;
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
        break;
      }

      case 'CANCEL':
      case 'ORDER_CANCELLED': {
        const next = store.filter((o) => {
          const matchSlug = restaurantSlug ? o.restaurantSlug.toLowerCase() === restaurantSlug.toLowerCase() : true;
          const matchId = o.id === orderId || o.orderNumber === orderNumber;
          return !(matchId && matchSlug);
        });
        setStore(next);
        break;
      }

      case 'FEEDBACK':
      case 'ORDER_FEEDBACK': {
        const next = store.map((o) => {
          const matchSlug = restaurantSlug ? o.restaurantSlug.toLowerCase() === restaurantSlug.toLowerCase() : true;
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
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      updatedOrder,
      order: updatedOrder,
      tempId: order?.id || orderId,
      orders: getStore(),
      lastUpdated: globalThis.__chimer_orders_last_updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
