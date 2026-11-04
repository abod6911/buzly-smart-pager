'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQueue } from '@/context/QueueContext';
import { CustomerNumpad } from '@/components/CustomerNumpad';
import { Bell, ArrowRight, ShieldCheck, UtensilsCrossed, Lock } from 'lucide-react';

export default function TenantTrackEntryPage() {
  const params = useParams();
  const slug = (params.slug as string) || 'demo-cafe';

  const { getRestaurant, getOrdersForRestaurant } = useQueue();
  const restaurant = getRestaurant(slug);
  const orders = getOrdersForRestaurant(slug);
  const activeOrders = orders.filter((o) => o.status === 'preparing' || o.status === 'ready');

  return (
    <div className="min-h-screen bg-obsidian text-white flex flex-col font-cairo selection:bg-emerald-500 selection:text-black">
      {/* Top Header */}
      <header className="border-b border-obsidian-border bg-obsidian-surface/70 backdrop-blur-md px-4 py-4 sticky top-0 z-30">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black shadow-md overflow-hidden border border-white/10"
              style={{ backgroundColor: `${restaurant.themeColor}25` }}
            >
              {restaurant.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Bell className="w-5 h-5" style={{ color: restaurant.themeColor }} />
              )}
            </div>
            <span className="font-black text-base tracking-tight text-white font-cairo">
              {restaurant.name}
            </span>
          </div>

          <Link
            href={`/${slug}/staff`}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors bg-obsidian-card px-2.5 py-1 rounded-lg border border-obsidian-border"
          >
            <Lock className="w-3 h-3 text-zinc-400" />
            <span>الكاشير</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 sm:p-6 flex flex-col justify-center items-center">
        <div className="text-center mb-6">
          <div
            className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-xl border border-white/10"
            style={{ backgroundColor: `${restaurant.themeColor}20` }}
          >
            <UtensilsCrossed className="w-8 h-8" style={{ color: restaurant.themeColor }} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-cairo">
            تتبع واستلام طلبك
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 leading-relaxed">
            أدخل رقم طلبك من الفاتورة لتحويل هاتفك إلى بيجر ذكي يرن فور جاهزية طلبك في <strong className="text-white">{restaurant.name}</strong>
          </p>
        </div>

        {/* Numpad */}
        <CustomerNumpad activeOrders={activeOrders} />

        {/* Reassuring Footer */}
        <div className="mt-8 text-center text-xs text-zinc-500 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>تنبيه فوري بالصوت والاهتزاز دون الحاجة لتحميل أي تطبيق</span>
        </div>
      </main>
    </div>
  );
}
