'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQueue } from '@/context/QueueContext';
import { StaffPinGuard } from '@/components/StaffPinGuard';
import { RestaurantNotFound } from '@/components/RestaurantNotFound';
import {
  BarChart3,
  ArrowRight,
  Clock,
  TrendingUp,
  Layers,
  Calendar,
  Timer,
  Zap,
  Inbox,
} from 'lucide-react';

export default function KitchenAnalyticsPage() {
  const params = useParams();
  const slug = (params.slug as string) || '';

  const { getRestaurant, getOrdersForRestaurant, isRestaurantsLoaded } = useQueue();
  const restaurant = getRestaurant(slug);
  const orders = getOrdersForRestaurant(slug);

  const analytics = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Only orders from today
    const todayOrders = orders.filter((o) => {
      const created = new Date(o.createdAt || o.created_at || 0).getTime();
      return created >= startOfToday.getTime();
    });

    const totalOrders = todayOrders.length;
    const preparingCount = todayOrders.filter((o) => o.status === 'preparing').length;
    const readyCount = todayOrders.filter((o) => o.status === 'ready').length;
    const completedCount = todayOrders.filter((o) => o.status === 'completed').length;

    // Prep Time: readyAt - createdAt (in minutes) for orders prepared today
    const prepTimes: number[] = [];
    todayOrders.forEach((o) => {
      if (o.readyAt && (o.createdAt || o.created_at)) {
        const diffMs =
          new Date(o.readyAt).getTime() -
          new Date(o.createdAt || o.created_at || 0).getTime();
        const mins = Math.max(1, Math.round(diffMs / 60000));
        prepTimes.push(mins);
      }
    });

    const avgPrepMins =
      prepTimes.length > 0
        ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length)
        : null;

    // Pickup Delay: completedAt - readyAt (in minutes)
    const pickupDelays: number[] = [];
    todayOrders.forEach((o) => {
      if (o.completedAt && o.readyAt) {
        const diffMs =
          new Date(o.completedAt).getTime() - new Date(o.readyAt).getTime();
        const mins = Math.max(1, Math.round(diffMs / 60000));
        pickupDelays.push(mins);
      }
    });

    const avgPickupMins =
      pickupDelays.length > 0
        ? Math.round(pickupDelays.reduce((a, b) => a + b, 0) / pickupDelays.length)
        : null;

    // Aggregate by hour 0 to 23
    const hourCounts: Record<number, number> = {};
    for (let h = 0; h < 24; h++) {
      hourCounts[h] = 0;
    }

    todayOrders.forEach((o) => {
      const date = new Date(o.createdAt || o.created_at || 0);
      const h = date.getHours();
      if (h >= 0 && h < 24) {
        hourCounts[h] += 1;
      }
    });

    let peakHour: number | null = null;
    let maxHourlyOrders = 0;
    Object.entries(hourCounts).forEach(([hourStr, count]) => {
      if (count > maxHourlyOrders) {
        maxHourlyOrders = count;
        peakHour = Number(hourStr);
      }
    });

    return {
      todayOrders,
      totalOrders,
      preparingCount,
      readyCount,
      completedCount,
      avgPrepMins,
      avgPickupMins,
      hourCounts,
      peakHour,
      maxHourlyOrders,
    };
  }, [orders]);

  if (!restaurant) {
    if (isRestaurantsLoaded) {
      return <RestaurantNotFound slug={slug} />;
    }
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex flex-col items-center justify-center font-sans p-4">
        <div className="w-12 h-12 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-3" />
        <p className="text-sm text-zinc-400 font-mono">جارِ التحقق من المتجر...</p>
      </div>
    );
  }

  const hasOrders = analytics.totalOrders > 0;

  return (
    <StaffPinGuard restaurant={restaurant} onUnlocked={() => {}}>
      <div className="min-h-screen bg-[#09090B] text-white flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
        {/* Header */}
        <header className="border-b border-white/[0.08] bg-[#09090B] sticky top-0 z-40 px-4 sm:px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href={`/${slug}/staff`}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                title="الرجوع للكاشير"
              >
                <ArrowRight className="w-4 h-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-semibold text-sm text-white">
                    تحليلات سرعة المطبخ
                  </h1>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-zinc-400 border border-white/[0.06]">
                    /{slug}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 font-normal">
                  مؤشرات الأداء اللحظية وسرعة استلام الزبائن
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/${slug}/admin`}
                className="px-3 py-1.5 rounded-lg bg-[#18181C] hover:bg-[#202026] text-xs font-medium text-zinc-300 border border-white/[0.08] transition-colors"
              >
                إعدادات المتجر
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-6xl w-full mx-auto p-4 sm:px-6 py-6 flex-1 space-y-5">
          {/* Linear-Style Insight Banner */}
          <div className="bg-[#121215] border border-white/[0.08] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">
                  {hasOrders
                    ? analytics.avgPrepMins !== null && analytics.avgPrepMins <= 10
                      ? 'كفاءة المطبخ: أداء سريع ومثالي'
                      : 'كفاءة المطبخ: أداء مستقر ومباشر'
                    : 'بانتظار بدء تشغيل اليوم'}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {hasOrders ? (
                    <>
                      متوسط سرعة التحضير{' '}
                      <strong className="text-zinc-200 font-mono tabular-nums">
                        {analytics.avgPrepMins !== null ? `${analytics.avgPrepMins} دقيقة` : '—'}
                      </strong>
                      ، وسرعة استلام العميل بعد النداء{' '}
                      <strong className="text-zinc-200 font-mono tabular-nums">
                        {analytics.avgPickupMins !== null ? `${analytics.avgPickupMins} دقيقة` : '—'}
                      </strong>
                      .
                    </>
                  ) : (
                    'لا توجد طلبات مسجلة لليوم حتى الآن.'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-white/[0.02] px-3 py-1.5 rounded-lg border border-white/[0.05] font-mono tabular-nums">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              <span>إحصائيات اليوم</span>
            </div>
          </div>

          {!hasOrders ? (
            /* Empty State Banner */
            <div className="bg-[#121215] border border-dashed border-white/10 rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-white/5 text-zinc-400 flex items-center justify-center mb-4">
                <Inbox className="w-7 h-7 stroke-[1.5]" />
              </div>
              <h4 className="text-base font-semibold text-white mb-1.5">
                لا توجد بيانات كافية لليوم حتى الآن
              </h4>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-md leading-relaxed mb-5">
                ستبدأ الإحصائيات بالظهور تلقائياً وبشكل حي فور استلام أول طلب من شاشة الكاشير.
              </p>
              <Link
                href={`/${slug}/staff`}
                className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#052E16] font-bold text-xs flex items-center gap-2 transition-colors"
              >
                <span>الانتقال لشاشة الكاشير وإضافة طلب</span>
              </Link>
            </div>
          ) : (
            <>
              {/* 4 Linear-Style KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* KPI 1 */}
                <div className="bg-[#121215] border border-white/[0.08] rounded-xl p-4 shadow-sm">
                  <span className="text-xs text-zinc-400 block mb-1">إجمالي طلبات اليوم</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-semibold font-mono text-white tabular-nums">
                      {analytics.totalOrders}
                    </span>
                    <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-0.5 font-mono">
                      <TrendingUp className="w-3 h-3" /> نشط
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1.5">تشمل النشطة والمكتملة</p>
                </div>

                {/* KPI 2 */}
                <div className="bg-[#121215] border border-white/[0.08] rounded-xl p-4 shadow-sm">
                  <span className="text-xs text-zinc-400 block mb-1">
                    متوسط وقت التحضير
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-semibold font-mono text-amber-300 tabular-nums">
                      {analytics.avgPrepMins !== null ? analytics.avgPrepMins : '—'}
                      {analytics.avgPrepMins !== null && (
                        <span className="text-xs font-sans text-zinc-400 mr-1 font-normal">دقيقة</span>
                      )}
                    </span>
                    <Clock className="w-4 h-4 text-zinc-500" />
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1.5">من تسجيل الطلب إلى الجاهزية</p>
                </div>

                {/* KPI 3 */}
                <div className="bg-[#121215] border border-white/[0.08] rounded-xl p-4 shadow-sm">
                  <span className="text-xs text-zinc-400 block mb-1">
                    سرعة استلام العميل
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-semibold font-mono text-emerald-400 tabular-nums">
                      {analytics.avgPickupMins !== null ? analytics.avgPickupMins : '—'}
                      {analytics.avgPickupMins !== null && (
                        <span className="text-xs font-sans text-zinc-400 mr-1 font-normal">دقيقة</span>
                      )}
                    </span>
                    <Zap className="w-4 h-4 text-emerald-400/80" />
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1.5">من نداء الجرس إلى استلام الوجبة</p>
                </div>

                {/* KPI 4 */}
                <div className="bg-[#121215] border border-white/[0.08] rounded-xl p-4 shadow-sm">
                  <span className="text-xs text-zinc-400 block mb-1">
                    الطلبات النشطة حالياً
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-semibold font-mono text-white tabular-nums">
                      {analytics.preparingCount + analytics.readyCount}
                    </span>
                    <Layers className="w-4 h-4 text-zinc-500" />
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1.5 font-mono tabular-nums">
                    {analytics.preparingCount} تحضير • {analytics.readyCount} جاهز
                  </p>
                </div>
              </div>

              {/* Peak Hours Chart */}
              <div className="bg-[#121215] border border-white/[0.08] rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-400" />
                      <span>توزيع أوقات الذروة حسب ساعات اليوم (0 - 23)</span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {analytics.peakHour !== null ? (
                        <>
                          ساعة الذروة اليوم عند الساعة{' '}
                          <strong className="text-zinc-200 font-mono">
                            {analytics.peakHour}:00
                          </strong>{' '}
                          بإجمالي {analytics.maxHourlyOrders} طلبات
                        </>
                      ) : (
                        'لا توجد ساعات ذروة مسجلة بعد'
                      )}
                    </p>
                  </div>
                </div>

                {/* Visual Bar Chart with faint grid */}
                <div className="h-52 flex items-end justify-between gap-1 sm:gap-2 pt-6 pb-2 px-1 sm:px-2 border-b border-dashed border-white/10 relative overflow-x-auto">
                  {Object.entries(analytics.hourCounts).map(([hour, count]) => {
                    const heightPercent =
                      analytics.maxHourlyOrders > 0 && count > 0
                        ? Math.max(12, Math.round((count / analytics.maxHourlyOrders) * 100))
                        : 0;
                    const isPeak =
                      analytics.peakHour !== null &&
                      Number(hour) === analytics.peakHour &&
                      count > 0;

                    return (
                      <div
                        key={hour}
                        className="flex-1 min-w-[20px] flex flex-col items-center gap-1.5 h-full justify-end group"
                      >
                        <span
                          className={`text-[9px] sm:text-[10px] font-mono tabular-nums transition-opacity ${
                            count > 0 ? 'text-zinc-300' : 'text-zinc-600 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {count}
                        </span>
                        <div
                          className={`w-full max-w-[24px] sm:max-w-[28px] rounded-t-md transition-all duration-300 ${
                            count === 0
                              ? 'bg-transparent h-0'
                              : isPeak
                              ? 'bg-emerald-500 shadow-sm'
                              : 'bg-zinc-800 hover:bg-zinc-700'
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />
                        <span className="text-[8px] sm:text-[10px] font-mono text-zinc-500 mt-1 tabular-nums">
                          {hour}h
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Orders Log Table */}
              <div className="bg-[#121215] border border-white/[0.08] rounded-xl p-5 shadow-sm">
                <h3 className="font-semibold text-sm text-white mb-3">سجل الطلبات الأخير</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-zinc-400">
                        <th className="pb-2.5 font-medium">رقم الطلب</th>
                        <th className="pb-2.5 font-medium">الحالة</th>
                        <th className="pb-2.5 font-medium">وقت التحضير</th>
                        <th className="pb-2.5 font-medium">تاريخ الطلب</th>
                        <th className="pb-2.5 font-medium">التنبيهات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] text-zinc-300">
                      {analytics.todayOrders.slice(0, 10).map((o) => (
                        <tr key={o.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-2.5 font-mono font-bold text-white text-sm tabular-nums">
                            #{o.orderNumber}
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                                o.status === 'ready'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : o.status === 'preparing'
                                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                  : 'bg-white/[0.04] text-zinc-400 border border-white/[0.06]'
                              }`}
                            >
                              {o.status === 'ready'
                                ? 'جاهز للاستلام'
                                : o.status === 'preparing'
                                ? 'قيد التحضير'
                                : 'تم التسليم'}
                            </span>
                          </td>
                          <td className="py-2.5 font-mono tabular-nums text-zinc-400">
                            {o.estimatedMinutes} دقيقة
                          </td>
                          <td className="py-2.5 text-zinc-400 font-mono tabular-nums">
                            {new Date(o.createdAt || o.created_at || Date.now()).toLocaleTimeString('ar-SA')}
                          </td>
                          <td className="py-2.5 font-mono tabular-nums text-amber-300">
                            {o.rePingCount > 0 ? `${o.rePingCount}x` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </StaffPinGuard>
  );
}
