'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, RefreshCw, CheckCircle2, Clock, QrCode, Trash2, AlertCircle, Search, X } from 'lucide-react';
import { Order } from '@/types/queue';
import { soundManager } from '@/lib/audio';

interface StaffQueueGridProps {
  preparingOrders: Order[];
  readyOrders: Order[];
  onMarkReady: (orderId: string) => Promise<unknown>;
  onRePing: (orderId: string) => Promise<unknown>;
  onComplete: (orderId: string) => Promise<unknown>;
  onCancel: (orderId: string) => Promise<unknown>;
  onOpenQr: (orderNumber: string) => void;
}

export const StaffQueueGrid: React.FC<StaffQueueGridProps> = ({
  preparingOrders,
  readyOrders,
  onMarkReady,
  onRePing,
  onComplete,
  onCancel,
  onOpenQr,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'preparing' | 'ready'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [now, setNow] = useState<number>(Date.now());

  // Update timer tick every 10 seconds to update relative times
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const getElapsedTime = (isoDate: string) => {
    const diffMs = now - new Date(isoDate).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'الآن';
    return `منذ ${diffMins} د`;
  };

  const matchesSearch = (o: Order) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      (o.notes && o.notes.toLowerCase().includes(q)) ||
      (o.customerPhone && o.customerPhone.includes(q))
    );
  };

  const filteredPreparing = useMemo(
    () => preparingOrders.filter(matchesSearch),
    [preparingOrders, searchQuery]
  );

  const filteredReady = useMemo(
    () => readyOrders.filter(matchesSearch),
    [readyOrders, searchQuery]
  );

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Mobile column tabs */}
      <div className="flex lg:hidden bg-obsidian-surface p-1 rounded-2xl border border-obsidian-border">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'all'
              ? 'bg-obsidian-border text-white'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          الكل ({preparingOrders.length + readyOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('preparing')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'preparing'
              ? 'bg-buzly-amber/20 text-buzly-amber border border-buzly-amber/30'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          قيد التحضير ({preparingOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('ready')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'ready'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          جاهز للاستلام ({readyOrders.length})
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-500 absolute top-3.5 right-3.5" />
        <input
          type="text"
          placeholder="بحث سريع برقم الطلب # أو الملاحظة أو رقم الجوال..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-obsidian-surface border border-obsidian-border rounded-2xl pr-10 pl-10 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute top-3 left-3 text-zinc-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 min-h-[480px]">
        {/* COLUMN 1: PREPARING (قيد التحضير) */}
        {(activeTab === 'all' || activeTab === 'preparing') && (
          <div className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-5 flex flex-col shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-obsidian-border/80 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-buzly-amber animate-pulse" />
                <h3 className="font-bold text-white text-lg font-cairo">قيد التحضير (Preparing)</h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-buzly-amber/10 border border-buzly-amber/30 text-buzly-amber text-xs font-bold font-mono">
                {filteredPreparing.length} طلبات
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar max-h-[580px]">
              <AnimatePresence mode="popLayout">
                {filteredPreparing.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center text-zinc-500">
                    <Clock className="w-10 h-10 mb-2 stroke-[1.5] text-zinc-600" />
                    <p className="text-sm font-medium">لا توجد طلبات قيد التحضير حالياً</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      {searchQuery ? 'لا توجد نتائج مطابقة لبحثك' : 'أدخل رقم طلب من اللوحة لإضافته هنا'}
                    </p>
                  </div>
                ) : (
                  filteredPreparing.map((order) => (
                    <motion.div
                      key={order.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      className="bg-obsidian-card border border-obsidian-border hover:border-buzly-amber/40 rounded-2xl p-4 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-obsidian-400 border border-obsidian-border flex items-center justify-center font-mono font-extrabold text-2xl text-white">
                            #{order.orderNumber}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-zinc-400 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-buzly-amber" />
                                {getElapsedTime(order.createdAt)}
                              </span>
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-buzly-amber/10 text-buzly-amber font-mono font-bold">
                                ETA {order.estimatedMinutes}د
                              </span>
                            </div>
                            {order.notes && (
                              <p className="text-xs text-zinc-300 mt-1 line-clamp-1">
                                {order.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Quick QR & Cancel */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onOpenQr(order.orderNumber)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-obsidian-400 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-400 border border-obsidian-border text-xs font-bold transition-all shadow-sm"
                            title="عرض QR للعميل"
                          >
                            <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                            <span>كود QR</span>
                          </button>
                          <button
                            onClick={() => onCancel(order.id)}
                            className="p-1.5 rounded-xl bg-obsidian-400 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-obsidian-border transition-colors"
                            title="إلغاء الطلب"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* CALL ACTION BUTTON */}
                      <button
                        onClick={() => {
                          soundManager.unlock();
                          onMarkReady(order.id);
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        <Bell className="w-4 h-4 animate-bounce-subtle" />
                        <span>نداء العميل - جاهز الآن (Call Ready)</span>
                      </button>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* COLUMN 2: READY FOR PICKUP (جاهز للاستلام) */}
        {(activeTab === 'all' || activeTab === 'ready') && (
          <div className="bg-obsidian-surface border border-emerald-500/20 rounded-3xl p-5 flex flex-col shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-obsidian-border/80 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                <h3 className="font-bold text-emerald-400 text-lg font-cairo">جاهز للاستلام (Ready)</h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold font-mono">
                {filteredReady.length} جاهز
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar max-h-[580px]">
              <AnimatePresence mode="popLayout">
                {filteredReady.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center text-zinc-500">
                    <CheckCircle2 className="w-10 h-10 mb-2 stroke-[1.5] text-zinc-600" />
                    <p className="text-sm font-medium">لا توجد طلبات بانتظار الاستلام</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      {searchQuery ? 'لا توجد نتائج مطابقة لبحثك' : 'عند نداء أي طلب جاهز سيظهر هنا فوراً'}
                    </p>
                  </div>
                ) : (
                  filteredReady.map((order) => (
                    <motion.div
                      key={order.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      className="bg-obsidian-card border-2 border-emerald-500/40 rounded-2xl p-4 shadow-lg shadow-emerald-500/5 relative overflow-hidden"
                    >
                      {/* Flashing glow indicator */}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />

                      <div className="flex items-start justify-between mb-3 relative z-10">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-emerald-500 text-black font-mono font-black text-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            #{order.orderNumber}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                جاهز {order.readyAt ? getElapsedTime(order.readyAt) : 'الآن'}
                              </span>
                              {order.rePingCount > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-buzly-amber/20 text-buzly-amber font-mono font-bold flex items-center gap-0.5">
                                  <AlertCircle className="w-3 h-3" /> تم التنبيه {order.rePingCount}x
                                </span>
                              )}
                            </div>
                            {order.notes && (
                              <p className="text-xs text-zinc-300 mt-1 line-clamp-1">
                                {order.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* QR modal trigger */}
                        <button
                          onClick={() => onOpenQr(order.orderNumber)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-obsidian-400 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-400 border border-obsidian-border text-xs font-bold transition-all shadow-sm"
                          title="عرض QR للعميل"
                        >
                          <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                          <span>كود QR</span>
                        </button>
                      </div>

                      {/* TWO ACTION BUTTONS: RE-PING & COMPLETED */}
                      <div className="grid grid-cols-2 gap-2 relative z-10">
                        {/* Re-Ping Button */}
                        <button
                          onClick={() => {
                            soundManager.unlock();
                            onRePing(order.id);
                          }}
                          className="py-2.5 px-3 rounded-xl bg-obsidian-border hover:bg-obsidian-borderHover active:scale-[0.98] text-buzly-amber font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-buzly-amber/20"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>إعادة تنبيه (Re-ping)</span>
                        </button>

                        {/* Completed Button */}
                        <button
                          onClick={() => {
                            soundManager.unlock();
                            onComplete(order.id);
                          }}
                          className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>تم التسليم (Done)</span>
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
