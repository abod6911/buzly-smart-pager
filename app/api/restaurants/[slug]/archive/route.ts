import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Order } from '@/types/queue';

const ARCHIVES_DIR = path.join(process.cwd(), 'data', 'archives');

// Ensure directory exists
async function ensureDir(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {}
}

function getFilePath(slug: string): string {
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return path.join(ARCHIVES_DIR, `${safeSlug}.json`);
}

async function readLocalArchive(slug: string): Promise<Order[]> {
  try {
    const filePath = getFilePath(slug);
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocalArchive(slug: string, orders: Order[]): Promise<void> {
  await ensureDir(ARCHIVES_DIR);
  const filePath = getFilePath(slug);
  await fs.writeFile(filePath, JSON.stringify(orders, null, 2), 'utf-8');
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const cleanSlug = slug.toLowerCase().trim();

    // 1. Read from local JSON archive file
    const localOrders = await readLocalArchive(cleanSlug);

    // 2. Fetch from Supabase (if configured)
    let dbOrders: Order[] = [];
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('orders_queue')
          .select('*')
          .eq('restaurant_slug', cleanSlug)
          .in('status', ['completed', 'archived', 'cancelled'])
          .order('created_at', { ascending: false });

        if (!error && data) {
          dbOrders = data.map((row) => ({
            id: row.id,
            orderNumber: row.order_number,
            restaurantSlug: row.restaurant_slug || cleanSlug,
            customerName: row.customer_name,
            customerPhone: row.customer_phone,
            notes: row.notes,
            status: row.status,
            estimatedMinutes: row.estimated_mins || 10,
            pushSubscription: row.push_subscription,
            rePingCount: row.ping_count || 0,
            createdAt: row.created_at,
            readyAt: row.ready_at,
            completedAt: row.completed_at,
            lastPingAt: row.last_ping_at,
          }));
        }
      } catch (err) {
        console.warn('Supabase archive fetch error:', err);
      }
    }

    // 3. Merge & Deduplicate by Order ID or OrderNumber + Date
    const map = new Map<string, Order>();
    [...localOrders, ...dbOrders].forEach((ord) => {
      if (!ord || !ord.orderNumber) return;
      const key = ord.id || `${ord.orderNumber}_${ord.createdAt}`;
      if (!map.has(key)) {
        map.set(key, ord);
      } else {
        // Prefer completedAt data
        const existing = map.get(key)!;
        if (ord.completedAt && !existing.completedAt) {
          map.set(key, ord);
        }
      }
    });

    const merged = Array.from(map.values()).sort((a, b) => {
      const timeA = new Date(a.createdAt || a.created_at || 0).getTime();
      const timeB = new Date(b.createdAt || b.created_at || 0).getTime();
      return timeB - timeA;
    });

    // 4. Generate daily summaries
    const summariesMap = new Map<string, Order[]>();
    merged.forEach((ord) => {
      const dateStr = (ord.createdAt || ord.created_at || new Date().toISOString()).split('T')[0];
      const list = summariesMap.get(dateStr) || [];
      list.push(ord);
      summariesMap.set(dateStr, list);
    });

    const summaries = Array.from(summariesMap.entries()).map(([date, dayOrders]) => {
      const completed = dayOrders.filter((o) => o.status === 'completed' || o.status === 'archived');
      const prepTimes: number[] = [];

      completed.forEach((o) => {
        if (o.readyAt && (o.createdAt || o.created_at)) {
          const diffMs =
            new Date(o.readyAt).getTime() - new Date(o.createdAt || o.created_at || 0).getTime();
          const mins = Math.max(1, Math.round(diffMs / 60000));
          prepTimes.push(mins);
        }
      });

      const avgPrepMinutes =
        prepTimes.length > 0
          ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length)
          : null;

      return {
        date,
        totalOrders: dayOrders.length,
        completedOrders: completed.length,
        cancelledOrders: dayOrders.filter((o) => o.status === 'cancelled').length,
        avgPrepMinutes,
        orders: dayOrders,
      };
    });

    return NextResponse.json(
      {
        success: true,
        count: merged.length,
        orders: merged,
        summaries,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err) {
    console.error('Archive GET error:', err);
    return NextResponse.json({ success: false, error: 'تعذر قراءة ملف الأرشيف' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const cleanSlug = slug.toLowerCase().trim();
    const body = await req.json();

    const incomingOrders: Order[] = Array.isArray(body.orders) ? body.orders : [];
    if (incomingOrders.length === 0) {
      return NextResponse.json({ success: true, message: 'لا توجد طلبات للأرشفة' });
    }

    // 1. Read existing
    const existing = await readLocalArchive(cleanSlug);
    const map = new Map<string, Order>();
    existing.forEach((o) => map.set(o.id || `${o.orderNumber}_${o.createdAt}`, o));

    // 2. Append new orders
    incomingOrders.forEach((o) => {
      const key = o.id || `${o.orderNumber}_${o.createdAt}`;
      map.set(key, { ...o, status: 'completed' });
    });

    const updated = Array.from(map.values()).sort((a, b) => {
      const timeA = new Date(a.createdAt || a.created_at || 0).getTime();
      const timeB = new Date(b.createdAt || b.created_at || 0).getTime();
      return timeB - timeA;
    });

    // 3. Write to file
    await writeLocalArchive(cleanSlug, updated);

    // 4. Update Supabase if available
    if (isSupabaseConfigured() && supabase) {
      try {
        const orderIds = incomingOrders.map((o) => o.id).filter(Boolean);
        if (orderIds.length > 0) {
          await supabase
            .from('orders_queue')
            .update({ status: 'completed' })
            .in('id', orderIds);
        }
      } catch (err) {
        console.warn('Supabase archive update warning:', err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `تم حفظ ${incomingOrders.length} طلب في ملف الأرشيف بنجاح`,
      totalArchived: updated.length,
    });
  } catch (err) {
    console.error('Archive POST error:', err);
    return NextResponse.json({ success: false, error: 'تعذر حفظ ملف الأرشيف' }, { status: 500 });
  }
}
