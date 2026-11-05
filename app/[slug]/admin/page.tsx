'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useQueue } from '@/context/QueueContext';
import { StaffPinGuard } from '@/components/StaffPinGuard';
import {
  Settings,
  Palette,
  Printer,
  Save,
  Check,
  ArrowRight,
  Tv,
  BarChart3,
  Smartphone,
  Sparkles,
  QrCode,
  Shield,
  MessageCircle,
  Wifi,
  Cloud,
  Camera,
} from 'lucide-react';

const COLOR_OPTIONS = [
  { name: 'زمردي كلاسيكي', hex: '#10B981' },
  { name: 'كهرماني دافئ', hex: '#F59E0B' },
  { name: 'أزرق ملكي', hex: '#3B82F6' },
  { name: 'وردي ياقوتي', hex: '#F43F5E' },
  { name: 'أرجواني عصري', hex: '#8B5CF6' },
];

export default function TenantAdminBrandingPage() {
  const params = useParams();
  const slug = (params.slug as string) || 'demo-cafe';

  const { getRestaurant, updateRestaurant } = useQueue();
  const restaurant = getRestaurant(slug);

  const [activeTab, setActiveTab] = useState<'branding' | 'stand'>('branding');

  // Form states
  const [name, setName] = useState<string>(restaurant.name);
  const [logoUrl, setLogoUrl] = useState<string>(restaurant.logoUrl || '');
  const [themeColor, setThemeColor] = useState<string>(restaurant.themeColor || '#10B981');
  const [staffPin, setStaffPin] = useState<string>(restaurant.staffPin || '1234');
  const [whatsappEnabled, setWhatsappEnabled] = useState<boolean>(
    restaurant.whatsappFallbackEnabled ?? true
  );
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // QR Stand State
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [origin, setOrigin] = useState<string>('');
  const [activeBaseUrl, setActiveBaseUrl] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedOverride = localStorage.getItem('buzly_base_url_override');
      const base = savedOverride?.trim() || window.location.origin;
      setOrigin(window.location.origin);
      setActiveBaseUrl(base);
    }
  }, []);

  const tableStandUrl = `${(activeBaseUrl || origin || '').replace(/\/+$/, '')}/${slug}/track`;

  useEffect(() => {
    if (tableStandUrl) {
      QRCode.toDataURL(tableStandUrl, {
        width: 380,
        margin: 2,
        color: {
          dark: '#0A0A0C',
          light: '#FFFFFF',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((e) => console.error(e));
    }
  }, [tableStandUrl]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateRestaurant(slug, {
      name,
      logoUrl,
      themeColor,
      staffPin: staffPin.trim() || '1234',
      whatsappFallbackEnabled: whatsappEnabled,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handlePrintStand = () => {
    if (typeof window === 'undefined') return;

    const printWin = window.open('', '_blank');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <title>ستاند طاولة - ${name}</title>
          <style>
            @page { size: A5 portrait; margin: 0; }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 0;
              padding: 40px 24px;
              background: #fff;
              color: #0A0A0C;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              min-height: 100vh;
              box-sizing: border-box;
            }
            .stand-card {
              border: 3px solid ${themeColor};
              border-radius: 28px;
              padding: 40px 32px;
              max-width: 380px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.08);
            }
            .logo {
              width: 72px;
              height: 72px;
              border-radius: 18px;
              margin: 0 auto 16px;
              object-fit: cover;
              border: 2px solid #eee;
            }
            .badge {
              display: inline-block;
              background: ${themeColor};
              color: #fff;
              padding: 6px 16px;
              border-radius: 20px;
              font-size: 13px;
              font-weight: bold;
              margin-bottom: 12px;
            }
            h1 { margin: 0 0 10px; font-size: 26px; font-weight: 900; }
            p { margin: 0 0 24px; font-size: 14px; color: #555; line-height: 1.5; }
            .qr-box {
              background: #fff;
              padding: 16px;
              border: 2px dashed ${themeColor};
              border-radius: 20px;
              display: inline-block;
              margin-bottom: 20px;
            }
            .qr-box img { width: 220px; height: 220px; display: block; }
            .instructions {
              font-size: 14px;
              font-weight: 700;
              color: #111;
              background: #f8f9fa;
              padding: 12px 18px;
              border-radius: 14px;
            }
            .brand-footer { margin-top: 24px; font-size: 11px; color: #888; }
          </style>
        </head>
        <body>
          <div class="stand-card">
            ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="logo" />` : ''}
            <div class="badge">نظام النداء الذكي</div>
            <h1>${name}</h1>
            <p>امسح الرمز بكاميرا الهاتف لمتابعة طلبك مباشرة. استرح وسيقوم هاتفك بالرنين والاهتزاز فور جهوزيته.</p>
            
            <div class="qr-box">
              <img src="${qrDataUrl}" alt="QR" />
            </div>

            <div class="instructions">
              وجّه كاميرا الهاتف للرمز لمتابعة تفاصيل الفاتورة
            </div>

            <div class="brand-footer">
              مدعوم بنظام بوزلي للنداء الذكي
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <StaffPinGuard restaurant={restaurant} onUnlocked={() => {}}>
      <div className="min-h-screen bg-obsidian text-white flex flex-col font-cairo selection:bg-emerald-500 selection:text-black">
        {/* Top Header */}
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
                  <span>إعدادات وهوية المتجر</span>
                  <span
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full text-black font-bold"
                    style={{ backgroundColor: themeColor }}
                  >
                    {slug}
                  </span>
                </h1>
                <p className="text-xs text-zinc-400">تخصيص العلامة التجارية، الألوان، وطباعة ستاند الباركود</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/${slug}/tv`}
                target="_blank"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-xs font-bold text-zinc-300 border border-obsidian-border"
              >
                <Tv className="w-4 h-4 text-buzly-amber" />
                <span className="hidden sm:inline">شاشة TV</span>
              </Link>
              <Link
                href={`/${slug}/admin/analytics`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-xs font-bold text-zinc-300 border border-obsidian-border"
              >
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">التحليلات</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Tab Controls */}
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6">
          <div className="flex border-b border-obsidian-border gap-2">
            <button
              onClick={() => setActiveTab('branding')}
              className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'branding'
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>الهوية والتخصيص</span>
            </button>

            <button
              onClick={() => setActiveTab('stand')}
              className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'stand'
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>طباعة ستاندات الطاولات</span>
            </button>
          </div>
        </div>

        {/* Main Body */}
        <main className="max-w-6xl w-full mx-auto p-4 sm:px-6 py-8 flex-1">
          {/* TAB 1: BRANDING STUDIO */}
          {activeTab === 'branding' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Form */}
              <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
                <div className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-6 shadow-xl space-y-5">
                  <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-obsidian-border pb-3">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>بيانات المنشأة التجارية</span>
                  </h3>

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      اسم المطعم أو الكافيه
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-obsidian-card border border-obsidian-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Logo URL */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      رابط شعار المتجر
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com/logo.png"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="w-full bg-obsidian-card border border-obsidian-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 dir-ltr"
                    />
                  </div>

                  {/* Accent Color Picker */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-2">
                      اللون الرئيسي للهوية
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {COLOR_OPTIONS.map((c) => {
                        const isSelected = themeColor.toLowerCase() === c.hex.toLowerCase();
                        return (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setThemeColor(c.hex)}
                            className={`p-3 rounded-2xl border text-right transition-all flex items-center gap-2.5 ${
                              isSelected
                                ? 'border-white bg-obsidian-card shadow-lg'
                                : 'border-obsidian-border bg-obsidian-card/50 hover:bg-obsidian-card'
                            }`}
                          >
                            <span
                              className="w-5 h-5 rounded-full shadow-inner shrink-0"
                              style={{ backgroundColor: c.hex }}
                            />
                            <span className="text-xs font-bold text-zinc-200">{c.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4-digit PIN */}
                  <div className="pt-2 border-t border-obsidian-border">
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      رمز الدخول السري للكاشير
                    </label>
                    <p className="text-[11px] text-zinc-500 mb-2">
                      يمنع فتح لوحة التحكم وأخذ الإجراءات لغير الموظفين المصرح لهم
                    </p>
                    <input
                      type="text"
                      maxLength={4}
                      value={staffPin}
                      onChange={(e) => setStaffPin(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-36 bg-obsidian-card border border-obsidian-border rounded-xl px-4 py-2.5 text-lg font-mono tabular-nums text-center tracking-widest text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* WhatsApp Toggle */}
                  <div className="pt-2 border-t border-obsidian-border flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-zinc-200 block">
                        تفعيل خيار التنبيه عبر واتساب
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        إظهار زر مراسلة فورية للكاشير في حال تعذر إشعارات الويب لدى العميل
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={whatsappEnabled}
                      onChange={(e) => setWhatsappEnabled(e.target.checked)}
                      className="w-5 h-5 rounded accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full py-4 px-6 rounded-2xl font-extrabold text-sm text-black flex items-center justify-center gap-2 shadow-xl cursor-pointer transition-all"
                    style={{ backgroundColor: themeColor }}
                  >
                    {savedSuccess ? (
                      <>
                        <Check className="w-5 h-5" />
                        <span>تم حفظ التعديلات بنجاح</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        <span>حفظ التعديلات والتحديث الفوري</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Live Preview Card */}
              <div className="lg:col-span-5 bg-obsidian-surface border border-obsidian-border rounded-3xl p-6 shadow-xl sticky top-24">
                <h3 className="text-sm font-bold text-zinc-400 mb-4 flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  <span>معاينة مظهر شاشة العميل</span>
                </h3>

                <div className="bg-obsidian border-2 border-obsidian-border rounded-3xl p-6 text-center shadow-inner relative overflow-hidden">
                  <div
                    className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center shadow-lg border border-white/10 overflow-hidden"
                    style={{ backgroundColor: `${themeColor}25` }}
                  >
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Sparkles className="w-8 h-8" style={{ color: themeColor }} />
                    )}
                  </div>
                  <h4 className="text-xl font-black text-white">{name || 'اسم المطعم'}</h4>
                  <p className="text-xs text-zinc-400 mt-1">طلبك يُحضّر بكل عناية وإتقان</p>

                  <div className="my-6 py-4 px-6 rounded-2xl bg-obsidian-card border border-obsidian-border inline-block">
                    <span className="text-xs text-zinc-500 block">رقم الطلب</span>
                    <span className="font-mono tabular-nums text-4xl font-black" style={{ color: themeColor }}>
                      #104
                    </span>
                  </div>

                  <div
                    className="py-3 px-4 rounded-xl text-black font-extrabold text-xs shadow-md"
                    style={{ backgroundColor: themeColor }}
                  >
                    جاهز للاستلام
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRINTABLE STAND GENERATOR */}
          {activeTab === 'stand' && (
            <div className="max-w-xl mx-auto flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">معاينة ستاند الباركود للطاولة</h3>
                  <p className="text-xs text-zinc-400">جاهز للطباعة على ورق مقوى مقاس A5 أو A6</p>
                </div>
                <button
                  onClick={handlePrintStand}
                  className="py-2.5 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة الستاند</span>
                </button>
              </div>

              {/* Base URL selector for printing */}
              <div className="w-full bg-obsidian-surface border border-obsidian-border rounded-2xl p-3.5 mb-2 text-right">
                <span className="text-xs font-bold text-zinc-300 block mb-2">رابط الموقع المطبوع داخل الباركود:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const url = 'http://192.168.100.12:3000';
                      setActiveBaseUrl(url);
                      localStorage.setItem('buzly_base_url_override', url);
                    }}
                    className={`p-2.5 rounded-xl border text-right transition-all text-xs flex items-center gap-2 ${
                      activeBaseUrl === 'http://192.168.100.12:3000'
                        ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold'
                        : 'bg-obsidian-card border-obsidian-border text-zinc-400'
                    }`}
                  >
                    <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>شبكة الواي فاي المحلية (192.168.100.12)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const url = 'https://buzly-smart-pager.vercel.app';
                      setActiveBaseUrl(url);
                      localStorage.setItem('buzly_base_url_override', url);
                    }}
                    className={`p-2.5 rounded-xl border text-right transition-all text-xs flex items-center gap-2 ${
                      activeBaseUrl === 'https://buzly-smart-pager.vercel.app'
                        ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold'
                        : 'bg-obsidian-card border-obsidian-border text-zinc-400'
                    }`}
                  >
                    <Cloud className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>رابط السحابة المباشر</span>
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500 mt-2 font-mono dir-ltr truncate">
                  الرابط المشفر: {tableStandUrl}
                </p>
              </div>

              {/* Physical Stand Card Preview */}
              <div className="bg-white text-black p-8 rounded-3xl shadow-2xl border-4 w-full max-w-sm text-center my-4 relative" style={{ borderColor: themeColor }}>
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={name}
                    className="w-16 h-16 rounded-2xl mx-auto mb-3 object-cover shadow border border-zinc-200"
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white"
                    style={{ backgroundColor: themeColor }}
                  >
                    <QrCode className="w-8 h-8" />
                  </div>
                )}

                <span
                  className="inline-block text-white text-[11px] font-black px-3 py-1 rounded-full mb-2"
                  style={{ backgroundColor: themeColor }}
                >
                  جهاز النداء الذكي
                </span>

                <h3 className="text-2xl font-black text-black mb-1">{name}</h3>
                <p className="text-xs text-zinc-600 mb-4 leading-relaxed">
                  امسح الرمز بكاميرا الهاتف لمتابعة تجهيز وجبتك ورنين هاتفك فور جهوزيتها
                </p>

                {/* QR Code Container */}
                <div
                  className="p-3 bg-white rounded-2xl border-2 border-dashed inline-block shadow-inner mb-4"
                  style={{ borderColor: themeColor }}
                >
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrDataUrl} alt="QR Code" className="w-48 h-48 mx-auto" />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-xs text-zinc-400">
                      جارِ التحميل...
                    </div>
                  )}
                </div>

                <div className="bg-zinc-100 p-2.5 rounded-xl text-xs font-bold text-zinc-800 flex items-center justify-center gap-1.5">
                  <Camera className="w-4 h-4 text-zinc-600" />
                  <span>وجّه كاميرا الهاتف للرمز لمتابعة طلبك</span>
                </div>

                <div className="text-[10px] text-zinc-400 mt-4">
                  Chimer Smart Restaurant Pager
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </StaffPinGuard>
  );
}
