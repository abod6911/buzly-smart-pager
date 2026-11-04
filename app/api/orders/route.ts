import { NextRequest, NextResponse } from 'next/server';
import { Order, OrderStatus, OrderFeedback } from '@/types/queue';

// Global in-memory store shared across all devices hitting this Next.js server instance
declare global {
  // eslint-disable-next-line no-var
  var __buzly_orders_store: Order[] | undefined;
  // eslint-disable-next-line no-var
  var __buzly_orders_last_updated: number | undefined;
}

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
];

function getStore(): Order[] {
  if (!globalThis.__buzly_orders_store) {
    globalThis.__buzly_orders_store = [...INITIAL_DEMO_ORDERS];
    globalThis.__buzly_orders_last_updated = Date.now();
  }
  return globalThis.__buzly_orders_store;
}

function setStore(orders: Order[]) {
  globalThis.__buzly_orders_store = orders;
  globalThis.__buzly_orders_last_updated = Date.now();
}

// GET: Retrieve all active orders or filter by slug / orderNumber
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug')?.toLowerCase();
  const orderNumber = searchParams.get('orderNumber')?.trim();

  let store = getStore();

  if (slug) {
    store = store.filter((o) => o.restaurantSlug.toLowerCase() === slug);
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
      lastUpdated: globalThis.__buzly_orders_last_updated || Date.now(),
      serverTime: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    success: true,
    orders: store,
    count: store.length,
    lastUpdated: globalThis.__buzly_orders_last_updated || Date.now(),
    serverTime: new Date().toISOString(),
  });
}

// POST: Add, update status, reping, complete, or sync orders
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, order, orderId, orderNumber, restaurantSlug, feedback, orders } = body;
    const store = getStore();
    const nowIso = new Date().toISOString();

    let updatedOrder: Order | undefined;

    switch (action) {
      case 'ADD':
      case 'ORDER_ADDED': {
        const orderData = order || body;
        if (!orderData || !orderData.orderNumber) {
          return NextResponse.json({ success: false, error: 'Missing order details' }, { status: 400 });
        }
        const newOrder: Order = {
          ...orderData,
          id: orderData.id || `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          restaurantSlug: (orderData.restaurantSlug || restaurantSlug || 'demo-cafe').toLowerCase(),
          status: orderData.status || 'preparing',
          rePingCount: orderData.rePingCount || 0,
          createdAt: orderData.createdAt || nowIso,
        };

        // Filter out if duplicate number in same restaurant
        const filtered = store.filter(
          (o) =>
            !(
              o.restaurantSlug.toLowerCase() === newOrder.restaurantSlug &&
              o.orderNumber.toLowerCase() === newOrder.orderNumber.toLowerCase()
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
          // Merge client orders with server orders by ID
          const orderMap = new Map<string, Order>();
          store.forEach((o) => orderMap.set(o.id, o));
          orders.forEach((o: Order) => orderMap.set(o.id, o));
          setStore(Array.from(orderMap.values()));
        }
        break;
      }

      case 'RESET_DEMO':
      case 'QUEUE_RESET': {
        setStore([...INITIAL_DEMO_ORDERS]);
        break;
      }

      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      updatedOrder,
      orders: getStore(),
      lastUpdated: globalThis.__buzly_orders_last_updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
