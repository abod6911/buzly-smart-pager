'use client';

import React, { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueue } from '@/context/QueueContext';
import { soundManager } from '@/lib/audio';
import { pwaHelper } from '@/lib/pwa-helper';
import { Order, OrderStatus } from '@/types/queue';
import {
  Bell,
  CheckCircle2,
  Clock,
  VolumeX,
  Volume2,
  ArrowRight,
  RotateCcw,
  Star,
  Send,
  Utensils,
  Receipt,
  Check,
} from 'lucide-react';

function TenantCustomerTrackerInner() {
  const params = useParams();
  const searchParams = useSearchParams();

  // Safe Next.js 14/15 parameter unwrap
  const slug = (Array.isArray(params?.slug) ? params.slug[0] : params?.slug) || 'demo-cafe';
  const rawOrderNumber = (Array.isArray(params?.orderNumber) ? params.orderNumber[0] : params?.orderNumber) || '';
  const decodedOrderNumber = decodeURIComponent(String(rawOrderNumber)).trim();

  const {
    getRestaurant,
    getOrder,
    completeOrder,
    submitOrderFeedback,
    lastEvent,
    syncNow,
  } = useQueue();

  const restaurant = getRestaurant(slug);
  const liveOrder = getOrder(decodedOrderNumber, slug);

  // Self-healing fallback ticket: Customer NEVER sees an empty screen or error boundary
  const fallbackOrder = useMemo((): Order => {
    if (liveOrder) return liveOrder;
    const estParam = searchParams?.get('est');
    const statusParam = (searchParams?.get('status') as OrderStatus) || 'preparing';
    return {
      id: `ticket-${decodedOrderNumber}`,
      orderNumber: decodedOrderNumber || '1',
      restaurantSlug: slug,
      restaurant_slug: slug,
      status: statusParam,
      estimatedMinutes: parseInt(estParam || '10', 10) || 10,
      notes: searchParams?.get('notes') || undefined,
      createdAt: searchParams?.get('created') || new Date().toISOString(),
      rePingCount: 0,
    };
  }, [liveOrder, searchParams, decodedOrderNumber, slug]);

  const order = liveOrder || fallbackOrder;

  // Local state
  const [isAudioUnlocked, setIsAudioUnlocked] = useState<boolean>(false);
  const [alarmActive, setAlarmActive] = useState<boolean>(false);
  const [hasUserSilenced, setHasUserSilenced] = useState<boolean>(false);
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);
  const [rating, setRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedbackSent, setFeedbackSent] = useState<boolean>(false);
  const confettiFiredRef = useRef<boolean>(false);

  // 1. Silent iOS Audio & Vibration unlock check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsAudioUnlocked(soundManager.isAudioUnlocked());
    }

    const unlockSilently = async () => {
      await soundManager.unlock();
      soundManager.startSilentKeepAlive();
      setIsAudioUnlocked(true);
      pwaHelper.requestNotificationPermission().catch(() => {});
    };

    window.addEventListener('pointerdown', unlockSilently, { once: true });
    window.addEventListener('touchstart', unlockSilently, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlockSilently);
      window.removeEventListener('touchstart', unlockSilently);
    };
  }, []);

  // 2. Targeted Single Customer Order Fetch (O(1) payload)
  useEffect(() => {
    if (liveOrder || !decodedOrderNumber) return;

    let isCancelled = false;
    fetch(`/api/orders?slug=${encodeURIComponent(slug)}&orderNumber=${encodeURIComponent(decodedOrderNumber)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!isCancelled && data && data.success && data.order) {
          syncNow();
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [liveOrder, slug, decodedOrderNumber, syncNow]);

  // 3. Background Reconnection Recovery on visibilitychange
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleReconnection = () => {
      if (document.visibilityState === 'visible') {
        syncNow();
        soundManager.unlock().catch(() => {});
        soundManager.startSilentKeepAlive();

        if (order?.status === 'ready' && !hasUserSilenced) {
          setAlarmActive(true);
          soundManager.startReadyAlarmLoop(restaurant?.chimeTheme || 'hospitality');
          soundManager.triggerHaptic([600, 150, 600, 150, 1000]);
        }
      }
    };

    document.addEventListener('visibilitychange', handleReconnection);
    window.addEventListener('focus', handleReconnection);

    return () => {
      document.removeEventListener('visibilitychange', handleReconnection);
      window.removeEventListener('focus', handleReconnection);
    };
  }, [order?.status, hasUserSilenced, restaurant?.chimeTheme, syncNow]);

  // 4. Elapsed time calculator
  useEffect(() => {
    if (!order) return;
    const updateTimes = () => {
      const created = new Date(order.createdAt || order.created_at || Date.now()).getTime();
      const mins = Math.max(0, Math.floor((Date.now() - created) / 60000));
      setElapsedMinutes(mins);
    };
    updateTimes();
    const interval = setInterval(updateTimes, 15000);
    return () => clearInterval(interval);
  }, [order?.createdAt, order?.created_at, order]);

  // 5. 4-Channel Ready Trigger (Audio Chime, Haptic Vibration, Web Push, Confetti)
  useEffect(() => {
    if (!order) return;

    if (order.status === 'ready' && !hasUserSilenced) {
      setAlarmActive(true);

      // Channel 1: High-Decibel Looping Web Audio Chime
      soundManager.startReadyAlarmLoop(restaurant?.chimeTheme || 'hospitality');

      // Channel 2: Safe Haptic Vibration (Guarded for iOS Safari)
      soundManager.triggerHaptic([600, 150, 600, 150, 1000]);

      // Channel 3: System Web Push Notification
      pwaHelper.showSystemNotification(`طلبك #${order.orderNumber} جاهز للاستلام (${restaurant?.name || slug})`, {
        body: 'تفضل إلى الكاونتر لاستلام طلبك وهو طازج.',
      });

      // Confetti celebratory splash
      if (!confettiFiredRef.current) {
        confettiFiredRef.current = true;
        try {
          confetti({
            particleCount: 100,
            spread: 80,
            origin: { y: 0.55 },
            colors: ['#10B981', '#34D399', '#F59E0B', '#FFFFFF'],
          });
        } catch {}
      }
    } else if (order.status === 'completed') {
      soundManager.stopReadyAlarm();
      soundManager.stopHaptic();
      setAlarmActive(false);
    }
  }, [order?.status, hasUserSilenced, order?.orderNumber, restaurant?.name, restaurant?.chimeTheme, slug, order]);

  // 6. Dynamic Browser Tab Title Flashing while Ready
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
  }, [order?.status, order?.orderNumber, hasUserSilenced, order]);

  // 7. Repeating Safe Vibration Loop while Ready
  useEffect(() => {
    if (!order || order.status !== 'ready' || hasUserSilenced) return;

    const vibeInterval = setInterval(() => {
      soundManager.triggerHaptic([600, 150, 600, 150, 1000]);
    }, 3500);

    return () => {
      clearInterval(vibeInterval);
      soundManager.stopHaptic();
    };
  }, [order?.status, hasUserSilenced, order]);

  // 8. Re-Ping Event Listener
  useEffect(() => {
    if (!lastEvent || !order) return;
    if (
      lastEvent.type === 'ORDER_REPING' &&
      lastEvent.orderNumber === order.orderNumber &&
      (lastEvent.restaurantSlug || '').toLowerCase() === slug.toLowerCase()
    ) {
      setHasUserSilenced(false);
      setAlarmActive(true);
      soundManager.startReadyAlarmLoop(restaurant?.chimeTheme || 'hospitality');
      soundManager.triggerHaptic([600, 150, 600, 150, 1000]);

      pwaHelper.showSystemNotification(`تذكير: طلبك #${order.orderNumber} جاهز للاستلام`, {
        body: `يرجى مراجعة كاونتر ${restaurant?.name || slug} لاستلام طلبك.`,
      });
    }
  }, [lastEvent, order?.orderNumber, slug, restaurant?.name, restaurant?.chimeTheme, order]);

  // 9. Cleanup on Unmount
  useEffect(() => {
    return () => {
      soundManager.stopReadyAlarm();
      soundManager.stopHaptic();
    };
  }, []);

  const handleExplicitUnlock = async () => {
    await soundManager.unlock();
    soundManager.startSilentKeepAlive();
    setIsAudioUnlocked(true);
    soundManager.playThemedChime(restaurant?.chimeTheme || 'hospitality');
    pwaHelper.requestNotificationPermission().catch(() => {});
  };

  const handleIReceivedOrder = async () => {
    soundManager.stopReadyAlarm();
    soundManager.stopHaptic();
    setAlarmActive(false);
    setHasUserSilenced(true);
    if (order?.id) {
      await completeOrder(order.id, slug);
    }
  };

  const isPreparing = order.status === 'preparing';
  const isReady = order.status === 'ready';
  const isCompleted = order.status === 'completed';

  const estMinutes = order.estimatedMinutes || 10;
  const remainingMinutes = Math.max(0, estMinutes - elapsedMinutes);
  const progressPercent = Math.min(100, Math.round((elapsedMinutes / Math.max(1, estMinutes)) * 100));

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-between p-4 sm:p-6 font-sans select-none relative overflow-x-hidden selection:bg-emerald-500 selection:text-black">
      {/* Ambient Spotlight Background */}
      <div
        className={`fixed inset-0 pointer-events-none transition-opacity duration-1000 ${
          isReady
            ? 'opacity-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/25 via-emerald-950/20 to-transparent'
            : 'opacity-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent'
        }`}
      />

      {/* Top Header / Live Navigation Bar */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between z-10 py-2">
        <Link
          href={`/${slug}/track`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-400 hover:text-white text-xs font-medium transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>طلب آخر</span>
        </Link>

        {/* Live Pulse Pill */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-medium text-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>متصل لحظياً</span>
        </div>

        {/* Audio Status Quick Icon */}
        <button
          onClick={handleExplicitUnlock}
          className="p-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-400 hover:text-white transition-colors cursor-pointer"
          title="فحص الصوت"
        >
          {isAudioUnlocked ? (
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
          )}
        </button>
      </header>

      {/* Main Luxury Apple Wallet Boarding Pass */}
      <main className="max-w-md w-full mx-auto my-auto z-10 py-3">
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={`rounded-3xl relative overflow-hidden transition-all duration-700 ${
            isReady
              ? 'bg-gradient-to-b from-[#092B1C] via-[#0A2218] to-[#0A1713] border-2 border-emerald-400/60 shadow-[0_0_60px_rgba(16,185,129,0.25)]'
              : 'bg-[#111115] border border-white/[0.1] shadow-2xl'
          }`}
        >
          {/* Perforated Notches on edges */}
          <div className="absolute top-[48%] -left-3.5 w-7 h-7 rounded-full bg-[#070709] border border-white/[0.08] z-20 pointer-events-none" />
          <div className="absolute top-[48%] -right-3.5 w-7 h-7 rounded-full bg-[#070709] border border-white/[0.08] z-20 pointer-events-none" />

          {/* Upper Ticket Section */}
          <div className="p-6 pb-4">
            {/* Restaurant Brand Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl overflow-hidden border border-white/10 bg-[#18181E] flex items-center justify-center shadow-md shrink-0">
                  {restaurant?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={restaurant.logoUrl}
                      alt={restaurant.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center font-bold text-base text-white"
                      style={{ backgroundColor: restaurant?.themeColor || '#10B981' }}
                    >
                      {restaurant?.name ? restaurant.name.charAt(0).toUpperCase() : <Utensils className="w-5 h-5 text-white" />}
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="text-base font-bold text-white tracking-tight">
                    {restaurant?.name || slug}
                  </h1>
                  <span className="text-[11px] font-mono text-zinc-400">
                    رقم الإشعار الإلكتروني
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                  isReady
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : isCompleted
                    ? 'bg-zinc-800 text-zinc-300 border-white/10'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                {isReady ? 'جاهز للاستلام' : isCompleted ? 'تم الاستلام' : 'قيد التحضير'}
              </div>
            </div>

            {/* Hero Order Number Glass Card */}
            <div className="bg-[#0A0A0E]/80 backdrop-blur-md rounded-2xl p-6 text-center border border-white/[0.06] shadow-inner relative overflow-hidden">
              <span className="text-[11px] font-mono font-medium tracking-widest text-zinc-500 uppercase block mb-1">
                رقم الطلب
              </span>

              <div className="text-7xl sm:text-8xl font-black font-mono tracking-tight tabular-nums text-white dir-ltr my-1 drop-shadow-md">
                #{decodedOrderNumber}
              </div>

              {/* Sub-status line */}
              {isPreparing && (
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-amber-300/90 mt-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>الوقت المتوقع للتحضير: قرابة {remainingMinutes} دقيقة</span>
                </div>
              )}

              {isReady && (
                <div className="flex items-center justify-center gap-1.5 text-sm font-bold text-emerald-300 mt-2 animate-pulse">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>تفضل إلى الكاونتر لاستلام طلبك الآن</span>
                </div>
              )}

              {isCompleted && (
                <div className="text-xs text-zinc-400 mt-2">
                  تم تسليم هذا الطلب بنجاح. بالعافية!
                </div>
              )}
            </div>
          </div>

          {/* Perforated Dashed Divider */}
          <div className="relative flex items-center px-6">
            <div className="w-full border-b border-dashed border-white/[0.12]" />
          </div>

          {/* Lower Ticket Section */}
          <div className="p-6 pt-5 space-y-5">
            {/* Apple 3-Step Segmented Progress Stepper */}
            <div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {/* Step 1: Confirmed */}
                <div className="h-1.5 rounded-full bg-emerald-500 transition-all shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                {/* Step 2: Preparing */}
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    isPreparing
                      ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                      : isReady || isCompleted
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                      : 'bg-zinc-800'
                  }`}
                />
                {/* Step 3: Ready */}
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    isReady
                      ? 'bg-emerald-400 animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.8)]'
                      : isCompleted
                      ? 'bg-emerald-500'
                      : 'bg-zinc-800'
                  }`}
                />
              </div>

              {/* Step Labels */}
              <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                <span className="text-emerald-400">تأكيد الطلب</span>
                <span className={isPreparing ? 'text-amber-300 font-bold' : isReady || isCompleted ? 'text-emerald-400' : 'text-zinc-600'}>
                  قيد التحضير
                </span>
                <span className={isReady ? 'text-emerald-300 font-bold' : isCompleted ? 'text-emerald-400' : 'text-zinc-600'}>
                  جاهز للاستلام
                </span>
              </div>
            </div>

            {/* Smart Interactive Alert Pill */}
            {!isCompleted && (
              <div>
                {isAudioUnlocked ? (
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                      <span>جرس التنبيه والاهتزاز مفعّل</span>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      مفعّل
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handleExplicitUnlock}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <VolumeX className="w-4 h-4 text-emerald-400" />
                      <span>تفعيل الرنين والاهتزاز عند الجاهزية</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-300 underline">
                      اضغط للتفعيل
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* Big Action Button when Ready */}
            {isReady && (
              <motion.button
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleIReceivedOrder}
                className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-base transition-all shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                <span>استلمت طلبي — إيقاف الرنين</span>
              </motion.button>
            )}

            {/* Completed State: Review and Feedback */}
            {isCompleted && (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center space-y-3">
                  <p className="text-xs font-semibold text-zinc-300">
                    كيف كانت تجربتك مع طلبك اليوم؟
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className="p-1 transition-transform hover:scale-110 cursor-pointer"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= rating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-zinc-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  {!feedbackSent ? (
                    <button
                      onClick={() => {
                        if (order?.id) {
                          submitOrderFeedback(order.id, {
                            rating,
                            tags: selectedTags,
                            submittedAt: new Date().toISOString(),
                          }, slug);
                        }
                        setFeedbackSent(true);
                      }}
                      className="px-6 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-bold text-white border border-white/[0.08] transition-colors cursor-pointer"
                    >
                      إرسال التقييم
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold">
                      <Check className="w-4 h-4" />
                      <span>شكراً لمشاركتك تقييمك!</span>
                    </div>
                  )}
                </div>

                <Link
                  href={`/${slug}/track`}
                  className="block w-full py-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-center text-xs font-bold text-white transition-all"
                >
                  تتبع طلب جديد
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      </main>

      {/* Ticket Footer Metadata */}
      <footer className="max-w-md w-full mx-auto text-center z-10 py-2">
        <p className="text-[11px] text-zinc-600 font-mono">
          Buzly Smart Pager • {slug}
        </p>
      </footer>
    </div>
  );
}

// Self-healing customer wrapper: NEVER crashes or throws into a destructive error screen
export default function TenantCustomerTrackerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center font-sans p-4">
          <div className="w-12 h-12 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-4" />
          <p className="text-zinc-400 text-xs font-mono">جارِ تجهيز تذكرة الطلب...</p>
        </div>
      }
    >
      <TenantCustomerTrackerInner />
    </Suspense>
  );
}
