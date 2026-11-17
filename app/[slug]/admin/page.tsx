'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useQueue } from '@/context/QueueContext';
import { StaffPinGuard, StaffLockBtn } from '@/components/StaffPinGuard';
import { RestaurantNotFound } from '@/components/RestaurantNotFound';
import { useLanguage, LanguageSwitcher } from '@/context/LanguageContext';
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
  Volume2,
  Mic,
  Archive,
  Activity,
  ExternalLink,
  Store,
} from 'lucide-react';
import { ChimeSoundTheme } from '@/types/queue';
import { soundManager } from '@/lib/audio';
import { LogoPicker } from '@/components/LogoPicker';
import { AdminOrdersArchive } from '@/components/AdminOrdersArchive';

const COLOR_OPTIONS = [
  { name: 'زمردي كلاسيكي', hex: '#10B981' },
  { name: 'كهرماني دافئ', hex: '#F59E0B' },
  { name: 'أزرق ملكي', hex: '#3B82F6' },
  { name: 'وردي ياقوتي', hex: '#F43F5E' },
  { name: 'أرجواني عصري', hex: '#8B5CF6' },
];

const CHIME_THEMES: { id: ChimeSoundTheme; name: string; desc: string }[] = [
  {
    id: 'hospitality',
    name: 'فندقي فاخر (Hospitality)',
    desc: 'نغمات متدرجة ناعمة وعميقة، مثالية للمطاعم واللاونجات الراقية',
  },
  {
    id: 'coffee-zen',
    name: 'كافيه هادئ (Coffee Zen)',
    desc: 'إيقاع ماريمبا دافئ ومتزن، مناسب للمقاهي والمخابز الحديثة',
  },
  {
    id: 'fast-casual',
    name: 'كاجوال سريع (Fast Casual Ding)',
    desc: 'نغمة دينغ مزدوجة واضحة ونفاذة للأماكن ذات الحركة السريعة',
  },
  {
    id: 'buzzer-retro',
    name: 'بيجر كلاسيكي (Retro Buzzer)',
    desc: 'صوت إلكتروني مميز يحاكي أجهزة البيجر التقليدية للمناطق المزدحمة',
  },
];

