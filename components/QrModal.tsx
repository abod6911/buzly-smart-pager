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
  Globe,
  Laptop,
  AlertTriangle,
  SlidersHorizontal,
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

  // Initialize Base URL with local storage override or window origin
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

  // Construct target URL with self-healing fallback parameters
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

  // Generate QR code data URL
  useEffect(() => {
    if (isOpen && targetUrl) {
      QRCode.toDataURL(targetUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#0A0A0C',
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
      ? `buzly-${restaurantSlug}-order-${orderNumber}-qr.png`
      : `buzly-${restaurantSlug}-counter-qr.png`;
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
              border: 3px dashed #000;
              border-radius: 20px;
              padding: 24px;
              max-width: 320px;
              margin: 20px auto;
            }
            h1 { margin: 0 0 4px; font-size: 26px; font-weight: 900; }
            .subtitle { font-size: 13px; color: #555; margin-bottom: 12px; }
            .order-num { font-size: 48px; font-weight: 900; font-family: monospace; margin: 10px 0; }
            img { width: 230px; height: 230px; border-radius: 12px; }
            p { font-size: 13px; color: #222; margin: 12px 0 0; font-weight: 600; line-height: 1.4; }
            .footer-tip { font-size: 11px; color: #777; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>BUZLY PAGER 🔔</h1>
            <div class="subtitle">بيجر ذكي لمتابعة الطلب</div>
            ${orderNumber ? `<div class="order-num">#${orderNumber}</div>` : '<div>امسح الكود لتتبع طلبك</div>'}
            <img src="${qrDataUrl}" alt="QR Code" />
            <p>امسح الكود بكاميرا جوالك لتفعيل جرس التنبيه الفوري عند جاهزية الطلب.</p>
            <div class="footer-tip">يعمل على آيفون وأندرويد دون الحاجة لتطبيق</div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-lg bg-obsidian-surface border border-obsidian-border rounded-3xl p-5 sm:p-6 text-white shadow-2xl relative my-auto font-cairo"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 p-2 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-zinc-400 hover:text-white transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="text-center mt-1 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-2.5 shadow-lg shadow-emerald-500/10">
                <QrIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black">
                {orderNumber ? `رمز الاستجابة للطلب #${orderNumber}` : 'رمز تتبع الطلبات (للطاولة أو الكاونتر)'}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                امسح الكود بكاميرا الجوال ليتحول هاتفك إلى بيجر ذكي يرن تلقائياً
              </p>
            </div>

            {/* Localhost Warning Banner */}
            {isLocalhost && (
              <div className="mb-4 bg-buzly-amber/10 border border-buzly-amber/30 rounded-2xl p-3.5 text-right flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-buzly-amber shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-buzly-amber">
                    ⚠️ تنبيه مسح الجوال: أنت تستخدم localhost
                  </p>
                  <p className="text-zinc-300 leading-relaxed text-[11px]">
                    كاميرا الجوال لن تستطيع فتح <code>localhost</code> لأنه يبحث عن السيرفر داخل الجوال نفسه. اضغط على أحد الروابط بالأسفل لتحديث الباركود فوراً لرابط الشبكة أو Vercel:
                  </p>
                </div>
              </div>
            )}

            {/* Quick URL Presets Bar */}
            <div className="mb-4 bg-obsidian-card border border-obsidian-border rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" /> رابط الباركود للمسح بالجوال:
                </span>
                <button
                  onClick={() => setShowOverrideSettings(!showOverrideSettings)}
                  className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 underline"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>{showOverrideSettings ? 'إخفاء الإعدادات' : 'تعديل الرابط يدويّاً'}</span>
                </button>
              </div>

              {/* 3 Presets Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyBaseUrl(KNOWN_WIFI_IP)}
                  className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between ${
                    activeBaseUrl === KNOWN_WIFI_IP
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-white font-bold'
                      : 'bg-obsidian-surface border-obsidian-border text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  <div className="truncate">
                    <span className="text-[10px] text-emerald-400 font-bold block">📶 شبكة الواي فاي (موصى به للمحل):</span>
                    <span className="font-mono text-xs dir-ltr block truncate">{KNOWN_WIFI_IP}</span>
                  </div>
                  {activeBaseUrl === KNOWN_WIFI_IP && <Check className="w-4 h-4 text-emerald-400 shrink-0 mr-1" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyBaseUrl(KNOWN_VERCEL_URL)}
                  className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between ${
                    activeBaseUrl === KNOWN_VERCEL_URL
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-white font-bold'
                      : 'bg-obsidian-surface border-obsidian-border text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  <div className="truncate">
                    <span className="text-[10px] text-sky-400 font-bold block">☁️ رابط Vercel السحابي الحي:</span>
                    <span className="font-mono text-xs dir-ltr block truncate">{KNOWN_VERCEL_URL}</span>
                  </div>
                  {activeBaseUrl === KNOWN_VERCEL_URL && <Check className="w-4 h-4 text-sky-400 shrink-0 mr-1" />}
                </button>
              </div>

              {/* Custom Input Accordion */}
              {showOverrideSettings && (
                <div className="mt-3 pt-3 border-t border-obsidian-border/80 flex flex-col gap-2">
                  <label className="text-[10px] text-zinc-400 font-bold">أدخل عنوان IP لابتوبك أو نطاقك المخصص:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customInputUrl}
                      onChange={(e) => setCustomInputUrl(e.target.value)}
                      placeholder="http://192.168.X.X:3000 أو https://..."
                      className="flex-1 bg-obsidian-surface border border-obsidian-border rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 dir-ltr"
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyBaseUrl(customInputUrl)}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all shadow-md"
                    >
                      تطبيق
                    </button>
                  </div>
                  {saveConfirmation && (
                    <span className="text-[11px] text-emerald-400 font-bold">
                      ✓ تم حفظ الرابط وسيتذكره المتصفح للباركودات القادمة!
                    </span>
                  )}
                  {activeBaseUrl !== currentOrigin && (
                    <button
                      onClick={handleResetToOrigin}
                      className="text-[10px] text-zinc-400 hover:text-white self-start underline"
                    >
                      استعادة الرابط الافتراضي ({currentOrigin})
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* QR Image Display */}
            <div className="bg-white p-3.5 rounded-3xl flex items-center justify-center mx-auto shadow-2xl w-56 h-56 border-4 border-emerald-500/30 relative group">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="Buzly QR Code"
                  className="w-full h-full object-contain rounded-xl"
                />
              ) : (
                <div className="animate-pulse text-zinc-400 text-xs">جارِ توليد الرمز...</div>
              )}
            </div>

            {/* Target URL Preview & Copy */}
            <div className="mt-4 bg-obsidian-card border border-obsidian-border rounded-xl p-2.5 flex items-center justify-between text-xs text-zinc-300">
              <span className="truncate max-w-[280px] font-mono dir-ltr text-[11px] text-zinc-400">
                {targetUrl}
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold transition-colors text-xs shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'تم النسخ!' : 'نسخ'}</span>
              </button>
            </div>

            {/* Action Buttons: Print & Download */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                onClick={handlePrint}
                className="py-2.5 px-4 rounded-xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>طباعة ستاند A6</span>
              </button>
              <button
                onClick={handleDownload}
                className="py-2.5 px-4 rounded-xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>تحميل كصورة PNG</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
