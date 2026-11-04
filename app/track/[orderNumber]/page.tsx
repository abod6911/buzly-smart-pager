'use client';

import React, { useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQueue } from '@/context/QueueContext';

function GenericTrackerRedirectInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawOrderNumber = params.orderNumber as string;
  const decodedOrderNumber = decodeURIComponent(rawOrderNumber || '').trim();
  const { orders } = useQueue();

  useEffect(() => {
    // 1. Check if the order exists in state to get its actual restaurant slug
    const matchingOrder = orders.find(
      (o) => o.orderNumber.toLowerCase() === decodedOrderNumber.toLowerCase()
    );

    const targetSlug =
      matchingOrder?.restaurantSlug ||
      searchParams.get('slug') ||
      'demo-cafe';

    const qs = searchParams.toString();
    const query = qs ? `?${qs}` : '';

    router.replace(`/${targetSlug}/track/${encodeURIComponent(decodedOrderNumber)}${query}`);
  }, [decodedOrderNumber, orders, router, searchParams]);

  return (
    <div className="min-h-screen bg-obsidian text-white flex flex-col items-center justify-center font-cairo p-4">
      <div className="w-12 h-12 rounded-full border-3 border-emerald-500 border-t-transparent animate-spin mb-4" />
      <h2 className="text-lg font-bold text-white font-mono">#{decodedOrderNumber}</h2>
      <p className="text-zinc-400 text-xs mt-1">جارِ فتح شاشة تتبع الطلب وتجهيز التنبيه...</p>
    </div>
  );
}

export default function GenericCustomerTrackerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-obsidian text-white flex flex-col items-center justify-center font-cairo">
          <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-3" />
          <p className="text-zinc-500 text-xs">تحميل...</p>
        </div>
      }
    >
      <GenericTrackerRedirectInner />
    </Suspense>
  );
}
