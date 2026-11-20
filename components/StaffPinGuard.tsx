'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, AlertCircle, KeyRound, ShieldAlert, CheckCircle2, Keyboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { soundManager } from '@/lib/audio';
import { Restaurant } from '@/types/queue';
import { RestaurantAvatar } from '@/components/RestaurantAvatar';
import { useLanguage, LanguageSwitcher } from '@/context/LanguageContext';
import { extractDigitKey } from '@/lib/keyboard';

interface StaffPinGuardProps {
  restaurant?: Restaurant;
  onUnlocked: () => void;
  children: React.ReactNode;
}

export const StaffPinGuard: React.FC<StaffPinGuardProps> = ({
  restaurant,
  onUnlocked,
  children,
}) => {
  const { language, isRTL, t } = useLanguage();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorShake, setErrorShake] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedUntilSeconds, setLockedUntilSeconds] = useState<number | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);

  // 1. Initial Session Check (Enforce PIN prompt on every fresh tab/visit from the very first time)
  useEffect(() => {
    setMounted(true);

    const slugKey = restaurant?.slug || 'demo-cafe';
    const isUnlockedInThisTab =
      typeof window !== 'undefined' &&
      sessionStorage.getItem(`chimer_tab_unlocked_${slugKey}`) === 'true';

    // If this tab was not explicitly unlocked in this session, ALWAYS show PIN prompt
    if (!isUnlockedInThisTab) {
      setIsAuthenticated(false);
      return;
    }

    const checkActiveSession = async () => {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' });
        const data = await res.json();
        if (data.authenticated && (!restaurant?.slug || data.slug === restaurant?.slug)) {
          setIsAuthenticated(true);
          onUnlocked();
        } else {
          setIsAuthenticated(false);
          sessionStorage.removeItem(`chimer_tab_unlocked_${slugKey}`);
        }
      } catch (err) {
        console.warn('Session verification error:', err);
      }
    };

    checkActiveSession();

    // Listen for instant lock / logout events
    const handleLock = () => {
      setIsAuthenticated(false);
      setPin('');
      setErrorMessage(null);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(`chimer_tab_unlocked_${slugKey}`);
      }
    };

    window.addEventListener('chimer:lock', handleLock);
    return () => window.removeEventListener('chimer:lock', handleLock);
  }, [restaurant?.slug, onUnlocked]);

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
          body: JSON.stringify({ slug: restaurant?.slug || '', pin: candidatePin }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          soundManager.playSuccessTone();
          const slugKey = restaurant?.slug || 'demo-cafe';
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(`chimer_tab_unlocked_${slugKey}`, 'true');
          }
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
    [isVerifying, lockedUntilSeconds, restaurant?.slug, onUnlocked]
  );

  const pinRef = useRef<string>('');
  useEffect(() => {
    pinRef.current = pin;
  }, [pin]);

  const handleDigit = useCallback(
    (digit: string) => {
      if (lockedUntilSeconds && lockedUntilSeconds > 0) return;
      if (isVerifying) return;
      const currentPin = pinRef.current;
      if (currentPin.length < 4) {
        soundManager.playKeyClick();
        const nextPin = currentPin + digit;
        pinRef.current = nextPin;
        setPin(nextPin);

        if (nextPin.length === 4) {
          verifyPinOnServer(nextPin);
        }
      }
    },
    [lockedUntilSeconds, isVerifying, verifyPinOnServer]
  );

  const handleBackspace = useCallback(() => {
    if (lockedUntilSeconds && lockedUntilSeconds > 0) return;
    if (isVerifying) return;
    soundManager.playKeyClick();
    const nextPin = pinRef.current.slice(0, -1);
    pinRef.current = nextPin;
    setPin(nextPin);
  }, [lockedUntilSeconds, isVerifying]);

  const handleClear = useCallback(() => {
    if (lockedUntilSeconds && lockedUntilSeconds > 0) return;
    if (isVerifying) return;
    soundManager.playKeyClick();
    pinRef.current = '';
    setPin('');
  }, [lockedUntilSeconds, isVerifying]);

  // Physical Keyboard & Numpad Listener for Cashier Terminals & Desktop PCs
  useEffect(() => {
    if (isAuthenticated) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing inside an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Allow browser shortcuts (Cmd+R, Ctrl+C, etc.)
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
        if (pinRef.current.length === 4) {
          verifyPinOnServer(pinRef.current);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated, handleDigit, handleBackspace, handleClear, verifyPinOnServer]);

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
        {/* Language Switcher in Pin Guard Header */}
        <div className="flex justify-end mb-2">
          <LanguageSwitcher variant="minimal" />
        </div>

        {/* Restaurant Header */}
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3">
            <RestaurantAvatar
              logoUrl={restaurant?.logoUrl}
              name={restaurant?.name}
              themeColor={restaurant?.themeColor}
              size="lg"
            />
          </div>
          <h2 className="text-lg font-bold text-white">{restaurant?.name || t('cashierPos')}</h2>
          <span className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 font-normal">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('pinPromptTitle')}</span>
          </span>
        </div>

        {/* Lockout Banner */}
        {isLocked ? (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 mb-6 text-center">
            <ShieldAlert className="w-6 h-6 text-rose-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-rose-300">
              {t('pinLockedTitle')}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {t('pinLockedMsg')}
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
              dir="ltr"
              style={{ direction: 'ltr' }}
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
                      {t('pinAttemptsRemaining')} {remainingAttempts}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* iOS / Apple Tactile Numeric Keypad */}
            <div dir="ltr" style={{ direction: 'ltr' }} className="grid grid-cols-3 gap-2 mb-4">
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
                {t('clear')}
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
                {t('delete')}
              </motion.button>
            </div>
          </>
        )}

        <div className="pt-3 border-t border-white/[0.06] text-center flex items-center justify-center gap-1.5 text-zinc-500 text-xs">
          <ShieldAlert className="w-3.5 h-3.5 text-emerald-400/80" />
          <span>{t('protectedAreaNotice')}</span>
        </div>

        <div className="mt-2 text-center text-[11px] text-zinc-500/80 flex items-center justify-center gap-1.5 select-none font-sans">
          <Keyboard className="w-3 h-3 text-zinc-400" />
          <span>{language === 'ar' ? 'يدعم لوحة المفاتيح والأرقام الجانبية (Numpad)' : 'Supports keyboard & Numpad entry'}</span>
        </div>
      </motion.div>
    </div>
  );
};

