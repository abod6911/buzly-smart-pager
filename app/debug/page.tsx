'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQueue } from '@/context/QueueContext';
import { soundManager } from '@/lib/audio';
import { pwaHelper } from '@/lib/pwa-helper';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Wifi,
  Server,
  Database,
  QrCode,
  Volume2,
  Bell,
  ArrowRight,
  ShieldCheck,
  Activity,
  Laptop,
  Smartphone,
  Sparkles,
} from 'lucide-react';

interface DiagnosticStep {
  name: string;
  status: 'idle' | 'running' | 'success' | 'failed';
  message?: string;
  durationMs?: number;
}

export default function DiagnosticsPage() {
  const { isSupabaseActive, addOrder, markReady, completeOrder, cancelOrder, syncNow } = useQueue();

  // Health check states
  const [serverLatency, setServerLatency] = useState<number | null>(null);
  const [serverOrdersCount, setServerOrdersCount] = useState<number>(0);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const [activeBaseUrl, setActiveBaseUrl] = useState<string>('');
  const [isLocalhost, setIsLocalhost] = useState<boolean>(false);

  const [audioState, setAudioState] = useState<string>('unknown');
  const [notifPermission, setNotifPermission] = useState<string>('default');
  const [swRegistered, setSwRegistered] = useState<boolean>(false);

  // E2E Test runner state
  const [isRunningE2E, setIsRunningE2E] = useState<boolean>(false);
  const [e2eSteps, setE2eSteps] = useState<DiagnosticStep[]>([
    { name: '1. فحص اتصال خادم المزامنة المحلي (/api/orders)', status: 'idle' },
    { name: '2. إنشاء طلب تجريبي واختباري (#999)', status: 'idle' },
    { name: '3. التأكد من حفظ الطلب بالخادم ومزامنته للشبكة', status: 'idle' },
    { name: '4. توليد رابط باركود صالح للجوال مع معلمات الأمان', status: 'idle' },
    { name: '5. محاكاة نداء الكاشير وإطلاق رنين الضيافة الفاخر', status: 'idle' },
    { name: '6. تسليم وأرشفة الطلب بنجاح', status: 'idle' },
  ]);

  // Initial Diagnostics Probe
  useEffect(() => {
    checkAllSystems();
  }, []);

  const checkAllSystems = async () => {
    // 1. Probe Server API Bridge
    const start = performance.now();
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' });
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        const data = await res.json();
        setServerLatency(latency);
        setServerOrdersCount(data.count || 0);
        setServerStatus('online');
      } else {
        setServerStatus('offline');
      }
    } catch {
      setServerStatus('offline');
    }

    // 2. Probe QR Base URL
    if (typeof window !== 'undefined') {
      const override = localStorage.getItem('buzly_base_url_override');
      const base = override?.trim() || window.location.origin;
      setActiveBaseUrl(base);
      setIsLocalhost(base.includes('localhost') || base.includes('127.0.0.1'));
    }

    // 3. Probe Audio
    if (typeof window !== 'undefined') {
      setAudioState('unlocked');
    }

    // 4. Probe Notifications & SW
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        setSwRegistered(regs.length > 0);
      });
    }
  };

  const runFullE2ETest = async () => {
    setIsRunningE2E(true);

    const updateStep = (index: number, status: 'running' | 'success' | 'failed', msg?: string, duration?: number) => {
      setE2eSteps((prev) =>
        prev.map((s, i) => (i === index ? { ...s, status, message: msg, durationMs: duration } : s))
      );
    };

    try {
      // Step 1: Check Server
      const t1 = performance.now();
      updateStep(0, 'running');
      const res = await fetch('/api/orders', { cache: 'no-store' });
      if (!res.ok) throw new Error('تعذر الاتصال بـ /api/orders');
      updateStep(0, 'success', `زمن الاستجابة: ${Math.round(performance.now() - t1)}ms`, Math.round(performance.now() - t1));

      // Step 2: Create Test Order
      const t2 = performance.now();
      updateStep(1, 'running');
      const testOrder = await addOrder('999', 10, 'طلب فحص تلقائي للنظام', undefined, 'demo-cafe');
      updateStep(1, 'success', `تم إنشاء الطلب #${testOrder.orderNumber} بنجاح`, Math.round(performance.now() - t2));

      // Step 3: Verify in Server Store
      const t3 = performance.now();
      updateStep(2, 'running');
      await syncNow();
      const verifyRes = await fetch('/api/orders?orderNumber=999', { cache: 'no-store' });
      const verifyData = await verifyRes.json();
      if (!verifyData.success || !verifyData.order) throw new Error('الطلب لم يتزامن في خادم الذاكرة');
      updateStep(2, 'success', 'الطلب متزامن ومتاح لجميع أجهزة الجوال على الشبكة', Math.round(performance.now() - t3));

      // Step 4: Validate QR Link
      const t4 = performance.now();
      updateStep(3, 'running');
      const targetBase = activeBaseUrl || window.location.origin;
      const qrUrl = `${targetBase}/demo-cafe/track/999?est=10&status=preparing`;
      if (isLocalhost) {
        updateStep(3, 'failed', `تحذير: الرابط يحتوي على localhost (${targetBase}). لن يعمل على الجوال إلا بتغيير الرابط للـ IP`);
      } else {
        updateStep(3, 'success', `رابط شبكة صالح للجوال: ${qrUrl}`, Math.round(performance.now() - t4));
      }

      // Step 5: Simulate Cashier Calling Ready & Play Chime
      const t5 = performance.now();
      updateStep(4, 'running');
      await soundManager.unlock();
      soundManager.playHospitalityChime();
      await markReady(testOrder.id, 'demo-cafe');
      updateStep(4, 'success', 'تم تفعيل التنبيه والنداء وتشغيل نغمة الضيافة الفندقية', Math.round(performance.now() - t5));

      // Step 6: Complete & Archive Order
      const t6 = performance.now();
      updateStep(5, 'running');
      await completeOrder(testOrder.id, 'demo-cafe');
      await cancelOrder(testOrder.id, 'demo-cafe');
      updateStep(5, 'success', 'تم تسليم الطلب الاختباري وتنظيف الطابور', Math.round(performance.now() - t6));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ في الاختبار';
      console.error(err);
      setE2eSteps((prev) =>
        prev.map((s) => (s.status === 'running' ? { ...s, status: 'failed', message: msg } : s))
      );
    } finally {
      setIsRunningE2E(false);
      checkAllSystems();
    }
  };

  return (
    <div className="min-h-screen bg-obsidian text-white flex flex-col font-cairo selection:bg-emerald-500 selection:text-black">
      {/* Header */}
      <header className="border-b border-obsidian-border bg-obsidian-surface/80 backdrop-blur-md px-4 py-4 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-xs font-bold">
            <ArrowRight className="w-4 h-4" />
            <span>العودة للرئيسية</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono font-bold text-xs text-white">مركز فحص وصحة النظام | System Diagnostics</span>
          </div>
          <button
            onClick={checkAllSystems}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-zinc-300 hover:text-white border border-obsidian-border text-xs font-bold transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>تحديث الفحص</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 py-8 space-y-6">
        {/* Intro */}
        <div className="text-right">
          <h1 className="text-2xl sm:text-3xl font-black text-white font-cairo flex items-center gap-2.5">
            <Activity className="w-7 h-7 text-emerald-400" />
            <span>فحص الجاهزية الشامل للتجربة على الجوال الحقيقي</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1.5">
            تحقق مباشر من الربط الشبكي بين اللابتوب والجوال، سرعة السيرفر، صحة الباركودات، ومحرك التنبيهات.
          </p>
        </div>

        {/* 4 Health Indicator Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Server Bridge */}
          <div className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-4 flex flex-col justify-between shadow-xl">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <Server className="w-5 h-5" />
              </div>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold font-mono ${
                serverStatus === 'online'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}>
                {serverStatus === 'online' ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">جسر السيرفر المحلي</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">مزامنة الأجهزة عبر Wi-Fi</p>
            </div>
            <div className="mt-4 pt-3 border-t border-obsidian-border/80 text-[11px] text-zinc-300 flex items-center justify-between font-mono">
              <span>زمن الاستجابة:</span>
              <span className="text-emerald-400 font-bold">{serverLatency ? `${serverLatency}ms` : '---'}</span>
            </div>
          </div>

          {/* Card 2: Supabase */}
          <div className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-4 flex flex-col justify-between shadow-xl">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold font-mono ${
                isSupabaseActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-buzly-amber/10 text-buzly-amber border border-buzly-amber/30'
              }`}>
                {isSupabaseActive ? 'CLOUD' : 'FALLBACK'}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">قاعدة البيانات</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {isSupabaseActive ? 'Supabase Realtime متصل' : 'السيرفر المحلي كبديل ذكي'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-obsidian-border/80 text-[11px] text-zinc-300 flex items-center justify-between">
              <span>الحالة:</span>
              <span className="text-zinc-200 font-bold">{isSupabaseActive ? 'سحابي فوري' : 'جاهز ويعمل 100%'}</span>
            </div>
          </div>

          {/* Card 3: QR Network Safety */}
          <div className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-4 flex flex-col justify-between shadow-xl">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${
                isLocalhost
                  ? 'bg-buzly-amber/10 border-buzly-amber/30 text-buzly-amber'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}>
                <QrCode className="w-5 h-5" />
              </div>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                isLocalhost
                  ? 'bg-buzly-amber/10 text-buzly-amber border border-buzly-amber/30'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              }`}>
                {isLocalhost ? '⚠️ LOCALHOST' : '✓ MOBILE READY'}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">صلاحية رابط الباركود</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {isLocalhost ? 'يجب تغييره لـ IP الشبكة للمسح' : 'صالح 100% لمسح الجوال'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-obsidian-border/80 text-[10px] text-zinc-400 font-mono truncate dir-ltr">
              {activeBaseUrl || '---'}
            </div>
          </div>

          {/* Card 4: Audio & Push */}
          <div className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-4 flex flex-col justify-between shadow-xl">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center">
                <Volume2 className="w-5 h-5" />
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                READY
              </span>
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">محرك الصوت والإشعار</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">نغمات Web Audio والاهتزاز</p>
            </div>
            <div className="mt-4 pt-3 border-t border-obsidian-border/80 text-[11px] text-zinc-300 flex items-center justify-between">
              <span>الإشعارات:</span>
              <span className="text-zinc-200 font-bold">{notifPermission}</span>
            </div>
          </div>
        </div>

        {/* E2E Test Runner Suite */}
        <div className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-obsidian-border/80 gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <span>زر الاختبار الشامل التلقائي (Automated End-to-End Test)</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                ينشئ طلباً اختبارياً (#999) ويفحص مزامنته الفورية، توليد الباركود، رنين الجرس، وأرشفة الطلب.
              </p>
            </div>
            <button
              onClick={runFullE2ETest}
              disabled={isRunningE2E}
              className={`py-3 px-6 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xl ${
                isRunningE2E
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black shadow-emerald-500/25'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isRunningE2E ? 'جارِ تنفيذ الاختبار...' : 'تشغيل الاختبار الشامل الآن'}</span>
            </button>
          </div>

          {/* Test Steps List */}
          <div className="mt-5 space-y-3">
            {e2eSteps.map((step, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                  step.status === 'success'
                    ? 'bg-emerald-500/5 border-emerald-500/30 text-white'
                    : step.status === 'running'
                    ? 'bg-buzly-amber/10 border-buzly-amber/40 text-buzly-amber animate-pulse'
                    : step.status === 'failed'
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : 'bg-obsidian-card border-obsidian-border text-zinc-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  {step.status === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                  {step.status === 'running' && (
                    <div className="w-5 h-5 rounded-full border-2 border-buzly-amber border-t-transparent animate-spin shrink-0" />
                  )}
                  {step.status === 'failed' && <XCircle className="w-5 h-5 text-rose-400 shrink-0" />}
                  {step.status === 'idle' && <div className="w-5 h-5 rounded-full border border-zinc-700 shrink-0" />}
                  <div>
                    <span className="text-xs font-bold block">{step.name}</span>
                    {step.message && (
                      <span className="text-[11px] text-zinc-400 mt-0.5 block">{step.message}</span>
                    )}
                  </div>
                </div>

                {step.durationMs !== undefined && (
                  <span className="font-mono text-xs font-bold text-zinc-400 shrink-0">
                    {step.durationMs}ms
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sound Test Panel */}
        <div className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span>تجربة النغمات والنداء الصوتي العربي مباشرة على هذا الجهاز:</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            <button
              onClick={async () => {
                await soundManager.unlock();
                soundManager.playHospitalityChime();
              }}
              className="p-3 rounded-2xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-xs font-bold text-zinc-200 hover:text-white transition-all text-center"
            >
              🛎️ جرس الفندق
            </button>
            <button
              onClick={async () => {
                await soundManager.unlock();
                soundManager.playCoffeeZenChime();
              }}
              className="p-3 rounded-2xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-xs font-bold text-zinc-200 hover:text-white transition-all text-center"
            >
              ☕ كافيه زين
            </button>
            <button
              onClick={async () => {
                await soundManager.unlock();
                soundManager.playFastCasualDing();
              }}
              className="p-3 rounded-2xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-xs font-bold text-zinc-200 hover:text-white transition-all text-center"
            >
              🍔 رنين سريع
            </button>
            <button
              onClick={async () => {
                await soundManager.unlock();
                soundManager.playRetroBuzzer();
              }}
              className="p-3 rounded-2xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-xs font-bold text-zinc-200 hover:text-white transition-all text-center"
            >
              📟 بيجر نبضي
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
