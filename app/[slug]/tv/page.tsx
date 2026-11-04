'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueue } from '@/context/QueueContext';
import { soundManager } from '@/lib/audio';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Clock,
  Bell,
  Flame,
  CheckCircle2,
  Sparkles,
  Mic,
  MicOff,
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
  const [newReadyFlash, setNewReadyFlash] = useState<boolean>(false);
  const previousReadyCount = useRef<number>(0);

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

  // React to new ready orders & play airport chime + optional Arabic voice on TV
  useEffect(() => {
    if (readyOrders.length > previousReadyCount.current && previousReadyCount.current !== 0) {
      if (audioEnabled) {
        soundManager.playThemedChime(restaurant.chimeTheme || 'hospitality');
        if (voiceEnabled && readyOrders[0]) {
          setTimeout(() => {
            soundManager.announceOrderArabic(readyOrders[0].orderNumber, restaurant.name);
          }, 1400);
        }
      }
      setNewReadyFlash(true);
      setTimeout(() => setNewReadyFlash(false), 2500);
    }
    previousReadyCount.current = readyOrders.length;
  }, [readyOrders, audioEnabled, voiceEnabled, restaurant.chimeTheme, restaurant.name]);

  // Listener for direct realtime events
  useEffect(() => {
    if (!lastEvent) return;
    if (
      (lastEvent.type === 'ORDER_READY' || lastEvent.type === 'ORDER_REPING') &&
      lastEvent.restaurantSlug === slug
    ) {
      if (audioEnabled) {
        soundManager.playThemedChime(restaurant.chimeTheme || 'hospitality');
        if (voiceEnabled && lastEvent.orderNumber) {
          setTimeout(() => {
            soundManager.announceOrderArabic(lastEvent.orderNumber!, restaurant.name);
          }, 1400);
        }
      }
      setNewReadyFlash(true);
      setTimeout(() => setNewReadyFlash(false), 2500);
    }
  }, [lastEvent, slug, audioEnabled, voiceEnabled, restaurant.chimeTheme, restaurant.name]);

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

  return (
    <div
      className={`min-h-screen bg-obsidian text-white flex flex-col font-cairo overflow-hidden select-none transition-colors duration-500 ${
        newReadyFlash ? 'bg-emerald-950/40 ring-8 ring-emerald-500/50 inset-0' : ''
      }`}
    >
      {/* ========================================================================= */}
      {/* TV HEADER BAR */}
      {/* ========================================================================= */}
      <header className="border-b-2 border-obsidian-border bg-obsidian-surface/90 backdrop-blur-md px-6 py-4 flex items-center justify-between shadow-2xl">
        {/* Brand & Logo */}
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border border-white/10 overflow-hidden"
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
              <Bell className="w-8 h-8" style={{ color: restaurant.themeColor }} />
            )}
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-white font-cairo tracking-tight">
              {restaurant.name}
            </h1>
            <p className="text-xs lg:text-sm text-zinc-400 font-semibold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>شاشة نداء الطلبات الحية (Live Order Status)</span>
            </p>
          </div>
        </div>

        {/* Live Clock & Actions */}
        <div className="flex items-center gap-6">
          {/* Digital Clock */}
          <div className="bg-obsidian-card border border-obsidian-border px-5 py-2.5 rounded-2xl flex items-center gap-2.5 shadow-inner">
            <Clock className="w-5 h-5 text-buzly-amber" />
            <span className="font-mono text-2xl lg:text-3xl font-black text-white tracking-wider">
              {currentTime || '--:--:--'}
            </span>
          </div>

          {/* Sound Toggle Button */}
          <button
            onClick={toggleAudio}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all border ${
              audioEnabled
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-obsidian-card hover:bg-obsidian-border text-zinc-400 border-obsidian-border'
            }`}
            title="تفعيل صوت جرس النداء للشاشة"
          >
            {audioEnabled ? <Volume2 className="w-5 h-5 text-emerald-400" /> : <VolumeX className="w-5 h-5" />}
            <span className="hidden md:inline">{audioEnabled ? 'جرس التنبيه مفعل' : 'انقر لتفعيل الصوت'}</span>
          </button>

          {/* Arabic Voice Callout Toggle */}
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`flex items-center gap-2 px-3.5 py-3 rounded-2xl font-bold text-sm transition-all border ${
              voiceEnabled
                ? 'bg-buzly-amber/20 text-buzly-amber border-buzly-amber/40'
                : 'bg-obsidian-card hover:bg-obsidian-border text-zinc-500 border-obsidian-border'
            }`}
            title="تفعيل النداء الصوتي بالعربي"
          >
            {voiceEnabled ? <Mic className="w-5 h-5 text-buzly-amber" /> : <MicOff className="w-5 h-5" />}
            <span className="hidden lg:inline">{voiceEnabled ? 'النداء الصوتي بالعربي 🎙️' : 'النداء الصوتي معطل'}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-2xl bg-obsidian-card hover:bg-obsidian-border text-zinc-300 border border-obsidian-border transition-colors"
            title="ملء الشاشة للتلفاز"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2 GIANT COLUMNS: PREPARING (Right) & READY (Left) */}
      {/* ========================================================================= */}
      <main className="flex-1 grid grid-cols-2 divide-x-2 divide-x-reverse divide-obsidian-border p-6 gap-6 overflow-hidden">
        {/* COLUMN 1: PREPARING (قيد التحضير) */}
        <div className="flex flex-col bg-obsidian-surface/60 rounded-3xl border border-obsidian-border p-6 shadow-2xl overflow-hidden">
          {/* Section Header */}
          <div className="flex items-center justify-between pb-4 border-b-2 border-obsidian-border/80 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-buzly-amber/15 border border-buzly-amber/30 flex items-center justify-center text-buzly-amber">
                <Flame className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h2 className="text-2xl lg:text-3xl font-extrabold text-buzly-amber font-cairo">
                  قيد التحضير (Preparing)
                </h2>
                <p className="text-xs lg:text-sm text-zinc-400">يتم إعدادها في المطبخ والبار</p>
              </div>
            </div>
            <span className="px-4 py-1.5 rounded-full bg-buzly-amber/10 border border-buzly-amber/30 text-buzly-amber text-lg font-black font-mono">
              {preparingOrders.length}
            </span>
          </div>

          {/* Orders Grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <AnimatePresence>
                {preparingOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="bg-obsidian-card border-2 border-obsidian-border hover:border-buzly-amber/40 rounded-3xl p-5 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden group"
                  >
                    <div className="text-xs text-zinc-400 font-bold mb-1">طلب #</div>
                    <div className="font-mono text-5xl lg:text-6xl font-black text-white tracking-tight group-hover:text-buzly-amber transition-colors">
                      {order.orderNumber}
                    </div>
                    <div className="mt-2 text-xs font-semibold text-buzly-amber/90 flex items-center gap-1 font-mono">
                      <span>{getElapsedMins(order.createdAt)} دقيقة</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {preparingOrders.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center py-20">
                <Flame className="w-16 h-16 mb-3 stroke-[1.2] opacity-50" />
                <p className="text-lg font-bold">لا توجد طلبات قيد التحضير حالياً</p>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2: READY FOR PICKUP (جاهز للاستلام) */}
        <div className="flex flex-col bg-emerald-950/20 rounded-3xl border-2 border-emerald-500/30 p-6 shadow-2xl overflow-hidden relative">
          {/* Ambient Glow */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Section Header */}
          <div className="flex items-center justify-between pb-4 border-b-2 border-emerald-500/20 mb-6 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-black flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Bell className="w-6 h-6 animate-bounce-subtle" />
              </div>
              <div>
                <h2 className="text-2xl lg:text-3xl font-extrabold text-emerald-400 font-cairo">
                  جاهز للاستلام (Ready Now)
                </h2>
                <p className="text-xs lg:text-sm text-zinc-300">تفضل بالتوجه إلى الكاونتر</p>
              </div>
            </div>
            <span className="px-4 py-1.5 rounded-full bg-emerald-500 text-black text-lg font-black font-mono shadow-lg shadow-emerald-500/30">
              {readyOrders.length}
            </span>
          </div>

          {/* Orders Grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 relative z-10">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <AnimatePresence>
                {readyOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, scale: 0.85, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className="bg-emerald-500 text-black rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-2xl shadow-emerald-500/30 border-4 border-emerald-300 animate-pulse-glow-emerald"
                  >
                    <div className="text-xs uppercase font-extrabold text-black/75 mb-1">
                      طلب جاهز 🔔
                    </div>
                    <div className="font-mono text-6xl lg:text-7xl font-black text-black tracking-tight">
                      {order.orderNumber}
                    </div>
                    <div className="mt-2 text-xs font-black bg-black/15 px-3 py-1 rounded-full text-black">
                      استلم الآن
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {readyOrders.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center py-20">
                <CheckCircle2 className="w-16 h-16 mb-3 stroke-[1.2] opacity-50" />
                <p className="text-lg font-bold">بانتظار تجهيز الطلبات</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Info Ticker */}
      <footer className="border-t border-obsidian-border bg-obsidian-surface/60 px-6 py-2.5 flex items-center justify-between text-xs text-zinc-400">
        <span className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>تظهر الأرقام تلقائياً فور تجهيزها مع تنبيه صوتي فندقي</span>
        </span>
        <span className="font-mono font-semibold">Buzly Smart Kitchen Display v3.0</span>
      </footer>
    </div>
  );
}
