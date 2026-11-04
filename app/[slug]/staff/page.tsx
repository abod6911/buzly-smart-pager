'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQueue } from '@/context/QueueContext';
import { StaffPinGuard } from '@/components/StaffPinGuard';
import { StaffNumpad } from '@/components/StaffNumpad';
import { StaffQueueGrid } from '@/components/StaffQueueGrid';
import { QrModal } from '@/components/QrModal';
import { soundManager } from '@/lib/audio';
import {
  Bell,
  Volume2,
  QrCode,
  RotateCcw,
  Smartphone,
  Radio,
  ExternalLink,
  Tv,
  Settings,
  BarChart3,
  Archive,
  Flame,
  MessageCircle,
  Activity,
} from 'lucide-react';

export default function TenantStaffCashierPage() {
  const params = useParams();
  const slug = (params.slug as string) || 'demo-cafe';

  const {
    getRestaurant,
    getOrdersForRestaurant,
    addOrder,
    markReady,
    rePing,
    completeOrder,
    cancelOrder,
    archiveCompletedOrders,
    resetToDemoOrders,
    isSupabaseActive,
  } = useQueue();

  const restaurant = getRestaurant(slug);
  const tenantOrders = getOrdersForRestaurant(slug);

  const preparingOrders = tenantOrders.filter((o) => o.status === 'preparing');
  const readyOrders = tenantOrders.filter((o) => o.status === 'ready');
  const completedOrders = tenantOrders.filter((o) => o.status === 'completed');

  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | undefined>(undefined);
  const [soundTested, setSoundTested] = useState<boolean>(false);
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [showPhoneInput, setShowPhoneInput] = useState<boolean>(false);

  const handleOpenQr = (orderNumber?: string) => {
    setSelectedOrderNumber(orderNumber);
    setQrModalOpen(true);
  };

  const handleTestSound = async () => {
    await soundManager.unlock();
    soundManager.playHospitalityChime();
    setSoundTested(true);
    setTimeout(() => setSoundTested(false), 2000);
  };

  const handleAddOrderWithTenant = async (
    orderNumber: string,
    estimatedMinutes: number,
    notes?: string
  ) => {
    await addOrder(orderNumber, estimatedMinutes, notes, customerPhone, slug);
    setCustomerPhone('');
    setShowPhoneInput(false);
  };

  const handleWhatsAppAlert = (phone: string, orderNumber: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const message = `مرحباً من ${restaurant.name} 🌟 طلبك رقم #${orderNumber} جاهز للاستلام الآن على الكاونتر! نتمنى لك وجبة شهية.`;
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(
      message
    )}`;
    window.open(url, '_blank');
  };

  return (
    <StaffPinGuard restaurant={restaurant} onUnlocked={() => {}}>
      <div className="min-h-screen bg-obsidian text-white flex flex-col font-cairo selection:bg-emerald-500 selection:text-black">
        {/* Top Staff Navigation Bar */}
        <header className="border-b border-obsidian-border bg-obsidian-surface/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-3.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            {/* Logo & Restaurant Name */}
            <div className="flex items-center gap-3">
              <Link href={`/${slug}/admin`} className="flex items-center gap-2.5 group">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg border border-white/10 group-hover:scale-105 transition-transform overflow-hidden"
                  style={{ backgroundColor: `${restaurant.themeColor}20` }}
                >
                  {restaurant.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={restaurant.logoUrl}
                      alt={restaurant.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Bell className="w-5 h-5" style={{ color: restaurant.themeColor }} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-base lg:text-lg tracking-tight text-white font-cairo">
                      {restaurant.name}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold text-black font-mono shadow-sm"
                      style={{ backgroundColor: restaurant.themeColor }}
                    >
                      POS
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 hidden sm:block">
                    لوحة الكاشير واستدعاء الزبائن
                  </p>
                </div>
              </Link>
            </div>

            {/* Quick Multi-Tenant Navigation Links */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* TV Screen Link */}
              <Link
                href={`/${slug}/tv`}
                target="_blank"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-zinc-300 border border-obsidian-border text-xs font-bold transition-all shadow-sm"
                title="فتح شاشة التلفاز التفاعلية في تبويب أو شاشة ثانية"
              >
                <Tv className="w-4 h-4 text-buzly-amber" />
                <span className="hidden md:inline">شاشة التلفاز TV</span>
              </Link>

              {/* Kitchen Analytics */}
              <Link
                href={`/${slug}/admin/analytics`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-zinc-300 border border-obsidian-border text-xs font-bold transition-all shadow-sm"
                title="مؤشرات أداء المطبخ وسرعة التحضير"
              >
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span className="hidden md:inline">التحليلات</span>
              </Link>

              {/* Branding Studio & QR Stand Settings */}
              <Link
                href={`/${slug}/admin`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-zinc-300 border border-obsidian-border text-xs font-bold transition-all shadow-sm"
                title="إعدادات الهوية وطباعة ستاند الباركود"
              >
                <Settings className="w-4 h-4 text-zinc-300" />
                <span className="hidden lg:inline">إعدادات المتجر</span>
              </Link>

              {/* System Diagnostics */}
              <Link
                href="/debug"
                target="_blank"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-zinc-300 border border-obsidian-border text-xs font-bold transition-all shadow-sm"
                title="فحص وصحة اتصال الجوال والسيرفر"
              >
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="hidden xl:inline">فحص النظام</span>
              </Link>

              {/* Restaurant QR Code */}
              <button
                onClick={() => handleOpenQr(undefined)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-zinc-300 border border-obsidian-border text-xs font-bold transition-all"
                title="عرض رمز QR للكاونتر"
              >
                <QrCode className="w-4 h-4 text-zinc-300" />
                <span className="hidden sm:inline">QR الكاونتر</span>
              </button>

              {/* Customer Tracker Link */}
              <Link
                href={`/${slug}/track`}
                target="_blank"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-extrabold text-xs shadow-md transition-all text-black"
                style={{ backgroundColor: restaurant.themeColor }}
              >
                <Smartphone className="w-4 h-4" />
                <span className="hidden sm:inline">شاشة العميل</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col">
          {/* Quick Stats Overview Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-obsidian-surface border border-obsidian-border rounded-2xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-zinc-400 font-medium">الطلبات النشطة</p>
                <p className="text-xl font-bold font-mono text-white mt-0.5">
                  {preparingOrders.length + readyOrders.length}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-obsidian-card border border-obsidian-border flex items-center justify-center text-zinc-400">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              </div>
            </div>

            <div className="bg-obsidian-surface border border-buzly-amber/20 rounded-2xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-buzly-amber font-medium">قيد التحضير</p>
                <p className="text-xl font-bold font-mono text-buzly-amber mt-0.5">
                  {preparingOrders.length}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-buzly-amber/10 border border-buzly-amber/20 flex items-center justify-center text-buzly-amber">
                <Flame className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-obsidian-surface border border-emerald-500/20 rounded-2xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-emerald-400 font-medium">جاهز للاستلام</p>
                <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                  {readyOrders.length}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Bell className="w-4 h-4 animate-bounce-subtle" />
              </div>
            </div>

            {/* Auto-archive Completed Orders */}
            <div className="bg-obsidian-surface border border-obsidian-border rounded-2xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-zinc-400 font-medium">مكتمل اليوم</p>
                <p className="text-xl font-bold font-mono text-zinc-300 mt-0.5">
                  {completedOrders.length}
                </p>
              </div>
              {completedOrders.length > 0 ? (
                <button
                  onClick={() => archiveCompletedOrders(slug)}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-rose-400 font-medium bg-obsidian-card hover:bg-rose-500/10 px-2 py-1 rounded-lg border border-obsidian-border transition-colors"
                  title="أرشفة وتصفية الطلبات المكتملة"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>تصفية</span>
                </button>
              ) : (
                <button
                  onClick={() => resetToDemoOrders(slug)}
                  className="text-[11px] text-emerald-400 hover:underline font-medium"
                >
                  إعادة تعيين
                </button>
              )}
            </div>
          </div>

          {/* Cashier Layout: Numpad (Left) + Queue Grid (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
            {/* Numpad Section: 4 cols */}
            <div className="lg:col-span-4 lg:sticky lg:top-24 h-auto space-y-3">
              <StaffNumpad onAddOrder={handleAddOrderWithTenant} />

              {/* Optional WhatsApp Customer Phone Input */}
              {restaurant.whatsappFallbackEnabled && (
                <div className="bg-obsidian-surface border border-obsidian-border rounded-2xl p-3 text-xs">
                  {!showPhoneInput ? (
                    <button
                      type="button"
                      onClick={() => setShowPhoneInput(true)}
                      className="text-zinc-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors font-medium"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-400" />
                      <span>+ إضافة رقم جوال الزبون (لتنبيه الواتساب)</span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 font-semibold flex items-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-400" /> رقم الجوال
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerPhone('');
                            setShowPhoneInput(false);
                          }}
                          className="text-[11px] text-zinc-500 hover:text-white"
                        >
                          إلغاء
                        </button>
                      </div>
                      <input
                        type="tel"
                        placeholder="مثال: 9665XXXXXXXX أو 05XXXXXXXX"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full bg-obsidian-card border border-obsidian-border rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 dir-ltr"
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
                onComplete={(orderId) => completeOrder(orderId, slug)}
                onCancel={(orderId) => cancelOrder(orderId, slug)}
                onOpenQr={handleOpenQr}
              />
            </div>
          </div>
        </main>

        {/* QR Modal */}
        <QrModal
          isOpen={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          orderNumber={selectedOrderNumber}
          restaurantSlug={slug}
        />
      </div>
    </StaffPinGuard>
  );
}
