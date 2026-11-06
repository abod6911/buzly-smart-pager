'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueue } from '@/context/QueueContext';
import { StaffPinGuard } from '@/components/StaffPinGuard';
import { StaffNumpad } from '@/components/StaffNumpad';
import { StaffQueueGrid } from '@/components/StaffQueueGrid';
import { QrModal } from '@/components/QrModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RestaurantNotFound } from '@/components/RestaurantNotFound';
import { RestaurantAvatar } from '@/components/RestaurantAvatar';
import { Order } from '@/types/queue';
import { soundManager } from '@/lib/audio';
import {
  Bell,
  Volume2,
  QrCode,
  Smartphone,
  ExternalLink,
  Tv,
  Settings,
  BarChart3,
  Archive,
  MessageCircle,
  Activity,
  Layers,
  RotateCcw,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export default function TenantStaffCashierPage() {
  const params = useParams();
  const rawSlug = (params.slug as string) || 'demo-cafe';
  const slug = rawSlug.toLowerCase().trim();

  const {
    getRestaurant,
    getOrdersForRestaurant,
    isRestaurantsLoaded,
    addOrder,
    getActiveOrder,
    markReady,
    rePing,
    completeOrder,
    cancelOrder,
    revertToPreparing,
    restoreOrder,
    archiveCompletedOrders,
    networkStatus,
    warmupLiveChannel,
  } = useQueue();

  // Persistent Pre-Warming of Supabase Realtime Broadcast Channel on Cashier mount
  useEffect(() => {
    if (slug && warmupLiveChannel) {
      warmupLiveChannel(slug);
    }
  }, [slug, warmupLiveChannel]);

  const restaurant = getRestaurant(slug);
  const tenantOrders = getOrdersForRestaurant(slug) || [];

  const preparingOrders = (tenantOrders || []).filter((o) => o && o.status === 'preparing');
  const readyOrders = (tenantOrders || []).filter((o) => o && o.status === 'ready');
  const completedOrders = (tenantOrders || []).filter((o) => o && o.status === 'completed');

  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | undefined>(undefined);
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [showPhoneInput, setShowPhoneInput] = useState<boolean>(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [undoAction, setUndoAction] = useState<{
    order: Order;
    type: 'completed' | 'cancelled';
    timer: number;
  } | null>(null);

  // 4-second undo auto-dismiss countdown
  useEffect(() => {
    if (!undoAction) return;
    if (undoAction.timer <= 0) {
      setUndoAction(null);
      return;
    }
    const interval = setInterval(() => {
      setUndoAction((prev) => (prev ? { ...prev, timer: prev.timer - 1 } : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [undoAction]);

  const handleCompleteWithUndo = async (orderId: string) => {
    const target = tenantOrders.find((o) => o.id === orderId || o.orderNumber === orderId);
    await completeOrder(orderId, slug);
    if (target) {
      setUndoAction({ order: target, type: 'completed', timer: 4 });
    }
  };

  const handleCancelWithUndo = async (orderId: string) => {
    const target = tenantOrders.find((o) => o.id === orderId || o.orderNumber === orderId);
    await cancelOrder(orderId, slug);
    if (target) {
      setUndoAction({ order: target, type: 'cancelled', timer: 4 });
    }
  };

  const handlePerformUndo = async () => {
    if (undoAction?.order) {
      await restoreOrder(undoAction.order, slug);
      setUndoAction(null);
    }
  };

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

  const handleOpenQr = (orderNumber?: string) => {
    setSelectedOrderNumber(orderNumber);
    setQrModalOpen(true);
  };

  const handleAddOrderWithTenant = async (
    orderNumber: string,
    estimatedMinutes: number,
    notes?: string,
    options?: { replaceExisting?: boolean }
  ) => {
    setIsSubmittingOrder(true);
    try {
      await addOrder(
        orderNumber,
        estimatedMinutes,
        notes,
        customerPhone || undefined,
        slug,
        options
      );
      setCustomerPhone('');
      setShowPhoneInput(false);
      setFeedbackToast(`تمت إضافة الطلب #${orderNumber}`);
      setTimeout(() => setFeedbackToast(null), 2500);
    } catch (err) {
      console.error('Failed to add order:', err);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <ErrorBoundary fallbackTitle="تعذر تحميل لوحة الكاشير">
      <StaffPinGuard restaurant={restaurant} onUnlocked={() => {}}>
        <div className="min-h-screen bg-[#09090B] text-white flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
          {/* Unified Enterprise App Header */}
        <header className="border-b border-white/[0.08] bg-[#09090B]/90 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            {/* Left: Brand & Live Status */}
            <div className="flex items-center gap-3">
              <Link href={`/${slug}/admin`} className="flex items-center gap-2.5 group">
                <RestaurantAvatar
                  logoUrl={restaurant?.logoUrl}
                  name={restaurant?.name || slug}
                  themeColor={restaurant?.themeColor}
                  size="sm"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white">
                      {restaurant?.name || slug}
                    </span>
                    {networkStatus === 'connected' ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>متصل لحظياً</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                        <span>جاري إعادة الاتصال...</span>
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </div>

            {/* Middle: Segmented View Navigation */}
            <nav className="hidden md:flex items-center bg-[#121215] border border-white/[0.08] p-1 rounded-xl text-xs font-medium text-zinc-400">
              <span className="px-3 py-1.5 rounded-lg bg-zinc-800 text-white font-semibold shadow-sm">
                لوحة الكاشير
              </span>
              <Link
                href={`/${slug}/tv`}
                target="_blank"
                className="px-3 py-1.5 rounded-lg hover:text-white transition-colors flex items-center gap-1.5"
              >
                <Tv className="w-3.5 h-3.5 text-zinc-400" />
                <span>شاشة العرض TV</span>
              </Link>
              <Link
                href={`/${slug}/admin/analytics`}
                className="px-3 py-1.5 rounded-lg hover:text-white transition-colors flex items-center gap-1.5"
              >
                <BarChart3 className="w-3.5 h-3.5 text-zinc-400" />
                <span>التحليلات</span>
              </Link>
              <Link
                href={`/${slug}/admin`}
                className="px-3 py-1.5 rounded-lg hover:text-white transition-colors flex items-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5 text-zinc-400" />
                <span>إعدادات المتجر</span>
              </Link>
              <Link
                href="/debug"
                target="_blank"
                className="px-3 py-1.5 rounded-lg hover:text-white transition-colors flex items-center gap-1.5"
              >
                <Activity className="w-3.5 h-3.5 text-zinc-400" />
                <span>فحص النظام</span>
              </Link>
            </nav>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.94 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => handleOpenQr(undefined)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-zinc-200 border border-white/[0.08] text-xs font-medium transition-colors shadow-sm"
                title="عرض رمز الباركود للطاولات"
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                <span>باركود الطاولات</span>
              </motion.button>

              <Link
                href={`/${slug}/track`}
                target="_blank"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#18181C] hover:bg-[#202026] text-zinc-300 border border-white/[0.08] text-xs font-medium transition-colors shadow-sm"
              >
                <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
                <span>شاشة العميل</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col">
          {/* Subtle Live Toast / Feedback Banner */}
          <AnimatePresence>
            {feedbackToast && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-3 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold">{feedbackToast}</span>
                </div>
                <span className="text-[11px] font-mono text-emerald-400/80">قيد التحضير فوراً</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Linear-Style KPI Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-[#121215] border border-white/[0.08] rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-zinc-400">الطلبات النشطة</p>
                <p className="text-2xl font-bold font-mono text-white mt-0.5 tabular-nums">
                  {preparingOrders.length + readyOrders.length}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-400">
                <Layers className="w-4 h-4 text-zinc-400" />
              </div>
            </div>

            <div className="bg-[#121215] border border-amber-500/20 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-amber-300">قيد التحضير</p>
                <p className="text-2xl font-bold font-mono text-amber-300 mt-0.5 tabular-nums">
                  {preparingOrders.length}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-300">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-[#121215] border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-emerald-400">جاهز للاستلام</p>
                <p className="text-2xl font-bold font-mono text-emerald-400 mt-0.5 tabular-nums">
                  {readyOrders.length}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Bell className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-[#121215] border border-white/[0.08] rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-zinc-400">مكتمل اليوم</p>
                <p className="text-2xl font-bold font-mono text-zinc-300 mt-0.5 tabular-nums">
                  {completedOrders.length}
                </p>
              </div>
              {completedOrders.length > 0 ? (
                <button
                  onClick={() => archiveCompletedOrders(slug)}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 font-medium bg-white/[0.04] hover:bg-white/[0.08] px-2.5 py-1 rounded-lg border border-white/[0.06] transition-colors"
                  title="أرشفة الطلبات المكتملة"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>أرشفة</span>
                </button>
              ) : (
                <span className="text-xs text-zinc-600 font-mono">—</span>
              )}
            </div>
          </div>

          {/* POS Split Layout: Tactile Numpad (4 cols) + Active Queue (8 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
            <div className="lg:col-span-4 lg:sticky lg:top-20 h-auto space-y-3">
              <StaffNumpad
                onAddOrder={handleAddOrderWithTenant}
                onMarkReady={(id) => markReady(id, slug)}
                getActiveOrder={(num) => getActiveOrder(num, slug)}
                isSubmitting={isSubmittingOrder}
              />

              {/* Optional WhatsApp Customer Phone Input */}
              {restaurant?.whatsappFallbackEnabled && (
                <div className="bg-[#121215] border border-white/[0.08] rounded-2xl p-3 text-xs">
                  {!showPhoneInput ? (
                    <button
                      type="button"
                      onClick={() => setShowPhoneInput(true)}
                      className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-colors font-medium text-xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>إضافة رقم جوال لتنبيه واتساب</span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-300 font-medium">
                          رقم جوال العميل:
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPhoneInput(false);
                            setCustomerPhone('');
                          }}
                          className="text-[10px] text-zinc-500 hover:text-zinc-300"
                        >
                          إلغاء
                        </button>
                      </div>
                      <input
                        type="tel"
                        placeholder="05XXXXXXXX أو 9665XXXXXXXX"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full bg-[#18181C] border border-white/[0.08] rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 dir-ltr"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Active Queue Grid: 8 cols */}
            <div className="lg:col-span-8 flex-1">
              <StaffQueueGrid
                preparingOrders={preparingOrders}
                readyOrders={readyOrders}
                onMarkReady={(orderId) => markReady(orderId, slug)}
                onRePing={(orderId) => rePing(orderId, slug)}
                onComplete={handleCompleteWithUndo}
                onCancel={handleCancelWithUndo}
                onRevertToPreparing={(orderId) => revertToPreparing(orderId, slug)}
                onOpenQr={handleOpenQr}
              />
            </div>
          </div>
        </main>

        {/* Accidental Cashier Action Floating Undo Pill ("تراجع سريع") */}
        <AnimatePresence>
          {undoAction && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 350, damping: 26 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#141418] border border-white/10 text-white shadow-2xl backdrop-blur-md"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs text-zinc-200 font-medium">
                  {undoAction.type === 'completed'
                    ? `تم تسليم الطلب #${undoAction.order.orderNumber}`
                    : `تم إلغاء الطلب #${undoAction.order.orderNumber}`}
                </span>
              </div>
              <button
                onClick={handlePerformUndo}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>تراجع ({undoAction.timer}ث)</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Apple Wallet Style QR Modal */}
        <QrModal
          isOpen={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          orderNumber={selectedOrderNumber}
          restaurantSlug={slug}
        />
      </div>
    </StaffPinGuard>
    </ErrorBoundary>
  );
}
