'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueue } from '@/context/QueueContext';
import { KeepAwakeEngine } from '@/components/KeepAwakeEngine';
import { soundManager } from '@/lib/audio';
import { pwaHelper } from '@/lib/pwa-helper';
import {
  Bell,
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
} from 'lucide-react';

export default function TenantCustomerTrackerPage() {
  const params = useParams();
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
  } = useQueue();
  const restaurant = getRestaurant(slug);
  const order = getOrder(decodedOrderNumber, slug);

  const [alarmActive, setAlarmActive] = useState<boolean>(false);
  const [hasUserSilenced, setHasUserSilenced] = useState<boolean>(false);
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);
  const [rating, setRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedbackSent, setFeedbackSent] = useState<boolean>(false);
  const confettiFiredRef = useRef<boolean>(false);

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

  // Handle Ready state & Re-ping
  useEffect(() => {
    if (!order) return;

    if (order.status === 'ready' && !hasUserSilenced) {
      setAlarmActive(true);
      soundManager.startReadyAlarmLoop();

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

      pwaHelper.showSystemNotification(`طلبك #${order.orderNumber} جاهز للاستلام! 🍔 (${restaurant.name})`, {
        body: 'توجه إلى الكاونتر لاستلام وجبتك وهي ساخنة ولذيذة.',
      });
    } else if (order.status === 'completed') {
      soundManager.stopReadyAlarm();
      setAlarmActive(false);
    }
  }, [order?.status, hasUserSilenced, order?.orderNumber, restaurant.themeColor, restaurant.name]);

  useEffect(() => {
    if (!lastEvent || !order) return;
    if (
      lastEvent.type === 'ORDER_REPING' &&
      lastEvent.orderNumber === order.orderNumber &&
      lastEvent.restaurantSlug === slug
    ) {
      setHasUserSilenced(false);
      setAlarmActive(true);
      soundManager.startReadyAlarmLoop();

      pwaHelper.showSystemNotification(`تذكير: طلبك #${order.orderNumber} بانتظارك! 🔔`, {
        body: `يرجى مراجعة كاونتر ${restaurant.name} لاستلام طلبك.`,
      });
    }
  }, [lastEvent, order, slug, restaurant.name]);

  useEffect(() => {
    return () => {
      soundManager.stopReadyAlarm();
    };
  }, []);

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
          <Link
            href={`/${slug}/track`}
            className="px-6 py-3 rounded-2xl text-black font-extrabold text-sm transition-all shadow-lg"
            style={{ backgroundColor: restaurant.themeColor }}
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
            <span className="font-black text-sm tracking-tight text-white font-cairo">
              {restaurant.name}
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-mono">طلب #{order.orderNumber}</span>
            <Link
              href={`/${slug}/track`}
              className="text-xs text-zinc-400 hover:text-white bg-obsidian-card px-2.5 py-1 rounded-lg border border-obsidian-border transition-colors"
            >
              تغيير
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 sm:p-6 flex flex-col justify-between">
        {/* KeepAwake Engine & Web Push Shield */}
        <div className="mb-4">
          <KeepAwakeEngine
            orderNumber={order.orderNumber}
            orderStatus={order.status}
            onPushSubscribed={(sub) => registerPushSubscription(order.orderNumber, sub, slug)}
          />
        </div>

        {/* STATE 1: READY (FULL-SCREEN ALERT BUZZER MODE) */}
        {isReady && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-center py-4"
          >
            {alarmActive && (
              <div className="mb-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold animate-bounce-subtle">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>الجرس يرن لتنبيهك...</span>
                <button onClick={handleSilenceAlarm} className="mr-2 underline hover:text-white text-[11px]">
                  كتم
                </button>
              </div>
            )}

            <div className="relative mb-6">
              <div className="absolute -inset-4 bg-emerald-500/30 rounded-full blur-2xl animate-pulse" />
              <div
                className="w-36 h-36 sm:w-44 sm:h-44 rounded-full text-black flex flex-col items-center justify-center shadow-2xl border-4 border-emerald-300 animate-pulse-glow-emerald"
                style={{ backgroundColor: restaurant.themeColor || '#10B981' }}
              >
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

            <h1 className="text-3xl sm:text-4xl font-black text-emerald-400 font-cairo tracking-tight mb-2">
              طلبك جاهز الآن! 🍔
            </h1>
            <p className="text-sm sm:text-base text-zinc-200 max-w-xs mx-auto mb-6 leading-relaxed">
              تفضل بالتوجه إلى كاونتر <strong>{restaurant.name}</strong> لإبراز رقمك واستلام وجبتك.
            </p>

            <div className="w-full space-y-3">
              <button
                onClick={handleIReceivedOrder}
                className="w-full py-4 px-6 rounded-2xl bg-emerald-400 hover:bg-emerald-300 active:scale-95 text-black font-extrabold text-base flex items-center justify-center gap-2 shadow-2xl transition-all cursor-pointer"
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

        {/* STATE 2: PREPARING (RADAR / PULSE RING) */}
        {isPreparing && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
            <div className="relative mb-6">
              <div className="absolute -inset-6 bg-buzly-amber/15 rounded-full blur-2xl animate-pulse" />

              <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-obsidian-surface border-4 border-buzly-amber/40 flex flex-col items-center justify-center relative shadow-2xl shadow-buzly-amber/10 animate-pulse-glow-amber">
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="50%" cy="50%" r="44%" className="stroke-obsidian-border fill-none" strokeWidth="6" />
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

            <div className="bg-obsidian-card border border-buzly-amber/30 rounded-2xl px-5 py-3 mb-4 inline-flex items-center gap-3 shadow-lg">
              <Clock className="w-5 h-5 text-buzly-amber" />
              <div className="text-right">
                <span className="text-[11px] text-zinc-400 block">الوقت المتبقي التقديري</span>
                <span className="font-bold text-base text-buzly-amber font-mono">
                  {remainingMinutes > 0 ? `قرابة ${remainingMinutes} دقيقة` : 'لحظات ويجهز...'}
                </span>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white font-cairo mb-2">
              طلبك يُحضّر بحب وإتقان ✨
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-xs mx-auto leading-relaxed">
              خذ راحتك ولا داعي للانتظار أمام الكاونتر.. سيرن هاتفك تلقائياً أول ما يجهز طلبك في <strong>{restaurant.name}</strong>.
            </p>

            {order.notes && (
              <div className="mt-4 p-3 rounded-xl bg-obsidian-card border border-obsidian-border text-xs text-zinc-300 max-w-xs text-right">
                <span className="text-zinc-500 font-bold ml-1">الأصناف:</span>
                {order.notes}
              </div>
            )}
          </div>
        )}

        {/* STATE 3: COMPLETED & 5-STAR FEEDBACK */}
        {isCompleted && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-4 w-full">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mb-3 shadow-xl">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-extrabold text-white font-cairo mb-1">
              بالعافية مقدماً! 💚
            </h2>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto mb-4">
              تم تسليم طلبك رقم <span className="text-white font-bold font-mono">#{order.orderNumber}</span> بنجاح من {restaurant.name}.
            </p>

            {/* Interactive Feedback Module */}
            {!feedbackSent ? (
              <div className="w-full bg-obsidian-card border border-obsidian-border rounded-3xl p-5 mb-5 text-center shadow-xl space-y-3">
                <span className="text-xs font-bold text-zinc-300 block">
                  كيف كانت تجربتك مع سرعة التجهيز والخدمة؟
                </span>

                {/* 5 Stars */}
                <div className="flex items-center justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => {
                        soundManager.playKeyClick();
                        setRating(star);
                      }}
                      className="p-1 hover:scale-125 transition-transform"
                    >
                      <Star
                        className={`w-7 h-7 transition-colors ${
                          star <= rating
                            ? 'text-buzly-amber fill-buzly-amber'
                            : 'text-zinc-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                {/* Quick Feedback Tags */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                  {[
                    'خدمة سريعة ⚡',
                    'أكل ساخن وطازج 🍔',
                    'جرس التنبيه ممتاز 🔔',
                    'تعامل راقي ✨',
                  ].map((tag) => {
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
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-obsidian-surface text-zinc-400 border-obsidian-border hover:border-zinc-500'
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
                  <span>إرسال التقييم للمطعم</span>
                </button>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 mb-5 text-emerald-400 text-xs font-bold animate-fade-in">
                ✨ شكراً جزيلاً لتقييمك الكريم! رأيك يساعدنا على التطوير المستمر.
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
          <span className="font-mono">Buzly v3.0</span>
        </div>
      </main>
    </div>
  );
}
