'use client';

import React, { useEffect, useState, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  Copy,
  Check,
  QrCode as QrIcon,
  Download,
  Printer,
  Wifi,
  Cloud,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react';
import { AppleBottomSheet } from '@/components/AppleBottomSheet';

const STORAGE_OVERRIDE_KEY = 'chimer_base_url_override';
const KNOWN_WIFI_IP = 'http://192.168.100.12:3000';
const KNOWN_VERCEL_URL = 'https://buzly-smart-pager.vercel.app';

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber?: string;
  restaurantSlug?: string;
  orderNotes?: string;
  estimatedMinutes?: number;
}

export const QrModal: React.FC<QrModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  restaurantSlug = 'demo-cafe',
  orderNotes,
  estimatedMinutes = 10,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [currentOrigin, setCurrentOrigin] = useState<string>('');
  const [activeBaseUrl, setActiveBaseUrl] = useState<string>('');
  const [customInputUrl, setCustomInputUrl] = useState<string>('');
  const [showOverrideSettings, setShowOverrideSettings] = useState<boolean>(false);
  const [saveConfirmation, setSaveConfirmation] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      setCurrentOrigin(origin);
      const savedOverride =
        localStorage.getItem(STORAGE_OVERRIDE_KEY) ||
        localStorage.getItem('buzly_base_url_override');
      const initial = savedOverride?.trim() || origin;
      setActiveBaseUrl(initial);
      setCustomInputUrl(initial);
    }
  }, [isOpen]);

  const isLocalhost = useMemo(() => {
    if (!activeBaseUrl) return false;
    return (
      activeBaseUrl.includes('localhost') ||
      activeBaseUrl.includes('127.0.0.1') ||
      activeBaseUrl.includes('0.0.0.0')
    );
  }, [activeBaseUrl]);

  const isOrderQr = Boolean(orderNumber);

  const targetUrl = useMemo(() => {
    const base = (activeBaseUrl || currentOrigin || '').replace(/\/+$/, '');
    const cleanSlug = (restaurantSlug || 'demo-cafe').toLowerCase();

    if (orderNumber) {
      return `${base}/${cleanSlug}/track/${encodeURIComponent(orderNumber)}`;
    }

    return `${base}/${cleanSlug}/track`;
  }, [activeBaseUrl, currentOrigin, restaurantSlug, orderNumber]);

  useEffect(() => {
    if (!isOpen || !targetUrl) return;

    QRCode.toDataURL(targetUrl, {
      width: 480,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [targetUrl, isOpen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleSaveOverride = (newUrl: string) => {
    const trimmed = newUrl.trim().replace(/\/+$/, '');
    setActiveBaseUrl(trimmed);
    setCustomInputUrl(trimmed);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_OVERRIDE_KEY, trimmed);
    }
    setSaveConfirmation(true);
    setTimeout(() => setSaveConfirmation(false), 2500);
  };

  const handleResetToOrigin = () => {
    setActiveBaseUrl(currentOrigin);
    setCustomInputUrl(currentOrigin);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_OVERRIDE_KEY);
    }
    setSaveConfirmation(true);
    setTimeout(() => setSaveConfirmation(false), 2000);
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `chimer-qr-${orderNumber || 'counter'}.png`;
    a.click();
  };

  const handlePrint = () => {
    if (!qrDataUrl) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    if (orderNumber) {
      // 1. ORDER SPECIFIC RECEIPT SLIP
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
          <head>
            <title>إيصال طلب #${orderNumber}</title>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                text-align: center;
                padding: 16px;
                color: #000;
                margin: 0;
                background: #fff;
              }
              .receipt {
                border: 2px dashed #71717A;
                border-radius: 12px;
                padding: 20px;
                max-width: 260px;
                margin: 10px auto;
              }
              .store-name { font-size: 16px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; }
              .badge { display: inline-block; font-size: 11px; background: #000; color: #fff; padding: 2px 8px; border-radius: 99px; margin-bottom: 8px; }
              .order-num { font-size: 54px; font-weight: 900; font-family: monospace; margin: 4px 0; letter-spacing: -1px; }
              img { width: 180px; height: 180px; margin: 8px 0; }
              .instructions { font-size: 12px; font-weight: 700; color: #18181B; line-height: 1.4; margin-top: 6px; }
              .footer { font-size: 10px; color: #71717A; margin-top: 12px; border-top: 1px solid #E4E4E7; pt: 8px; }
            </style>
          </head>
          <body>
            <div class="receipt">
              <div class="store-name">${restaurantSlug || 'المتجر'}</div>
              <div class="badge">بيجر ذكي للطلب</div>
              <div class="order-num">#${orderNumber}</div>
              <img src="${qrDataUrl}" alt="QR" />
              <div class="instructions">امسح الكود بكاميرا جوالك وسيرن هاتفك تلقائياً فور جاهزية وجبتك.</div>
              <div class="footer">${new Date().toLocaleString('ar-SA')}</div>
            </div>
            <script>
              window.onload = function() { window.print(); }
            </script>
          </body>
        </html>
      `);
    } else {
      // 2. COUNTER & TABLE ACRYLIC STAND (A6)
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
          <head>
            <title>ستاند طاولة - ${restaurantSlug || 'المتجر'}</title>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                text-align: center;
                padding: 30px;
                color: #000;
                margin: 0;
                background: #fff;
              }
              .stand {
                border: 3px solid #18181B;
                border-radius: 20px;
                padding: 32px 24px;
                max-width: 320px;
                margin: 20px auto;
                box-shadow: 0 10px 25px rgba(0,0,0,0.05);
              }
              .store-name { font-size: 22px; font-weight: 900; margin-bottom: 6px; }
              .subtitle { font-size: 13px; color: #71717A; margin-bottom: 16px; font-weight: 600; }
              img { width: 220px; height: 220px; border-radius: 12px; margin: 10px 0; }
              .callout { font-size: 15px; font-weight: 800; color: #059669; margin-top: 14px; }
              .instructions { font-size: 12px; color: #52525B; margin-top: 6px; line-height: 1.5; font-weight: 500; }
            </style>
          </head>
          <body>
            <div class="stand">
              <div class="store-name">${restaurantSlug || 'المتجر'}</div>
              <div class="subtitle">خدمة النداء والبيجر الذكي</div>
              <img src="${qrDataUrl}" alt="QR" />
              <div class="callout">امسح لمتابعة طلبك من طاولتك</div>
              <div class="instructions">افتح كاميرا جوالك وامسح الرمز لتفعيل جرس التنبيه الفوري عند جاهزية طلبك للاستلام.</div>
            </div>
            <script>
              window.onload = function() { window.print(); }
            </script>
          </body>
        </html>
      `);
    }
    printWindow.document.close();
  };

  return (
    <AppleBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={orderNumber ? `باركود استلام الطلب #${orderNumber}` : 'رمز الطاولات والكاونتر الموحد'}
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-center">
        {/* Purpose description */}
        <p className="text-xs text-zinc-400 font-medium leading-relaxed">
          {orderNumber
            ? `هذا الباركود مخصص للطلب #${orderNumber} فقط، يفتحه العميل لمتابعة وجبته ورنين جواله عند الجاهزية.`
            : 'هذا الباركود موحد للطاولات والكاونتر لمسحه بواسطة العملاء لمتابعة طلباتهم.'}
        </p>
        {/* Localhost Warning Notice */}
        {isLocalhost && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-right">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-300">
                  تنبيه: الرابط محلي
                </p>
                <p className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
                  اختر &quot;الرابط السحابي&quot; أو &quot;الشبكة المحلية&quot; لفتح الباركود من الجوال.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Network & Base URL Settings Drawer */}
        <div className="text-right">
          <button
            type="button"
            onClick={() => setShowOverrideSettings(!showOverrideSettings)}
            className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors mx-auto"
          >
            <SlidersHorizontal className="w-3 h-3 text-emerald-400" />
            <span>
              {showOverrideSettings ? 'إخفاء الإعدادات' : 'إعدادات الشبكة'}
            </span>
          </button>

          {showOverrideSettings && (
            <div className="mt-3 bg-[#18181C] border border-white/[0.08] rounded-2xl p-3.5 space-y-3">
              <label className="block text-xs font-semibold text-zinc-300">
                رابط الخادم المعتمد للباركود (Base URL):
              </label>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSaveOverride(KNOWN_WIFI_IP)}
                  className="text-[10px] font-mono flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 border border-white/[0.06] transition-colors"
                >
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span>الشبكة المحلية</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveOverride(KNOWN_VERCEL_URL)}
                  className="text-[10px] font-mono flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 border border-white/[0.06] transition-colors"
                >
                  <Cloud className="w-3 h-3 text-sky-400" />
                  <span>الرابط السحابي</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetToOrigin}
                  className="text-[10px] font-mono px-2 py-1.5 rounded-lg bg-transparent hover:bg-white/[0.05] text-zinc-400 transition-colors"
                >
                  الافتراضي
                </button>
              </div>

              {/* Manual Input */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  dir="ltr"
                  value={customInputUrl}
                  onChange={(e) => setCustomInputUrl(e.target.value)}
                  placeholder="http://192.168.1.X:3000"
                  className="flex-1 bg-[#121215] border border-white/[0.1] rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => handleSaveOverride(customInputUrl)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors shrink-0"
                >
                  تطبيق
                </button>
              </div>

              {saveConfirmation && (
                <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>تم حفظ وتحديث رابط الباركود بنجاح</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Apple HIG Pass QR Container */}
        <div className="bg-white p-4 rounded-3xl flex items-center justify-center mx-auto shadow-xl w-60 h-60 border border-zinc-200">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="QR Code"
              className="w-full h-full object-contain rounded-2xl"
            />
          ) : (
            <div className="text-zinc-400 text-xs">جارِ إنشاء الرمز...</div>
          )}
        </div>

        {/* Target URL Preview */}
        <div className="bg-[#18181C] border border-white/[0.06] rounded-2xl p-2.5 flex items-center justify-between text-xs">
          <span className="truncate max-w-[260px] font-mono dir-ltr text-[11px] text-zinc-400">
            {targetUrl}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 font-medium transition-colors text-xs"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handlePrint}
            className="py-3 px-3 rounded-2xl bg-[#18181C] hover:bg-[#202026] border border-white/[0.08] text-zinc-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-400" />
            <span>{orderNumber ? 'طباعة إيصال الطلب' : 'طباعة ستاند A6 للطاولة'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="py-3 px-3 rounded-2xl bg-[#18181C] hover:bg-[#202026] border border-white/[0.08] text-zinc-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>تحميل كصورة PNG</span>
          </button>
        </div>
      </div>
    </AppleBottomSheet>
  );
};
