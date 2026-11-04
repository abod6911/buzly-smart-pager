'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQueue } from '@/context/QueueContext';
import { soundManager } from '@/lib/audio';
import {
  Bell,
  Smartphone,
  Store,
  Volume2,
  Sparkles,
  ArrowLeft,
  Radio,
  CheckCircle2,
  Clock,
  Layers,
  Zap,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

export default function LandingRoleSwitcherPage() {
  const { preparingOrders, readyOrders, resetToDemoOrders } = useQueue();
  const [isPlayingTestSound, setIsPlayingTestSound] = useState<boolean>(false);

  const handleTestChime = async () => {
    setIsPlayingTestSound(true);
    await soundManager.unlock();
    soundManager.playHospitalityChime();
    setTimeout(() => setIsPlayingTestSound(false), 2200);
  };

  return (
    <div className="min-h-screen bg-obsidian text-white flex flex-col font-cairo selection:bg-emerald-500 selection:text-black">
      {/* Interactive Top Live Sync Demo Bar */}
      <div className="bg-gradient-to-r from-emerald-950 via-obsidian-surface to-emerald-950 border-b border-emerald-500/20 px-4 py-2 text-xs">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold text-emerald-400">
              المزامنة المباشرة نشطة تلقائياً بين التبويبات (BroadcastChannel + LocalStorage)
            </span>
          </div>
          <div className="flex items-center gap-3 text-zinc-400">
            <span>
              قيد التحضير: <strong className="text-buzly-amber">{preparingOrders.length}</strong>
            </span>
            <span>•</span>
            <span>
              جاهز للاستلام: <strong className="text-emerald-400">{readyOrders.length}</strong>
            </span>
            <span>•</span>
            <button
              onClick={resetToDemoOrders}
              className="text-emerald-400 hover:underline font-bold"
            >
              إعادة ضبط البيانات التجريبية
            </button>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <header className="border-b border-obsidian-border/80 px-4 sm:px-6 py-4 bg-obsidian-surface/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-black font-black text-xl shadow-lg shadow-emerald-500/20">
              <Bell className="w-5 h-5 text-black" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-white font-mono">
                BUZLY
              </span>
              <span className="text-[10px] block text-emerald-400 font-semibold -mt-1">
                البيجر الذكي للمطاعم والكافيهات
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleTestChime}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                isPlayingTestSound
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-lg shadow-emerald-500/20'
                  : 'bg-obsidian-card hover:bg-obsidian-border text-zinc-300 border-obsidian-border'
              }`}
            >
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span>{isPlayingTestSound ? 'جارِ الرنين 🔔' : 'تجربة صوت الجرس'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto pt-4 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>وداعاً للأجهزة البلاستيكية الضائعة والمكلفة</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white font-cairo tracking-tight leading-tight sm:leading-tight">
            نظام بيجر المطاعم الذكي
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
              في متصفح جوال الزبون مباشرة
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 mt-4 leading-relaxed max-w-2xl mx-auto">
            امسح الكود واستلم طلبك فور جاهزيته. رنين صوتي فاخر واهتزاز مستمر ينبه العميل حتى لو كان هاتفه في جيبه أو شاشته مغلقة.
          </p>
        </div>

        {/* ========================================================================= */}
        {/* TWO PROMINENT HERO ROLE CARDS: STAFF POS vs CUSTOMER TRACKER */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full mb-12">
          {/* Card 1: Staff Cashier Pad */}
          <Link
            href="/staff"
            className="group relative bg-obsidian-surface hover:bg-obsidian-surface/90 border-2 border-obsidian-border hover:border-emerald-500/50 rounded-3xl p-6 sm:p-8 transition-all duration-300 shadow-2xl flex flex-col justify-between overflow-hidden"
          >
            {/* Ambient hover glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />

            <div>
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Store className="w-7 h-7" />
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  لوحة الكاشير وطاقم العمل
                </span>
                <span className="text-[11px] bg-obsidian-card px-2.5 py-0.5 rounded-full border border-obsidian-border text-zinc-400">
                  مخصصة للآيباد والكمبيوتر
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-cairo mb-3 group-hover:text-emerald-400 transition-colors">
                شاشة الكاشير (Staff Pad)
              </h2>

              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                لوحة إدخال سريعة بالأرقام لإضافة الطلب في ثانيتين، نداء العميل بضغطة واحدة، إعادة التنبيه، وإدارة الطابور بالكامل لحظياً.
              </p>

              <div className="space-y-2 mb-6 text-xs text-zinc-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>لوحة أرقام سريعة + مؤقت جاهزية (5 إلى 30 د)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>نداء فوري (Call Ready) يطلق رنين الزبون</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>توليد كود QR ديناميكي للطلب أو الكاونتر</span>
                </div>
              </div>
            </div>

            <div className="w-full py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all group-hover:translate-x-1">
              <span>فتح لوحة الكاشير</span>
              <ArrowLeft className="w-4 h-4" />
            </div>
          </Link>

          {/* Card 2: Customer Order Tracker */}
          <Link
            href="/track"
            className="group relative bg-obsidian-surface hover:bg-obsidian-surface/90 border-2 border-obsidian-border hover:border-buzly-amber/50 rounded-3xl p-6 sm:p-8 transition-all duration-300 shadow-2xl flex flex-col justify-between overflow-hidden"
          >
            {/* Ambient hover glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-buzly-amber/10 rounded-full blur-2xl group-hover:bg-buzly-amber/20 transition-all pointer-events-none" />

            <div>
              <div className="w-14 h-14 rounded-2xl bg-buzly-amber/10 border border-buzly-amber/30 text-buzly-amber flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Smartphone className="w-7 h-7" />
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-buzly-amber">
                  واجهة العميل والزبون
                </span>
                <span className="text-[11px] bg-obsidian-card px-2.5 py-0.5 rounded-full border border-obsidian-border text-zinc-400">
                  مخصصة للجوال
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-cairo mb-3 group-hover:text-buzly-amber transition-colors">
                شاشة العميل (Customer View)
              </h2>

              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                تجربة العميل عند مسح الباركود: عداد الوقت المتبقي، إبقاء الشاشة نشطة (WakeLock)، وتحول الشاشة للون الأخضر مع رنين مستمر واهتزاز.
              </p>

              <div className="space-y-2 mb-6 text-xs text-zinc-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-buzly-amber" />
                  <span>حالة التحضير مع عداد تنازلي وموسيقى هادئة</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-buzly-amber" />
                  <span>تنبيه كامل الشاشة مع صوت جرس فندقي واهتزاز</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-buzly-amber" />
                  <span>إشعار نظام (System Notification) لخلفية المتصفح</span>
                </div>
              </div>
            </div>

            <div className="w-full py-3.5 px-5 rounded-2xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-all group-hover:translate-x-1">
              <span>فتح شاشة العميل</span>
              <ArrowLeft className="w-4 h-4" />
            </div>
          </Link>
        </div>

        {/* Interactive Testing Walkthrough */}
        <div className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-6 sm:p-8 max-w-4xl mx-auto w-full shadow-xl">
          <div className="flex items-center gap-2.5 mb-4">
            <Zap className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-lg text-white font-cairo">
              كيف تختبر المزامنة الفورية الآن خلال 10 ثوانٍ؟
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-obsidian-card border border-obsidian-border rounded-2xl p-4">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center mb-2">
                1
              </span>
              <h4 className="font-bold text-white mb-1">افتح شاشة الكاشير</h4>
              <p className="text-zinc-400">
                افتح <Link href="/staff" target="_blank" className="text-emerald-400 underline">شاشة الكاشير في تبويب منفصل</Link>.
              </p>
            </div>

            <div className="bg-obsidian-card border border-obsidian-border rounded-2xl p-4">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center mb-2">
                2
              </span>
              <h4 className="font-bold text-white mb-1">افتح شاشة تتبع الطلب #104</h4>
              <p className="text-zinc-400">
                افتح <Link href="/track/104" target="_blank" className="text-emerald-400 underline">شاشة تتبع الطلب #104</Link> واضغط "تفعيل جرس التنبيه".
              </p>
            </div>

            <div className="bg-obsidian-card border border-obsidian-border rounded-2xl p-4">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center mb-2">
                3
              </span>
              <h4 className="font-bold text-white mb-1">اضغط "نداء العميل"</h4>
              <p className="text-zinc-400">
                من شاشة الكاشير اضغط <strong>نداء العميل</strong> وراقب شاشة الزبون ترن وتهتز فوراً!
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-obsidian-border/80 px-4 py-6 text-center text-xs text-zinc-500 mt-auto">
        <p>Buzly Smart Restaurant Pager © 2026 - نظام الاستدعاء والبيجر الذكي للمطاعم</p>
      </footer>
    </div>
  );
}
