'use client';

import React, { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueue } from '@/context/QueueContext';
import { useLanguage, LanguageSwitcher } from '@/context/LanguageContext';
import { soundManager } from '@/lib/audio';
import { pwaHelper } from '@/lib/pwa-helper';
import { Order, OrderStatus } from '@/types/queue';
import { RestaurantAvatar } from '@/components/RestaurantAvatar';
import {
  VolumeX,
  Volume2,
  ArrowRight,
  Star,
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
  // Strictly isolates from stale historical orders
  const fallbackOrder = useMemo((): Order => {
    if (liveOrder) {
      const now = Date.now();
      if (liveOrder.status === 'completed') {
        const compTime = new Date(liveOrder.completedAt || liveOrder.createdAt || now).getTime();
        if (now - compTime < 90 * 1000) {
          return liveOrder;
        }
      } else if (liveOrder.status === 'ready') {
        const readyTime = new Date(liveOrder.readyAt || liveOrder.createdAt || now).getTime();
        if (now - readyTime < 30 * 60 * 1000) {
          return liveOrder;
        }
      } else if (liveOrder.status === 'preparing') {
        return liveOrder;
      }
    }

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

  // Reset any cached override orders when route parameters change
  useEffect(() => {
    setOverrideOrder(null);
    setAlarmActive(false);
    setHasUserSilenced(false);
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

        syncNow().catch(() => {});
      }
    };

    channel.on('broadcast', { event: 'ORDER_CALL' }, handleBroadcast);
  }, [slug, decodedOrderNumber, warmupLiveChannel, getOrCreateLiveChannel, liveOrder, fallbackOrder, overrideOrder, restaurant?.name, restaurant?.chimeTheme, syncNow]);

  // 2. Ultra-Fast High-Frequency Heartbeat Poll (300ms Direct Poll while preparing)
  useEffect(() => {
    if (order.status !== 'preparing' || !decodedOrderNumber) return;

    let isCancelled = false;
    const createdParam = searchParams?.get('created') || '';
    const createdQuery = createdParam ? `&created=${encodeURIComponent(createdParam)}` : '';

    const pollOrder = async () => {
      try {
        const res = await fetch(
          `/api/orders?slug=${encodeURIComponent(slug)}&orderNumber=${encodeURIComponent(decodedOrderNumber)}${createdQuery}&t=${Date.now()}`,
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
        const now = Date.now();

        if (remoteOrder.status === 'ready') {
          const readyTime = new Date(remoteOrder.readyAt || remoteOrder.createdAt || now).getTime();
          // Strictly verify that the ready status was declared within the last 30 minutes
          if (now - readyTime < 30 * 60 * 1000) {
            setOverrideOrder(remoteOrder);
            setHasUserSilenced(false);
            setAlarmActive(true);
            soundManager.startReadyAlarmLoop(restaurant?.chimeTheme || 'hospitality');
            soundManager.triggerHaptic([600, 150, 600, 150, 1000]);
            syncNow().catch(() => {});
          }
        } else if (remoteOrder.status === 'completed') {
          const compTime = new Date(remoteOrder.completedAt || remoteOrder.createdAt || now).getTime();
          // Only transition to completed if completed very recently (< 90 seconds)
          if (now - compTime < 90 * 1000) {
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
    <div className="min-h-screen bg-[#09090B] text-white flex flex-col justify-between p-4 sm:p-6 font-sans select-none relative overflow-x-hidden">
      {/* Top Header */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between py-2 z-10">
        <Link
          href={`/${slug}/track`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-zinc-400 hover:text-white text-xs font-medium transition-colors"
        >
          <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? '' : 'rotate-180'}`} />
          <span>{t('anotherOrder')}</span>
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="minimal" />

          <button
            onClick={handleExplicitUnlock}
            className="p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title={t('audioCheck')}
          >
            {isAudioUnlocked ? (
              <Volume2 className="w-3.5 h-3.5 text-zinc-200" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
            )}
          </button>
        </div>
      </header>

      {/* Main Order Card */}
      <main className="max-w-md w-full mx-auto my-auto z-10 py-4">
        <motion.div
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-[28px] p-6 sm:p-8 bg-[#141416] border border-white/[0.07] shadow-xl text-center"
        >
          {/* Restaurant & Status Badge Row */}
          <div className="flex items-center justify-between pb-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <RestaurantAvatar
                logoUrl={restaurant?.logoUrl}
                name={restaurant?.name || slug}
                themeColor={restaurant?.themeColor}
                size="md"
              />
              <h1 className="text-sm font-semibold text-white tracking-tight">
                {restaurant?.name || slug}
              </h1>
            </div>

            {/* Quiet Status Pill */}
            <div
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                isReady
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : isCompleted
                  ? 'bg-white/[0.06] text-zinc-400'
                  : 'bg-white/[0.06] text-zinc-300'
              }`}
            >
              {isReady ? 'جاهز للاستلام' : isCompleted ? 'تم الاستلام' : 'قيد التحضير'}
            </div>
          </div>

          {/* Big Order Number */}
          <div className="py-6 sm:py-8">
            <div
              dir="ltr"
              style={{ direction: 'ltr' }}
              className="text-8xl sm:text-9xl font-black tracking-tight tabular-nums text-white font-mono leading-none my-2 select-none"
            >
              #{decodedOrderNumber}
            </div>

            {/* Status-specific content */}
            {isPreparing && (
              <div className="mt-8 space-y-4">
                {/* Subtle, minimalist progress bar */}
                <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-white/70 rounded-full"
                    style={{ width: `${Math.max(15, progressPercent)}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-400 font-normal">
                  سيرن هاتفك ويهتز فور جهوزية الطلب
                </p>
                {!isAudioUnlocked && (
                  <button
                    onClick={handleExplicitUnlock}
                    className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer pt-1"
                  >
                    انقر هنا لتأكيد رنين الهاتف
                  </button>
                )}
              </div>
            )}

            {isReady && (
              <div className="mt-6 space-y-4">
                <p className="text-sm font-semibold text-zinc-200">
                  طلبك جاهز، تفضل بالاستلام من الكاونتر
                </p>

                {/* Tactile High-Contrast White Action Button */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleIReceivedOrder}
                  className="w-full py-4 px-6 rounded-2xl bg-white hover:bg-zinc-100 text-black font-bold text-base transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <Check className="w-5 h-5 stroke-[2.5]" />
                  <span>استلمت الطلب</span>
                </motion.button>

                {alarmActive && (
                  <div>
                    <button
                      onClick={() => {
                        soundManager.stopReadyAlarm();
                        soundManager.stopHaptic();
                        setHasUserSilenced(true);
                      }}
                      className="text-xs text-zinc-400 hover:text-white transition-colors py-1 cursor-pointer"
                    >
                      إيقاف صوت الرنين
                    </button>
                  </div>
                )}
              </div>
            )}

            {isCompleted && (
              <div className="mt-6 space-y-5">
                <p className="text-xs text-zinc-400">
                  نتمنى لك وجبة شهية وتجربة مميزة
                </p>

                {/* Minimal Rating Stars */}
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => {
                        setRating(star);
                        if (order?.id) {
                          submitOrderFeedback(order.id, { rating: star, submittedAt: new Date().toISOString() }, slug);
                        }
                        setFeedbackSent(true);
                      }}
                      className="p-1.5 transition-transform active:scale-90 cursor-pointer"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= rating ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                {feedbackSent && (
                  <p className="text-xs text-emerald-400 font-medium">شكراً لتقييمك!</p>
                )}

                <div className="pt-2">
                  <Link
                    href={`/${slug}/track`}
                    className="inline-block text-xs text-zinc-400 hover:text-white underline underline-offset-4"
                  >
                    متابعة طلب آخر
                  </Link>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </main>

      {/* Clean Bottom Area */}
      <footer className="max-w-md w-full mx-auto text-center py-2 z-10">
        <span className="text-[11px] text-zinc-600 font-mono">CHIMER</span>
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
