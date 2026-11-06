'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'qrcode';
import { useQueue } from '@/context/QueueContext';
import { soundManager } from '@/lib/audio';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RestaurantNotFound } from '@/components/RestaurantNotFound';
import { RestaurantAvatar } from '@/components/RestaurantAvatar';
import {
  Maximize2,
  Minimize2,
  Clock,
  BellRing,
  ChefHat,
  Volume2,
  VolumeX,
  Smartphone,
  Flame,
  Radio,
  CheckCircle2,
  Sparkles,
  Store,
} from 'lucide-react';

export default function KitchenTvBoardPage() {
  const params = useParams();
  const slug = (params?.slug as string) || '';

  const {
    getRestaurant,
    getOrdersForRestaurant,
    isRestaurantsLoaded,
    lastEvent,
    warmupLiveChannel,
    getOrCreateLiveChannel,
  } = useQueue();

  const restaurant = getRestaurant(slug);
  const orders = getOrdersForRestaurant(slug);

  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [trackerQrUrl, setTrackerQrUrl] = useState<string>('');
  const [highlightOrderNumber, setHighlightOrderNumber] = useState<string | null>(null);

  const previousReadyCount = useRef<number>(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // 1. Pre-warm persistent Supabase Realtime channel for zero-latency TV alerts (<30ms)
  useEffect(() => {
    if (slug && warmupLiveChannel) {
      warmupLiveChannel(slug);
    }
  }, [slug, warmupLiveChannel]);

  // Listen to ORDER_CALL broadcast directly on TV board
  useEffect(() => {
    if (!slug || !getOrCreateLiveChannel) return;
    const channel = getOrCreateLiveChannel(slug);
    if (!channel) return;

    const handleBroadcast = ({ payload }: { payload: any }) => {
      if (!payload) return;
      const pSlug = (payload.restaurantSlug || payload.order?.restaurantSlug || '').toLowerCase().trim();
      const pNum = String(payload.orderNumber || payload.order?.orderNumber || '').trim();

      if (pSlug === slug.toLowerCase().trim() && pNum) {
        triggerNewReady(pNum);
      }
    };

    channel.on('broadcast', { event: 'ORDER_CALL' }, handleBroadcast);
  }, [slug, getOrCreateLiveChannel]);

  // 2. Generate dynamic Dark-Mode Emerald QR Code for customer mobile tracker
  useEffect(() => {
    if (typeof window === 'undefined' || !slug) return;
    const origin = window.location.origin;
    const trackUrl = `${origin}/${slug}/track`;
    QRCode.toDataURL(trackUrl, {
      margin: 1,
      width: 160,
      color: {
        dark: '#10B981',
        light: '#0D0D12',
      },
    })
      .then((url) => setTrackerQrUrl(url))
      .catch(() => {});
  }, [slug]);

  // 3. Smart TV Keep-Awake Engine (WakeLock + Silent Audio Keep-Alive)
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
    soundManager.warmUp();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
        soundManager.warmUp();
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

  // 4. Digital clock & Gregorian/Arabic date ticker
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
      try {
        setCurrentDate(
          now.toLocaleDateString('ar-SA', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        );
      } catch {
        setCurrentDate(now.toDateString());
      }
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // 5. Track Fullscreen changes
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // 6. Filter active orders
  const preparingOrders = useMemo(
    () => orders.filter((o) => o.status === 'preparing'),
    [orders]
  );
  const readyOrders = useMemo(
    () => orders.filter((o) => o.status === 'ready'),
    [orders]
  );

  // 7. Trigger alert spotlight and audio announcement
  const triggerNewReady = (orderNum: string) => {
    setHighlightOrderNumber(orderNum);
    if (audioEnabled) {
      soundManager.playThemedChime(restaurant?.chimeTheme || 'hospitality');
      const voiceActive = restaurant?.voiceAnnounceEnabled ?? true;
      if (voiceActive) {
        setTimeout(() => {
          soundManager.announceOrderArabic(orderNum, restaurant?.name || '');
        }, 1300);
      }
    }
    setTimeout(() => {
      setHighlightOrderNumber(null);
    }, 4000);
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

  const getElapsedMins = (createdAt: string) => {
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return Math.max(0, diff);
  };

  const handleExplicitAudioUnlock = async () => {
    await soundManager.unlock();
    soundManager.warmUp();
    setAudioUnlocked(true);
    setAudioEnabled(true);
    soundManager.playSuccessTone();
  };

  // Check audio status on mount & global interaction
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAudioUnlocked(soundManager.isAudioUnlocked());
    }

    const handleGlobalUnlock = async () => {
      await soundManager.unlock();
      soundManager.warmUp();
      setAudioUnlocked(true);
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
      <div className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center font-sans p-4">
        <div className="w-14 h-14 rounded-full border-3 border-emerald-500 border-t-transparent animate-spin mb-4" />
        <p className="text-base text-zinc-400 font-mono tracking-wider">جارِ تشغيل لوحة الشاشة الذكية...</p>
      </div>
    );
  }

  const themeColor = restaurant?.themeColor || '#10B981';

  return (
    <ErrorBoundary fallbackTitle="تعذر تحميل شاشة الصالة والتلفاز">
      <div className="min-h-screen bg-[#070709] text-white flex flex-col font-sans overflow-hidden select-none relative">
        {/* Dynamic Atmospheric Ambient Lighting */}
        <div
          className="fixed inset-0 pointer-events-none opacity-40 transition-opacity duration-1000"
          style={{
            background: `radial-gradient(ellipse 70% 50% at 85% 15%, ${themeColor}22, transparent 65%), radial-gradient(ellipse 60% 40% at 15% 85%, #F59E0B12, transparent 65%)`,
          }}
        />

        {/* 1. LUXURY ENTERPRISE TV HEADER */}
        <header className="border-b border-white/[0.08] bg-[#0A0A0E]/95 backdrop-blur-xl px-6 lg:px-10 py-4 flex items-center justify-between z-20 shadow-lg">
          {/* Brand Identity & Status */}
          <div className="flex items-center gap-4 lg:gap-5">
            <div className="relative group">
              <div
                className="absolute -inset-1 rounded-2xl opacity-60 blur-md group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: themeColor }}
              />
              <div className="relative">
                <RestaurantAvatar
                  logoUrl={restaurant?.logoUrl}
                  name={restaurant?.name || slug}
                  themeColor={themeColor}
                  size="lg"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                  {restaurant?.name || slug}
                </h1>
                <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>بث فوري مباشر</span>
                </div>
              </div>
              <p className="text-xs lg:text-sm text-zinc-400 font-medium mt-0.5 flex items-center gap-2">
                <span>شاشة نداء واستدعاء الطلبات</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-500 font-mono text-xs">Live Display Board</span>
              </p>
            </div>
          </div>

          {/* Center Sound & Connectivity Bar */}
          <div className="hidden xl:flex items-center gap-3">
            <button
              onClick={handleExplicitAudioUnlock}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all border ${
                audioEnabled && audioUnlocked
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-sm'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30 animate-pulse'
              }`}
              title="اختبار أو تفعيل مكبر الصوت"
            >
              {audioEnabled && audioUnlocked ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span>مكبر الصوت نشط</span>
                  <div className="flex items-end gap-0.5 h-3 ml-1">
                    <span className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-0.5 h-3 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-amber-300" />
                  <span>انقر لتفعيل المنبه الصوتي</span>
                </>
              )}
            </button>
          </div>

          {/* Clock, Date & Fullscreen Controls */}
          <div className="flex items-center gap-3.5">
            {/* Clock & Date Badge */}
            <div className="bg-[#121217] border border-white/[0.08] px-4 py-2 rounded-2xl flex flex-col items-end shadow-inner">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span className="font-mono text-xl lg:text-2xl font-black text-white tabular-nums tracking-wider dir-ltr">
                  {currentTime || '--:--:--'}
                </span>
              </div>
              {currentDate && (
                <span className="text-[11px] text-zinc-400 font-medium tracking-tight mt-0.5">
                  {currentDate}
                </span>
              )}
            </div>

            {/* Fullscreen Button */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.05 }}
              onClick={toggleFullscreen}
              className="p-3 rounded-2xl bg-[#121217] hover:bg-[#1A1A22] text-zinc-400 hover:text-white border border-white/[0.08] transition-colors shadow-sm cursor-pointer"
              title={isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5 text-emerald-400" /> : <Maximize2 className="w-5 h-5" />}
            </motion.button>
          </div>
        </header>

        {/* 2. DRAMATIC CENTER SPOTLIGHT CALLOUT (TRIGGERED ON READY CALL) */}
        <AnimatePresence>
          {highlightOrderNumber && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/85 backdrop-blur-xl pointer-events-none"
            >
              {/* Expanding Concentric Soundwave Rings */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0.9 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeOut' }}
                className="absolute w-80 h-80 rounded-full border-2 border-emerald-400/60 pointer-events-none"
              />
              <motion.div
                initial={{ scale: 0.6, opacity: 0.8 }}
                animate={{ scale: 2.0, opacity: 0 }}
                transition={{ repeat: Infinity, duration: 2, delay: 0.4, ease: 'easeOut' }}
                className="absolute w-80 h-80 rounded-full border border-emerald-400/40 pointer-events-none"
              />
              <motion.div
                initial={{ scale: 0.4, opacity: 0.7 }}
                animate={{ scale: 1.5, opacity: 0 }}
                transition={{ repeat: Infinity, duration: 2, delay: 0.8, ease: 'easeOut' }}
                className="absolute w-80 h-80 rounded-full border border-emerald-400/30 pointer-events-none"
              />

              {/* Callout Card */}
              <motion.div
                initial={{ scale: 0.5, y: 50, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{
                  scale: 0.4,
                  y: 40,
                  opacity: 0,
                  transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] },
                }}
                transition={{
                  type: 'spring',
                  stiffness: 350,
                  damping: 25,
                }}
                className="relative bg-gradient-to-b from-[#0A261D] to-[#041611] border-3 border-emerald-400 rounded-3xl p-8 sm:p-14 text-center max-w-2xl w-full shadow-[0_0_80px_rgba(16,185,129,0.35)]"
              >
                <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-sm font-black uppercase tracking-wider mb-6">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                  <span>نداء استلام طلب</span>
                </div>

                <div className="font-mono text-8xl sm:text-9xl font-black text-white tracking-tight tabular-nums my-4 drop-shadow-[0_0_35px_rgba(16,185,129,0.5)]">
                  #{highlightOrderNumber}
                </div>

                <h2 className="text-3xl sm:text-4xl font-black text-emerald-300 mt-5 tracking-tight flex items-center justify-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 inline-block" />
                  <span>طلبكم جاهز للاستلام الآن</span>
                </h2>
                <p className="text-base sm:text-lg text-emerald-100/80 mt-3 font-medium">
                  تفضل بالتوجه إلى كاونتر الاستلام لاستلام وجبتك وهي طازجة
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3. MAIN SPLIT BENTO BOARD (ALWAYS VISIBLE WITH RICH CONTENT & PLACEHOLDERS) */}
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 p-5 lg:p-7 gap-5 lg:gap-7 overflow-hidden">
          {/* COLUMN 1: PREPARING (قيد التحضير - AMBER WARMTH) */}
          <div className="flex flex-col bg-[#0F0F14]/90 rounded-3xl border border-amber-500/25 p-5 lg:p-6 shadow-2xl overflow-hidden backdrop-blur-md relative group">
            {/* Ambient Column Aura */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Column Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-5 relative z-10">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shadow-sm">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                    قيد التحضير
                  </h2>
                  <p className="text-xs text-amber-300/70 font-medium">جاري إعداد وتجهيز الطلب</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-base lg:text-lg font-mono font-bold tabular-nums">
                  {preparingOrders.length} {preparingOrders.length === 1 ? 'طلب' : 'طلبات'}
                </span>
              </div>
            </div>

            {/* Order Cards Grid OR Crafted Preparation Lounge State */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative z-10">
              {preparingOrders.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {preparingOrders.map((order) => {
                      const elapsed = getElapsedMins(order.createdAt || order.created_at || new Date().toISOString());
                      const isDelayed = elapsed > (order.estimatedMinutes || 15);

                      return (
                        <motion.div
                          key={order.id}
                          layout
                          layoutId={`tv-prep-${order.id}`}
                          initial={{ opacity: 0, scale: 0.94, y: 15 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.92 }}
                          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                          className="bg-[#17171E] border border-amber-500/20 hover:border-amber-500/40 rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-lg transition-all relative overflow-hidden group/card"
                        >
                          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
                          <span className="text-[11px] font-mono text-zinc-400 mb-1 tracking-wider uppercase">
                            طلب رقم
                          </span>
                          <div className="font-mono text-5xl lg:text-6xl font-black text-white tracking-tight tabular-nums my-1">
                            #{order.orderNumber}
                          </div>
                          <div className="mt-2 flex items-center gap-1.5">
                            <span
                              className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full flex items-center gap-1 tabular-nums ${
                                isDelayed
                                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                  : 'bg-white/[0.05] text-zinc-400 border border-white/[0.05]'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>{elapsed === 0 ? 'الآن' : `${elapsed} د`}</span>
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="h-full min-h-[320px] flex flex-col items-center justify-center p-8 text-center rounded-2xl border-2 border-dashed border-amber-500/20 bg-amber-500/[0.02]">
                  <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mb-4 text-amber-300 shadow-inner">
                    <Flame className="w-8 h-8 animate-pulse" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">المطبخ والبار في وضع الاستعداد</h3>
                  <p className="text-sm text-zinc-400 max-w-sm leading-relaxed mb-4">
                    ستظهر أرقام الطلبات هنا فور إدخالها من شاشة الكاشير والبدء في تحضيرها بكل إتقان.
                  </p>
                  <span className="text-xs font-mono text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                    بانتظار طلبات جديدة • Kitchen Ready
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2: READY FOR PICKUP (جاهز للاستلام - NEON EMERALD) */}
          <div className="flex flex-col bg-gradient-to-b from-[#07241C]/95 via-[#051C16]/95 to-[#03140F]/95 rounded-3xl border-2 border-emerald-500/40 p-5 lg:p-6 shadow-2xl shadow-emerald-500/15 overflow-hidden backdrop-blur-md relative group">
            {/* Ambient Column Aura */}
            <div className="absolute top-0 left-0 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Column Header */}
            <div className="flex items-center justify-between pb-4 border-b border-emerald-500/25 mb-5 relative z-10">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <BellRing className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h2 className="text-2xl lg:text-3xl font-black text-emerald-400 tracking-tight">
                    جاهز للاستلام
                  </h2>
                  <p className="text-xs text-emerald-200/70 font-medium">يرجى التوجه للكاونتر لاستلام طلبك</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-base lg:text-lg font-mono font-bold tabular-nums shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                  {readyOrders.length} {readyOrders.length === 1 ? 'جاهز' : 'جاهزة'}
                </span>
              </div>
            </div>

            {/* Order Cards Grid OR Crafted Pickup Counter State */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative z-10">
              {readyOrders.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {readyOrders.map((order) => {
                      const elapsed = getElapsedMins(order.readyAt || order.createdAt || new Date().toISOString());

                      return (
                        <motion.div
                          key={order.id}
                          layout
                          layoutId={`tv-ready-${order.id}`}
                          initial={{ opacity: 0, scale: 0.9, y: 15 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ type: 'spring', stiffness: 350, damping: 26 }}
                          className="bg-[#093527] border-2 border-emerald-400/80 hover:border-emerald-300 rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-[0_0_30px_rgba(16,185,129,0.25)] relative overflow-hidden group/card"
                        >
                          <div className="absolute top-0 inset-x-0 h-1.5 bg-emerald-400 shadow-[0_0_10px_#10B981]" />

                          <span className="text-[11px] font-bold uppercase text-emerald-300 bg-emerald-500/25 px-3 py-0.5 rounded-full mb-1 flex items-center gap-1.5 border border-emerald-400/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
                            <span>تفضل بالاستلام</span>
                          </span>

                          <div className="font-mono text-6xl lg:text-7xl font-black text-white tracking-tight tabular-nums my-1 drop-shadow-[0_0_15px_rgba(16,185,129,0.6)]">
                            #{order.orderNumber}
                          </div>

                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[10px] font-mono text-emerald-200/80">
                              {elapsed === 0 ? 'الآن' : `منذ ${elapsed} د`}
                            </span>
                            {order.rePingCount > 0 && (
                              <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                                نداء {order.rePingCount}x
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="h-full min-h-[320px] flex flex-col items-center justify-center p-8 text-center rounded-2xl border-2 border-dashed border-emerald-500/30 bg-emerald-500/[0.03]">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center mb-4 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">كاونتر الاستلام بانتظاركم</h3>
                  <p className="text-sm text-emerald-100/70 max-w-sm leading-relaxed mb-4">
                    عند اكتمال تحضير وجبتكم سينطلق المنبه الصوتي فوراً ويظهر رقم طلبكم هنا باللون الأخضر.
                  </p>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full">
                    مستعدون للتسليم • Pickup Station Ready
                  </span>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* 4. BOTTOM SMART MARQUEE & CUSTOMER UTILITY RIBBON */}
        <footer className="border-t border-white/[0.08] bg-[#0A0A0E]/95 backdrop-blur-md px-6 py-3 flex items-center justify-between z-20">
          {/* Informative Marquee Ticker */}
          <div className="flex-1 flex items-center gap-3 overflow-hidden ml-4">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold shrink-0 flex items-center gap-1.5 border border-emerald-500/25">
              <Sparkles className="w-3.5 h-3.5" />
              <span>تنبيه للعملاء</span>
            </span>
            <div className="text-xs text-zinc-300 font-medium truncate">
              يرجى مراقبة رقم طلبكم على هذه الشاشة • سيتم الإعلان الصوتي تلقائياً فور جاهزية الطلب • نتمنى لكم تجربة مميزة وهنيئة!
            </div>
          </div>

          {/* Customer Mobile Tracker QR Code Badge */}
          {trackerQrUrl && (
            <div className="hidden sm:flex items-center gap-3 bg-[#131318] border border-emerald-500/30 px-3.5 py-1.5 rounded-2xl shadow-lg shrink-0">
              <img
                src={trackerQrUrl}
                alt="QR Tracker"
                className="w-10 h-10 rounded-xl bg-black p-0.5 border border-emerald-500/30 shadow-sm"
              />
              <div className="text-right">
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>تتبع طلبك على جوالك</span>
                </div>
                <p className="text-[10px] text-zinc-400 font-medium">امسح الكود بكاميرا الهاتف</p>
              </div>
            </div>
          )}
        </footer>

        {/* Floating Sound Activation Toast for TVs needing manual gesture */}
        {!audioUnlocked && (
          <motion.button
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleExplicitAudioUnlock}
            className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm px-7 py-3.5 rounded-full shadow-[0_0_35px_rgba(16,185,129,0.4)] flex items-center gap-3 border border-white/20 cursor-pointer animate-pulse"
          >
            <Volume2 className="w-5 h-5 text-white" />
            <span>انقر في أي مكان لتفعيل التنبيه الصوتي للشاشة 🔊</span>
          </motion.button>
        )}
      </div>
    </ErrorBoundary>
  );
}
