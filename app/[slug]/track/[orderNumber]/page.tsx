'use client';

import React, { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueue } from '@/context/QueueContext';
import { KeepAwakeEngine } from '@/components/KeepAwakeEngine';
import { AudioUnlockOverlay } from '@/components/AudioUnlockOverlay';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { soundManager } from '@/lib/audio';
import { pwaHelper } from '@/lib/pwa-helper';
import { Order, OrderStatus } from '@/types/queue';
import {
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  VolumeX,
  Volume2,
  ArrowRight,
  ShieldAlert,
  Flame,
  Check,
  RotateCcw,
  Star,
  Send,
  Sparkles,
  Utensils,
  Receipt,
} from 'lucide-react';

function TenantCustomerTrackerInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = (params.slug as string) || 'demo-cafe';
  const rawOrderNumber = params.orderNumber as string;
  const decodedOrderNumber = decodeURIComponent(rawOrderNumber || '').trim();

  const {
    getRestaurant,
    getOrder,
    completeOrder,
    registerPushSubscription,
    submitOrderFeedback,
    lastEvent,
    syncNow,
  } = useQueue();
  const restaurant = getRestaurant(slug);
  const liveOrder = getOrder(decodedOrderNumber, slug);

  // Self-healing fallback from QR URL params if cross-device sync is still propagating
  const fallbackOrder = useMemo(() => {
    if (liveOrder) return liveOrder;
    const estParam = searchParams.get('est');
    const statusParam = searchParams.get('status') as OrderStatus;
    if (estParam || statusParam) {
      return {
        id: `fb-${decodedOrderNumber}`,
        orderNumber: decodedOrderNumber,
        restaurantSlug: slug,
        status: statusParam || 'preparing',
        estimatedMinutes: parseInt(estParam || '10', 10),
        notes: searchParams.get('notes') || undefined,
        createdAt: searchParams.get('created') || new Date().toISOString(),
        rePingCount: 0,
      } as Order;
    }
    return undefined;
  }, [liveOrder, searchParams, decodedOrderNumber, slug]);

  const order = liveOrder || fallbackOrder;
  const [isSyncing, setIsSyncing] = useState<boolean>(!order);

  const [alarmActive, setAlarmActive] = useState<boolean>(false);
  const [hasUserSilenced, setHasUserSilenced] = useState<boolean>(false);
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);
  const [rating, setRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedbackSent, setFeedbackSent] = useState<boolean>(false);
  const [showAudioUnlockOverlay, setShowAudioUnlockOverlay] = useState<boolean>(false);
  const confettiFiredRef = useRef<boolean>(false);

  // 1. Mobile Audio & Vibration Unlock Guard
  useEffect(() => {
    if (typeof window !== 'undefined' && !soundManager.isAudioUnlocked()) {
      setShowAudioUnlockOverlay(true);
    }

    const unlockAll = async () => {
      await soundManager.unlock();
      soundManager.startSilentKeepAlive();
      setShowAudioUnlockOverlay(false);
      pwaHelper.requestNotificationPermission().catch(() => {});
    };

    // One-time global touch anywhere unlocks Web Audio and keep-alive
    window.addEventListener('pointerdown', unlockAll, { once: true });
    window.addEventListener('touchstart', unlockAll, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlockAll);
      window.removeEventListener('touchstart', unlockAll);
    };
  }, []);

  const handleExplicitUnlock = async () => {
    await soundManager.unlock();
    soundManager.startSilentKeepAlive();
    setShowAudioUnlockOverlay(false);
    pwaHelper.requestNotificationPermission().catch(() => {});
    soundManager.playThemedChime(restaurant.chimeTheme || 'hospitality');
  };

  // 2. Background Tab & Lock-Screen Reconnection Recovery (visibilitychange)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleReconnection = () => {
      if (document.visibilityState === 'visible') {
        syncNow();
        soundManager.unlock().catch(() => {});
        soundManager.startSilentKeepAlive();

        // If order became ready while locked, trigger alarm loop
        if (order && order.status === 'ready' && !hasUserSilenced) {
          setAlarmActive(true);
          soundManager.startReadyAlarmLoop(restaurant.chimeTheme || 'hospitality');
        }
      }
    };

    document.addEventListener('visibilitychange', handleReconnection);
    window.addEventListener('focus', handleReconnection);

    return () => {
      document.removeEventListener('visibilitychange', handleReconnection);
      window.removeEventListener('focus', handleReconnection);
    };
  }, [order, hasUserSilenced, restaurant.chimeTheme, syncNow]);

  // Immediate single-order fetch from server bridge if not yet in state
  useEffect(() => {
    if (liveOrder) {
      setIsSyncing(false);
      return;
    }

    let isCancelled = false;
    fetch(`/api/orders?slug=${encodeURIComponent(slug)}&orderNumber=${encodeURIComponent(decodedOrderNumber)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!isCancelled) {
          if (data && data.success && data.order) {
            syncNow();
          }
          setIsSyncing(false);
        }
      })
      .catch(() => {
        if (!isCancelled) setIsSyncing(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [liveOrder, slug, decodedOrderNumber, syncNow]);

  // Elapsed time counter
  useEffect(() => {
    if (!order) return;
    const updateTimes = () => {
      const created = new Date(order.createdAt).getTime();
      const mins = Math.max(0, Math.floor((Date.now() - created) / 60000));
      setElapsedMinutes(mins);
    };
    updateTimes();
    const interval = setInterval(updateTimes, 15000);
    return () => clearInterval(interval);
  }, [order]);

  // 4-Channel Synchronous Alert Trigger for Ready State
  useEffect(() => {
    if (!order) return;

    if (order.status === 'ready' && !hasUserSilenced) {
      setAlarmActive(true);

      // Channel 1: High-Decibel Looping Web Audio Chime (DynamicsCompressorNode boosted)
      soundManager.startReadyAlarmLoop(restaurant.chimeTheme || 'hospitality');

      // Channel 2: Intense Haptic Vibration Pattern
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([600, 150, 600, 150, 1000]);
        } catch {}
      }

      // Channel 3: System Web Push / Service Worker Notification
      pwaHelper.showSystemNotification(`طلبك #${order.orderNumber} جاهز للاستلام (${restaurant.name})`, {
        body: 'تفضل إلى الكاونتر لاستلام طلبك وهو طازج.',
      });

      // Confetti splash
      if (!confettiFiredRef.current) {
        confettiFiredRef.current = true;
        try {
          confetti({
            particleCount: 120,
            spread: 90,
            origin: { y: 0.6 },
            colors: [restaurant.themeColor || '#10B981', '#34D399', '#F59E0B', '#FFFFFF'],
          });
        } catch {}
      }
    } else if (order.status === 'completed') {
      soundManager.stopReadyAlarm();
      setAlarmActive(false);
    }
  }, [order?.status, hasUserSilenced, order?.orderNumber, restaurant.themeColor, restaurant.name, restaurant.chimeTheme]);

  // Channel 4: Dynamic Browser Tab Title Flashing while Ready
  useEffect(() => {
    if (!order || order.status !== 'ready' || hasUserSilenced) return;

    let flip = false;
    const originalTitle = document.title;
    const interval = setInterval(() => {
      document.title = flip
        ? `طلبك رقم #${order.orderNumber} جاهز!`
        : `توجه للكاونتر الآن`;
      flip = !flip;
    }, 1000);

    return () => {
      clearInterval(interval);
      document.title = originalTitle;
    };
  }, [order?.status, order?.orderNumber, hasUserSilenced]);

  // Repeating Intense Vibration loop while Ready
  useEffect(() => {
    if (!order || order.status !== 'ready' || hasUserSilenced) return;

    const vibeInterval = setInterval(() => {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([600, 150, 600, 150, 1000]);
        } catch {}
      }
    }, 3000);

    return () => {
      clearInterval(vibeInterval);
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(0);
        } catch {}
      }
    };
  }, [order?.status, hasUserSilenced]);

  useEffect(() => {
    if (!lastEvent || !order) return;
    if (
      lastEvent.type === 'ORDER_REPING' &&
      lastEvent.orderNumber === order.orderNumber &&
      lastEvent.restaurantSlug === slug
    ) {
      setHasUserSilenced(false);
      setAlarmActive(true);
      soundManager.startReadyAlarmLoop(restaurant.chimeTheme || 'hospitality');

      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([600, 150, 600, 150, 1000]);
        } catch {}
      }

      pwaHelper.showSystemNotification(`تذكير: طلبك #${order.orderNumber} جاهز للاستلام`, {
        body: `يرجى مراجعة كاونتر ${restaurant.name} لاستلام طلبك.`,
      });
    }
  }, [lastEvent, order, slug, restaurant.name, restaurant.chimeTheme]);

  useEffect(() => {
    return () => {
      soundManager.stopReadyAlarm();
    };
  }, []);

  const handleTestVolume = async () => {
    await soundManager.unlock();
    soundManager.playThemedChime(restaurant.chimeTheme || 'hospitality');
  };

  const handleIReceivedOrder = async () => {
    soundManager.stopReadyAlarm();
    setAlarmActive(false);
    setHasUserSilenced(true);
    if (order) {
      await completeOrder(order.id, slug);
    }
  };

  const handleSilenceAlarm = () => {
    soundManager.stopReadyAlarm();
    setAlarmActive(false);
    setHasUserSilenced(true);
  };

  // 1. Loading State while checking server bridge
  if (isSyncing) {
    return (
      <div className="min-h-screen bg-obsidian text-white flex flex-col items-center justify-center font-cairo p-4">
        <div className="w-14 h-14 rounded-full border-3 border-emerald-500 border-t-transparent animate-spin mb-4" />
        <h2 className="text-xl font-bold font-cairo">جارِ الاتصال بكاونتر {restaurant.name}...</h2>
        <p className="text-zinc-400 text-xs mt-2">نبحث عن الطلب #{decodedOrderNumber} لتجهيز جرس التنبيه</p>
      </div>
    );
  }

  // 2. Not Found Fallback (only if no live order and no URL params)
  if (!order) {
    return (
      <div className="min-h-screen bg-obsidian text-white flex flex-col font-cairo p-4">
        <header className="py-4">
          <Link
            href={`/${slug}/track`}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs font-semibold"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لإدخال رقم آخر في {restaurant.name}</span>
          </Link>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto text-center">
          <div className="w-16 h-16 rounded-3xl bg-zinc-800/80 border border-obsidian-border text-zinc-400 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold font-cairo">لم يتم العثور على الطلب #{decodedOrderNumber}</h2>
          <p className="text-zinc-400 text-sm mt-2 mb-6">
            قد يكون الرقم غير مسجل في {restaurant.name} أو تم تسليمه مسبقاً.
          </p>
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => syncNow()}
              className="w-full py-3 rounded-2xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-white font-bold text-xs flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة المحاولة والمزامنة</span>
            </button>
            <Link
              href={`/${slug}/track`}
              className="w-full py-3 rounded-2xl text-black font-extrabold text-sm transition-all shadow-lg text-center"
              style={{ backgroundColor: restaurant.themeColor || '#10B981' }}
            >
              إدخال رقم الطلب مجدداً
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isPreparing = order.status === 'preparing';
  const isReady = order.status === 'ready';
  const isCompleted = order.status === 'completed';

  const remainingMinutes = Math.max(0, order.estimatedMinutes - elapsedMinutes);
  const progressPercent = Math.min(
    100,
    Math.round((elapsedMinutes / Math.max(1, order.estimatedMinutes)) * 100)
  );

  return (
    <div
      className={`min-h-screen text-white flex flex-col font-cairo transition-colors duration-700 selection:bg-emerald-500 selection:text-black ${
        isReady
          ? 'bg-gradient-to-b from-emerald-950/70 via-obsidian to-emerald-950/40'
          : 'bg-obsidian'
      }`}
    >
      {/* Top Header */}
      <header className="border-b border-obsidian-border/70 bg-obsidian-surface/60 backdrop-blur-md px-4 py-3.5 sticky top-0 z-30">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href={`/${slug}/track`} className="flex items-center gap-2.5 group">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-black shadow-md border border-white/10 overflow-hidden"
              style={{ backgroundColor: `${restaurant.themeColor}25` }}
            >
              {restaurant.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Bell className="w-4 h-4" style={{ color: restaurant.themeColor }} />
              )}
            </div>
            <span className="font-extrabold text-sm tracking-tight text-white font-cairo">
              {restaurant.name}
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.05 }}
              onClick={handleTestVolume}
              className="text-[11px] text-zinc-300 hover:text-white bg-obsidian-card px-2.5 py-1 rounded-lg border border-obsidian-border flex items-center gap-1.5 transition-colors shadow-sm"
              title="تجربة مستوى الصوت"
            >
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">تجربة الصوت</span>
            </motion.button>
            <span className="text-xs text-zinc-400 font-mono tabular-nums">طلب #{order.orderNumber}</span>
            <Link
              href={`/${slug}/track`}
              className="text-xs text-zinc-400 hover:text-white bg-obsidian-card px-2.5 py-1 rounded-lg border border-obsidian-border transition-colors"
            >
              تغيير
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 sm:p-6 flex flex-col justify-between space-y-4">
        {/* Triple Keep Awake & Notification activator */}
        <KeepAwakeEngine
          orderNumber={order.orderNumber}
          restaurantName={restaurant.name}
          onSubscriptionObtained={(sub) => {
            registerPushSubscription(order.orderNumber, sub, slug);
          }}
        />

        {/* 1. PREPARING STATE */}
        {isPreparing && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
            {/* Breathing Radial Ring */}
            <motion.div
              animate={{ scale: [1, 1.025, 1] }}
              transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
              className="relative mb-6"
            >
              <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-full border-4 border-obsidian-border flex items-center justify-center relative shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="transparent"
                    stroke="#1E1E24"
                    strokeWidth="6"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="transparent"
                    stroke={restaurant.themeColor || '#10B981'}
                    strokeWidth="6"
                    strokeDasharray={276}
                    strokeDashoffset={276 - (276 * progressPercent) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[11px] text-zinc-400 font-semibold mb-0.5">الوقت المتبقي التقديري</span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono tabular-nums text-5xl sm:text-6xl font-black text-white">
                      {remainingMinutes}
                    </span>
                    <span className="text-xs text-zinc-400 font-bold">دقيقة</span>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono tabular-nums mt-1">
                    #{order.orderNumber}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* 3-Step Live Order Pipeline Indicators */}
            <div className="w-full bg-[#121216] border border-white/[0.08] rounded-2xl p-4 mb-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between relative">
                {/* Connecting lines */}
                <div className="absolute top-4 inset-x-8 h-0.5 bg-zinc-800 -z-0">
                  <div className="w-1/2 h-full bg-emerald-500 transition-all duration-500" />
                </div>

                {/* Step 1: Received */}
                <div className="flex flex-col items-center relative z-10 gap-1.5 flex-1">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center shadow-sm">
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <span className="text-[10px] font-semibold text-zinc-300">تم استلام الطلب</span>
                </div>

                {/* Step 2: Preparing in kitchen */}
                <div className="flex flex-col items-center relative z-10 gap-1.5 flex-1">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 border-2 border-amber-400 text-amber-300 flex items-center justify-center shadow-sm animate-pulse">
                    <Utensils className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-bold text-amber-300">يُحضّر في المطبخ</span>
                </div>

                {/* Step 3: Ready */}
                <div className="flex flex-col items-center relative z-10 gap-1.5 flex-1">
                  <div className="w-8 h-8 rounded-full bg-zinc-900 border-2 border-zinc-700 text-zinc-500 flex items-center justify-center shadow-sm">
                    <BellRing className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-semibold text-zinc-500">جاهز للاستلام</span>
                </div>
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white font-cairo mb-2 flex items-center justify-center gap-2">
              <span>طلبك قيد التحضير بعناية</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-xs mx-auto mb-4 leading-relaxed">
              يرجى إبقاء هذه الصفحة مفتوحة. سيرن هاتفك ويهتز بأعلى صوت فور جاهزية الوجبة!
            </p>

            {order.notes && (
              <div className="w-full bg-obsidian-surface border border-obsidian-border rounded-2xl p-3 text-right">
                <span className="text-[11px] text-zinc-400 font-bold block mb-1">ملاحظات طلبك:</span>
                <p className="text-xs text-zinc-200">{order.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* 2. READY FOR PICKUP STATE: Full-Screen Morph with Animated Ringing Bell */}
        {isReady && (
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="flex-1 flex flex-col items-center justify-center text-center py-4"
          >
            {alarmActive && (
              <div className="mb-4 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold animate-pulse">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>جرس التنبيه يرن الآن...</span>
                <button
                  onClick={handleSilenceAlarm}
                  className="mr-2 underline hover:text-white text-[11px] cursor-pointer"
                >
                  كتم الصوت
                </button>
              </div>
            )}

            <div className="relative mb-6">
              <div
                className="w-44 h-44 sm:w-52 sm:h-52 rounded-3xl text-black flex flex-col items-center justify-center shadow-2xl border-2 border-white/20 relative overflow-hidden"
                style={{ backgroundColor: restaurant.themeColor || '#10B981' }}
              >
                {/* Animated Ringing Bell Vector Icon */}
                <motion.div
                  animate={{ rotate: [-14, 14, -10, 10, -5, 5, 0] }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                  className="w-14 h-14 rounded-2xl bg-black/15 flex items-center justify-center mb-1"
                >
                  <BellRing className="w-8 h-8 text-black" strokeWidth={2.2} />
                </motion.div>

                <span className="text-xs font-bold uppercase tracking-wider text-black/75">
                  طلب رقم
                </span>
                <span className="font-mono tabular-nums text-5xl sm:text-6xl font-black tracking-tight text-black">
                  #{order.orderNumber}
                </span>
                <span className="text-[11px] font-bold mt-1 bg-black/15 px-3 py-0.5 rounded-full text-black">
                  جاهز للاستلام
                </span>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-emerald-400 font-cairo tracking-tight mb-2">
              طلبك جاهز للاستلام الآن
            </h1>
            <p className="text-sm sm:text-base text-zinc-300 max-w-xs mx-auto mb-6 leading-relaxed">
              تفضل بالتوجه إلى كاونتر <strong className="text-white">{restaurant.name}</strong> واستلم وجبتك ساخنة وطازجة.
            </p>

            <motion.button
              whileTap={{ scale: 0.94 }}
              whileHover={{ scale: 1.01 }}
              onClick={handleIReceivedOrder}
              className="w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-base flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 transition-all cursor-pointer"
            >
              <Check className="w-6 h-6 stroke-[3]" />
              <span>استلمت طلبي بنجاح</span>
            </motion.button>
          </motion.div>
        )}

        {/* 3. COMPLETED STATE & 5-STAR RATING */}
        {isCompleted && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mb-4 shadow-xl">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white font-cairo mb-2">
              بالعافية، نتمنى لك وجبة شهية
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-xs mx-auto mb-6">
              تم تسليم الطلب #{order.orderNumber} بنجاح. يسعدنا تقييمك لتجربتك في {restaurant.name}.
            </p>

            {/* Interactive 5-Star Feedback Form */}
            {!feedbackSent ? (
              <div className="w-full bg-obsidian-surface border border-obsidian-border rounded-3xl p-5 mb-5 shadow-2xl">
                <span className="text-xs font-bold text-zinc-300 block mb-3">كيف كانت تجربتك اليوم؟</span>
                <div className="flex items-center justify-center gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      className="p-1 hover:scale-110 active:scale-95 transition-transform"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          s <= rating
                            ? 'text-buzly-amber fill-buzly-amber'
                            : 'text-zinc-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5 justify-center mb-4">
                  {['خدمة سريعة', 'الأكل ساخن وطازج', 'طاقم عمل متميز', 'تنبيه البيجر دقيق'].map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setSelectedTags((prev) =>
                            isSelected ? prev.filter((t) => t !== tag) : [...prev, tag]
                          );
                        }}
                        className={`text-[11px] px-3 py-1.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                            : 'bg-obsidian-card text-zinc-400 border-obsidian-border hover:text-white'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    await submitOrderFeedback(
                      order.id,
                      {
                        rating,
                        tags: selectedTags,
                        submittedAt: new Date().toISOString(),
                      },
                      slug
                    );
                    setFeedbackSent(true);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-black flex items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer"
                  style={{ backgroundColor: restaurant.themeColor || '#10B981' }}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال التقييم</span>
                </button>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 mb-5 text-emerald-400 text-xs font-bold animate-fade-in">
                شكراً جزيلاً لتقييمك. رأيك يساعدنا على الارتقاء بالخدمة دائماً.
              </div>
            )}

            <Link
              href={`/${slug}/track`}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-xs font-bold text-white transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>تتبع طلب آخر</span>
            </Link>
          </div>
        )}

        {/* Footer Real-Time Connection Indicator */}
        <div className="pt-4 border-t border-obsidian-border/80 flex items-center justify-between text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            المزامنة الفورية نشطة ({restaurant.slug})
          </span>
          <span className="font-mono">Buzly v3.1</span>
        </div>
      </main>

      {/* Floating Audio & Vibration Unlock Guard */}
      <AudioUnlockOverlay
        isVisible={showAudioUnlockOverlay}
        onUnlock={handleExplicitUnlock}
      />
    </div>
  );
}

export default function TenantCustomerTrackerPage() {
  return (
    <ErrorBoundary fallbackTitle="تعذر تحميل شاشة تتبع الطلب">
      <Suspense
        fallback={
          <div className="min-h-screen bg-obsidian text-white flex flex-col items-center justify-center font-cairo">
            <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-3" />
            <p className="text-zinc-500 text-xs">تحميل شاشة التتبع...</p>
          </div>
        }
      >
        <TenantCustomerTrackerInner />
      </Suspense>
    </ErrorBoundary>
  );
}
