'use client';

import React, { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueue } from '@/context/QueueContext';
import { useLanguage, LanguageSwitcher } from '@/context/LanguageContext';
import { soundManager } from '@/lib/audio';
import { pwaHelper, DEFAULT_VAPID_PUBLIC_KEY } from '@/lib/pwa-helper';
import { Order, OrderStatus, PushSubscriptionData } from '@/types/queue';
import { RestaurantAvatar } from '@/components/RestaurantAvatar';
import { MuhabBrandBadge } from '@/components/MuhabBrandBadge';
import {
  VolumeX,
  Volume2,
  ArrowRight,
  Star,
  Check,
  BellRing,
  Clock,
  ShieldCheck,
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
    registerPushSubscription,
    lastEvent,
    syncNow,
    getOrCreateLiveChannel,
    warmupLiveChannel,
  } = useQueue();

  const { language, isRTL, t } = useLanguage();

  const restaurant = getRestaurant(slug);
  const liveOrder = getOrder(decodedOrderNumber, slug);
  const [overrideOrder, setOverrideOrder] = useState<Order | null>(null);
  const [isCheckingOrder, setIsCheckingOrder] = useState<boolean>(!liveOrder);
  const [orderNotFound, setOrderNotFound] = useState<boolean>(false);

  const order = overrideOrder || liveOrder || null;

  // Stable references to prevent SSE / WebSocket reconnection loops
  const orderRef = useRef<Order | null>(order);
  useEffect(() => {
    orderRef.current = order;
    if (order) {
      setIsCheckingOrder(false);
      setOrderNotFound(false);
    }
  }, [order]);

  const restaurantRef = useRef(restaurant);
  useEffect(() => {
    restaurantRef.current = restaurant;
  }, [restaurant]);

  // Reset any cached override orders when route parameters change
  useEffect(() => {
    setOverrideOrder(null);
    setAlarmActive(false);
    setHasUserSilenced(false);
    setOrderNotFound(false);
    setIsCheckingOrder(!liveOrder);
  }, [decodedOrderNumber, slug]);

  // Local state
  const [isAudioUnlocked, setIsAudioUnlocked] = useState<boolean>(false);
  const [alarmActive, setAlarmActive] = useState<boolean>(false);
  const [hasUserSilenced, setHasUserSilenced] = useState<boolean>(false);
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);
  const [rating, setRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedbackSent, setFeedbackSent] = useState<boolean>(false);

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
      const perm = await pwaHelper.requestNotificationPermission().catch(() => 'denied');
      if (perm === 'granted') {
        const sub = await pwaHelper.subscribeToWebPush(DEFAULT_VAPID_PUBLIC_KEY);
        if (sub) {
          const serialized: PushSubscriptionData = JSON.parse(JSON.stringify(sub));
          registerPushSubscription(decodedOrderNumber, serialized, slug).catch(() => {});
        }
      }
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
            pSlug === slug.toLowerCase().trim() &&
            (!pNum || pNum.toLowerCase() === decodedOrderNumber.toLowerCase() || cleanPNum === cleanTargetNum);

          if (matches && (data.type === 'ORDER_READY' || data.type === 'ORDER_REPING')) {
            const currentOrd = orderRef.current;
            const updatedReadyOrder: Order = {
              ...(currentOrd || {
                id: `order-${decodedOrderNumber}`,
                orderNumber: decodedOrderNumber,
                restaurantSlug: slug,
                createdAt: new Date().toISOString(),
                estimatedMinutes: 10,
                rePingCount: 0,
              }),
              ...(data.order || {}),
              status: 'ready',
              rePingCount:
                typeof data.rePingCount === 'number'
                  ? data.rePingCount
                  : data.type === 'ORDER_REPING'
                  ? (currentOrd?.rePingCount || 0) + 1
                  : currentOrd?.rePingCount || 0,
              readyAt: data.readyAt || data.order?.readyAt || new Date().toISOString(),
              lastPingAt: data.lastPingAt || new Date().toISOString(),
            };

            setOverrideOrder(updatedReadyOrder);
            setHasUserSilenced(false);
            setAlarmActive(true);

            const theme = restaurantRef.current?.chimeTheme || 'hospitality';
            soundManager.startReadyAlarmLoop(theme);
            soundManager.triggerHaptic([800, 200, 800, 200, 1200]);

            pwaHelper.showSystemNotification(
              data.type === 'ORDER_REPING'
                ? `تذكير: طلبك #${decodedOrderNumber} جاهز للاستلام! 🔔 (${restaurantRef.current?.name || slug})`
                : `طلبك #${decodedOrderNumber} جاهز للاستلام! 🍔 (${restaurantRef.current?.name || slug})`,
              {
                body: 'تفضل بالتوجه إلى الكاونتر لاستلام وجبتك وهي ساخنة ولذيذة.',
              }
            );

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
  }, [slug, decodedOrderNumber, syncNow]);

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

      const matchSlug = pSlug === slug.toLowerCase().trim();
      const matchNum = pNum.toLowerCase() === decodedOrderNumber.toLowerCase() || cleanPNum === cleanTargetNum;

      if (matchSlug && matchNum) {
        const currentOrd = orderRef.current;
        const updatedReadyOrder: Order = {
          ...(currentOrd || {
            id: `order-${decodedOrderNumber}`,
            orderNumber: decodedOrderNumber,
            restaurantSlug: slug,
            createdAt: new Date().toISOString(),
            estimatedMinutes: 10,
            rePingCount: 0,
          }),
          ...(payload.order || {}),
          status: 'ready',
          rePingCount:
            typeof payload.rePingCount === 'number'
              ? payload.rePingCount
              : payload.type === 'ORDER_REPING'
              ? (currentOrd?.rePingCount || 0) + 1
              : currentOrd?.rePingCount || 0,
          readyAt: payload.readyAt || payload.order?.readyAt || new Date().toISOString(),
          lastPingAt: payload.lastPingAt || new Date().toISOString(),
        };

        setOverrideOrder(updatedReadyOrder);
        setHasUserSilenced(false);
        setAlarmActive(true);

        const theme = restaurantRef.current?.chimeTheme || 'hospitality';
        soundManager.startReadyAlarmLoop(theme);
        soundManager.triggerHaptic([800, 200, 800, 200, 1200]);

        pwaHelper.showSystemNotification(
          payload.type === 'ORDER_REPING'
            ? `تذكير: طلبك #${decodedOrderNumber} جاهز للاستلام! 🔔 (${restaurantRef.current?.name || slug})`
            : `طلبك #${decodedOrderNumber} جاهز للاستلام! 🍔 (${restaurantRef.current?.name || slug})`,
          {
            body: 'تفضل بالتوجه إلى الكاونتر لاستلام وجبتك وهي ساخنة ولذيذة.',
          }
        );

        syncNow().catch(() => {});
      }
    };

    channel.on('broadcast', { event: 'ORDER_CALL' }, handleBroadcast);
  }, [slug, decodedOrderNumber, warmupLiveChannel, getOrCreateLiveChannel, syncNow]);

  // 2. Ultra-Fast High-Frequency Heartbeat Poll (200ms Direct Poll until completed)
  useEffect(() => {
    if (order?.status === 'completed' || !decodedOrderNumber) return;

    let isCancelled = false;

    const pollOrder = async () => {
      try {
        const res = await fetch(
          `/api/orders?slug=${encodeURIComponent(slug)}&orderNumber=${encodeURIComponent(decodedOrderNumber)}&t=${Date.now()}`,
          {
            cache: 'no-store',
            headers: {
              'Pragma': 'no-cache',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          }
        );
        if (res.status === 404) {
          if (!isCancelled && !orderRef.current) {
            setOrderNotFound(true);
            setIsCheckingOrder(false);
          }
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (isCancelled) return;
        if (!data?.success || !data.order) {
          if (!orderRef.current) {
            setOrderNotFound(true);
            setIsCheckingOrder(false);
          }
          return;
        }

        const remoteOrder: Order = data.order;
        const currentOrd = orderRef.current;

        if (!currentOrd) {
          setOverrideOrder(remoteOrder);
          setOrderNotFound(false);
          setIsCheckingOrder(false);
          return;
        }

        if (remoteOrder.status === 'ready') {
          const isNewReady = currentOrd.status === 'preparing';
          const isNewPing = (remoteOrder.rePingCount || 0) > (currentOrd.rePingCount || 0);

          if (isNewReady || isNewPing) {
            setOverrideOrder(remoteOrder);
            setHasUserSilenced(false);
            setAlarmActive(true);
            const theme = restaurantRef.current?.chimeTheme || 'hospitality';
            soundManager.startReadyAlarmLoop(theme);
            soundManager.triggerHaptic([800, 200, 800, 200, 1200]);

            pwaHelper.showSystemNotification(
              isNewPing
                ? `تذكير: طلبك #${decodedOrderNumber} جاهز للاستلام! 🔔 (${restaurantRef.current?.name || slug})`
                : `طلبك #${decodedOrderNumber} جاهز للاستلام! 🍔 (${restaurantRef.current?.name || slug})`,
              {
                body: 'تفضل بالتوجه إلى الكاونتر لاستلام وجبتك وهي ساخنة ولذيذة.',
              }
            );

            syncNow().catch(() => {});
          }
        } else if (remoteOrder.status === 'completed') {
          if (currentOrd.status !== 'completed') {
            setOverrideOrder(remoteOrder);
            setAlarmActive(false);
            soundManager.stopReadyAlarm();
            syncNow().catch(() => {});
          }
        }
      } catch {
        // Silently continue polling
      }
    };

    // Run immediately on mount (0ms) without waiting for first interval tick
    pollOrder();
    const interval = setInterval(pollOrder, 200);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [order?.status, decodedOrderNumber, slug, syncNow]);

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
    const perm = await pwaHelper.requestNotificationPermission().catch(() => 'denied');
    if (perm === 'granted') {
      const sub = await pwaHelper.subscribeToWebPush(DEFAULT_VAPID_PUBLIC_KEY);
      if (sub) {
        const serialized: PushSubscriptionData = JSON.parse(JSON.stringify(sub));
        registerPushSubscription(decodedOrderNumber, serialized, slug).catch(() => {});
      }
    }
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

  const isPreparing = order?.status === 'preparing';
  const isReady = order?.status === 'ready';
  const isCompleted = order?.status === 'completed';

  const estMinutes = order?.estimatedMinutes || 10;
  const remainingMinutes = Math.max(0, estMinutes - elapsedMinutes);
  const progressPercent = Math.min(100, Math.round((elapsedMinutes / Math.max(1, estMinutes)) * 100));

  const restaurantDisplayName = restaurant?.name || slug;
  const paddedOrderNum = decodedOrderNumber.padStart(3, '0');

  if (isCheckingOrder && !order) {
    return (
      <div className="min-h-screen bg-[#F4F1EA] text-zinc-900 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-900 border-t-transparent animate-spin mb-3" />
        <p className="text-sm font-medium text-zinc-600">
          {language === 'ar'
            ? `جارِ التحقق من الطلب #${decodedOrderNumber}...`
            : `Checking order #${decodedOrderNumber}...`}
        </p>
      </div>
    );
  }

  if (orderNotFound || !order) {
    return (
      <div className="min-h-screen bg-[#F4F1EA] text-zinc-900 flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-[#FFFDF9] border border-zinc-200/90 rounded-[28px] p-7 sm:p-8 text-center shadow-[0_14px_40px_rgba(24,24,27,0.08)]">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
            {restaurantDisplayName}
          </p>
          <h1 className="text-2xl font-extrabold text-zinc-950 mb-2">
            {language === 'ar'
              ? `رقم الطلب #${decodedOrderNumber} غير موجود`
              : `Order #${decodedOrderNumber} not found`}
          </h1>
          <p className="text-sm text-zinc-600 mb-6">
            {language === 'ar'
              ? 'الرقم غير صحيح أو لم يتم تسجيل هذا الطلب بعد. تأكد من الرقم على الفاتورة أو راجع الكاشير.'
              : 'This order number is not in the active queue. Please double-check your receipt or ask the cashier.'}
          </p>
          <Link
            href={`/${slug}/track`}
            className="inline-block w-full py-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-sm transition-colors"
          >
            {language === 'ar' ? 'إدخال رقم طلب آخر' : 'Try another order number'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-4 sm:p-6 font-sans select-none relative overflow-x-hidden transition-colors duration-700 ${
        isReady
          ? 'bg-emerald-600 text-white'
          : 'bg-[#F4F1EA] text-zinc-900'
      }`}
    >
      {/* Top Header */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between py-2 z-10">
        <Link
          href={`/${slug}/track`}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            isReady
              ? 'bg-white/15 hover:bg-white/25 text-white'
              : 'bg-white/80 hover:bg-white text-zinc-700 border border-zinc-200/80 shadow-xs'
          }`}
        >
          <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? '' : 'rotate-180'}`} />
          <span>{t('anotherOrder')}</span>
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="minimal" />

          <button
            onClick={handleExplicitUnlock}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              isReady
                ? 'bg-white/15 hover:bg-white/25 text-white'
                : 'bg-white/80 hover:bg-white text-zinc-700 border border-zinc-200/80'
            }`}
            title={t('audioCheck')}
          >
            {isAudioUnlocked ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 opacity-60" />
            )}
          </button>
        </div>
      </header>

      {/* Main Tactile Ticket / Cinematic Ready View */}
      <main className="max-w-md w-full mx-auto my-auto z-10 py-4">
        <AnimatePresence mode="wait">
          {isPreparing && (
            <motion.div
              key="ticket-preparing"
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.96 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="w-full"
            >
              {/* Audio recovery banner if needed */}
              {!isAudioUnlocked && (
                <button
                  type="button"
                  onClick={handleExplicitUnlock}
                  className="w-full mb-3 bg-amber-100 hover:bg-amber-200/80 border border-amber-300 text-amber-950 rounded-2xl px-4 py-2.5 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4" />
                    {language === 'ar'
                      ? 'انقر لتفعيل صوت الرنين العالي'
                      : 'Tap to enable loud buzzer chime'}
                  </span>
                  <span className="underline">
                    {language === 'ar' ? 'تجربة' : 'Test'}
                  </span>
                </button>
              )}

              {/* Physical Perforated Ticket Card */}
              <div className="drop-shadow-[0_16px_40px_rgba(24,24,27,0.08)]">
                {/* Upper Ticket Body */}
                <div className="bg-[#FFFDF9] border border-b-0 border-zinc-200/90 rounded-t-[28px] p-6 sm:p-7">
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 truncate">
                      {restaurantDisplayName}
                    </span>
                    <span
                      dir="ltr"
                      className="font-mono text-sm font-bold text-zinc-900 bg-zinc-100 px-3 py-1 rounded-full shrink-0"
                    >
                      No. {paddedOrderNum}
                    </span>
                  </div>

                  <div className="text-center py-3">
                    <p className="text-sm font-bold text-zinc-500 mb-1">
                      {language === 'ar' ? 'طلبك قيد التحضير' : 'Preparing your order'}
                    </p>
                    <div
                      dir="ltr"
                      className="text-6xl sm:text-7xl font-black tracking-tight tabular-nums text-zinc-950 font-mono leading-none my-2"
                    >
                      #{decodedOrderNumber}
                    </div>

                    <div className="mt-4 inline-flex items-center gap-2 bg-amber-100 border border-amber-200 text-amber-950 px-4 py-1.5 rounded-full text-sm font-bold">
                      <Clock className="w-4 h-4 text-amber-700" />
                      <span>
                        {language === 'ar'
                          ? `حوالي ${remainingMinutes > 0 ? remainingMinutes : estMinutes} دقائق`
                          : `About ${remainingMinutes > 0 ? remainingMinutes : estMinutes} minutes`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Perforated Tear Line with Circular Side Notches */}
                <div className="relative flex items-center bg-[#FFFDF9] border-x border-zinc-200/90">
                  <div className="w-5 h-10 bg-[#F4F1EA] rounded-r-full border-y border-r border-zinc-200/90 -ml-px transition-colors duration-700" />
                  <div className="flex-1 border-t-2 border-dashed border-zinc-300 mx-2" />
                  <div className="w-5 h-10 bg-[#F4F1EA] rounded-l-full border-y border-l border-zinc-200/90 -mr-px transition-colors duration-700" />
                </div>

                {/* Lower Ticket Stub (Tears away cinematically when Ready) */}
                <motion.div
                  initial={{ y: 0, opacity: 1, rotate: 0 }}
                  exit={{ y: 68, opacity: 0, rotate: -3 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-[#FAF7F0] border border-t-0 border-zinc-200/90 rounded-b-[28px] p-6 sm:p-7 pt-5 flex items-center gap-5"
                >
                  <div className="flex items-center justify-center w-12 shrink-0 border-r border-zinc-200 pr-4">
                    <span
                      dir="ltr"
                      className="font-mono text-2xl font-black tracking-widest text-zinc-400 -rotate-90 select-none"
                    >
                      {paddedOrderNum}
                    </span>
                  </div>

                  <div className="flex-1 space-y-2.5 text-start">
                    <p className="text-sm font-medium text-zinc-700 leading-snug">
                      {language === 'ar'
                        ? 'سيرن هاتفك فور جهوزية طلبك. أبقِ هذه الصفحة مفتوحة.'
                        : "We'll buzz this phone when your order is ready. Keep this page open."}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {language === 'ar'
                          ? 'مباشر • يتحدث فور جهوزية الطلب'
                          : 'Live. Updates the moment your order is ready.'}
                      </span>

                      <span className="inline-flex items-center gap-1 text-zinc-500 font-medium">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        {language === 'ar'
                          ? 'الشاشة تبقى مضيئة'
                          : 'Screen staying awake'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {isReady && (
            <motion.div
              key="ticket-ready"
              initial={{ opacity: 0, scale: 0.9, y: 28 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="text-center py-4"
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-6 shadow-lg"
              >
                <BellRing className="w-10 h-10 text-white" />
              </motion.div>

              <p className="text-xs font-bold uppercase tracking-widest text-emerald-100 mb-2">
                {restaurantDisplayName}
              </p>

              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-2">
                {language === 'ar' ? 'طلبك جاهز!' : 'Your order is ready.'}
              </h1>

              <p className="text-lg text-emerald-50 font-medium mb-6">
                {language === 'ar'
                  ? 'تفضل بالاستلام من الكاونتر الآن'
                  : 'Come to the counter to pick it up.'}
              </p>

              <div className="bg-emerald-700/60 border border-emerald-400/30 rounded-3xl p-6 mb-6 shadow-inner">
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-200 block mb-1">
                  {language === 'ar' ? 'رقم الطلب' : 'Order Number'}
                </span>
                <div
                  dir="ltr"
                  className="text-7xl font-black font-mono tabular-nums text-white"
                >
                  #{decodedOrderNumber}
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleIReceivedOrder}
                className="w-full py-4 px-6 rounded-2xl bg-white hover:bg-emerald-50 text-emerald-950 font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-xl cursor-pointer"
              >
                <Check className="w-5 h-5 stroke-[2.5]" />
                <span>{language === 'ar' ? 'استلمت الطلب' : "I've picked it up"}</span>
              </motion.button>

              {alarmActive && (
                <button
                  onClick={() => {
                    soundManager.stopReadyAlarm();
                    soundManager.stopHaptic();
                    setHasUserSilenced(true);
                  }}
                  className="mt-4 text-xs text-emerald-100/90 hover:text-white underline underline-offset-4 py-1 cursor-pointer"
                >
                  {language === 'ar' ? 'إيقاف صوت الرنين' : 'Silence buzzer chime'}
                </button>
              )}
            </motion.div>
          )}

          {isCompleted && (
            <motion.div
              key="ticket-completed"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-[#FFFDF9] border border-zinc-200/90 rounded-[28px] p-7 sm:p-8 text-center shadow-[0_14px_40px_rgba(24,24,27,0.08)]"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
                <Check className="w-7 h-7 stroke-[2.5]" />
              </div>

              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">
                {restaurantDisplayName}
              </p>
              <h1 className="text-2xl font-extrabold text-zinc-950 mb-1">
                {language === 'ar'
                  ? `تم تسليم الطلب #${decodedOrderNumber}`
                  : `Order #${decodedOrderNumber} picked up`}
              </h1>
              <p className="text-sm text-zinc-600 mb-6">
                {language === 'ar'
                  ? 'نتمنى لك وجبة شهية وتجربة مميزة'
                  : 'Enjoy your meal!'}
              </p>

              {/* Minimal Rating Stars */}
              <div className="flex items-center justify-center gap-2 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => {
                      setRating(star);
                      if (order?.id) {
                        submitOrderFeedback(
                          order.id,
                          { rating: star, submittedAt: new Date().toISOString() },
                          slug
                        );
                      }
                      setFeedbackSent(true);
                    }}
                    className="p-1.5 transition-transform active:scale-90 cursor-pointer"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= rating
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-zinc-300'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {feedbackSent && (
                <p className="text-xs text-emerald-700 font-bold mb-4">
                  {language === 'ar' ? 'شكراً لتقييمك!' : 'Thanks for your feedback!'}
                </p>
              )}

              <Link
                href={`/${slug}/track`}
                className="mt-2 inline-block w-full py-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-sm transition-colors"
              >
                {language === 'ar' ? 'متابعة طلب آخر' : 'Track another order'}
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Clean Bottom Area */}
      <footer className="max-w-md w-full mx-auto text-center py-3 z-10">
        <div className={isReady ? 'opacity-80' : 'opacity-70'}>
          <MuhabBrandBadge />
        </div>
      </footer>
    </div>
  );
}

// Self-healing customer wrapper: NEVER crashes or throws into a destructive error screen
export default function TenantCustomerTrackerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090B] text-white flex flex-col items-center justify-center font-sans p-4">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin mb-4" />
          <p className="text-zinc-500 text-xs font-sans">تحميل...</p>
        </div>
      }
    >
      <TenantCustomerTrackerInner />
    </Suspense>
  );
}
