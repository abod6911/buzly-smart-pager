'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQueue } from '@/context/QueueContext';
import { StaffNumpad } from '@/components/StaffNumpad';
import { StaffQueueGrid } from '@/components/StaffQueueGrid';
import { QrModal } from '@/components/QrModal';
import { soundManager } from '@/lib/audio';
import {
  Bell,
  Volume2,
  QrCode,
  RotateCcw,
  Smartphone,
  Radio,
  ExternalLink,
  SlidersHorizontal,
  Flame,
} from 'lucide-react';

export default function StaffCashierPage() {
  const {
    preparingOrders,
    readyOrders,
    addOrder,
    markReady,
    rePing,
    completeOrder,
    cancelOrder,
    resetToDemoOrders,
    clearQueue,
    isSupabaseActive,
    getActiveOrder,
  } = useQueue();

  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | undefined>(undefined);
  const [soundTested, setSoundTested] = useState<boolean>(false);

  const handleAddOrder = async (
    orderNumber: string,
    estimatedMinutes: number,
    notes?: string,
    options?: { replaceExisting?: boolean }
  ) => {
    await addOrder(orderNumber, estimatedMinutes, notes, undefined, 'demo-cafe', options);
  };

  const handleOpenQr = (orderNumber?: string) => {
    setSelectedOrderNumber(orderNumber);
    setQrModalOpen(true);
  };

  const handleTestSound = async () => {
    await soundManager.unlock();
    soundManager.playHospitalityChime();
    setSoundTested(true);
    setTimeout(() => setSoundTested(false), 2000);
  };

  return (
    <div className="min-h-screen bg-obsidian text-white flex flex-col font-cairo selection:bg-emerald-500 selection:text-black">
      {/* Top Staff Navigation Bar */}
      <header className="border-b border-obsidian-border bg-obsidian-surface/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Role Badge */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl overflow-hidden border border-emerald-500/30 flex items-center justify-center bg-black shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Chimer Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-lg tracking-tight text-white font-mono">
                    CHIMER
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    كاشير POS
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 hidden sm:block">
                  لوحة نداء واستدعاء الزبائن الذكية
                </p>
              </div>
            </Link>

            {/* Sync Badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-obsidian-card border border-obsidian-border text-xs text-zinc-300">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>مزامنة فورية متعددة التبويبات</span>
              {isSupabaseActive && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-mono">
                  Supabase Live
                </span>
              )}
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Test Sound */}
            <button
              onClick={handleTestSound}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                soundTested
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-obsidian-card hover:bg-obsidian-border text-zinc-300 border-obsidian-border'
              }`}
              title="تجربة صوت جرس النداء"
            >
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">تجربة الجرس</span>
            </button>

            {/* Restaurant QR Code */}
            <button
              onClick={() => handleOpenQr(undefined)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-zinc-300 border border-obsidian-border text-xs font-bold transition-all"
              title="رمز QR للكاونتر"
            >
              <QrCode className="w-4 h-4 text-zinc-300" />
              <span className="hidden sm:inline">QR الكاونتر</span>
            </button>

            {/* Clear Orders */}
            <button
              onClick={() => clearQueue('demo-cafe')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-zinc-400 hover:text-white border border-obsidian-border text-xs font-bold transition-all"
              title="تفريغ طابور الطلبات"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">تفريغ الطابور</span>
            </button>

            {/* Customer Tracker Link */}
            <Link
              href="/track"
              target="_blank"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold shadow-md shadow-emerald-500/20 transition-all"
            >
              <Smartphone className="w-4 h-4" />
              <span>شاشة العميل</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Staff Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        {/* Quick Stats Overview Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-obsidian-surface border border-obsidian-border rounded-2xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-zinc-400 font-medium">الطلبات النشطة</p>
              <p className="text-xl font-bold font-mono text-white mt-0.5">
                {preparingOrders.length + readyOrders.length}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-obsidian-card border border-obsidian-border flex items-center justify-center text-zinc-400">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-obsidian-surface border border-buzly-amber/20 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-buzly-amber font-medium">قيد التحضير</p>
              <p className="text-xl font-bold font-mono text-buzly-amber mt-0.5">
                {preparingOrders.length}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-buzly-amber/10 border border-buzly-amber/20 flex items-center justify-center text-buzly-amber">
              <Flame className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-obsidian-surface border border-emerald-500/20 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-emerald-400 font-medium">جاهز للاستلام</p>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                {readyOrders.length}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Bell className="w-4 h-4 animate-bounce-subtle" />
            </div>
          </div>

          <div className="bg-obsidian-surface border border-obsidian-border rounded-2xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-zinc-400 font-medium">طريقة الاختبار</p>
              <p className="text-xs font-semibold text-emerald-400 mt-0.5">
                افتح تبويبين معاً للمزامنة
              </p>
            </div>
            <button
              onClick={() => clearQueue('demo-cafe')}
              className="text-[11px] text-rose-400 hover:text-rose-300 underline font-medium"
            >
              مسح الكل
            </button>
          </div>
        </div>

        {/* Cashier Layout: Numpad (Left) + Queue Grid (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
          {/* Numpad Section: 4 cols on Desktop */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 h-auto">
            <StaffNumpad
              onAddOrder={handleAddOrder}
              onMarkReady={(id) => markReady(id, 'demo-cafe')}
              getActiveOrder={(num) => getActiveOrder(num, 'demo-cafe')}
            />
          </div>

          {/* Active Queue Grid: 8 cols on Desktop */}
          <div className="lg:col-span-8 flex-1">
            <StaffQueueGrid
              preparingOrders={preparingOrders}
              readyOrders={readyOrders}
              onMarkReady={markReady}
              onRePing={rePing}
              onComplete={completeOrder}
              onCancel={cancelOrder}
              onOpenQr={handleOpenQr}
            />
          </div>
        </div>
      </main>

      {/* QR Modal */}
      <QrModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        orderNumber={selectedOrderNumber}
        restaurantSlug="demo-cafe"
      />
    </div>
  );
}
