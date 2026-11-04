'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Delete, ArrowLeft, Search, Sparkles } from 'lucide-react';
import { soundManager } from '@/lib/audio';
import { Order } from '@/types/queue';

interface CustomerNumpadProps {
  activeOrders: Order[];
  slug?: string;
}

export const CustomerNumpad: React.FC<CustomerNumpadProps> = ({ activeOrders, slug }) => {
  const [orderNumber, setOrderNumber] = useState<string>('');
  const router = useRouter();

  const handleDigit = (digit: string) => {
    soundManager.playKeyClick();
    if (orderNumber.length < 5) {
      setOrderNumber((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    soundManager.playKeyClick();
    setOrderNumber((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    soundManager.playKeyClick();
    setOrderNumber('');
  };

  const handleTrack = () => {
    if (!orderNumber.trim()) return;
    soundManager.unlock();
    const targetSlug = slug || 'demo-cafe';
    router.push(`/${targetSlug}/track/${encodeURIComponent(orderNumber.trim())}`);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Display Screen */}
      <div className="bg-obsidian-surface border-2 border-obsidian-border rounded-3xl p-5 shadow-2xl text-center">
        <p className="text-xs text-zinc-400 mb-2 font-semibold">أدخل رقم الفاتورة أو الاستلام</p>

        <div className="bg-obsidian-400 border border-obsidian-border rounded-2xl py-4 px-6 flex items-center justify-center gap-2 mb-4">
          <span className="text-emerald-500 font-mono text-3xl font-bold">#</span>
          <span
            className={`font-mono tabular-nums text-5xl font-black tracking-widest ${
              orderNumber ? 'text-white' : 'text-zinc-600'
            }`}
          >
            {orderNumber || '---'}
          </span>
        </div>

        {/* Numpad 1-9, C, 0, Backspace */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-16 rounded-2xl bg-obsidian-card hover:bg-obsidian-border text-white text-2xl font-mono tabular-nums font-bold border border-obsidian-border active:scale-95 transition-all shadow-sm flex items-center justify-center select-none"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            onClick={handleClear}
            className="h-16 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-base border border-rose-500/20 active:scale-95 transition-all flex items-center justify-center select-none"
          >
            مسح
          </button>

          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-16 rounded-2xl bg-obsidian-card hover:bg-obsidian-border text-white text-2xl font-mono tabular-nums font-bold border border-obsidian-border active:scale-95 transition-all shadow-sm flex items-center justify-center select-none"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            className="h-16 rounded-2xl bg-obsidian-card hover:bg-obsidian-border text-zinc-300 border border-obsidian-border active:scale-95 transition-all flex items-center justify-center select-none"
            title="تراجع"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Submit Tracking Button */}
        <button
          type="button"
          disabled={!orderNumber.trim()}
          onClick={handleTrack}
          className={`w-full py-4 px-6 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 transition-all shadow-xl ${
            orderNumber.trim()
              ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/25 active:scale-[0.98] cursor-pointer'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
          }`}
        >
          <span>تتبع طلبي الآن</span>
          <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* Quick Select from Active Orders (if any) */}
      {activeOrders.length > 0 && (
        <div className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-buzly-amber" /> أو اختر من الطلبات النشطة حالياً
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              {activeOrders.length} طلبات
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {activeOrders.map((ord) => (
              <button
                key={ord.id}
                onClick={() => {
                  soundManager.unlock();
                  const targetSlug = ord.restaurantSlug || slug || 'demo-cafe';
                  router.push(`/${targetSlug}/track/${encodeURIComponent(ord.orderNumber)}`);
                }}
                className="p-3 rounded-2xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-right transition-all flex items-center justify-between group active:scale-95"
              >
                <div>
                  <div className="font-mono tabular-nums font-extrabold text-lg text-white group-hover:text-emerald-400 transition-colors">
                    #{ord.orderNumber}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        ord.status === 'ready' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                      }`}
                    />
                    <span className="text-[10px] text-zinc-400">
                      {ord.status === 'ready' ? 'جاهز للاستلام' : 'قيد التحضير'}
                    </span>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
