'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQueue } from '@/context/QueueContext';
import { CustomerNumpad } from '@/components/CustomerNumpad';
import { RestaurantNotFound } from '@/components/RestaurantNotFound';
import { Bell, ShieldCheck, Utensils, Lock } from 'lucide-react';

export default function TenantTrackEntryPage() {
  const params = useParams();
  const slug = (Array.isArray(params?.slug) ? params.slug[0] : params?.slug) || 'demo-cafe';

  const { getRestaurant, getOrdersForRestaurant, isRestaurantsLoaded } = useQueue();
  const restaurant = getRestaurant(slug);
  const orders = getOrdersForRestaurant(slug);
  const activeOrders = (orders || []).filter((o) => o && (o.status === 'preparing' || o.status === 'ready'));

  if (!restaurant) {
    if (isRestaurantsLoaded) {
      return <RestaurantNotFound slug={slug} />;
    }
    return (
      <div className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center font-sans p-4">
        <div className="w-12 h-12 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-3" />
        <p className="text-sm text-zinc-400 font-mono">جارِ التحقق من المتجر...</p>
      </div>
    );
  }

  const themeColor = restaurant?.themeColor || '#10B981';
  const restaurantName = restaurant?.name || slug;

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-between p-4 sm:p-6 font-sans selection:bg-emerald-500 selection:text-black">
      {/* Top Header */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between py-2 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl overflow-hidden border border-white/10 bg-[#18181E] flex items-center justify-center shadow-md">
            {restaurant?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={restaurant.logoUrl}
                alt={restaurantName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center font-bold text-sm text-white"
                style={{ backgroundColor: themeColor }}
              >
                {restaurantName ? restaurantName.charAt(0).toUpperCase() : <Bell className="w-4 h-4 text-white" />}
              </div>
            )}
          </div>
          <div>
            <h1 className="font-bold text-sm text-white tracking-tight">
              {restaurantName}
            </h1>
            <span className="text-[11px] font-mono text-zinc-500">
              خدمة النداء الذكي
            </span>
          </div>
        </div>

        <Link
          href={`/${slug}/staff`}
          className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1.5 rounded-full border border-white/[0.08]"
        >
          <Lock className="w-3 h-3 text-zinc-400" />
          <span>الكاشير</span>
        </Link>
      </header>

      {/* Main Content Card */}
      <main className="max-w-md w-full mx-auto my-auto py-4 z-10 flex flex-col items-center">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-xl border border-white/10 bg-white/[0.04]">
            <Utensils className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            استلام الطلب
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
            أدخل رقم طلبك من الفاتورة لتحويل هاتفك إلى بيجر ذكي ينبهك فور الجاهزية
          </p>
        </div>

        {/* Tactile Customer Numpad */}
        <div className="w-full">
          <CustomerNumpad activeOrders={activeOrders} slug={slug} />
        </div>

        {/* Reassuring Footer */}
        <div className="mt-6 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>تنبيه فوري بالصوت والاهتزاز دون الحاجة لأي تطبيق</span>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="max-w-md w-full mx-auto text-center py-2 z-10">
        <p className="text-[11px] text-zinc-600 font-mono">
          Buzly Smart Pager • {slug}
        </p>
      </footer>
    </div>
  );
}
