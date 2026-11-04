'use client';

import React, { useState, useEffect } from 'react';
import { Lock, RotateCcw, AlertCircle, KeyRound, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { soundManager } from '@/lib/audio';
import { Restaurant } from '@/types/queue';

interface StaffPinGuardProps {
  restaurant: Restaurant;
  onUnlocked: () => void;
  children: React.ReactNode;
}

export const StaffPinGuard: React.FC<StaffPinGuardProps> = ({
  restaurant,
  onUnlocked,
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [errorShake, setErrorShake] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const authKey = `buzly_pin_auth_${restaurant.slug}`;
      const savedAuth = sessionStorage.getItem(authKey);
      if (savedAuth === 'true') {
        setIsAuthenticated(true);
      }
    }
  }, [restaurant.slug]);

  const targetPin = restaurant.staffPin || '1234';

  const handleDigit = (digit: string) => {
    soundManager.playKeyClick();
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);

      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    soundManager.playKeyClick();
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    soundManager.playKeyClick();
    setPin('');
  };

  const verifyPin = (candidatePin: string) => {
    if (candidatePin === targetPin) {
      soundManager.playSuccessTone();
      const authKey = `buzly_pin_auth_${restaurant.slug}`;
      sessionStorage.setItem(authKey, 'true');
      setIsAuthenticated(true);
      onUnlocked();
    } else {
      setErrorShake(true);
      setTimeout(() => {
        setPin('');
        setErrorShake(false);
      }, 600);
    }
  };

  if (!mounted) return null;

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-white flex flex-col items-center justify-center p-4 font-sans selection:bg-emerald-500 selection:text-black">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-[#121215] border border-white/[0.08] rounded-2xl p-6 sm:p-7 shadow-sm text-center relative"
      >
        {/* Restaurant Badge */}
        <div className="mb-6 flex flex-col items-center">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mb-3 border border-white/10 overflow-hidden bg-[#18181C]"
          >
            {restaurant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={restaurant.logoUrl}
                alt={restaurant.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <KeyRound className="w-6 h-6 text-emerald-400" />
            )}
          </div>
          <h2 className="text-lg font-bold text-white">{restaurant.name}</h2>
          <span className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 font-normal">
            <Lock className="w-3.5 h-3.5 text-zinc-500" />
            <span>لوحة الكاشير محمية برمز مرور</span>
          </span>
        </div>

        {/* 4-digit PIN dots */}
        <motion.div
          animate={errorShake ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="flex justify-center items-center gap-4 mb-6"
        >
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                  isFilled
                    ? 'bg-emerald-400 scale-110 shadow-sm'
                    : 'bg-white/[0.08] border border-white/[0.06]'
                }`}
              />
            );
          })}
        </motion.div>

        {errorShake && (
          <p className="text-xs text-rose-400 font-medium mb-4 flex items-center justify-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>رمز المرور غير صحيح، يرجى المحاولة ثانية</span>
          </p>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-12 sm:h-13 rounded-xl bg-[#18181C] hover:bg-[#202026] text-white text-xl font-mono font-semibold tabular-nums border border-white/[0.06] active:scale-95 transition-all flex items-center justify-center select-none shadow-sm"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            onClick={handleClear}
            className="h-12 sm:h-13 rounded-xl bg-[#18181C] hover:bg-rose-950/20 text-rose-400 text-xs font-medium border border-white/[0.06] active:scale-95 transition-all flex items-center justify-center select-none"
          >
            مسح
          </button>

          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-12 sm:h-13 rounded-xl bg-[#18181C] hover:bg-[#202026] text-white text-xl font-mono font-semibold tabular-nums border border-white/[0.06] active:scale-95 transition-all flex items-center justify-center select-none shadow-sm"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 sm:h-13 rounded-xl bg-[#18181C] hover:bg-[#202026] text-zinc-300 border border-white/[0.06] active:scale-95 transition-all flex items-center justify-center select-none"
            title="تراجع"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Hint for Demo */}
        <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-[11px] text-zinc-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
          <span>الرمز الافتراضي للتجربة: <strong className="text-zinc-200 font-mono">1234</strong></span>
        </div>
      </motion.div>
    </div>
  );
};
