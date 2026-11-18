'use client';

import React, { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueue } from '@/context/QueueContext';
import { useLanguage, LanguageSwitcher } from '@/context/LanguageContext';
import { soundManager } from '@/lib/audio';
import { pwaHelper } from '@/lib/pwa-helper';
import { Order, OrderStatus } from '@/types/queue';
import { RestaurantAvatar } from '@/components/RestaurantAvatar';
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
    getOrCreateLiveChannel,
    warmupLiveChannel,
  } = useQueue();

  const { language, isRTL, t } = useLanguage();

  const restaurant = getRestaurant(slug);
  const liveOrder = getOrder(decodedOrderNumber, slug);
  const [overrideOrder, setOverrideOrder] = useState<Order | null>(null);

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

  const order = overrideOrder || liveOrder || fallbackOrder;

  // Local state
  const [isAudioUnlocked, setIsAudioUnlocked] = useState<boolean>(false);
  const [alarmActive, setAlarmActive] = useState<boolean>(false);
  const [hasUserSilenced, setHasUserSilenced] = useState<boolean>(false);
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);
  const [rating, setRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedbackSent, setFeedbackSent] = useState<boolean>(false);
  const confettiFiredRef = useRef<boolean>(false);

  // 1. Instant Audio Pre-Decoding & Silent Hardware Warm-Up
  useEffect(() => {
    // Keep AudioContext warm immediately on mount
    soundManager.warmUp();
    if (typeof window !== 'undefined') {
      setIsAudioUnlocked(soundManager.isAudioUnlocked());
    }

    const unlockSilently = async () => {
      await soundManager.unlock();
      soundManager.startSilentKeepAlive();
      setIsAudioUnlocked(true);
      pwaHelper.requestNotificationPermission().catch(() => {});
    };

    window.addEventListener('pointerdown', unlockSilently);
    window.addEventListener('touchstart', unlockSilently);
    window.addEventListener('click', unlockSilently);

    return () => {
      window.removeEventListener('pointerdown', unlockSilently);
      window.removeEventListener('touchstart', unlockSilently);
      window.removeEventListener('click', unlockSilently);
    };
  }, []);

  // Screen WakeLock to prevent phone sleep & CPU/Timer throttling while tracking
  useEffect(() => {
    pwaHelper.acquireWakeLock().catch(() => {});
    return () => {
      pwaHelper.releaseWakeLock();
    };
  }, []);

  // 1.2 Zero-Latency Server-Sent Events (SSE) Push (<15ms Realtime across devices)
  useEffect(() => {
    if (!slug || !decodedOrderNumber || typeof window === 'undefined') return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(
        `/api/orders/stream?slug=${encodeURIComponent(slug)}&orderNumber=${encodeURIComponent(decodedOrderNumber)}`
      );

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data || data.type === 'CONNECTED') return;

          const pSlug = (data.restaurantSlug || data.order?.restaurantSlug || '').toLowerCase().trim();
          const pNum = String(data.orderNumber || data.order?.orderNumber || '').trim();
          const cleanPNum = pNum.replace(/^#/, '').toLowerCase();
          const cleanTargetNum = decodedOrderNumber.replace(/^#/, '').toLowerCase();

          const matches =
            (!pSlug || pSlug === 'all' || pSlug === slug.toLowerCase().trim()) &&
            (!pNum || pNum.toLowerCase() === decodedOrderNumber.toLowerCase() || cleanPNum === cleanTargetNum);

          if (matches && (data.type === 'ORDER_READY' || data.type === 'ORDER_REPING')) {
            const updatedReadyOrder: Order = {
              ...(overrideOrder || liveOrder || fallbackOrder),
              ...(data.order || {}),
              status: 'ready',
              rePingCount:
                typeof data.rePingCount === 'number'
                  ? data.rePingCount
                  : data.type === 'ORDER_REPING'
                  ? ((overrideOrder || liveOrder || fallbackOrder)?.rePingCount || 0) + 1
                  : (overrideOrder || liveOrder || fallbackOrder)?.rePingCount || 0,
              readyAt: data.readyAt || data.order?.readyAt || new Date().toISOString(),
              lastPingAt: data.lastPingAt || new Date().toISOString(),
            };

            setOverrideOrder(updatedReadyOrder);
            setHasUserSilenced(false);
            setAlarmActive(true);

            soundManager.startReadyAlarmLoop(restaurant?.chimeTheme || 'hospitality');
            soundManager.triggerHaptic([600, 150, 600, 150, 1000]);

            pwaHelper.showSystemNotification(
              data.type === 'ORDER_REPING'
                ? `تذكير: طلبك #${decodedOrderNumber} جاهز للاستلام! 🔔 (${restaurant?.name || slug})`
                : `طلبك #${decodedOrderNumber} جاهز للاستلام! 🍔 (${restaurant?.name || slug})`,
              {
                body: 'تفضل بالتوجه إلى الكاونتر لاستلام وجبتك وهي ساخنة ولذيذة.',
              }
            );

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

            syncNow().catch(() => {});
          } else if (matches && data.type === 'ORDER_COMPLETED') {
            setOverrideOrder((prev) => (prev ? { ...prev, status: 'completed' } : null));
            setAlarmActive(false);
            soundManager.stopReadyAlarm();
            syncNow().catch(() => {});
          }
        } catch (err) {
          console.warn('SSE payload error:', err);
        }
      };
    } catch (e) {
      console.warn('EventSource connection error:', e);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [slug, decodedOrderNumber, overrideOrder, liveOrder, fallbackOrder, restaurant?.name, restaurant?.chimeTheme, syncNow]);

  // 1.5 Persistent Pre-Warmed Supabase Realtime Broadcast Channel (Zero-Latency Delivery <100ms)
  useEffect(() => {
    if (!slug || !decodedOrderNumber) return;

    if (warmupLiveChannel) {
      warmupLiveChannel(slug);
    }

    if (!getOrCreateLiveChannel) return;
    const channel = getOrCreateLiveChannel(slug);
    if (!channel) return;

    const handleBroadcast = ({ payload }: { payload: any }) => {
      if (!payload) return;
      const pSlug = (payload.restaurantSlug || payload.order?.restaurantSlug || '').toLowerCase().trim();
      const pNum = String(payload.orderNumber || payload.order?.orderNumber || '').trim();
      const cleanPNum = pNum.replace(/^#/, '').toLowerCase();
      const cleanTargetNum = decodedOrderNumber.replace(/^#/, '').toLowerCase();

      const matchSlug = !pSlug || pSlug === slug.toLowerCase().trim();
      const matchNum = pNum.toLowerCase() === decodedOrderNumber.toLowerCase() || cleanPNum === cleanTargetNum;

      if (matchSlug && matchNum) {
        // Zero-Latency Instant Delivery (<100ms) - Direct Phone Reaction!
        const updatedReadyOrder: Order = {
          ...(overrideOrder || liveOrder || fallbackOrder),
          ...(payload.order || {}),
          status: 'ready',
          rePingCount:
            typeof payload.rePingCount === 'number'
              ? payload.rePingCount
              : payload.type === 'ORDER_REPING'
              ? ((overrideOrder || liveOrder || fallbackOrder)?.rePingCount || 0) + 1
              : (overrideOrder || liveOrder || fallbackOrder)?.rePingCount || 0,
          readyAt: payload.readyAt || payload.order?.readyAt || new Date().toISOString(),
          lastPingAt: payload.lastPingAt || new Date().toISOString(),
        };

        setOverrideOrder(updatedReadyOrder);
        setHasUserSilenced(false);
        setAlarmActive(true);

        // Immediate audio chime and vibration in 0ms without iOS hardware delay
        soundManager.startReadyAlarmLoop(restaurant?.chimeTheme || 'hospitality');
        soundManager.triggerHaptic([600, 150, 600, 150, 1000]);

        pwaHelper.showSystemNotification(
          payload.type === 'ORDER_REPING'
            ? `تذكير: طلبك #${decodedOrderNumber} جاهز للاستلام! 🔔 (${restaurant?.name || slug})`
            : `طلبك #${decodedOrderNumber} جاهز للاستلام! 🍔 (${restaurant?.name || slug})`,
          {
            body: 'تفضل بالتوجه إلى الكاونتر لاستلام وجبتك وهي ساخنة ولذيذة.',
          }
        );

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

        syncNow().catch(() => {});
      }
    };

    channel.on('broadcast', { event: 'ORDER_CALL' }, handleBroadcast);
  }, [slug, decodedOrderNumber, warmupLiveChannel, getOrCreateLiveChannel, liveOrder, fallbackOrder, overrideOrder, restaurant?.name, restaurant?.chimeTheme, syncNow]);

  // 2. Ultra-Fast High-Frequency Heartbeat Poll (300ms Direct Poll while preparing)
  useEffect(() => {
    if (order.status !== 'preparing' || !decodedOrderNumber) return;

    let isCancelled = false;
    const pollOrder = async () => {
      try {
        const res = await fetch(
          `/api/orders?slug=${encodeURIComponent(slug)}&orderNumber=${encodeURIComponent(decodedOrderNumber)}&t=${Date.now()}`,
          {
            cache: 'no-store',
            headers: {
              'Pragma': 'no-cache',
              'Cache-Control': 'no-cache',
            },
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (isCancelled || !data?.success || !data.order) return;

        const remoteOrder: Order = data.order;
        if (remoteOrder.status === 'ready') {
          setOverrideOrder(remoteOrder);
          setHasUserSilenced(false);
          setAlarmActive(true);
          soundManager.startReadyAlarmLoop(restaurant?.chimeTheme || 'hospitality');
          soundManager.triggerHaptic([600, 150, 600, 150, 1000]);
          syncNow().catch(() => {});
        }
      } catch {
        // Silently continue polling
      }
    };

    // Run immediately on mount (0ms) without waiting for first interval tick
    pollOrder();
    const interval = setInterval(pollOrder, 300);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [order.status, decodedOrderNumber, slug, restaurant?.chimeTheme, syncNow]);

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

  // 10. Global one-touch audio unlock for mobile Safari & Chrome
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unlockAudio = async () => {
      await soundManager.unlock();
      soundManager.startSilentKeepAlive();
      setIsAudioUnlocked(true);
    };

    window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
    window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
    window.addEventListener('click', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('click', unlockAudio);
    };
  }, []);

  // 11. Gentle background push notification permission request on enter
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        try {
          Notification.requestPermission().catch(() => {});
        } catch {}
      }
    }
  }, []);

  // 12. Dynamic Title Flash when order is ready & window is inactive/background
  useEffect(() => {
    if (!order || order.status !== 'ready' || hasUserSilenced) return;

    const originalTitle = typeof document !== 'undefined' ? document.title : '';
    let flash = false;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined') {
        document.title = flash
          ? `🚨 طلبك جاهز! (#${decodedOrderNumber})`
          : `🔔 تفضل باستلام طلبك من الكاونتر`;
        flash = !flash;
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (typeof document !== 'undefined' && originalTitle) {
        document.title = originalTitle;
      }
    };
  }, [order?.status, hasUserSilenced, decodedOrderNumber]);

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
    setOverrideOrder((prev) => (prev ? { ...prev, status: 'completed' } : null));
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
    <div className="min-h-screen bg-[#000000] text-white flex flex-col justify-between p-4 sm:p-6 font-sans select-none relative overflow-x-hidden selection:bg-[#34C759] selection:text-black">
      {/* Subtle Apple ambient glow on ready */}
      {isReady && (
        <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_20%,_rgba(52,199,89,0.12),transparent_70%)] animate-pulse" />
      )}

      {/* Top Header / Navigation Bar */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between z-10 py-3">
        <Link
          href={`/${slug}/track`}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white text-xs font-medium transition-all"
        >
          <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? '' : 'rotate-180'}`} />
          <span>{t('anotherOrder')}</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Subtle Live Status Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] text-[11px] font-medium text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
            <span>متصل</span>
          </div>

          <LanguageSwitcher variant="minimal" />

          <button
            onClick={handleExplicitUnlock}
            className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title={t('audioCheck')}
          >
            {isAudioUnlocked ? (
              <Volume2 className="w-3.5 h-3.5 text-[#34C759]" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
            )}
          </button>
        </div>
      </header>

      {/* In-App Ready Notification Banner (iOS Dynamic Island / Capsule alert) */}
      <AnimatePresence>
        {isReady && !hasUserSilenced && (
          <motion.div
            initial={{ y: -60, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -60, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            className="fixed top-4 left-4 right-4 max-w-md mx-auto z-50 bg-[#1C1C1E] border border-[#34C759]/40 rounded-[24px] p-4 shadow-2xl flex items-center justify-between backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#34C759]/20 flex items-center justify-center text-[#34C759] shrink-0">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#34C759]">طلبك جاهز الآن!</div>
                <div className="text-sm font-bold text-white">
                  رقم #{decodedOrderNumber} تفضل بالاستلام
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                soundManager.stopReadyAlarm();
                soundManager.stopHaptic();
                setHasUserSilenced(true);
              }}
              className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors cursor-pointer"
            >
              إيقاف الرنين
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Apple Live Activity Card */}
      <main className="max-w-md w-full mx-auto my-auto z-10 py-2">
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className={`rounded-[32px] p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.6)] transition-all duration-500 border ${
            isReady
              ? 'bg-[#18231C] border-[#34C759]/30 shadow-[#34C759]/10'
              : 'bg-[#161618] border-white/[0.08]'
          }`}
        >
          {/* Restaurant Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <RestaurantAvatar
                logoUrl={restaurant?.logoUrl}
                name={restaurant?.name || slug}
                themeColor={restaurant?.themeColor}
                size="md"
              />
              <div>
                <h1 className="text-[15px] font-semibold text-white tracking-tight">
                  {restaurant?.name || slug}
                </h1>
                <p className="text-[11px] text-zinc-400">تذكرة المتابعة المباشرة</p>
              </div>
            </div>

            {/* Apple Status Capsule */}
            <div
              className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                isReady
                  ? 'bg-[#34C759]/20 text-[#34C759] border border-[#34C759]/30'
                  : isCompleted
                  ? 'bg-zinc-800 text-zinc-300'
                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
              }`}
            >
              {isReady ? 'جاهز للاستلام' : isCompleted ? 'تم الاستلام' : 'قيد التحضير'}
            </div>
          </div>

          {/* Hero Order Number */}
          <div className="text-center py-4 mb-4">
            <span className="text-xs font-medium text-zinc-400 tracking-wider block mb-2">
              {t('orderNumber')}
            </span>
            <div
              dir="ltr"
              style={{ direction: 'ltr' }}
              className="text-7xl sm:text-8xl font-black tracking-tight tabular-nums text-white my-1 font-mono"
            >
              #{decodedOrderNumber}
            </div>

            {/* State subline */}
            {isPreparing && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium mt-3">
                <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
                <span>{t('estPrepTime', { min: remainingMinutes })}</span>
              </div>
            )}

            {isReady && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#34C759]/15 border border-[#34C759]/30 text-[#34C759] text-sm font-bold mt-3 animate-pulse">
                <CheckCircle2 className="w-4 h-4 text-[#34C759]" />
                <span>طلبك جاهز، تفضل باستلامه من الكاونتر</span>
              </div>
            )}

            {isCompleted && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] text-zinc-400 text-xs font-medium mt-3">
                <Check className="w-3.5 h-3.5 text-[#34C759]" />
                <span>{t('orderDeliveredThanks')}</span>
              </div>
            )}
          </div>

          {/* Continuous Apple Progress Capsule */}
          {!isCompleted && (
            <div className="space-y-2 mb-6">
              <div className="h-2 w-full bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isReady ? 'bg-[#34C759]' : 'bg-amber-400'
                  }`}
                  style={{ width: isReady ? '100%' : `${Math.max(15, progressPercent)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-zinc-500 font-medium px-0.5">
                <span>تم تأكيد الطلب</span>
                <span className={isPreparing ? 'text-amber-300 font-semibold' : ''}>جاري التحضير</span>
                <span className={isReady ? 'text-[#34C759] font-semibold' : ''}>جاهز للاستلام</span>
              </div>
            </div>
          )}

          {/* Primary Action Button when Ready */}
          {isReady && (
            <div className="space-y-3 mb-4">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleIReceivedOrder}
                className="w-full py-4 px-6 rounded-[20px] bg-[#34C759] hover:bg-[#30D158] text-black font-extrabold text-base transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                <span>استلمت طلبي — إيقاف التنبيه</span>
              </motion.button>
            </div>
          )}

          {/* Completed State: Review and Feedback */}
          {isCompleted && (
            <div className="space-y-4 pt-2">
              <div className="p-5 rounded-[24px] bg-white/[0.04] border border-white/[0.06] text-center space-y-3">
                <p className="text-xs font-semibold text-zinc-300">
                  {t('howWasExperience')}
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
                    className="px-6 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-white transition-colors cursor-pointer"
                  >
                    {t('submitFeedback')}
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-[#34C759] font-medium">
                    <Check className="w-4 h-4" />
                    <span>{t('feedbackThanks')}</span>
                  </div>
                )}
              </div>

              <Link
                href={`/${slug}/track`}
                className="block w-full py-3.5 rounded-[18px] bg-white/[0.05] hover:bg-white/[0.09] text-center text-xs font-medium text-white transition-all"
              >
                {t('trackNewOrder')}
              </Link>
            </div>
          )}

          {/* Discreet Audio Reassurance Note */}
          {!isCompleted && (
            <div className="pt-2 text-center">
              {isAudioUnlocked ? (
                <p className="text-[11px] text-zinc-400 flex items-center justify-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-[#34C759]" />
                  <span>التنبيه الصوتي والاهتزاز مفعل تلقائياً</span>
                </p>
              ) : (
                <button
                  onClick={handleExplicitUnlock}
                  className="text-[11px] text-zinc-400 hover:text-white flex items-center justify-center gap-1.5 mx-auto underline cursor-pointer"
                >
                  <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                  <span>انقر هنا لتأكيد رنين الهاتف فور جهوزية الطلب</span>
                </button>
              )}
            </div>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="max-w-md w-full mx-auto text-center z-10 py-3">
        <p className="text-[11px] text-zinc-400">
          استرح وسيقوم هاتفك بالرنين فور جهوزية طلبك
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
        <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center justify-center font-sans p-4">
          <div className="w-10 h-10 rounded-full border-2 border-[#34C759] border-t-transparent animate-spin mb-4" />
          <p className="text-zinc-400 text-xs font-sans">جاري تجهيز تذكرة الطلب...</p>
        </div>
      }
    >
      <TenantCustomerTrackerInner />
    </Suspense>
  );
}
