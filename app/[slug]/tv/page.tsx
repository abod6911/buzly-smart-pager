'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueue } from '@/context/QueueContext';
import { soundManager } from '@/lib/audio';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Clock,
  Bell,
  Mic,
  MicOff,
  Sparkles,
  Check,
  ChevronLeft,
} from 'lucide-react';

export default function KitchenTvBoardPage() {
  const params = useParams();
  const slug = (params.slug as string) || 'demo-cafe';

  const { getRestaurant, getOrdersForRestaurant, lastEvent } = useQueue();
  const restaurant = getRestaurant(slug);
  const orders = getOrdersForRestaurant(slug);

  const [currentTime, setCurrentTime] = useState<string>('');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [highlightOrderNumber, setHighlightOrderNumber] = useState<string | null>(null);
  const previousReadyCount = useRef<number>(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // 1. Smart TV Keep-Awake Engine (WakeLock + Silent Audio Keep-Alive)
  useEffect(() => {
    let isCancelled = false;

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && !isCancelled) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
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

  // Digital clock tick
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('ar-SA', {
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

  // Filter orders
  const preparingOrders = useMemo(
    () => orders.filter((o) => o.status === 'preparing'),
    [orders]
  );
  const readyOrders = useMemo(
    () => orders.filter((o) => o.status === 'ready'),
    [orders]
  );

  // Trigger alert banner and audio
  const triggerNewReady = (orderNum: string) => {
    setHighlightOrderNumber(orderNum);
    if (audioEnabled) {
      soundManager.playThemedChime(restaurant.chimeTheme || 'hospitality');
      if (voiceEnabled) {
        setTimeout(() => {
          soundManager.announceOrderArabic(orderNum, restaurant.name);
        }, 1300);
      }
    }
    setTimeout(() => {
      setHighlightOrderNumber(null);
    }, 3500);
  };

  const handleTestVolume = async () => {
    await soundManager.unlock();
    setAudioEnabled(true);
    soundManager.playHospitalityChime();
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
      lastEvent.restaurantSlug === slug &&
      lastEvent.orderNumber
    ) {
      triggerNewReady(lastEvent.orderNumber);
    }
  }, [lastEvent, slug]);

  const toggleAudio = async () => {
    if (!audioEnabled) {
      await soundManager.unlock();
      soundManager.playHospitalityChime();
      setAudioEnabled(true);
    } else {
      setAudioEnabled(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const getElapsedMins = (createdAt: string) => {
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return Math.max(0, diff);
  };

  // One-time global pointerdown listener for TV display audio unlock
  useEffect(() => {
    const handleGlobalUnlock = async () => {
      if (!audioEnabled) {
        await soundManager.unlock();
        setAudioEnabled(true);
      }
    };
    window.addEventListener('pointerdown', handleGlobalUnlock, { once: true });
    return () => window.removeEventListener('pointerdown', handleGlobalUnlock);
  }, [audioEnabled]);

  return (
    <ErrorBoundary fallbackTitle="تعذر تحميل شاشة الصالة والتلفاز">
      <div className="min-h-screen bg-[#09090B] text-white flex flex-col font-sans overflow-hidden select-none relative">
      {/* Smart TV One-Tap Audio Unlocker Banner */}
      {!audioEnabled && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          onClick={async () => {
            await soundManager.unlock();
            soundManager.playHospitalityChime();
            setAudioEnabled(true);
            toggleFullscreen();
          }}
          className="bg-emerald-500 hover:bg-emerald-400 text-[#052E16] font-bold text-xs py-2.5 px-4 text-center cursor-pointer flex items-center justify-center gap-2 z-30 transition-colors shadow-lg"
        >
          <Volume2 className="w-4 h-4 stroke-[2.5]" />
          <span>اضغط في أي مكان على الشاشة لتفعيل النداء الصوتي ووضع ملء الشاشة</span>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* 1. TOP AIRPORT-STYLE HEADER */}
      {/* ========================================================================= */}
      <header className="border-b border-white/[0.08] bg-[#09090B] px-6 py-4 flex items-center justify-between z-20">
        {/* Brand */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-white/10 overflow-hidden bg-[#18181C]">
            {restaurant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={restaurant.logoUrl}
                alt={restaurant.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Bell className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
                {restaurant.name}
              </h1>
              <span className="text-[10px] font-mono uppercase bg-white/[0.04] text-zinc-400 px-2 py-0.5 rounded border border-white/[0.06]">
                شاشة الصالة
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-normal mt-0.5">
              شاشة الاستدعاء ومتابعة جاهزية الطلبات
            </p>
          </div>
        </div>

        {/* Status & Controls */}
        <div className="flex items-center gap-3">
          {/* Digital Clock */}
          <div className="bg-[#121215] border border-white/[0.08] px-4 py-2 rounded-xl flex items-center gap-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <Clock className="w-4 h-4 text-zinc-400" />
            <span className="font-mono text-xl lg:text-2xl font-bold text-white tabular-nums tracking-wider">
              {currentTime || '--:--:--'}
            </span>
          </div>

          {/* Test Volume Button */}
          <motion.button
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.02 }}
            onClick={handleTestVolume}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#121215] hover:bg-[#18181E] text-zinc-300 hover:text-white border border-white/[0.08] transition-colors shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
            title="تجربة مستوى الصوت والرنين الفندقي"
          >
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">تجربة مستوى الصوت</span>
          </motion.button>

          {/* Sound Toggle */}
          <motion.button
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.02 }}
            onClick={toggleAudio}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors border shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] ${
              audioEnabled
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-[#121215] hover:bg-[#18181C] text-zinc-400 border-white/[0.08]'
            }`}
            title="تفعيل رنين الشاشة"
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{audioEnabled ? 'جرس التنبيه مفعل' : 'تفعيل الرنين'}</span>
          </motion.button>

          {/* Voice Toggle */}
          <motion.button
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors border shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] ${
              voiceEnabled
                ? 'bg-white/[0.06] text-zinc-200 border-white/[0.12]'
                : 'bg-[#121215] text-zinc-500 border-white/[0.08]'
            }`}
            title="تفعيل النداء الصوتي العربي"
          >
            {voiceEnabled ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4" />}
            <span className="hidden md:inline">{voiceEnabled ? 'النداء الصوتي مفعل' : 'النداء الصوتي معطل'}</span>
          </motion.button>

          {/* Fullscreen */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-[#121215] hover:bg-[#18181C] text-zinc-400 hover:text-white border border-white/[0.08] transition-colors shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
            title="ملء الشاشة"
          >
            <Maximize2 className="w-4 h-4" />
          </motion.button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. DRAMATIC CENTER SPOTLIGHT CALLOUT OVERLAY (3.5s with ripple wave) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {highlightOrderNumber && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md pointer-events-none"
          >
            {/* Subtle Outward Ripple Waves */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.8, ease: 'easeOut' }}
              className="absolute w-72 h-72 rounded-full border-2 border-emerald-400/50 pointer-events-none"
            />
            <motion.div
              initial={{ scale: 0.6, opacity: 0.7 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.8, delay: 0.5, ease: 'easeOut' }}
              className="absolute w-72 h-72 rounded-full border border-emerald-400/40 pointer-events-none"
            />

            {/* Spotlight Card */}
            <motion.div
              initial={{ scale: 0.5, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{
                scale: 0.35,
                x: '-40%',
                y: '10%',
                opacity: 0,
                transition: { duration: 0.45, ease: [0.32, 0.72, 0, 1] },
              }}
              transition={{
                type: 'spring',
                stiffness: 350,
                damping: 24,
              }}
              className="relative bg-[#121216] border-2 border-emerald-500 rounded-3xl p-8 sm:p-12 text-center max-w-xl w-full shadow-2xl shadow-emerald-500/20"
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span>نداء جديد</span>
              </div>

              {/* Order Number */}
              <div className="font-mono text-7xl sm:text-9xl font-black text-white tracking-tight tabular-nums my-2 drop-shadow-lg">
                #{highlightOrderNumber}
              </div>

              {/* Action Message */}
              <h2 className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-4 tracking-tight">
                جاهز للاستلام الآن
              </h2>
              <p className="text-sm sm:text-base text-zinc-300 mt-2 font-medium">
                تفضل بالتوجه إلى كاونتر الاستلام
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 3. SPLIT BOARD: PREPARING (RIGHT) vs READY (LEFT) */}
      {/* ========================================================================= */}
      <main className="flex-1 grid grid-cols-2 divide-x-2 divide-x-reverse divide-white/[0.06] p-6 gap-6 overflow-hidden">
        {/* COLUMN 1: PREPARING (قيد التحضير) */}
        <div className="flex flex-col bg-[#121215] rounded-2xl border border-white/[0.08] p-5 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06] mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div>
                <h2 className="text-lg lg:text-xl font-bold text-zinc-200">
                  قيد التحضير
                </h2>
                <p className="text-xs text-zinc-500">يتم إعدادها في المطبخ</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm font-mono font-bold tabular-nums">
              {preparingOrders.length}
            </span>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <AnimatePresence>
                {preparingOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    className="bg-[#18181C] border border-white/[0.06] rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm"
                  >
                    <span className="text-[11px] font-mono text-zinc-500 mb-1">طلب</span>
                    <div className="font-mono text-4xl lg:text-5xl font-bold text-white tracking-tight tabular-nums">
                      {order.orderNumber}
                    </div>
                    <div className="mt-2 text-[11px] font-mono text-zinc-400 tabular-nums">
                      منذ {getElapsedMins(order.createdAt)} د
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {preparingOrders.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center py-20">
                <p className="text-sm font-medium">لا توجد طلبات قيد التحضير حالياً</p>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2: READY FOR PICKUP (جاهز للاستلام) */}
        <div className="flex flex-col bg-emerald-950/20 rounded-2xl border border-emerald-500/20 p-5 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-emerald-500/20 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <h2 className="text-lg lg:text-xl font-bold text-emerald-400">
                  جاهز للاستلام
                </h2>
                <p className="text-xs text-zinc-400">تفضل بالتوجه إلى الكاونتر</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-mono font-bold tabular-nums">
              {readyOrders.length}
            </span>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <AnimatePresence>
                {readyOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    className="bg-[#121215] border-2 border-emerald-500/40 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden"
                  >
                    <span className="text-[10px] uppercase font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>جاهز الآن</span>
                    </span>
                    <div className="font-mono text-5xl lg:text-6xl font-bold text-white tracking-tight tabular-nums my-1">
                      {order.orderNumber}
                    </div>
                    <span className="mt-1 text-[10px] font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                      تفضل للاستلام
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {readyOrders.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center py-20">
                <p className="text-sm font-medium">بانتظار جاهزية الطلبات</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Ticker */}
      <footer className="border-t border-white/[0.08] bg-[#09090B] px-6 py-2.5 flex items-center justify-between text-xs text-zinc-500">
        <span className="flex items-center gap-1.5 font-normal">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>تظهر الأرقام تلقائياً فور جاهزية الطلب بالمطبخ</span>
        </span>
        <span className="font-mono text-[11px] text-zinc-600">Buzly Display System</span>
      </footer>
    </div>
    </ErrorBoundary>
  );
}
