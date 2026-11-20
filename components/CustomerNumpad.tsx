'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Delete, ArrowLeft, Search, Sparkles } from 'lucide-react';
import { soundManager } from '@/lib/audio';
import { Order } from '@/types/queue';
import { useLanguage } from '@/context/LanguageContext';

interface CustomerNumpadProps {
  activeOrders: Order[];
  slug?: string;
}

export const CustomerNumpad: React.FC<CustomerNumpadProps> = ({ activeOrders, slug }) => {
  const [orderNumber, setOrderNumber] = useState<string>('');
  const router = useRouter();
  const { language, isRTL, t } = useLanguage();

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
    const now = Date.now();
    router.push(`/${targetSlug}/track/${encodeURIComponent(orderNumber.trim())}?created=${now}`);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Clean Keypad Surface */}
      <div className="bg-[#141416] border border-white/[0.07] rounded-[28px] p-6 sm:p-7 shadow-xl text-center">
        <p className="text-xs text-zinc-400 mb-3 font-medium">{t('enterBillNumber')}</p>

        {/* Display Screen */}
        <div
          dir="ltr"
          style={{ direction: 'ltr' }}
          className="bg-[#0E0E10] border border-white/[0.06] rounded-2xl py-4 px-6 flex items-center justify-center gap-2 mb-6"
        >
          <span className="text-zinc-500 font-mono text-2xl font-semibold select-none">#</span>
          <span
            dir="ltr"
            style={{ direction: 'ltr' }}
            className={`font-mono tabular-nums text-4xl sm:text-5xl font-bold tracking-widest ${
              orderNumber ? 'text-white' : 'text-zinc-700'
            }`}
          >
            {orderNumber || '••••'}
          </span>
        </div>

        {/* Apple Circular Numpad 1-9, C, 0, Backspace */}
        <div dir="ltr" style={{ direction: 'ltr' }} className="grid grid-cols-3 gap-3 sm:gap-4 max-w-[280px] sm:max-w-[320px] mx-auto mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <motion.button
              key={digit}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => handleDigit(digit)}
              className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-white/[0.05] hover:bg-white/[0.1] active:bg-white/[0.18] text-white text-2xl sm:text-3xl font-medium font-sans border border-white/[0.06] transition-all flex items-center justify-center select-none shadow-sm cursor-pointer mx-auto"
            >
              {digit}
            </motion.button>
          ))}

          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={handleClear}
            className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-white/[0.02] hover:bg-rose-500/15 text-zinc-400 hover:text-rose-400 text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center select-none cursor-pointer mx-auto"
          >
            {t('clear')}
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => handleDigit('0')}
            className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-white/[0.05] hover:bg-white/[0.1] active:bg-white/[0.18] text-white text-2xl sm:text-3xl font-medium font-sans border border-white/[0.06] transition-all flex items-center justify-center select-none shadow-sm cursor-pointer mx-auto"
          >
            0
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={handleBackspace}
            className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-white/[0.02] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors flex items-center justify-center select-none cursor-pointer mx-auto"
            title={t('backspace')}
          >
            <Delete className="w-5 h-5 sm:w-6 sm:h-6" />
          </motion.button>
        </div>

        {/* Submit Tracking Button (Luxury High-Contrast Solid White) */}
        <motion.button
          type="button"
          whileTap={orderNumber.trim() ? { scale: 0.97 } : undefined}
          disabled={!orderNumber.trim()}
          onClick={handleTrack}
          className={`w-full py-4 px-6 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
            orderNumber.trim()
              ? 'bg-white hover:bg-zinc-200 text-black shadow-sm cursor-pointer'
              : 'bg-white/[0.04] text-zinc-600 border border-white/[0.05] cursor-not-allowed'
          }`}
        >
          <span>{t('trackMyOrder')}</span>
          <ArrowLeft className={`w-4 h-4 stroke-[2.5] ${isRTL ? '' : 'rotate-180'}`} />
        </motion.button>
      </div>

      {/* Quick Select from Active Orders */}
      {activeOrders.length > 0 && (
        <div className="bg-[#141416] border border-white/[0.07] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <span>{t('orChooseFromActive')}</span>
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              {t('activeOrdersCount', { count: activeOrders.length })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {activeOrders.map((ord) => (
              <button
                key={ord.id}
                onClick={() => {
                  soundManager.unlock();
                  const targetSlug = ord.restaurantSlug || slug || 'demo-cafe';
                  const orderCreated = new Date(ord.createdAt || ord.created_at || Date.now()).getTime();
                  router.push(`/${targetSlug}/track/${encodeURIComponent(ord.orderNumber)}?created=${orderCreated}`);
                }}
                className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-right transition-all flex items-center justify-between group active:scale-95"
              >
                <div>
                  <div className="font-mono tabular-nums font-extrabold text-lg text-white group-hover:text-zinc-200 transition-colors">
                    #{ord.orderNumber}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        ord.status === 'ready' ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                    />
                    <span className="text-[10px] text-zinc-400">
                      {ord.status === 'ready' ? t('ready') : t('preparing')}
                    </span>
                  </div>
                </div>
                <ArrowLeft className={`w-4 h-4 text-zinc-500 group-hover:text-white transition-colors ${isRTL ? '' : 'rotate-180'}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
