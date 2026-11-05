'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Lock, AlertCircle, KeyRound, ShieldAlert, CheckCircle2 } from 'lucide-react';
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
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorShake, setErrorShake] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedUntilSeconds, setLockedUntilSeconds] = useState<number | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);

  // 1. Initial Session Check via Secure HttpOnly Cookie
  useEffect(() => {
    setMounted(true);

    const checkActiveSession = async () => {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' });
        const data = await res.json();
        if (data.authenticated && data.slug === restaurant.slug) {
          setIsAuthenticated(true);
          onUnlocked();
        }
      } catch (err) {
        console.warn('Session verification error:', err);
      }
    };

    checkActiveSession();
  }, [restaurant.slug, onUnlocked]);

  // 2. Lockout Countdown Timer
  useEffect(() => {
    if (!lockedUntilSeconds || lockedUntilSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockedUntilSeconds((prev) => {
        if (!prev || prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedUntilSeconds]);

  // 3. Server-Side Secure PIN Verification
  const verifyPinOnServer = useCallback(
    async (candidatePin: string) => {
      if (isVerifying || (lockedUntilSeconds && lockedUntilSeconds > 0)) return;
      setIsVerifying(true);
      setErrorMessage(null);

      try {
        const res = await fetch('/api/auth/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: restaurant.slug, pin: candidatePin }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          soundManager.playSuccessTone();
          setIsAuthenticated(true);
          onUnlocked();
        } else if (res.status === 429 || data.locked) {
          soundManager.playErrorTone();
          setLockedUntilSeconds(data.retryAfterSeconds || 900);
          setErrorMessage(
            data.error || 'تم قفل الدخول مؤقتاً بسبب تكرار المحاولات الخاطئة'
          );
          setErrorShake(true);
          setPin('');
        } else {
          soundManager.playErrorTone();
          setErrorShake(true);
          setRemainingAttempts(data.remainingAttempts ?? null);
          setErrorMessage(
            data.error || 'رمز المرور غير صحيح، يرجى المحاولة ثانية'
          );
          setTimeout(() => {
            setPin('');
            setErrorShake(false);
          }, 600);
        }
      } catch {
        soundManager.playErrorTone();
        setErrorMessage('تعذر الاتصال بخادم التحقق الأمني');
        setErrorShake(true);
      } finally {
        setIsVerifying(false);
      }
    },
    [isVerifying, lockedUntilSeconds, restaurant.slug, onUnlocked]
  );

  const handleDigit = (digit: string) => {
    if (lockedUntilSeconds && lockedUntilSeconds > 0) return;
    soundManager.playKeyClick();
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);

      if (nextPin.length === 4) {
        verifyPinOnServer(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    if (lockedUntilSeconds && lockedUntilSeconds > 0) return;
    soundManager.playKeyClick();
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (lockedUntilSeconds && lockedUntilSeconds > 0) return;
    soundManager.playKeyClick();
    setPin('');
  };

  if (!mounted) return null;

  if (isAuthenticated) {
    return <>{children}</>;
  }

  const isLocked = Boolean(lockedUntilSeconds && lockedUntilSeconds > 0);

  return (
    <div className="min-h-screen bg-[#09090B] text-white flex flex-col items-center justify-center p-4 font-sans selection:bg-emerald-500 selection:text-black">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', mass: 0.8, stiffness: 260, damping: 25 }}
        className="w-full max-w-sm bg-[#121215] border border-white/[0.08] rounded-2xl p-6 sm:p-7 shadow-2xl text-center relative overflow-hidden"
      >
        {/* Restaurant Header */}
        <div className="mb-6 flex flex-col items-center">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-3 border border-white/10 overflow-hidden bg-[#18181C]">
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
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>لوحة الكاشير محمية بتشفير الجلسة</span>
          </span>
        </div>

        {/* Lockout Banner */}
        {isLocked ? (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 mb-6 text-center">
            <ShieldAlert className="w-6 h-6 text-rose-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-rose-300">
              تم حظر المحاولات مؤقتاً
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              تم تجاوز الحد المسموح (5 محاولات خاطئة). يرجى الانتظار:
            </p>
            <div className="font-mono text-2xl font-bold text-rose-400 mt-2 tabular-nums">
              {Math.floor((lockedUntilSeconds || 0) / 60)}:
              {String((lockedUntilSeconds || 0) % 60).padStart(2, '0')}
            </div>
          </div>
        ) : (
          <>
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
                        ? 'bg-emerald-400 scale-110 shadow-sm shadow-emerald-400/40'
                        : 'bg-white/[0.08] border border-white/[0.06]'
                    }`}
                  />
                );
              })}
            </motion.div>

            {/* Error & Attempts Message */}
            <AnimatePresence>
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mb-4"
                >
                  <p className="text-xs text-rose-400 font-medium flex items-center justify-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errorMessage}</span>
                  </p>
                  {remainingAttempts !== null && remainingAttempts > 0 && (
                    <p className="text-[11px] text-zinc-500 mt-1">
                      محاولات متبقية قبل القفل: {remainingAttempts}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* iOS / Apple Tactile Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <motion.button
                  key={digit}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => handleDigit(digit)}
                  disabled={isVerifying || isLocked}
                  className="h-12 sm:h-13 rounded-xl bg-[#18181C] hover:bg-[#202026] active:bg-emerald-500/20 text-white text-xl font-mono font-semibold tabular-nums border border-white/[0.06] transition-colors flex items-center justify-center select-none shadow-sm disabled:opacity-40"
                >
                  {digit}
                </motion.button>
              ))}

              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={handleClear}
                disabled={isVerifying || isLocked}
                className="h-12 sm:h-13 rounded-xl bg-transparent hover:bg-white/[0.04] text-zinc-400 hover:text-white text-xs font-medium border border-transparent transition-colors flex items-center justify-center select-none disabled:opacity-40"
              >
                مسح
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => handleDigit('0')}
                disabled={isVerifying || isLocked}
                className="h-12 sm:h-13 rounded-xl bg-[#18181C] hover:bg-[#202026] active:bg-emerald-500/20 text-white text-xl font-mono font-semibold tabular-nums border border-white/[0.06] transition-colors flex items-center justify-center select-none shadow-sm disabled:opacity-40"
              >
                0
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={handleBackspace}
                disabled={isVerifying || isLocked}
                className="h-12 sm:h-13 rounded-xl bg-transparent hover:bg-white/[0.04] text-zinc-400 hover:text-white text-xs font-medium border border-transparent transition-colors flex items-center justify-center select-none disabled:opacity-40"
              >
                حذف
              </motion.button>
            </div>
          </>
        )}

        <div className="pt-2 border-t border-white/[0.06] text-center">
          <p className="text-[11px] text-zinc-500 font-mono">
            الرمز الافتراضي للتجربة: <span className="text-zinc-400">1234</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
