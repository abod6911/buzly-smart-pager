'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BellRing,
  RefreshCw,
  Check,
  Clock,
  QrCode,
  Trash2,
  Search,
  X,
  Inbox,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { Order } from '@/types/queue';
import { soundManager } from '@/lib/audio';
import { appleSpringQuick } from '@/lib/motion';

interface StaffQueueGridProps {
  preparingOrders: Order[];
  readyOrders: Order[];
  onMarkReady: (orderId: string) => Promise<unknown>;
  onRePing: (orderId: string) => Promise<unknown>;
  onComplete: (orderId: string) => Promise<unknown>;
  onCancel: (orderId: string) => Promise<unknown>;
  onOpenQr: (orderNumber: string) => void;
  onRevertToPreparing?: (orderId: string) => Promise<unknown>;
}

export const StaffQueueGrid: React.FC<StaffQueueGridProps> = ({
  preparingOrders,
  readyOrders,
  onMarkReady,
  onRePing,
  onComplete,
  onCancel,
  onOpenQr,
  onRevertToPreparing,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'preparing' | 'ready'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const getElapsedMins = (isoDate: string) => {
    const diffMs = now - new Date(isoDate).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  const safePreparing = useMemo(
    () => (Array.isArray(preparingOrders) ? preparingOrders : []),
    [preparingOrders]
  );

  const safeReady = useMemo(
    () => (Array.isArray(readyOrders) ? readyOrders : []),
    [readyOrders]
  );

  const matchesSearch = (o: Order) => {
    if (!o) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (o.orderNumber && o.orderNumber.toLowerCase().includes(q)) ||
      (o.notes && o.notes.toLowerCase().includes(q)) ||
      (o.customerPhone && o.customerPhone.includes(q))
    );
  };

  const filteredPreparing = useMemo(
    () => safePreparing.filter(matchesSearch),
    [safePreparing, searchQuery]
  );

  const filteredReady = useMemo(
    () => safeReady.filter(matchesSearch),
    [safeReady, searchQuery]
  );

  return (
    <div className="flex flex-col h-full space-y-3.5">
      {/* Mobile column tabs */}
      <div className="flex lg:hidden bg-[#121215] p-1 rounded-xl border border-white/[0.08]">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
            activeTab === 'all'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          الكل ({preparingOrders.length + readyOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('preparing')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
            activeTab === 'preparing'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          قيد التحضير ({preparingOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('ready')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
            activeTab === 'ready'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          جاهز للاستلام ({readyOrders.length})
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-500 absolute top-3 right-3.5" />
        <input
          type="text"
          placeholder="بحث سريع برقم الطلب # أو الملاحظة أو رقم الجوال..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#121215] border border-white/[0.08] rounded-xl pr-10 pl-10 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute top-2.5 left-3 text-zinc-500 hover:text-white p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[480px]">
        {/* COLUMN 1: PREPARING (قيد التحضير) */}
        {(activeTab === 'all' || activeTab === 'preparing') && (
          <div className="bg-[#121215] border border-white/[0.08] rounded-2xl p-4 flex flex-col shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06] mb-3.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h3 className="font-semibold text-zinc-200 text-sm">قيد التحضير</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono font-medium tabular-nums">
                {filteredPreparing.length}
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar max-h-[580px]">
              <AnimatePresence mode="popLayout">
                {filteredPreparing.length === 0 ? (
                  <motion.div
                    key="empty-preparing-placeholder"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={appleSpringQuick}
                    className="h-56 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-white/[0.08] rounded-xl bg-white/[0.01]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-2.5 text-amber-300">
                      <Inbox className="w-5 h-5 stroke-[1.5]" />
                    </div>
                    <p className="text-xs font-semibold text-zinc-300">لا توجد طلبات قيد التحضير حالياً</p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      {searchQuery ? 'لا توجد نتائج مطابقة لبحثك' : 'أدخل رقم طلب من اللوحة لإضافته'}
                    </p>
                  </motion.div>
                ) : (
                  filteredPreparing.map((order) => {
                    const elapsed = getElapsedMins(order.createdAt);
                    const isDelayed = elapsed > order.estimatedMinutes;

                    return (
                      <motion.div
                        key={order.id}
                        layout
                        layoutId={`order-card-${order.id}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={appleSpringQuick}
                        className="bg-[#18181C] border border-white/[0.08] hover:border-white/[0.14] rounded-xl p-3.5 transition-colors group shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-lg bg-[#09090B] border border-white/[0.08] flex items-center justify-center font-mono font-bold text-xl text-white tabular-nums">
                              #{order.orderNumber}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-[11px] font-mono tabular-nums px-2 py-0.5 rounded flex items-center gap-1 ${
                                    isDelayed
                                      ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                                      : 'bg-white/[0.04] text-zinc-400 border border-white/[0.04]'
                                  }`}
                                >
                                  <Clock className="w-3 h-3 text-zinc-400" />
                                  <span>{elapsed === 0 ? 'الآن' : `${elapsed} د`}</span>
                                </span>
                                <span className="text-[10px] text-zinc-400 font-mono tabular-nums">
                                  ETA {order.estimatedMinutes}د
                                </span>
                              </div>
                              {order.notes && (
                                <p className="text-xs text-zinc-300 mt-1 line-clamp-1 font-normal">
                                  {order.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1">
                            <motion.button
                              whileTap={{ scale: 0.92 }}
                              whileHover={{ scale: 1.05 }}
                              onClick={() => onOpenQr(order.orderNumber)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors"
                              title="عرض الباركود للعميل"
                            >
                              <QrCode className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.92 }}
                              whileHover={{ scale: 1.05 }}
                              onClick={() => onCancel(order.id)}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                              title="إلغاء الطلب"
                            >
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                          </div>
                        </div>

                        {/* CALL ACTION BUTTON */}
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          whileHover={{ scale: 1.01 }}
                          onClick={() => {
                            soundManager.unlock();
                            onMarkReady(order.id);
                          }}
                          className="w-full py-2.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#052E16] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                        >
                          <BellRing className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>نداء الاستلام</span>
                        </motion.button>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* COLUMN 2: READY FOR PICKUP (جاهز للاستلام) */}
        {(activeTab === 'all' || activeTab === 'ready') && (
          <div className="bg-[#121215] border border-emerald-500/20 rounded-2xl p-4 flex flex-col shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06] mb-3.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <h3 className="font-semibold text-emerald-400 text-sm">جاهز للاستلام</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-medium tabular-nums">
                {filteredReady.length}
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar max-h-[580px]">
              <AnimatePresence mode="popLayout">
                {filteredReady.length === 0 ? (
                  <motion.div
                    key="empty-ready-placeholder"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={appleSpringQuick}
                    className="h-56 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-emerald-500/20 rounded-xl bg-emerald-500/[0.02]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2.5 text-emerald-400">
                      <Check className="w-5 h-5 stroke-[2]" />
                    </div>
                    <p className="text-xs font-semibold text-zinc-300">لا توجد طلبات بانتظار الاستلام حالياً</p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      {searchQuery ? 'لا توجد نتائج مطابقة لبحثك' : 'عند نداء أي طلب جاهز سيظهر هنا فوراً'}
                    </p>
                  </motion.div>
                ) : (
                  filteredReady.map((order) => {
                    const readyElapsed = order.readyAt ? getElapsedMins(order.readyAt) : 0;

                    return (
                      <motion.div
                        key={order.id}
                        layout
                        layoutId={`order-card-${order.id}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                        className="bg-[#071F18] border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl p-3.5 relative overflow-hidden transition-colors shadow-[inset_0_1px_0_0_rgba(16,185,129,0.14)]"
                      >
                        <div className="flex items-start justify-between mb-3 relative z-10">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-lg bg-emerald-500 text-[#052E16] font-mono font-bold text-xl flex items-center justify-center tabular-nums shadow-sm">
                              #{order.orderNumber}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-emerald-400 font-mono tabular-nums flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span>جاهز {readyElapsed === 0 ? 'الآن' : `منذ ${readyElapsed} د`}</span>
                                </span>
                                {order.rePingCount > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono tabular-nums flex items-center gap-0.5 border border-amber-500/20">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    <span>{order.rePingCount}x</span>
                                  </span>
                                )}
                              </div>
                              {order.notes && (
                                <p className="text-xs text-zinc-300 mt-1 line-clamp-1 font-normal">
                                  {order.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Top Card Actions: Undo back to preparing & QR modal trigger */}
                          <div className="flex items-center gap-1">
                            {onRevertToPreparing && (
                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                whileHover={{ scale: 1.05 }}
                                onClick={() => onRevertToPreparing(order.id)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                                title="إرجاع للتحضير (تراجع)"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </motion.button>
                            )}
                            <motion.button
                              whileTap={{ scale: 0.92 }}
                              whileHover={{ scale: 1.05 }}
                              onClick={() => onOpenQr(order.orderNumber)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors"
                              title="عرض الباركود للعميل"
                            >
                              <QrCode className="w-4 h-4 text-emerald-400" />
                            </motion.button>
                          </div>
                        </div>

                        {/* TWO ACTION BUTTONS: RE-PING & COMPLETED */}
                        <div className="grid grid-cols-2 gap-2 relative z-10">
                          <motion.button
                            whileTap={{ scale: 0.94 }}
                            whileHover={{ scale: 1.01 }}
                            onClick={() => {
                              soundManager.unlock();
                              onRePing(order.id);
                            }}
                            className="py-2 px-3 rounded-lg bg-[#202026] hover:bg-[#282830] text-amber-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-all border border-amber-500/20"
                          >
                            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>إعادة النداء</span>
                          </motion.button>

                          <motion.button
                            whileTap={{ scale: 0.94 }}
                            whileHover={{ scale: 1.01 }}
                            onClick={() => {
                              soundManager.unlock();
                              onComplete(order.id);
                            }}
                            className="py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#052E16] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" strokeWidth={1.75} />
                            <span>تم التسليم</span>
                          </motion.button>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
