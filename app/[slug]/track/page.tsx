'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQueue } from '@/context/QueueContext';
import { useLanguage, LanguageSwitcher } from '@/context/LanguageContext';
import { CustomerNumpad } from '@/components/CustomerNumpad';
import { RestaurantNotFound } from '@/components/RestaurantNotFound';
import { RestaurantAvatar } from '@/components/RestaurantAvatar';
import { Bell, ShieldCheck, Utensils, Lock } from 'lucide-react';

export default function TenantTrackEntryPage() {
  const params = useParams();
  const slug = (Array.isArray(params?.slug) ? params.slug[0] : params?.slug) || 'demo-cafe';

  const { getRestaurant, getOrdersForRestaurant, isRestaurantsLoaded } = useQueue();
  const { language, isRTL, t } = useLanguage();
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
    <div className="min-h-screen bg-[#000000] text-white flex flex-col justify-between p-4 sm:p-6 font-sans selection:bg-[#34C759] selection:text-black">
      {/* Top Header */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between py-2.5 z-10">
        <div className="flex items-center gap-3">
          <RestaurantAvatar
            logoUrl={restaurant?.logoUrl}
            name={restaurantName}
            themeColor={themeColor}
            size="md"
          />
          <div>
            <h1 className="font-semibold text-[15px] text-white tracking-tight">
              {restaurantName}
            </h1>
            <span className="text-[11px] text-zinc-400">
              خدمة النداء الرقمي
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="minimal" />
        </div>
      </header>

      {/* Main Content Card */}
      <main className="max-w-md w-full mx-auto my-auto py-4 z-10 flex flex-col items-center">
        {/* Tactile Customer Numpad */}
        <div className="w-full">
          <CustomerNumpad activeOrders={activeOrders} slug={slug} />
        </div>

        {/* Reassuring Footer */}
        <div className="mt-5 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{t('noAppNeeded')}</span>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="max-w-md w-full mx-auto text-center py-2 z-10">
        <p className="text-[11px] text-zinc-400 font-sans">
          استرح وسيقوم هاتفك بالرنين والاهتزاز فور جهوزية طلبك
        </p>
      </footer>
    </div>
  );
}