/**
 * Instantly terminates active staff session and triggers immediate lock on all open guards
 */
export async function lockStaffSession(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' });
  } catch (err) {
    console.warn('Logout request failed:', err);
  }
  if (typeof window !== 'undefined') {
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('chimer_tab_unlocked_')) {
        sessionStorage.removeItem(key);
      }
    });
    window.dispatchEvent(new CustomEvent('chimer:lock'));
  }
}

/**
 * Reusable One-Tap Terminal Lock Button for Staff & Admin Headers
 */
export const StaffLockBtn: React.FC<{
  className?: string;
  label?: string;
}> = ({ className, label = 'قفل الشاشة' }) => {
  const [isLocking, setIsLocking] = useState(false);

  const handleLock = async () => {
    setIsLocking(true);
    try {
      await lockStaffSession();
    } finally {
      setIsLocking(false);
    }
  };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      whileHover={{ scale: 1.02 }}
      onClick={handleLock}
      disabled={isLocking}
      className={
        className ||
        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-300 border border-rose-500/25 text-xs font-semibold transition-all shadow-sm disabled:opacity-50 select-none'
      }
      title="قفل الشاشة فوراً لمنع التطفل وتأمين البيانات"
    >
      <Lock className="w-3.5 h-3.5 text-rose-400" />
      <span>{label}</span>
    </motion.button>
  );
};
