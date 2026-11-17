'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Archive,
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  RotateCcw,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Phone,
  MessageSquare,
  Star,
  Trash2,
} from 'lucide-react';
import { Order, DayArchiveSummary } from '@/types/queue';
import { useQueue } from '@/context/QueueContext';

interface AdminOrdersArchiveProps {
  slug: string;
  themeColor: string;
}

export const AdminOrdersArchive: React.FC<AdminOrdersArchiveProps> = ({
  slug,
  themeColor,
}) => {
  const { startNewDay } = useQueue();
  const [archivedOrders, setArchivedOrders] = useState<Order[]>([]);
  const [summaries, setSummaries] = useState<DayArchiveSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Load Archive from API + Local Storage
  const loadArchiveData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch from server archive file
      const res = await fetch(`/api/restaurants/${slug}/archive`, { cache: 'no-store' });
      const data = await res.json();

      let ordersList: Order[] = [];
      if (res.ok && data.success && Array.isArray(data.orders)) {
        ordersList = data.orders;
        if (Array.isArray(data.summaries)) {
          setSummaries(data.summaries);
        }
      }

      // 2. Merge with local storage archive (fallback & offline preservation)
      try {
        const localKey = `chimer_archive_${slug}`;
        const localRaw = localStorage.getItem(localKey);
        if (localRaw) {
          const localParsed: Order[] = JSON.parse(localRaw);
          if (Array.isArray(localParsed)) {
            const map = new Map<string, Order>();
            ordersList.forEach((o) => map.set(o.id || `${o.orderNumber}_${o.createdAt}`, o));
            localParsed.forEach((o) => map.set(o.id || `${o.orderNumber}_${o.createdAt}`, o));
            ordersList = Array.from(map.values()).sort((a, b) => {
              const tA = new Date(a.createdAt || a.created_at || 0).getTime();
              const tB = new Date(b.createdAt || b.created_at || 0).getTime();
              return tB - tA;
            });
          }
        }
      } catch {}

      setArchivedOrders(ordersList);
    } catch (err) {
      console.warn('Failed to load archive data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadArchiveData();
  }, [loadArchiveData]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return archivedOrders.filter((ord) => {
      // Filter by Date
      if (selectedDate !== 'all') {
        const ordDate = (ord.createdAt || ord.created_at || '').split('T')[0];
        if (ordDate !== selectedDate) return false;
      }
      // Filter by Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const num = (ord.orderNumber || '').toLowerCase();
        const phone = (ord.customerPhone || '').toLowerCase();
        const notes = (ord.notes || '').toLowerCase();
        if (!num.includes(query) && !phone.includes(query) && !notes.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [archivedOrders, selectedDate, searchQuery]);

  // Unique available dates
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    archivedOrders.forEach((o) => {
      const d = (o.createdAt || o.created_at || '').split('T')[0];
      if (d) dates.add(d);
    });
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [archivedOrders]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = archivedOrders.length;
    const completed = archivedOrders.filter((o) => o.status === 'completed' || o.status === 'archived').length;
    const cancelled = archivedOrders.filter((o) => o.status === 'cancelled').length;

    const prepTimes: number[] = [];
    archivedOrders.forEach((o) => {
      if (o.readyAt && (o.createdAt || o.created_at)) {
        const diffMs = new Date(o.readyAt).getTime() - new Date(o.createdAt || o.created_at || 0).getTime();
        const mins = Math.max(1, Math.round(diffMs / 60000));
        prepTimes.push(mins);
      }
    });

    const avgPrep = prepTimes.length > 0 ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length) : null;

    return { total, completed, cancelled, avgPrep, daysCount: availableDates.length };
  }, [archivedOrders, availableDates]);

  // Export to Excel / CSV with UTF-8 BOM
  const exportToCSV = () => {
    if (archivedOrders.length === 0) return;

    const headers = [
      'رقم الطلب',
      'الحالة',
      'تاريخ الطلب',
      'وقت الطلب',
      'وقت الجاهزية',
      'وقت الاستلام',
      'مدة التحضير (دقائق)',
      'رقم هاتف العميل',
      'ملاحظات الطلب',
      'تقييم العميل',
    ];

    const rows = filteredOrders.map((ord) => {
      const created = ord.createdAt || ord.created_at ? new Date(ord.createdAt || ord.created_at!) : null;
      const ready = ord.readyAt ? new Date(ord.readyAt) : null;
      const completed = ord.completedAt ? new Date(ord.completedAt) : null;

      let prepMins = '';
      if (ready && created) {
        prepMins = String(Math.max(1, Math.round((ready.getTime() - created.getTime()) / 60000)));
      }

      return [
        `#${ord.orderNumber}`,
        ord.status === 'completed' ? 'تم الاستلام' : ord.status === 'cancelled' ? 'ملغي' : ord.status,
        created ? created.toLocaleDateString('ar-SA') : '',
        created ? created.toLocaleTimeString('ar-SA') : '',
        ready ? ready.toLocaleTimeString('ar-SA') : '',
        completed ? completed.toLocaleTimeString('ar-SA') : '',
        prepMins,
        ord.customerPhone || '',
        `"${(ord.notes || '').replace(/"/g, '""')}"`,
        ord.feedback?.rating ? `${ord.feedback.rating}/5` : '',
      ].join(',');
    });

    // UTF-8 BOM for Arabic support in Microsoft Excel
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${slug}-orders-archive-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setActionMessage('تم تصدير ملف Excel (CSV) بنجاح');
    setTimeout(() => setActionMessage(null), 3000);
  };

  // Export to JSON Backup File
  const exportToJSON = () => {
    if (archivedOrders.length === 0) return;
    const jsonStr = JSON.stringify(archivedOrders, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${slug}-orders-backup-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setActionMessage('تم تنزيل ملف النسخة الاحتياطية (JSON) بنجاح');
    setTimeout(() => setActionMessage(null), 3000);
  };

  // Manual Trigger: Start New Day & Reset Counter to 0
  const handleStartNewDay = async () => {
    const confirmed = window.confirm(
      'هل ترغب بالتأكيد في بدء يوم عمل جديد؟\n\nسيتم نقل كافة طلبات اليوم السابقة إلى هذا الأرشيف وتصفير عداد الطلبات فوراً للبدء من جديد.'
    );
    if (!confirmed) return;

    setIsResetting(true);
    try {
      const archivedCount = await startNewDay(slug);
      await loadArchiveData();
      setActionMessage(`تم بدء يوم عمل جديد بنجاح وتصفير العداد (تمت أرشفة ${archivedCount} طلب).`);
      setTimeout(() => setActionMessage(null), 4000);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6 font-cairo">
      {/* Security & Confidentiality Notice Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-zinc-900 to-emerald-500/10 border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
              <span>سجل الأرشيف والمبيعات المشفر</span>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                محمي بتشفير PIN
              </span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
              يتم حفظ وتوثيق جميع الطلبات التي تمت في هذا الملف بأمان تام. لا يمكن لأي عميل أو زائر خارجي الوصول إليه نهائياً.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <motion.button
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.02 }}
            onClick={exportToCSV}
            disabled={archivedOrders.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 active:bg-emerald-500/35 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all shadow-sm disabled:opacity-40"
            title="تصدير إلى ملف إكسل متوافق مع اللغة العربية"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>تصدير Excel (CSV)</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.02 }}
            onClick={exportToJSON}
            disabled={archivedOrders.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/[0.08] text-xs font-bold transition-all shadow-sm disabled:opacity-40"
            title="تنزيل نسخة احتياطية بصيغة JSON"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span>ملف النسخة (JSON)</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.02 }}
            onClick={handleStartNewDay}
            disabled={isResetting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all shadow-sm disabled:opacity-40"
            title="تصفير العداد وأرشفة الطلبات السابقة لبدء يوم جديد"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-amber-400 ${isResetting ? 'animate-spin' : ''}`} />
            <span>بدء يوم جديد (تصفير)</span>
          </motion.button>
        </div>
      </div>

      {/* Success / Action Feedback Banner */}
      <AnimatePresence>
        {actionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold">{actionMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4 Stat Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#121215] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 font-medium">إجمالي الطلبات</span>
            <Archive className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-extrabold text-white">
            {stats.total}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1">طلب مسجل في الأرشيف</span>
        </div>

        <div className="bg-[#121215] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 font-medium">الطلبات المنجزة</span>
            <CheckCircle2 className="w-4 h-4 text-sky-400" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-extrabold text-white">
            {stats.completed}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1">تم تسليمها للزبائن</span>
        </div>

        <div className="bg-[#121215] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 font-medium">متوسط التحضير</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-extrabold text-white">
            {stats.avgPrep ? `${stats.avgPrep}د` : '---'}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1">سرعة تجهيز الطلب</span>
        </div>

        <div className="bg-[#121215] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 font-medium">أيام العمل المسجلة</span>
            <Calendar className="w-4 h-4 text-purple-400" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-extrabold text-white">
            {stats.daysCount}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1">يوم محفوظ في الملف</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#121215] border border-white/[0.08] rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم الطلب أو الجوال..."
            className="w-full bg-[#18181C] border border-white/[0.06] rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-zinc-400 shrink-0">تصفية بالتاريخ:</span>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-[#18181C] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
          >
            <option value="all">جميع التواريخ ({archivedOrders.length})</option>
            {availableDates.map((dateStr) => {
              const isToday = dateStr === new Date().toISOString().split('T')[0];
              const count = archivedOrders.filter((o) => (o.createdAt || o.created_at || '').startsWith(dateStr)).length;
              return (
                <option key={dateStr} value={dateStr}>
                  {dateStr} {isToday ? '(اليوم)' : ''} — {count} طلب
                </option>
              );
            })}
          </select>

          <button
            onClick={loadArchiveData}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
            title="تحديث الأرشيف"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Orders Table / List */}
      <div className="bg-[#121215] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-3" />
            <p className="text-xs font-mono">جارِ قراءة وتشفير سجل الطلبات...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center">
            <Archive className="w-12 h-12 text-zinc-600 mb-3" />
            <h4 className="text-sm font-bold text-zinc-300">لا توجد طلبات مؤرشفة</h4>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              عند انتهاء اليوم أو الضغط على &quot;بدء يوم جديد&quot;، سيتم ترحيل وحفظ كافة الطلبات تلقائياً داخل هذا السجل المشفر.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#18181C] text-zinc-400 border-b border-white/[0.06] font-medium">
                <tr>
                  <th className="py-3 px-4">رقم الطلب</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4">تاريخ ووقت الطلب</th>
                  <th className="py-3 px-4">مدة التحضير</th>
                  <th className="py-3 px-4">وقت الاستلام</th>
                  <th className="py-3 px-4">هاتف العميل</th>
                  <th className="py-3 px-4">ملاحظات وتقييم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredOrders.map((ord) => {
                  const created = ord.createdAt || ord.created_at ? new Date(ord.createdAt || ord.created_at!) : null;
                  const ready = ord.readyAt ? new Date(ord.readyAt) : null;
                  const completed = ord.completedAt ? new Date(ord.completedAt) : null;

                  let prepMins = null;
                  if (ready && created) {
                    prepMins = Math.max(1, Math.round((ready.getTime() - created.getTime()) / 60000));
                  }

                  return (
                    <tr key={ord.id || `${ord.orderNumber}_${ord.createdAt}`} className="hover:bg-white/[0.02] transition-colors">
                      {/* Order Number Badge */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-sm text-white px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08]">
                          #{ord.orderNumber}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {ord.status === 'completed' || ord.status === 'archived' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>مكتمل ومستلم</span>
                          </span>
                        ) : ord.status === 'cancelled' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <span>ملغي</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <span>{ord.status}</span>
                          </span>
                        )}
                      </td>

                      {/* Created Time */}
                      <td className="py-3 px-4 text-zinc-300 font-mono">
                        {created ? (
                          <div>
                            <div>{created.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</div>
                            <div className="text-[10px] text-zinc-500">{created.toLocaleDateString('ar-SA')}</div>
                          </div>
                        ) : (
                          '---'
                        )}
                      </td>

                      {/* Prep Duration */}
                      <td className="py-3 px-4 font-mono text-zinc-300">
                        {prepMins !== null ? (
                          <span className="text-emerald-400 font-bold">{prepMins} دقيقة</span>
                        ) : (
                          <span className="text-zinc-500">---</span>
                        )}
                      </td>

                      {/* Completed Time */}
                      <td className="py-3 px-4 text-zinc-400 font-mono">
                        {completed ? completed.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '---'}
                      </td>

                      {/* Customer Phone */}
                      <td className="py-3 px-4 font-mono text-zinc-300">
                        {ord.customerPhone ? (
                          <a
                            href={`https://wa.me/${ord.customerPhone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3 text-emerald-400" />
                            <span>{ord.customerPhone}</span>
                          </a>
                        ) : (
                          <span className="text-zinc-600">---</span>
                        )}
                      </td>

                      {/* Notes & Rating */}
                      <td className="py-3 px-4 text-zinc-400">
                        <div className="flex flex-col gap-0.5">
                          {ord.notes && <span className="text-xs text-zinc-200">{ord.notes}</span>}
                          {ord.feedback?.rating && (
                            <div className="flex items-center gap-1 text-amber-400 text-[11px]">
                              <Star className="w-3 h-3 fill-amber-400" />
                              <span>{ord.feedback.rating}/5</span>
                            </div>
                          )}
                          {!ord.notes && !ord.feedback?.rating && <span className="text-zinc-600">---</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
