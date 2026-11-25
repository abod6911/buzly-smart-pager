'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Delete, ArrowLeft, Search, Sparkles, Keyboard } from 'lucide-react';
import { soundManager } from '@/lib/audio';
import { Order } from '@/types/queue';
import { useLanguage } from '@/context/LanguageContext';
import { extractDigitKey } from '@/lib/keyboard';

interface CustomerNumpadProps {
  activeOrders: Order[];
  slug?: string;
}

export const CustomerNumpad: React.FC<CustomerNumpadProps> = ({ activeOrders, slug }) => {
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [notFoundError, setNotFoundError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const router = useRouter();
  const { language, isRTL, t } = useLanguage();

  const orderNumberRef = useRef<string>('');
  useEffect(() => {
    orderNumberRef.current = orderNumber;
  }, [orderNumber]);

  const handleDigit = useCallback((digit: string) => {
    soundManager.playKeyClick();
    setNotFoundError(null);
    const current = orderNumberRef.current;
    if (current.length < 5) {
      const next = current + digit;
      orderNumberRef.current = next;
      setOrderNumber(next);
    }
  }, []);

  const handleBackspace = useCallback(() => {
    soundManager.playKeyClick();
    setNotFoundError(null);
    const next = orderNumberRef.current.slice(0, -1);
    orderNumberRef.current = next;
    setOrderNumber(next);
  }, []);

  const handleClear = useCallback(() => {
    soundManager.playKeyClick();
    setNotFoundError(null);
    orderNumberRef.current = '';
    setOrderNumber('');
  }, []);

  const handleTrack = useCallback(async () => {
    const num = orderNumberRef.current.trim();
    if (!num) return;
    soundManager.unlock();
    const targetSlug = slug || 'demo-cafe';
    setIsChecking(true);
    setNotFoundError(null);

    try {
      const existsLocally = activeOrders.some(
        (o) => o.orderNumber.toLowerCase() === num.toLowerCase()
      );
      if (!existsLocally) {
        const res = await fetch(
          `/api/orders?slug=${encodeURIComponent(targetSlug)}&orderNumber=${encodeURIComponent(num)}&t=${Date.now()}`,
          { cache: 'no-store' }
        );
        const data = res.ok ? await res.json().catch(() => null) : null;
        if (!res.ok || !data?.success || !data?.order) {
          setNotFoundError(
            language === 'ar'
              ? `رقم الطلب #${num} غير موجود. تأكد من الرقم على الفاتورة.`
              : `Order #${num} not found. Please check your receipt number.`
          );
          return;
        }
      }
      router.push(`/${targetSlug}/track/${encodeURIComponent(num)}`);
    } catch {
      setNotFoundError(
        language === 'ar'
          ? 'تعذر التحقق من الطلب، حاول مرة أخرى.'
          : 'Could not verify order. Please try again.'
      );
    } finally {
      setIsChecking(false);
    }
  }, [slug, router, activeOrders, language]);

  // Physical Keyboard & Numpad listener for PCs, laptops, and desktop browsers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing inside an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Enter') {
          handleTrack();
        }
        return;
      }

      // Ignore browser shortcuts
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const digit = extractDigitKey(e.key, e.code);
      if (digit !== null) {
        e.preventDefault();
        handleDigit(digit);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleTrack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleBackspace, handleClear, handleTrack]);

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Warm Editorial Tactile Keypad Card */}
      <div className="bg-[#FFFDF9] border border-zinc-200/90 rounded-[28px] p-6 sm:p-7 shadow-[0_14px_40px_rgba(24,24,27,0.08)] text-center">
        <p className="text-xs text-zinc-500 mb-3 font-semibold">{t('enterBillNumber')}</p>

        {/* Display Screen */}
        <div
          dir="ltr"
          style={{ direction: 'ltr' }}
          className="bg-[#FAF7F0] border border-zinc-200/80 rounded-2xl py-4 px-6 flex items-center justify-center gap-2 mb-5"
        >
          <span className="text-zinc-400 font-mono text-2xl font-bold select-none">#</span>
          <span
            dir="ltr"
            style={{ direction: 'ltr' }}
            className={`font-mono tabular-nums text-4xl sm:text-5xl font-black tracking-widest ${
              orderNumber ? 'text-zinc-950' : 'text-zinc-300'
            }`}
          >
            {orderNumber || '••••'}
          </span>
        </div>

        {notFoundError && (
          <div className="mb-4 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {notFoundError}
          </div>
        )}

        {/* True Circular Apple-Style Numpad */}
        <div
          dir="ltr"
          style={{ direction: 'ltr' }}
          className="grid grid-cols-3 gap-3.5 max-w-[264px] sm:max-w-[296px] mx-auto mb-6 justify-items-center"
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <motion.button
              key={digit}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => handleDigit(digit)}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-950 text-2xl sm:text-3xl font-semibold font-mono border border-zinc-200/70 transition-colors flex items-center justify-center select-none cursor-pointer"
            >
              {digit}
            </motion.button>
          ))}

          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={handleClear}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-transparent hover:bg-rose-50 text-zinc-500 hover:text-rose-600 text-xs sm:text-sm font-bold transition-colors flex items-center justify-center select-none cursor-pointer"
          >
            {t('clear')}
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => handleDigit('0')}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-950 text-2xl sm:text-3xl font-semibold font-mono border border-zinc-200/70 transition-colors flex items-center justify-center select-none cursor-pointer"
          >
            0
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={handleBackspace}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-transparent hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors flex items-center justify-center select-none cursor-pointer"
            title={t('backspace')}
          >
            <Delete className="w-5 h-5 sm:w-6 sm:h-6" />
          </motion.button>
        </div>

        {/* Submit Tracking Button */}
        <motion.button
          type="button"
          whileTap={orderNumber.trim() && !isChecking ? { scale: 0.97 } : undefined}
          disabled={!orderNumber.trim() || isChecking}
          onClick={handleTrack}
          className={`w-full py-4 px-6 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
            orderNumber.trim() && !isChecking
              ? 'bg-zinc-950 hover:bg-zinc-800 text-white shadow-md cursor-pointer'
              : 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed'
          }`}
        >
          <span>{isChecking ? (language === 'ar' ? 'جارِ التحقق...' : 'Checking...') : t('trackMyOrder')}</span>
          {!isChecking && (
            <ArrowLeft className={`w-4 h-4 stroke-[2.5] ${isRTL ? '' : 'rotate-180'}`} />
          )}
        </motion.button>
      </div>

      {/* Quick Select from Active Orders */}
      {activeOrders.length > 0 && (
        <div className="bg-[#FFFDF9] border border-zinc-200/90 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
              <span>{t('orChooseFromActive')}</span>
            </span>
            <span className="text-[11px] text-zinc-400 font-mono">
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
                  router.push(`/${targetSlug}/track/${encodeURIComponent(ord.orderNumber)}`);
                }}
                className="p-3 rounded-xl bg-[#FAF7F0] hover:bg-zinc-100 border border-zinc-200/80 text-right transition-all flex items-center justify-between group active:scale-95 cursor-pointer"
              >
                <div>
                  <div className="font-mono tabular-nums font-extrabold text-lg text-zinc-950">
                    #{ord.orderNumber}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        ord.status === 'ready' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    <span className="text-[10px] text-zinc-500 font-medium">
                      {ord.status === 'ready' ? t('ready') : t('preparing')}
                    </span>
                  </div>
                </div>
                <ArrowLeft className={`w-4 h-4 text-zinc-400 group-hover:text-zinc-900 transition-colors ${isRTL ? '' : 'rotate-180'}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
