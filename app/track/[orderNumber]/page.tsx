'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueue } from '@/context/QueueContext';
import { ActivationBanner } from '@/components/ActivationBanner';
import { soundManager } from '@/lib/audio';
import { pwaHelper } from '@/lib/pwa-helper';
import {
  Bell,
  CheckCircle2,
  Clock,
  Sparkles,
  VolumeX,
  Volume2,
  ArrowRight,
  ShieldAlert,
  Flame,
  Check,
  RotateCcw,
} from 'lucide-react';

export default function CustomerOrderTrackerPage() {
  const params = useParams();
  const router = useRouter();
  const rawOrderNumber = params.orderNumber as string;
  const decodedOrderNumber = decodeURIComponent(rawOrderNumber || '').trim();

  const { orders, lastEvent, completeOrder, isSupabaseActive } = useQueue();

  // Find order in queue
  const order = useMemo(() => {
    return orders.find(
      (o) => o.orderNumber.toLowerCase() === decodedOrderNumber.toLowerCase()
    );
  }, [orders, decodedOrderNumber]);

  const [alarmActive, setAlarmActive] = useState<boolean>(false);
  const [hasUserSilenced, setHasUserSilenced] = useState<boolean>(false);
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);
  const confettiFiredRef = useRef<boolean>(false);

  // Calculate elapsed time from creation
  useEffect(() => {
    if (!order) return;

    const updateTimes = () => {
      const created = new Date(order.createdAt).getTime();
      const now = Date.now();
      const mins = Math.max(0, Math.floor((now - created) / 60000));
      setElapsedMinutes(mins);
    };

    updateTimes();
    const interval = setInterval(updateTimes, 15000);
    return () => clearInterval(interval);
  }, [order]);

  // Handle Real-Time Ready & Re-Ping triggers
  useEffect(() => {
    if (!order) return;

    if (order.status === 'ready' && !hasUserSilenced) {
      setAlarmActive(true);
      soundManager.startReadyAlarmLoop();

      // Trigger Confetti Celebration once per ready state
      if (!confettiFiredRef.current) {
        confettiFiredRef.current = true;
        try {
          confetti({
            particleCount: 120,
            spread: 90,
            origin: { y: 0.6 },
            colors: ['#10B981', '#34D399', '#F59E0B', '#FFFFFF'],
          });
        } catch {
          // Safe fallback
        }
      }

      // Trigger Browser System Notification if allowed
      pwaHelper.showSystemNotification(`طلبك #${order.orderNumber} جاهز للاستلام! 🍔`, {
        body: 'توجه إلى الكاونتر لاستلام وجبتك وهي ساخنة ولذيذة.',
      });
    } else if (order.status === 'completed') {
      soundManager.stopReadyAlarm();
      setAlarmActive(false);
    }
  }, [order?.status, hasUserSilenced, order?.orderNumber]);

  // Reactive listener for re-ping from cashier
  useEffect(() => {
    if (!lastEvent || !order) return;

    if (
      lastEvent.type === 'ORDER_REPING' &&
      lastEvent.orderNumber === order.orderNumber
    ) {
      // Re-trigger chime & vibration
      setHasUserSilenced(false);
      setAlarmActive(true);
      soundManager.startReadyAlarmLoop();

      pwaHelper.showSystemNotification(`تذكير: طلبك #${order.orderNumber} بانتظارك! 🔔`, {
        body: 'يرجى مراجعة الكاونتر لاستلام طلبك.',
      });
    }
  }, [lastEvent, order]);

  // Stop alarm on unmount
  useEffect(() => {
    return () => {
      soundManager.stopReadyAlarm();
    };
  }, []);

  // Customer acknowledges "I got my order"
  const handleIReceivedOrder = async () => {
    soundManager.stopReadyAlarm();
    setAlarmActive(false);
    setHasUserSilenced(true);

    if (order) {
      await completeOrder(order.id);
    }
  };

  // Silence buzzer sound without completing
  const handleSilenceAlarm = () => {
    soundManager.stopReadyAlarm();
    setAlarmActive(false);
    setHasUserSilenced(true);
  };

  // If order is not found
  if (!order) {
    return (
      <div className="min-h-screen bg-obsidian text-white flex flex-col font-cairo p-4">
        <header className="py-4">
          <Link
            href="/track"
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs font-semibold"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لإدخال رقم آخر</span>
          </Link>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto text-center">
          <div className="w-16 h-16 rounded-3xl bg-zinc-800/80 border border-obsidian-border text-zinc-400 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold font-cairo">لم يتم العثور على الطلب #{decodedOrderNumber}</h2>
          <p className="text-zinc-400 text-sm mt-2 mb-6">
            قد يكون الرقم غير مسجل أو تم تسليمه مسبقاً. يرجى التأكد من الرقم المسجل في الفاتورة.
          </p>
          <Link
            href="/track"
            className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm transition-all shadow-lg shadow-emerald-500/20"
          >
            إدخال رقم الطلب مجدداً
          </Link>
        </main>
      </div>
    );
  }

  const isPreparing = order.status === 'preparing';
  const isReady = order.status === 'ready';
  const isCompleted = order.status === 'completed';

  // Calculate remaining minutes
  const remainingMinutes = Math.max(0, order.estimatedMinutes - elapsedMinutes);
  const progressPercent = Math.min(
    100,
    Math.round((elapsedMinutes / Math.max(1, order.estimatedMinutes)) * 100)
  );

  return (
    <div
      className={`min-h-screen text-white flex flex-col font-cairo transition-colors duration-700 selection:bg-emerald-500 selection:text-black ${
        isReady
          ? 'bg-gradient-to-b from-emerald-950 via-obsidian to-emerald-950 animate-pulse-glow-emerald'
          : 'bg-obsidian'
      }`}
    >
      {/* Top Header */}
      <header className="border-b border-obsidian-border/70 bg-obsidian-surface/60 backdrop-blur-md px-4 py-3.5 sticky top-0 z-30">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href="/track" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-black font-black shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Bell className="w-4 h-4 text-black" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-white font-mono">
              BUZLY
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-mono">طلب #{order.orderNumber}</span>
            <Link
              href="/track"
              className="text-xs text-zinc-400 hover:text-white bg-obsidian-card px-2.5 py-1 rounded-lg border border-obsidian-border transition-colors"
            >
              تغيير
            </Link>
          </div>
        </div>
      </header>

      {/* Main Tracker Container */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 sm:p-6 flex flex-col justify-between">
        {/* Activation Banner (Always visible until unlocked) */}
        <div className="mb-4">
          <ActivationBanner />
        </div>

        {/* ========================================================================= */}
        {/* STATE 1: READY (FULL-SCREEN ALERT BUZZER MODE) */}
        {/* ========================================================================= */}
        {isReady && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 20 }}
            className="flex-1 flex flex-col items-center justify-center text-center py-4"
          >
            {/* Alarm Silencing Pill */}
            {alarmActive && (
              <div className="mb-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold animate-bounce-subtle">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>الجرس يرن الآن لتنبيهك...</span>
                <button
                  onClick={handleSilenceAlarm}
                  className="mr-2 underline hover:text-white text-[11px]"
                >
                  كتم الصوت
                </button>
              </div>
            )}

            {/* Giant Pulsing Buzzer Ring */}
            <div className="relative mb-6">
              <div className="absolute -inset-4 bg-emerald-500/30 rounded-full blur-2xl animate-pulse" />
              <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-emerald-500 text-black flex flex-col items-center justify-center shadow-2xl shadow-emerald-500/50 border-4 border-emerald-300 animate-pulse-glow-emerald">
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-black/70">
                  طلب رقم
                </span>
                <span className="font-mono text-5xl sm:text-6xl font-black tracking-tight text-black">
                  #{order.orderNumber}
                </span>
                <span className="text-[11px] font-bold mt-1 bg-black/15 px-2.5 py-0.5 rounded-full text-black">
                  جاهز للاستلام 🔔
                </span>
              </div>
            </div>

            {/* High-Impact Announcement */}
            <h1 className="text-3xl sm:text-4xl font-black text-emerald-400 font-cairo tracking-tight mb-2">
              طلبك جاهز الآن! 🍔
            </h1>
            <p className="text-sm sm:text-base text-zinc-200 max-w-xs mx-auto mb-6 leading-relaxed">
              تفضل بالتوجه إلى الكاونتر لإبراز رقمك واستلام وجبتك ساخنة وطازجة.
            </p>

            {/* One-Tap Action: "I got my order" */}
            <div className="w-full space-y-3">
              <button
                onClick={handleIReceivedOrder}
                className="w-full py-4 px-6 rounded-2xl bg-emerald-400 hover:bg-emerald-300 active:scale-95 text-black font-extrabold text-base flex items-center justify-center gap-2 shadow-2xl shadow-emerald-400/30 transition-all cursor-pointer"
              >
                <Check className="w-6 h-6 stroke-[3]" />
                <span>استلمت طلبي (إيقاف الجرس)</span>
              </button>

              {alarmActive && (
                <button
                  onClick={handleSilenceAlarm}
                  className="w-full py-3 px-4 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-zinc-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-obsidian-border"
                >
                  <VolumeX className="w-4 h-4" />
                  <span>إسكات صوت الجرس فقط</span>
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ========================================================================= */}
        {/* STATE 2: PREPARING (RADAR / PULSE COUNTDOWN RING) */}
        {/* ========================================================================= */}
        {isPreparing && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
            {/* Pulsing Preparation Ring */}
            <div className="relative mb-6">
              {/* Radar pulse ripples */}
              <div className="absolute -inset-6 bg-buzly-amber/15 rounded-full blur-2xl animate-pulse" />

              <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-obsidian-surface border-4 border-buzly-amber/40 flex flex-col items-center justify-center relative shadow-2xl shadow-buzly-amber/10 animate-pulse-glow-amber">
                {/* SVG Progress Ring */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="44%"
                    className="stroke-obsidian-border fill-none"
                    strokeWidth="6"
                  />
                  <circle
                    cx="50%"
                    cy="50%"
                    r="44%"
                    className="stroke-buzly-amber fill-none transition-all duration-1000 ease-out"
                    strokeWidth="6"
                    strokeDasharray={276}
                    strokeDashoffset={276 - (276 * progressPercent) / 100}
                    strokeLinecap="round"
                  />
                </svg>

                <div className="relative z-10 flex flex-col items-center">
                  <span className="text-[11px] font-bold text-zinc-400">طلبك رقم</span>
                  <span className="font-mono text-4xl sm:text-5xl font-extrabold text-white">
                    #{order.orderNumber}
                  </span>
                  <div className="flex items-center gap-1 text-buzly-amber text-xs font-bold mt-1">
                    <Flame className="w-3.5 h-3.5 animate-pulse" />
                    <span>يُحضّر الآن</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ETA Countdown Display */}
            <div className="bg-obsidian-card border border-buzly-amber/30 rounded-2xl px-5 py-3 mb-4 inline-flex items-center gap-3 shadow-lg">
              <Clock className="w-5 h-5 text-buzly-amber" />
              <div className="text-right">
                <span className="text-[11px] text-zinc-400 block">الوقت المتبقي التقديري</span>
                <span className="font-bold text-base text-buzly-amber font-mono">
                  {remainingMinutes > 0 ? `قرابة ${remainingMinutes} دقيقة` : 'لحظات ويجهز...'}
                </span>
              </div>
            </div>

            {/* Reassuring Arabic Copy */}
            <h2 className="text-xl sm:text-2xl font-black text-white font-cairo mb-2">
              طلبك يُحضّر بحب وإتقان ✨
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-xs mx-auto leading-relaxed">
              خذ راحتك ولا داعي للانتظار أمام الكاونتر.. سيرن هاتفك تلقائياً فور جاهزية طلبك.
            </p>

            {order.notes && (
              <div className="mt-4 p-3 rounded-xl bg-obsidian-card border border-obsidian-border text-xs text-zinc-300 max-w-xs text-right">
                <span className="text-zinc-500 font-bold ml-1">الأصناف:</span>
                {order.notes}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STATE 3: COMPLETED (THANK YOU) */}
        {/* ========================================================================= */}
        {isCompleted && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mb-4 shadow-xl">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-cairo mb-2">
              بالعافية مقدماً! 💚
            </h2>
            <p className="text-sm text-zinc-400 max-w-xs mx-auto mb-6">
              تم تسليم طلبك رقم <span className="text-white font-bold font-mono">#{order.orderNumber}</span> بنجاح. نتمنى لك وجبة هنيئة وشهية!
            </p>

            <Link
              href="/track"
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-sm font-bold text-white transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>تتبع طلب آخر</span>
            </Link>
          </div>
        )}

        {/* Footer Real-Time Connection Indicator */}
        <div className="pt-4 border-t border-obsidian-border/80 flex items-center justify-between text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            المزامنة الفورية نشطة
          </span>
          <span className="font-mono">Buzly v1.0</span>
        </div>
      </main>
    </div>
  );
}