export default function TenantAdminBrandingPage() {
  const params = useParams();
  const slug = (params.slug as string) || 'demo-cafe';
  const { language, isRTL, t } = useLanguage();

  const { getRestaurant, updateRestaurant, isRestaurantsLoaded } = useQueue();
  const restaurant = getRestaurant(slug);

  const [activeTab, setActiveTab] = useState<'screens' | 'branding' | 'stand' | 'archive'>('screens');

  // Form states
  const [name, setName] = useState<string>(restaurant?.name || '');
  const [logoUrl, setLogoUrl] = useState<string>(restaurant?.logoUrl || '');
  const [themeColor, setThemeColor] = useState<string>(restaurant?.themeColor || '#10B981');
  const [staffPin, setStaffPin] = useState<string>(restaurant?.staffPin || '1234');
  const [whatsappEnabled, setWhatsappEnabled] = useState<boolean>(
    restaurant?.whatsappFallbackEnabled ?? true
  );
  const [chimeTheme, setChimeTheme] = useState<ChimeSoundTheme>(
    restaurant?.chimeTheme || 'hospitality'
  );
  const [voiceAnnounce, setVoiceAnnounce] = useState<boolean>(
    restaurant?.voiceAnnounceEnabled ?? true
  );
  const [isPlayingTest, setIsPlayingTest] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // QR Stand State
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [origin, setOrigin] = useState<string>('');
  const [activeBaseUrl, setActiveBaseUrl] = useState<string>('');

  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name || '');
      setLogoUrl(restaurant.logoUrl || '');
      setThemeColor(restaurant.themeColor || '#10B981');
      setStaffPin(restaurant.staffPin || '1234');
      setWhatsappEnabled(restaurant.whatsappFallbackEnabled ?? true);
      setChimeTheme(restaurant.chimeTheme || 'hospitality');
      setVoiceAnnounce(restaurant.voiceAnnounceEnabled ?? true);
    }
  }, [restaurant]);

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

  const handleTestChime = async () => {
    setIsPlayingTest(true);
    try {
      await soundManager.unlock();
      soundManager.playThemedChime(chimeTheme);
      if (voiceAnnounce) {
        setTimeout(() => {
          soundManager.announceOrderArabic('10', name || 'المطعم');
        }, 1200);
      }
    } finally {
      setTimeout(() => setIsPlayingTest(false), 2200);
    }
  };

  if (!restaurant) {
    if (isRestaurantsLoaded) {
      return <RestaurantNotFound slug={slug} />;
    }
    return (
      <div className="min-h-screen bg-obsidian text-white flex flex-col items-center justify-center font-cairo p-4">
        <div className="w-12 h-12 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-3" />
        <p className="text-sm text-zinc-400 font-mono">جارِ التحقق من المتجر...</p>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateRestaurant(slug, {
      name,
      logoUrl,
      themeColor,
      staffPin: staffPin.trim() || '1234',
      whatsappFallbackEnabled: whatsappEnabled,
      chimeTheme,
      voiceAnnounceEnabled: voiceAnnounce,
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
                <ArrowRight className={`w-5 h-5 ${isRTL ? '' : 'rotate-180'}`} />
              </Link>
              <div>
                <h1 className="font-extrabold text-lg text-white font-cairo flex items-center gap-2">
                  <span>{t('storeManagement')}</span>
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
              <LanguageSwitcher variant="minimal" />

              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-xs font-bold text-emerald-400 border border-emerald-500/30 transition-colors"
                title="الرجوع إلى لوحة تحكم المالك الرئيسية لجميع المطاعم"
              >
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">كل المطاعم</span>
              </Link>

              <Link
                href={`/${slug}/tv`}
                target="_blank"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-xs font-bold text-zinc-300 border border-obsidian-border"
              >
                <Tv className="w-4 h-4 text-buzly-amber" />
                <span className="hidden sm:inline">{t('tvTitle')}</span>
              </Link>
              <Link
                href={`/${slug}/admin/analytics`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-xs font-bold text-zinc-300 border border-obsidian-border"
              >
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">{t('viewAnalytics')}</span>
              </Link>
              <StaffLockBtn label={t('lockTerminal')} />
            </div>
          </div>
        </header>

        {/* Tab Controls */}
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6">
          <div className="flex border-b border-obsidian-border gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('screens')}
              className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'screens'
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              <Tv className="w-4 h-4 text-sky-400" />
              <span>{t('supervisorCommandCenter')}</span>
              <span className="text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full font-mono">
                {t('controlBadge')}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('branding')}
              className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'branding'
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>{t('brandingTab')}</span>
            </button>

            <button
              onClick={() => setActiveTab('stand')}
              className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'stand'
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>{t('tableStandsTab')}</span>
            </button>

            <button
              onClick={() => setActiveTab('archive')}
              className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'archive'
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              <Archive className="w-4 h-4 text-amber-400" />
              <span>{t('archiveTab')}</span>
              <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                {t('protectedBadge')}
              </span>
            </button>
          </div>
        </div>

        {/* Main Body */}
        <main className="max-w-6xl w-full mx-auto p-4 sm:px-6 py-8 flex-1">
          {/* TAB 0: SUPERVISOR & SCREENS CONTROL CENTER */}
          {activeTab === 'screens' && (
            <div className="space-y-6">
              {/* Intro Banner */}
              <div className="bg-[#121215] border border-white/[0.08] rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
                    <Tv className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>{t('supervisorCommandCenter')}</span>
                      <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                        {t('supervisorBadge')}
                      </span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                      {t('supervisorIntro')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/${slug}/staff`}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all shadow-md"
                  >
                    <Store className="w-4 h-4" />
                    <span>{t('launchCashier')}</span>
                  </Link>
                </div>
              </div>

              {/* Grid of Screen Station Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* Station 1: TV Customer Screen */}
                <div className="bg-[#121215] border border-white/[0.08] hover:border-amber-500/30 rounded-3xl p-5 flex flex-col justify-between transition-all group shadow-lg">
                  <div>
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                      <Tv className="w-5 h-5" />
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-white text-base">{t('tvTitle')}</h3>
                      <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        {language === 'ar' ? 'للصالة والتلفزيون' : 'Dining Hall TV'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                      {language === 'ar'
                        ? 'تُعرض على شاشة التلفزيون المعلقة في صالة المطعم أو منطقة الاستلام. تعرض أرقام الطلبات الجاهزة والتحضير مع نداء صوتي عربي وإنجليزي فخم.'
                        : 'Displayed on dining hall TVs or pickup counter screens. Shows preparing and ready orders with bilingual voice announcements.'}
                    </p>
                    <div className="mt-4 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[11px] text-zinc-400">
                      💡 {t('fullscreenTip')}
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-2">
                    <Link
                      href={`/${slug}/tv`}
                      target="_blank"
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all"
                    >
                      <span>{t('launchTv')}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Station 2: Cashier POS Screen */}
                <div className="bg-[#121215] border border-white/[0.08] hover:border-emerald-500/30 rounded-3xl p-5 flex flex-col justify-between transition-all group shadow-lg">
                  <div>
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                      <Store className="w-5 h-5" />
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-white text-base">{t('cashierPos')}</h3>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        {t('protectedBadge')}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                      {language === 'ar'
                        ? 'شاشة العمل المستقلة المخصصة لموظف الكاشير لإدخال الطلبات بنقرة واحدة ونداء استلام الزبائن بزر نداء فوري.'
                        : 'Dedicated standalone terminal for cashiers to enter orders and chime customers with zero latency.'}
                    </p>
                    <div className="mt-4 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[11px] text-zinc-400">
                      🔒 {t('protectedAreaNotice')}
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-2">
                    <Link
                      href={`/${slug}/staff`}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all"
                    >
                      <span>{t('launchCashier')}</span>
                      <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? '' : 'rotate-180'}`} />
                    </Link>
                  </div>
                </div>

                {/* Station 3: Table QR & Counter Stands */}
                <div className="bg-[#121215] border border-white/[0.08] hover:border-purple-500/30 rounded-3xl p-5 flex flex-col justify-between transition-all group shadow-lg">
                  <div>
                    <div className="w-11 h-11 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                      <Printer className="w-5 h-5" />
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-white text-base">ستاندات باركود الطاولات</h3>
                      <span className="text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-full">
                        طباعة A6 / كاونتر
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                      تصميم وطباعة ستاندات الأكريليك الفاخرة للطاولات أو ملصق الكاونتر ليمسحه الزبائن بكاميرا هواتفهم فوراً.
                    </p>
                    <div className="mt-4 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[11px] text-zinc-400">
                      📄 قياس A6 احترافي مع شعار المطعم وألوان هويتك التلقائية.
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('stand')}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-black text-xs font-bold transition-all"
                    >
                      <span>معاينة وطباعة الستاند</span>
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Station 4: Customer Tracker Mobile Preview */}
                <div className="bg-[#121215] border border-white/[0.08] hover:border-sky-500/30 rounded-3xl p-5 flex flex-col justify-between transition-all group shadow-lg">
                  <div>
                    <div className="w-11 h-11 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-white text-base">شاشة جوال الزبون</h3>
                      <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full">
                        معاينة مباشرة
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                      معاينة الواجهة الذكية التي يراها الزبون على هاتفه، مع اختبار رنين واهتزاز الجوال الحقيقي فور جهوزية الطلب.
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-2">
                    <Link
                      href={`/${slug}/track`}
                      target="_blank"
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.08] text-xs font-bold transition-all"
                    >
                      <span>معاينة شاشة الزبون</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Station 5: Kitchen Speed Analytics */}
                <div className="bg-[#121215] border border-white/[0.08] hover:border-emerald-500/30 rounded-3xl p-5 flex flex-col justify-between transition-all group shadow-lg">
                  <div>
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-white text-base">تحليلات سرعة المطبخ</h3>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        تقارير الأداء
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                      إحصائيات حية عن متوسط سرعة التحضير وتأخير استلام الزبائن ومؤشرات كفاءة موظفي المطبخ والكاشير.
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-2">
                    <Link
                      href={`/${slug}/admin/analytics`}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.08] text-xs font-bold transition-all"
                    >
                      <span>عرض التحليلات</span>
                      <BarChart3 className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Station 6: System Diagnostics */}
                <div className="bg-[#121215] border border-white/[0.08] hover:border-zinc-500/30 rounded-3xl p-5 flex flex-col justify-between transition-all group shadow-lg">
                  <div>
                    <div className="w-11 h-11 rounded-2xl bg-zinc-800 text-zinc-300 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-white text-base">فحص وصحة النظام</h3>
                      <span className="text-[10px] bg-zinc-700/50 text-zinc-300 border border-zinc-600 px-2 py-0.5 rounded-full">
                        تشخيص الاتصال
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                      فحص سرعة استجابة السيرفر المحلي والإنترنت وشهادات الأمان ومحرك الأصوات للتأكد من جاهزية التشغيل بدون أي مشاكل.
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-2">
                    <Link
                      href="/debug"
                      target="_blank"
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.08] text-xs font-bold transition-all"
                    >
                      <span>تشغيل الفحص</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

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

                  {/* Enhanced Logo Selector & Uploader */}
                  <div>
                    <LogoPicker
                      value={logoUrl}
                      onChange={setLogoUrl}
                      restaurantName={name}
                      themeColor={themeColor}
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
                    <label className="block text-xs font-semibold text-zinc-300 mb-2">
                      رمز الدخول السري للكاشير
                    </label>
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
                    </div>
                    <input
                      type="checkbox"
                      checked={whatsappEnabled}
                      onChange={(e) => setWhatsappEnabled(e.target.checked)}
                      className="w-5 h-5 rounded accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* TV Display & Audio Public Settings Card */}
                <div className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-6 shadow-xl space-y-5">
                  <div className="flex items-center justify-between border-b border-obsidian-border pb-3">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-5 h-5 text-emerald-400" />
                      <div>
                        <h3 className="text-base font-bold text-white">إعدادات شاشة التلفزيون والصوت</h3>
                      </div>
                    </div>
                    <Link
                      href={`/${slug}/tv`}
                      target="_blank"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-xs font-bold text-zinc-300 border border-obsidian-border transition-colors"
                    >
                      <Tv className="w-3.5 h-3.5 text-buzly-amber" />
                      <span>معاينة الشاشة</span>
                    </Link>
                  </div>

                  {/* Chime Sound Theme Picker */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-2">
                      نغمة رنين الاستدعاء
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {CHIME_THEMES.map((theme) => {
                        const isSelected = chimeTheme === theme.id;
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => {
                              setChimeTheme(theme.id);
                              soundManager.setTheme(theme.id);
                            }}
                            className={`p-3 rounded-2xl border text-right transition-all flex items-start justify-between cursor-pointer ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-500/10 shadow-md'
                                : 'border-obsidian-border bg-obsidian-card/50 hover:bg-obsidian-card'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                                <span className="text-xs font-bold text-zinc-200">{theme.name}</span>
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Voice Announce Toggle */}
                  <div className="pt-2 border-t border-obsidian-border flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-zinc-200 block">
                        النداء الصوتي الآلي
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={voiceAnnounce}
                      onChange={(e) => setVoiceAnnounce(e.target.checked)}
                      className="w-5 h-5 rounded accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* Sound Testing Trigger Button */}
                  <div className="pt-3 border-t border-obsidian-border flex items-center justify-between">
                    <div className="text-[11px] text-zinc-400">
                      اختبر كيف ستسمع الشاشة النغمة والصوت في الصالة
                    </div>
                    <button
                      type="button"
                      onClick={handleTestChime}
                      disabled={isPlayingTest}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-xs font-bold text-emerald-400 border border-emerald-500/30 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>{isPlayingTest ? 'جاري الاختبار...' : 'تجربة مستوى الصوت'}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
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

          {/* TAB 3: ENCRYPTED ORDERS ARCHIVE */}
          {activeTab === 'archive' && (
            <AdminOrdersArchive slug={slug} themeColor={themeColor} />
          )}
        </main>
      </div>
    </StaffPinGuard>
  );
}
