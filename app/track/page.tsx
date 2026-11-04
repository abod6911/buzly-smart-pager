'use client';

import React from 'react';
import Link from 'next/link';
import { useQueue } from '@/context/QueueContext';
import { CustomerNumpad } from '@/components/CustomerNumpad';
import { Bell, ArrowRight, ShieldCheck, UtensilsCrossed } from 'lucide-react';

export default function TrackEntryPage() {
  const { orders } = useQueue();
  const activeOrders = orders.filter((o) => o.status === 'preparing' || o.status === 'ready');

  return (
    <div className="min-h-screen bg-obsidian text-white flex flex-col font-cairo selection:bg-emerald-500 selection:text-black">
      {/* Top Header */}
      <header className="border-b border-obsidian-border bg-obsidian-surface/70 backdrop-blur-md px-4 py-4 sticky top-0 z-30">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-black font-black shadow-md shadow-emerald-500/20">
              <Bell className="w-4 h-4 text-black" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-white font-mono">
              BUZLY
            </span>
          </Link>

          <Link
            href="/staff"
            className="text-xs text-zinc-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
          >
            <span>شاشة الكاشير</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 sm:p-6 flex flex-col justify-center items-center">
        {/* Intro */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-xl shadow-emerald-500/5">
            <UtensilsCrossed className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-cairo">
            تتبع واستلام طلبك
          </h1>
          <p className="text-sm text-zinc-400 mt-1.5">
            أدخل رقم طلبك من الفاتورة لتحويل هاتفك إلى بيجر ذكي يرن فور جاهزية الطلب
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
