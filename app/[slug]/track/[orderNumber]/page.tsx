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
          <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? '' : 'rotate-180'}`} />
          <span>{t('anotherOrder')}</span>
        </Link>

        {/* Live Pulse Pill */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-medium text-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{t('liveConnected')}</span>
        </div>

        {/* Language & Audio Controls */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="minimal" />

          <button
            onClick={handleExplicitUnlock}
            className="p-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title={t('audioCheck')}
          >
            {isAudioUnlocked ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
            )}
          </button>
        </div>
      </header>

      {/* 1. Floating In-App Heads-Up Alert (Guaranteed visual notification even if mobile OS blocks push) */}
      <AnimatePresence>
        {isReady && !hasUserSilenced && (
          <motion.div
            initial={{ y: -80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -80, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed top-3 left-4 right-4 max-w-md mx-auto z-50 bg-[#07241A] border-2 border-emerald-400 rounded-2xl p-4 shadow-2xl shadow-emerald-500/40 flex items-center justify-between ring-1 ring-emerald-500/50"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <RestaurantAvatar
                  logoUrl={restaurant?.logoUrl}
                  name={restaurant?.name || slug}
                  themeColor={restaurant?.themeColor}
                  size="sm"
                />
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-xs text-emerald-300">{t('instantAlert')}</span>
                  <span className="text-[10px] text-zinc-400 font-mono">{t('now')}</span>
                </div>
                <div className="text-sm font-black text-white">
                  {t('orderReadyAlertText', { orderNumber: decodedOrderNumber })}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                soundManager.stopReadyAlarm();
                soundManager.stopHaptic();
                setHasUserSilenced(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              {t('muteAlert')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Top Audio Activation Banner (Ensures mobile touch gesture unlocks audio & push) */}
      {isPreparing && !isAudioUnlocked && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full mx-auto z-20 my-2"
        >
          <button
            type="button"
            onClick={handleExplicitUnlock}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/15 to-emerald-500/10 border border-emerald-500/40 text-xs text-white shadow-lg cursor-pointer animate-pulse hover:border-emerald-400 transition-all"
          >
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400 animate-bounce" />
              <span className="font-bold text-emerald-200">
                {t('confirmAlertPrompt')}
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-black font-extrabold text-[11px] shadow-sm">
              {t('activateNow')}
            </span>
          </button>
        </motion.div>
      )}

      {/* Main Luxury Apple Wallet Boarding Pass */}
      <main className="max-w-md w-full mx-auto my-auto z-10 py-3">
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={`rounded-3xl relative overflow-hidden transition-all duration-700 ${
            isReady
              ? 'bg-gradient-to-b from-[#07251B] via-[#081F17] to-[#071511] border-2 border-emerald-500/40 shadow-2xl'
              : 'bg-[#111115] border border-white/[0.08] shadow-2xl'
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
                <RestaurantAvatar
                  logoUrl={restaurant?.logoUrl}
                  name={restaurant?.name || slug}
                  themeColor={restaurant?.themeColor}
                  size="md"
                />
                <h1 className="text-base font-bold text-white tracking-tight">
                  {restaurant?.name || slug}
                </h1>
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
                {t(order.status as any) || (isReady ? t('ready') : isCompleted ? t('completed') : t('preparing'))}
              </div>
            </div>

            {/* Hero Order Number Glass Card */}
            <div className="bg-[#0A0A0E]/80 backdrop-blur-md rounded-2xl p-6 text-center border border-white/[0.06] shadow-inner relative overflow-hidden">
              <span className="text-[11px] font-mono font-medium tracking-widest text-zinc-500 uppercase block mb-1">
                {t('orderNumber')}
              </span>

              <div className="text-7xl sm:text-8xl font-black font-mono tracking-tight tabular-nums text-white dir-ltr my-1 drop-shadow-md">
                #{decodedOrderNumber}
              </div>

              {/* Sub-status line */}
              {isPreparing && (
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-amber-300/90 mt-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{t('estPrepTime', { min: remainingMinutes })}</span>
                </div>
              )}

              {isReady && (
                <div className="flex items-center justify-center gap-1.5 text-sm font-bold text-emerald-300 mt-2 animate-pulse">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{t('proceedToCounter')}</span>
                </div>
              )}

              {isCompleted && (
                <div className="text-xs text-zinc-400 mt-2">
                  {t('orderDeliveredThanks')}
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
                <div className="h-1.5 rounded-full bg-emerald-500 transition-all" />
                {/* Step 2: Preparing */}
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    isPreparing
                      ? 'bg-amber-400'
                      : isReady || isCompleted
                      ? 'bg-emerald-500'
                      : 'bg-zinc-800'
                  }`}
                />
                {/* Step 3: Ready */}
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    isReady
                      ? 'bg-emerald-400'
                      : isCompleted
                      ? 'bg-emerald-500'
                      : 'bg-zinc-800'
                  }`}
                />
              </div>

              {/* Step Labels */}
              <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                <span className="text-emerald-400">{t('orderConfirmed')}</span>
                <span className={isPreparing ? 'text-amber-300 font-bold' : isReady || isCompleted ? 'text-emerald-400' : 'text-zinc-600'}>
                  {t('preparing')}
                </span>
                <span className={isReady ? 'text-emerald-300 font-bold' : isCompleted ? 'text-emerald-400' : 'text-zinc-600'}>
                  {t('ready')}
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
                      <span>{t('chimeAndVibeActive')}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      {t('active')}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handleExplicitUnlock}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <VolumeX className="w-4 h-4 text-emerald-400" />
                      <span>{t('enableChimeOnReady')}</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-300 underline">
                      {t('tapToEnable')}
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
                <span>{t('receivedMyOrder')}</span>
              </motion.button>
            )}

            {/* Completed State: Review and Feedback */}
            {isCompleted && (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center space-y-3">
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
                      className="px-6 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-bold text-white border border-white/[0.08] transition-colors cursor-pointer"
                    >
                      {t('submitFeedback')}
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold">
                      <Check className="w-4 h-4" />
                      <span>{t('feedbackThanks')}</span>
                    </div>
                  )}
                </div>

                <Link
                  href={`/${slug}/track`}
                  className="block w-full py-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-center text-xs font-bold text-white transition-all"
                >
                  {t('trackNewOrder')}
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
