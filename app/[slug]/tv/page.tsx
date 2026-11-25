'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueue } from '@/context/QueueContext';
import { useLanguage, LanguageSwitcher } from '@/context/LanguageContext';
import { soundManager } from '@/lib/audio';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RestaurantNotFound } from '@/components/RestaurantNotFound';
import { RestaurantAvatar } from '@/components/RestaurantAvatar';
import {
  Maximize2,
  Clock,
  Bell,
  UtensilsCrossed,
  Store,
  CheckCircle2,
  Volume2,
} from 'lucide-react';

export default function KitchenTvBoardPage() {
  const params = useParams();
  const slug = (params.slug as string) || '';

  const { getRestaurant, getOrdersForRestaurant, isRestaurantsLoaded, lastEvent } = useQueue();
  const { language, isRTL, t } = useLanguage();
  const restaurant = getRestaurant(slug);
  const orders = getOrdersForRestaurant(slug);

  const [currentTime, setCurrentTime] = useState<string>('');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [highlightOrderNumber, setHighlightOrderNumber] = useState<string | null>(null);
  const [isTestingAudio, setIsTestingAudio] = useState<boolean>(false);
  const [isWakeLockActive, setIsWakeLockActive] = useState<boolean>(false);
  const previousReadyCount = useRef<number>(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // 1. Smart TV Keep-Awake Engine (WakeLock + Silent Audio Keep-Alive)
  useEffect(() => {
    let isCancelled = false;

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && !isCancelled) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          setIsWakeLockActive(true);
          wakeLockRef.current.addEventListener('release', () => setIsWakeLockActive(false));
        } catch {
          // Wake lock rejected or unsupported
        }
      }
    };

    requestWakeLock();
    soundManager.startSilentKeepAlive();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
        soundManager.startSilentKeepAlive();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isCancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
      soundManager.stopSilentKeepAlive();
    };
  }, []);

  // 2. Digital clock tick in standard English/Western numerals (en-US)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // 3. Filter active orders
  const preparingOrders = useMemo(
    () => orders.filter((o) => o.status === 'preparing'),
    [orders]
  );
  const readyOrders = useMemo(
    () => orders.filter((o) => o.status === 'ready'),
    [orders]
  );

  // 4. Trigger alert banner and audio
  const triggerNewReady = (orderNum: string) => {
    setHighlightOrderNumber(orderNum);
    if (audioEnabled) {
      soundManager.playThemedChime(restaurant?.chimeTheme || 'hospitality');
      const voiceActive = restaurant?.voiceAnnounceEnabled ?? true;
      if (voiceActive) {
        setTimeout(() => {
          soundManager.announceOrder(
            orderNum,
            language === 'en' ? 'en' : 'bilingual',
            restaurant?.name || ''
          );
        }, 1300);
      }
    }
    setTimeout(() => {
      setHighlightOrderNumber(null);
    }, 3200);
  };

  useEffect(() => {
    if (readyOrders.length > previousReadyCount.current && previousReadyCount.current !== 0) {
      if (readyOrders[0]) {
        triggerNewReady(readyOrders[0].orderNumber);
      }
    }
    previousReadyCount.current = readyOrders.length;
  }, [readyOrders]);

  useEffect(() => {
    if (!lastEvent) return;
    if (
      (lastEvent.type === 'ORDER_READY' || lastEvent.type === 'ORDER_REPING') &&
      (lastEvent.restaurantSlug || '').toLowerCase() === slug.toLowerCase() &&
      lastEvent.orderNumber
    ) {
      triggerNewReady(lastEvent.orderNumber);
    }
  }, [lastEvent, slug]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleTestVoice = async () => {
    if (isTestingAudio) return;
    setIsTestingAudio(true);
    await soundManager.testTvVoiceAnnouncement('104', restaurant?.name || 'Demo Cafe');
    setTimeout(() => {
      setIsTestingAudio(false);
    }, 4500);
  };

  // Keyboard shortcut: Press F or F11 for Fullscreen, T for voice test
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11' || e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.key.toLowerCase() === 't') {
        handleTestVoice();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getElapsedMins = (createdAt: string) => {
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return Math.max(0, diff);
  };

  // 5. Silent one-time global click/touch listener to unlock Web Audio without visual clutter
  useEffect(() => {
    const handleGlobalUnlock = async () => {
      await soundManager.unlock();
      soundManager.startSilentKeepAlive();
      setAudioEnabled(true);
    };
    window.addEventListener('pointerdown', handleGlobalUnlock, { once: true });
    window.addEventListener('keydown', handleGlobalUnlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleGlobalUnlock);
      window.removeEventListener('keydown', handleGlobalUnlock);
    };
  }, []);

  if (!restaurant) {
    if (isRestaurantsLoaded) {
      return <RestaurantNotFound slug={slug} />;
    }
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex flex-col items-center justify-center font-sans p-4">
        <div className="w-12 h-12 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-3" />
        <p className="text-sm text-zinc-400 font-mono">جارِ التحقق من المتجر...</p>
      </div>
    );
  }

  const hasAnyActiveOrders = preparingOrders.length > 0 || readyOrders.length > 0;

  return (
    <ErrorBoundary fallbackTitle="تعذر تحميل شاشة الصالة والتلفاز">
      <div className="min-h-screen bg-[#0A0A0C] text-white flex flex-col font-sans overflow-hidden select-none relative">
        {/* 1. ARCHITECTURAL MINIMAL HEADER */}
        <header className="border-b border-white/[0.07] bg-[#0A0A0C] px-6 sm:px-8 py-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-4">
            <RestaurantAvatar
              logoUrl={restaurant?.logoUrl}
              name={restaurant?.name || slug}
              themeColor={restaurant?.themeColor}
              size="lg"
            />
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
              {restaurant?.name || slug}
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <LanguageSwitcher variant="minimal" />

            <div className="bg-[#121215] border border-white/[0.08] px-4 py-2 rounded-xl flex items-center gap-2">
              <span className="font-mono text-lg lg:text-xl font-semibold text-zinc-200 tabular-nums tracking-wider dir-ltr">
                {currentTime || '--:--:--'}
              </span>
            </div>

            <button
              onClick={handleTestVoice}
              disabled={isTestingAudio}
              className="p-2.5 rounded-xl bg-[#121215] hover:bg-[#18181C] text-zinc-400 hover:text-white border border-white/[0.08] transition-colors cursor-pointer disabled:opacity-40"
              title={language === 'ar' ? 'تجربة الصوت' : 'Test Sound'}
            >
              <Volume2 className={`w-4 h-4 ${isTestingAudio ? 'text-emerald-400' : ''}`} />
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl bg-[#121215] hover:bg-[#18181C] text-zinc-400 hover:text-white border border-white/[0.08] transition-colors cursor-pointer"
              title={t('fullscreen')}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* 2. CINEMATIC CENTER SPOTLIGHT OVERLAY */}
        <AnimatePresence>
          {highlightOrderNumber && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-xl pointer-events-none"
            >
              <motion.div
                initial={{ scale: 0.72, y: 32, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{
                  scale: 0.42,
                  x: '-28%',
                  y: '6%',
                  opacity: 0,
                  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                }}
                transition={{
                  type: 'spring',
                  stiffness: 280,
                  damping: 24,
                }}
                className="bg-emerald-600 text-white rounded-[36px] px-12 py-12 sm:px-20 sm:py-16 text-center max-w-xl w-full shadow-[0_32px_90px_rgba(0,0,0,0.65)]"
              >
                <p className="text-sm sm:text-base font-bold uppercase tracking-[0.25em] text-emerald-100 mb-3">
                  {language === 'ar' ? 'جاهز للاستلام' : 'ORDER READY'}
                </p>

                <div
                  dir="ltr"
                  className="font-mono text-[110px] sm:text-[156px] font-black text-white tracking-tight tabular-nums leading-none my-2"
                >
                  {highlightOrderNumber}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3. MAIN TV VIEW: PURE ARCHITECTURAL NUMBER BOARD */}
        {hasAnyActiveOrders ? (
          <main className="flex-1 grid grid-cols-2 divide-x divide-x-reverse divide-white/[0.07] overflow-hidden">
            {/* COLUMN 1: PREPARING (قيد التحضير) */}
            <section className="flex flex-col p-6 lg:p-8 overflow-hidden">
              <div className="flex items-center justify-between pb-5 border-b border-white/[0.07] mb-6">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <h2 className="text-2xl lg:text-3xl font-bold text-zinc-200 tracking-tight">
                    {t('nowPreparing')}
                  </h2>
                </div>
                <span className="font-mono text-lg font-semibold text-zinc-500 tabular-nums">
                  {preparingOrders.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                  <AnimatePresence mode="popLayout">
                    {preparingOrders.map((order) => (
                      <motion.div
                        key={order.id}
                        layout
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{
                          opacity: 0,
                          scale: 0.8,
                          transition: { duration: 0.25, ease: 'easeOut' },
                        }}
                        transition={{
                          layout: { type: 'spring', stiffness: 320, damping: 28 },
                          scale: { type: 'spring', stiffness: 360, damping: 26 },
                        }}
                        className="bg-[#121215] border border-white/[0.07] rounded-2xl py-6 px-4 flex items-center justify-center text-center"
                      >
                        <span
                          dir="ltr"
                          className="font-mono text-4xl lg:text-5xl font-bold text-zinc-200 tracking-tight tabular-nums"
                        >
                          {order.orderNumber}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </section>

            {/* COLUMN 2: READY (جاهز) */}
            <section className="flex flex-col p-6 lg:p-8 bg-[#0D1310] overflow-hidden">
              <div className="flex items-center justify-between pb-5 border-b border-emerald-500/20 mb-6">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <h2 className="text-2xl lg:text-3xl font-bold text-emerald-400 tracking-tight">
                    {t('readyForPickup')}
                  </h2>
                </div>
                <span className="font-mono text-lg font-semibold text-emerald-500/70 tabular-nums">
                  {readyOrders.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence mode="popLayout">
                    {readyOrders.map((order) => (
                      <motion.div
                        key={order.id}
                        layout
                        initial={{ opacity: 0, scale: 0.78 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{
                          opacity: 0,
                          scale: 0.75,
                          transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
                        }}
                        transition={{
                          layout: { type: 'spring', stiffness: 300, damping: 26 },
                          scale: { type: 'spring', stiffness: 380, damping: 22 },
                        }}
                        className="bg-emerald-600/15 border border-emerald-500/35 rounded-3xl py-8 px-5 flex items-center justify-center text-center"
                      >
                        <motion.span
                          dir="ltr"
                          initial={{ scale: 0.85 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                          className="font-mono text-6xl lg:text-7xl font-black text-white tracking-tight tabular-nums"
                        >
                          {order.orderNumber}
                        </motion.span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </section>
          </main>
        ) : (
          /* Quiet Luxury Welcome Idle State */
          <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl w-full flex flex-col items-center"
            >
              <div className="mb-6">
                <RestaurantAvatar
                  logoUrl={restaurant?.logoUrl}
                  name={restaurant?.name || slug}
                  themeColor={restaurant?.themeColor}
                  size="xl"
                />
              </div>
              <h2 className="text-4xl sm:text-6xl font-bold text-white tracking-tight">
                {restaurant?.name || slug}
              </h2>
            </motion.div>
          </main>
        )}
      </div>
    </ErrorBoundary>
  );
}
