'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Delete, ShieldAlert, Sparkles, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    <div className="min-h-screen bg-obsidian text-white flex flex-col items-center justify-center p-4 font-cairo selection:bg-emerald-500 selection:text-black">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm bg-obsidian-surface border border-obsidian-border rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden"
      >
        {/* Glow */}
        <div
          className="absolute -top-16 -right-16 w-36 h-36 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ backgroundColor: restaurant.themeColor || '#10B981' }}
        />

        {/* Restaurant Badge */}
        <div className="mb-6 flex flex-col items-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-xl border border-white/10 overflow-hidden"
            style={{ backgroundColor: `${restaurant.themeColor}20` }}
          >
            {restaurant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={restaurant.logoUrl}
                alt={restaurant.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <KeyRound className="w-8 h-8" style={{ color: restaurant.themeColor }} />
            )}
          </div>
          <h2 className="text-xl font-black font-cairo text-white">{restaurant.name}</h2>
          <span className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" /> لوحة تحكم الكاشير محمية برقم سري
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
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  isFilled
                    ? 'scale-125 shadow-lg'
                    : 'bg-obsidian-card border border-obsidian-border'
                }`}
                style={{
                  backgroundColor: isFilled ? restaurant.themeColor : undefined,
                  boxShadow: isFilled ? `0 0 12px ${restaurant.themeColor}` : undefined,
                }}
              />
            );
          })}
        </motion.div>

        {errorShake && (
          <p className="text-xs text-rose-400 font-bold mb-4 animate-fade-in flex items-center justify-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" /> الرقم السري غير صحيح، حاول ثانية
          </p>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-2xl bg-obsidian-card hover:bg-obsidian-border text-white text-2xl font-mono font-bold border border-obsidian-border active:scale-95 transition-all flex items-center justify-center select-none shadow-sm"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            onClick={handleClear}
            className="h-14 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-sm font-bold border border-rose-500/20 active:scale-95 transition-all flex items-center justify-center select-none"
          >
            مسح
          </button>

          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-obsidian-card hover:bg-obsidian-border text-white text-2xl font-mono font-bold border border-obsidian-border active:scale-95 transition-all flex items-center justify-center select-none shadow-sm"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-2xl bg-obsidian-card hover:bg-obsidian-border text-zinc-300 border border-obsidian-border active:scale-95 transition-all flex items-center justify-center select-none"
            title="تراجع"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Helper Hint for Demo */}
        <div className="p-2.5 rounded-xl bg-obsidian-card border border-obsidian-border/80 text-[11px] text-zinc-400 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-buzly-amber" />
          <span>الرقم السري الافتراضي للتجربة: <strong className="text-white font-mono">1234</strong></span>
        </div>
      </motion.div>
    </div>
  );
};
