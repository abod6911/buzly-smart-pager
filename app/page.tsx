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
  Activity,
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
              onClick={() => resetToDemoOrders('demo-cafe')}
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

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/debug"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-zinc-300 hover:text-white border border-obsidian-border text-xs font-bold transition-all"
              title="فحص وصحة النظام والجوال"
            >
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">فحص النظام والجوال</span>
            </Link>

            <button
              onClick={handleTestChime}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                isPlayingTestSound
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-lg shadow-emerald-500/20'
                  : 'bg-obsidian-card hover:bg-obsidian-border text-zinc-300 border-obsidian-border'
              }`}
            >
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">{isPlayingTestSound ? 'جارِ الرنين 🔔' : 'تجربة صوت الجرس'}</span>
            </button>

            <Link
              href="/onboard"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>سجل مطعمك مجاناً 🚀</span>
            </Link>
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

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/onboard"
              className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm shadow-xl shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>أنشئ بيجر مطعمك الآن (30 ثانية)</span>
            </Link>

            <Link
              href="/demo-cafe/staff"
              className="px-5 py-3.5 rounded-2xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-white font-bold text-sm transition-all flex items-center gap-2"
            >
              <span>معاينة كاشير Demo Cafe</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MULTI-TENANT HERO ACTION TILES */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto w-full mb-12">
          {/* Card 1: Staff Cashier Pad */}
          <Link
            href="/demo-cafe/staff"
            className="group bg-obsidian-surface hover:bg-obsidian-surface/90 border-2 border-obsidian-border hover:border-emerald-500/50 rounded-3xl p-6 transition-all shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Store className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                الكاشير (محمي برقم سري: 1234)
              </span>
              <h2 className="text-xl font-black text-white font-cairo mb-2 group-hover:text-emerald-400 transition-colors">
                شاشة الكاشير POS
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                لوحة إدخال بالأرقام في ثانيتين، نداء فوري، تنبيه واتساب، وتوليد كود QR للطلب.
              </p>
            </div>
            <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all">
              <span>فتح الكاشير</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* Card 2: Kitchen TV Screen */}
          <Link
            href="/demo-cafe/tv"
            target="_blank"
            className="group bg-obsidian-surface hover:bg-obsidian-surface/90 border-2 border-obsidian-border hover:border-buzly-amber/50 rounded-3xl p-6 transition-all shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-buzly-amber/10 border border-buzly-amber/30 text-buzly-amber flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Layers className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-buzly-amber uppercase tracking-wider block mb-1">
                تلفاز الصالة والمطبخ (TV)
              </span>
              <h2 className="text-xl font-black text-white font-cairo mb-2 group-hover:text-buzly-amber transition-colors">
                شاشة التلفاز التفاعلية
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                شاشة عريضة 16:9 بجودة فائقة تعرض أرقام التحضير وجاهزية الطلبات مع صوت جرس فندقي.
              </p>
            </div>
            <div className="w-full py-2.5 px-4 rounded-xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-buzly-amber font-extrabold text-xs flex items-center justify-center gap-2 transition-all">
              <span>عرض شاشة التلفاز</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* Card 3: Customer Tracker */}
          <Link
            href="/demo-cafe/track"
            target="_blank"
            className="group bg-obsidian-surface hover:bg-obsidian-surface/90 border-2 border-obsidian-border hover:border-teal-500/50 rounded-3xl p-6 transition-all shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Smartphone className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block mb-1">
                جوال العميل والزبون
              </span>
              <h2 className="text-xl font-black text-white font-cairo mb-2 group-hover:text-teal-400 transition-colors">
                شاشة بيجر العميل
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                تتبع العداد التنازلي، تحول الشاشة للأخضر مع رنين واهتزاز مستمر وإشعارات شاشة مقفلة.
              </p>
            </div>
            <div className="w-full py-2.5 px-4 rounded-xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all">
              <span>تجربة شاشة العميل</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* Card 4: Settings & Analytics */}
          <Link
            href="/demo-cafe/admin"
            className="group bg-obsidian-surface hover:bg-obsidian-surface/90 border-2 border-obsidian-border hover:border-purple-500/50 rounded-3xl p-6 transition-all shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-1">
                الهوية والطباعة والتحليلات
              </span>
              <h2 className="text-xl font-black text-white font-cairo mb-2 group-hover:text-purple-400 transition-colors">
                إدارة المتجر والطباعة
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                تخصيص الألوان والشعار، طباعة ستاند الطاولات A5، ومؤشرات أداء وسرعة تحضير المطبخ.
              </p>
            </div>
            <div className="w-full py-2.5 px-4 rounded-xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-purple-300 font-extrabold text-xs flex items-center justify-center gap-2 transition-all">
              <span>إعدادات المتجر والطباعة</span>
              <ArrowLeft className="w-3.5 h-3.5" />
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
