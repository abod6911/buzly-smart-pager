'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useQueue } from '@/context/QueueContext';
import { useLanguage, LanguageSwitcher } from '@/context/LanguageContext';
import { CustomerNumpad } from '@/components/CustomerNumpad';
import { RestaurantNotFound } from '@/components/RestaurantNotFound';
import { RestaurantAvatar } from '@/components/RestaurantAvatar';
import { MuhabBrandBadge } from '@/components/MuhabBrandBadge';

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
    <div className="min-h-screen bg-[#09090B] text-white flex flex-col justify-between p-4 sm:p-6 font-sans">
      {/* Top Header */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between py-2.5 z-10">
        <div className="flex items-center gap-3">
          <RestaurantAvatar
            logoUrl={restaurant?.logoUrl}
            name={restaurantName}
            themeColor={themeColor}
            size="md"
          />
          <h1 className="font-semibold text-sm text-white tracking-tight">
            {restaurantName}
          </h1>
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
      </main>

      {/* Clean Minimalist Footer */}
      <footer className="max-w-md w-full mx-auto text-center py-3 z-10">
        <MuhabBrandBadge />
      </footer>
    </div>
  );
}
