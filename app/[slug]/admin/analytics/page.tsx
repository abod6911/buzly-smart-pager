'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQueue } from '@/context/QueueContext';
import { StaffPinGuard } from '@/components/StaffPinGuard';
import {
  BarChart3,
  ArrowRight,
  Clock,
  CheckCircle2,
  TrendingUp,
  Flame,
  Zap,
  Award,
  Layers,
  Calendar,
} from 'lucide-react';

export default function KitchenAnalyticsPage() {
  const params = useParams();
  const slug = (params.slug as string) || 'demo-cafe';

  const { getRestaurant, getOrdersForRestaurant } = useQueue();
  const restaurant = getRestaurant(slug);
  const orders = getOrdersForRestaurant(slug);

  // Analytics Calculations
  const analytics = useMemo(() => {
    const totalOrders = orders.length;
    const preparingCount = orders.filter((o) => o.status === 'preparing').length;
    const readyCount = orders.filter((o) => o.status === 'ready').length;
    const completedCount = orders.filter((o) => o.status === 'completed').length;

    // Prep Time: readyAt - createdAt (in minutes)
    const prepTimes: number[] = [];
    orders.forEach((o) => {
      if (o.readyAt && o.createdAt) {
        const diffMs = new Date(o.readyAt).getTime() - new Date(o.createdAt).getTime();
        const mins = Math.max(1, Math.round(diffMs / 60000));
        prepTimes.push(mins);
      }
    });

    const avgPrepMins =
      prepTimes.length > 0
        ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length)
        : 8;

    // Pickup Delay: completedAt - readyAt (in minutes)
    const pickupDelays: number[] = [];
    orders.forEach((o) => {
      if (o.completedAt && o.readyAt) {
        const diffMs = new Date(o.completedAt).getTime() - new Date(o.readyAt).getTime();
        const mins = Math.max(1, Math.round(diffMs / 60000));
        pickupDelays.push(mins);
      }
    });

    const avgPickupMins =
      pickupDelays.length > 0
        ? Math.round(pickupDelays.reduce((a, b) => a + b, 0) / pickupDelays.length)
        : 2;

    // Hourly Distribution (e.g. 12:00 to 23:00)
    const hourCounts: Record<number, number> = {};
    for (let h = 12; h <= 23; h++) {
      hourCounts[h] = 0;
    }

    orders.forEach((o) => {
      const h = new Date(o.createdAt).getHours();
      if (hourCounts[h] !== undefined) {
        hourCounts[h] += 1;
      } else {
        hourCounts[h] = 1;
      }
    });

    // Find peak hour
    let peakHour = 19;
    let maxHourlyOrders = 0;
    Object.entries(hourCounts).forEach(([hourStr, count]) => {
      if (count > maxHourlyOrders) {
        maxHourlyOrders = count;
        peakHour = Number(hourStr);
      }
    });

    return {
      totalOrders,
      preparingCount,
      readyCount,
      completedCount,
      avgPrepMins,
      avgPickupMins,
      hourCounts,
      peakHour,
      maxHourlyOrders: Math.max(4, maxHourlyOrders),
    };
  }, [orders]);

  return (
    <StaffPinGuard restaurant={restaurant} onUnlocked={() => {}}>
      <div className="min-h-screen bg-obsidian text-white flex flex-col font-cairo selection:bg-emerald-500 selection:text-black">
        {/* Header */}
        <header className="border-b border-obsidian-border bg-obsidian-surface/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-3.5">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href={`/${slug}/staff`}
                className="p-2 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-zinc-400 hover:text-white transition-colors"
                title="الرجوع للكاشير"
              >
                <ArrowRight className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="font-extrabold text-lg text-white font-cairo flex items-center gap-2">
                  <span>تحليلات وسرعة المطبخ (Kitchen Analytics)</span>
                  <span
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full text-black font-bold"
                    style={{ backgroundColor: restaurant.themeColor }}
                  >
                    {slug}
                  </span>
                </h1>
                <p className="text-xs text-zinc-400">قياس دقيق لمتوسط سرعة التحضير وتأخير استلام الزبائن</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/${slug}/admin`}
                className="px-3 py-1.5 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-xs font-bold text-zinc-300 border border-obsidian-border"
              >
                إعدادات الهوية
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-6xl w-full mx-auto p-4 sm:px-6 py-8 flex-1 space-y-6">
          {/* Smart Insights Banner */}
          <div className="bg-gradient-to-r from-emerald-950/60 via-obsidian-surface to-emerald-950/60 border border-emerald-500/30 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  مستوى كفاءة المطبخ: {analytics.avgPrepMins <= 10 ? 'فائق السرعة (Excellent) ⚡' : 'مستقر (Normal) ✨'}
                </h3>
                <p className="text-xs text-zinc-300 mt-0.5">
                  متوسط وقت تحضير الوجبة قرابة <strong>{analytics.avgPrepMins} دقائق</strong>، وسرعة استلام العميل بعد النداء <strong>{analytics.avgPickupMins} دقائق</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-400 bg-obsidian-card px-3.5 py-1.5 rounded-xl border border-obsidian-border">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>إحصائيات اليوم المباشرة</span>
            </div>
          </div>

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Total Orders */}
            <div className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-5 shadow-lg">
              <span className="text-xs font-bold text-zinc-400 block mb-1">إجمالي طلبات اليوم</span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black font-mono text-white">
                  {analytics.totalOrders}
                </span>
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-0.5">
                  <TrendingUp className="w-3.5 h-3.5" /> +100%
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-2">تشمل النشطة والمكتملة</p>
            </div>

            {/* KPI 2: Average Prep Time */}
            <div className="bg-obsidian-surface border border-buzly-amber/30 rounded-3xl p-5 shadow-lg">
              <span className="text-xs font-bold text-buzly-amber block mb-1">
                متوسط وقت التحضير (Prep Time)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black font-mono text-buzly-amber">
                  {analytics.avgPrepMins}
                  <span className="text-base font-normal mr-1">د</span>
                </span>
                <Clock className="w-5 h-5 text-buzly-amber/70" />
              </div>
              <p className="text-[11px] text-zinc-500 mt-2">من استلام الطلب إلى الجاهزية</p>
            </div>

            {/* KPI 3: Average Pickup Delay */}
            <div className="bg-obsidian-surface border border-emerald-500/30 rounded-3xl p-5 shadow-lg">
              <span className="text-xs font-bold text-emerald-400 block mb-1">
                سرعة استلام العميل (Pickup Delay)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black font-mono text-emerald-400">
                  {analytics.avgPickupMins}
                  <span className="text-base font-normal mr-1">د</span>
                </span>
                <Zap className="w-5 h-5 text-emerald-400/70" />
              </div>
              <p className="text-[11px] text-zinc-500 mt-2">من إطلاق الجرس إلى الاستلام</p>
            </div>

            {/* KPI 4: Active In Flight */}
            <div className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-5 shadow-lg">
              <span className="text-xs font-bold text-zinc-400 block mb-1">
                الطلبات النشطة بالمطبخ
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black font-mono text-white">
                  {analytics.preparingCount + analytics.readyCount}
                </span>
                <Flame className="w-5 h-5 text-buzly-amber animate-pulse" />
              </div>
              <p className="text-[11px] text-zinc-500 mt-2">
                {analytics.preparingCount} تحضير • {analytics.readyCount} جاهز
              </p>
            </div>
          </div>

          {/* Peak Hours Chart */}
          <div className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span>توزيع أوقات الذروة حسب ساعات اليوم (Peak Hours)</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  ساعة الذروة اليوم كانت عند الساعة <strong>{analytics.peakHour}:00</strong>
                </p>
              </div>
            </div>

            {/* Visual Bar Chart */}
            <div className="h-56 flex items-end justify-between gap-2 pt-6 pb-2 px-2 border-b border-obsidian-border">
              {Object.entries(analytics.hourCounts).map(([hour, count]) => {
                const heightPercent = Math.max(
                  12,
                  Math.round((count / analytics.maxHourlyOrders) * 100)
                );
                const isPeak = Number(hour) === analytics.peakHour;

                return (
                  <div key={hour} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <span className="text-[10px] font-mono font-bold text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {count}
                    </span>
                    <div
                      className={`w-full max-w-[32px] rounded-t-xl transition-all duration-500 ${
                        isPeak
                          ? 'bg-emerald-400 shadow-lg shadow-emerald-400/30'
                          : 'bg-obsidian-card hover:bg-emerald-500/40 border border-obsidian-border'
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                    <span className="text-[10px] font-mono text-zinc-500 mt-1">
                      {hour}h
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Orders Log Table */}
          <div className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-6 shadow-xl">
            <h3 className="font-extrabold text-base text-white mb-4">سجل الطلبات الأخير وسرعة الاستجابة</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-obsidian-border text-zinc-400">
                    <th className="pb-3 font-semibold">رقم الطلب</th>
                    <th className="pb-3 font-semibold">الحالة</th>
                    <th className="pb-3 font-semibold">وقت التحضير التقديري</th>
                    <th className="pb-3 font-semibold">تاريخ الطلب</th>
                    <th className="pb-3 font-semibold">التنبيهات (Pings)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-border/50 text-zinc-300">
                  {orders.slice(0, 8).map((o) => (
                    <tr key={o.id} className="hover:bg-obsidian-card/40 transition-colors">
                      <td className="py-3 font-mono font-black text-white text-sm">#{o.orderNumber}</td>
                      <td className="py-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            o.status === 'ready'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : o.status === 'preparing'
                              ? 'bg-buzly-amber/10 text-buzly-amber border border-buzly-amber/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {o.status === 'ready'
                            ? 'جاهز للاستلام 🔔'
                            : o.status === 'preparing'
                            ? 'قيد التحضير ⏳'
                            : 'مكتمل ✅'}
                        </span>
                      </td>
                      <td className="py-3 font-mono">{o.estimatedMinutes} دقيقة</td>
                      <td className="py-3 text-zinc-400">{new Date(o.createdAt).toLocaleTimeString('ar-SA')}</td>
                      <td className="py-3 font-mono text-buzly-amber">{o.rePingCount > 0 ? `${o.rePingCount}x` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </StaffPinGuard>
  );
}
