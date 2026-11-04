'use client';

import React, { useEffect, useState, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Copy,
  Check,
  QrCode as QrIcon,
  Download,
  Printer,
  Wifi,
  Cloud,
  AlertTriangle,
  SlidersHorizontal,
  Bell,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_OVERRIDE_KEY = 'buzly_base_url_override';
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
      const savedOverride = localStorage.getItem(STORAGE_OVERRIDE_KEY);
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

  const targetUrl = useMemo(() => {
    const base = (activeBaseUrl || currentOrigin || '').replace(/\/+$/, '');
    const cleanSlug = (restaurantSlug || 'demo-cafe').toLowerCase();

    if (orderNumber) {
      const params = new URLSearchParams({
        est: String(estimatedMinutes || 10),
        status: 'preparing',
        slug: cleanSlug,
        created: new Date().toISOString(),
      });
      if (orderNotes) params.set('notes', orderNotes);
      return `${base}/${cleanSlug}/track/${encodeURIComponent(orderNumber)}?${params.toString()}`;
    }

    return `${base}/${cleanSlug}/track`;
  }, [activeBaseUrl, currentOrigin, restaurantSlug, orderNumber, estimatedMinutes, orderNotes]);

  useEffect(() => {
    if (isOpen && targetUrl) {
      QRCode.toDataURL(targetUrl, {
        width: 360,
        margin: 2,
        color: {
          dark: '#09090B',
          light: '#FFFFFF',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR generation failed', err));
    }
  }, [isOpen, targetUrl]);

  const handleApplyBaseUrl = (newUrl: string) => {
    const clean = newUrl.trim().replace(/\/+$/, '');
    if (!clean) return;
    setActiveBaseUrl(clean);
    setCustomInputUrl(clean);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_OVERRIDE_KEY, clean);
      setSaveConfirmation(true);
      setTimeout(() => setSaveConfirmation(false), 2000);
    }
  };

  const handleResetToOrigin = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_OVERRIDE_KEY);
      setActiveBaseUrl(currentOrigin);
      setCustomInputUrl(currentOrigin);
    }
  };

  const handleCopy = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = orderNumber
      ? `buzly-${restaurantSlug}-order-${orderNumber}.png`
      : `buzly-${restaurantSlug}-table.png`;
    a.click();
  };

  const handlePrint = () => {
    if (typeof window === 'undefined') return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <title>Buzly - ${orderNumber ? `طلب #${orderNumber}` : 'كود الكاونتر'}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              text-align: center;
              padding: 24px;
              color: #000;
              margin: 0;
            }
            .card {
              border: 2px solid #E4E4E7;
              border-radius: 16px;
              padding: 24px;
              max-width: 300px;
              margin: 20px auto;
            }
            h1 { margin: 0 0 4px; font-size: 22px; font-weight: 800; }
            .subtitle { font-size: 12px; color: #71717A; margin-bottom: 12px; }
            .order-num { font-size: 42px; font-weight: 800; font-family: monospace; margin: 10px 0; }
            img { width: 210px; height: 210px; border-radius: 12px; }
            p { font-size: 12px; color: #3F3F46; margin: 12px 0 0; font-weight: 600; line-height: 1.4; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>BUZLY PAGER</h1>
            <div class="subtitle">بيجر ذكي لمتابعة الطلب</div>
            ${orderNumber ? `<div class="order-num">#${orderNumber}</div>` : '<div>امسح لمتابعة طلبك</div>'}
            <img src="${qrDataUrl}" alt="QR Code" />
            <p>امسح الكود بكاميرا جوالك لتفعيل جرس التنبيه الفوري عند جاهزية الطلب.</p>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className="w-full max-w-md bg-[#121215] border border-white/[0.08] rounded-2xl p-5 sm:p-6 text-white shadow-2xl relative my-auto font-sans"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Apple Wallet Style Header */}
            <div className="text-center mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#18181C] border border-white/10 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <Bell className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-white">
                {orderNumber ? `رمز الاستجابة للطلب #${orderNumber}` : 'رمز تتبع الطلبات للطاولات'}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                امسح الكود بكاميرا الجوال ليتحول الهاتف إلى جهاز نداء ذكي
              </p>
            </div>

            {/* Localhost Warning */}
            {isLocalhost && (
              <div className="mb-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-right flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-amber-300">
                    تنبيه: أنت تتصفح عبر localhost
                  </p>
                  <p className="text-zinc-300 text-[11px] mt-0.5">
                    كاميرا الجوال تتطلب رابط شبكة أو رابط Vercel. اختر الرابط المناسب أدناه لتحديث الباركود:
                  </p>
                </div>
              </div>
            )}

            {/* Segmented Network Selector */}
            <div className="mb-3.5 bg-[#18181C] p-1 rounded-xl border border-white/[0.06]">
              <div className="grid grid-cols-2 gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => handleApplyBaseUrl(KNOWN_VERCEL_URL)}
                  className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    activeBaseUrl === KNOWN_VERCEL_URL
                      ? 'bg-zinc-800 text-white font-medium shadow-sm border border-white/10'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Cloud className="w-3.5 h-3.5 text-zinc-400" />
                  <span>الرابط السحابي</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyBaseUrl(KNOWN_WIFI_IP)}
                  className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    activeBaseUrl === KNOWN_WIFI_IP
                      ? 'bg-zinc-800 text-white font-medium shadow-sm border border-white/10'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Wifi className="w-3.5 h-3.5 text-zinc-400" />
                  <span>الشبكة المحلية</span>
                </button>
              </div>

              {/* Advanced toggle */}
              <div className="mt-1.5 pt-1.5 border-t border-white/[0.04] px-1 flex items-center justify-between">
                <button
                  onClick={() => setShowOverrideSettings(!showOverrideSettings)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
                >
                  <SlidersHorizontal className="w-2.5 h-2.5" />
                  <span>تعديل الرابط يدوياً</span>
                </button>
                <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[200px] dir-ltr">
                  {activeBaseUrl}
                </span>
              </div>

              {showOverrideSettings && (
                <div className="p-2 space-y-1.5">
                  <input
                    type="text"
                    value={customInputUrl}
                    onChange={(e) => setCustomInputUrl(e.target.value)}
                    placeholder="http://192.168.X.X:3000"
                    className="w-full bg-[#121215] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none dir-ltr"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyBaseUrl(customInputUrl)}
                    className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#052E16] font-semibold text-xs"
                  >
                    حفظ الرابط
                  </button>
                </div>
              )}
            </div>

            {/* Apple Wallet Pass Container */}
            <div className="bg-white p-3.5 rounded-2xl flex items-center justify-center mx-auto shadow-sm w-56 h-56 border border-zinc-200 relative">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className="w-full h-full object-contain rounded-xl"
                />
              ) : (
                <div className="text-zinc-400 text-xs">جارِ إنشاء الرمز...</div>
              )}
            </div>

            {/* Target URL Preview */}
            <div className="mt-3.5 bg-[#18181C] border border-white/[0.06] rounded-xl p-2.5 flex items-center justify-between text-xs">
              <span className="truncate max-w-[240px] font-mono dir-ltr text-[11px] text-zinc-400">
                {targetUrl}
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 font-medium transition-colors text-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="mt-3.5 grid grid-cols-2 gap-2">
              <button
                onClick={handlePrint}
                className="py-2.5 px-3 rounded-xl bg-[#18181C] hover:bg-[#202026] border border-white/[0.08] text-zinc-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-zinc-400" />
                <span>طباعة ستاند A6</span>
              </button>
              <button
                onClick={handleDownload}
                className="py-2.5 px-3 rounded-xl bg-[#18181C] hover:bg-[#202026] border border-white/[0.08] text-zinc-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" />
                <span>تحميل كصورة PNG</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
