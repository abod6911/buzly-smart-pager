'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, ExternalLink, QrCode as QrIcon, Download, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber?: string;
}

export const QrModal: React.FC<QrModalProps> = ({ isOpen, onClose, orderNumber }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [origin, setOrigin] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const targetUrl = orderNumber
    ? `${origin}/track/${encodeURIComponent(orderNumber)}`
    : `${origin}/track`;

  useEffect(() => {
    if (isOpen && targetUrl) {
      QRCode.toDataURL(targetUrl, {
        width: 360,
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
    a.download = orderNumber ? `buzly-order-${orderNumber}-qr.png` : 'buzly-restaurant-qr.png';
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
            }
            .card {
              border: 2px dashed #000;
              border-radius: 16px;
              padding: 24px;
              max-width: 320px;
              margin: 0 auto;
            }
            h1 { margin: 0 0 8px; font-size: 24px; }
            .order-num { font-size: 42px; font-weight: 900; margin: 12px 0; }
            img { width: 220px; height: 220px; }
            p { font-size: 13px; color: #444; margin: 8px 0 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>BUZLY PAGER 🔔</h1>
            ${orderNumber ? `<div class="order-num">#${orderNumber}</div>` : '<div>امسح لمتابعة طلبك</div>'}
            <img src="${qrDataUrl}" alt="QR Code" />
            <p>امسح الكود بجوالك لتفعيل جرس التنبيه الفوري واستلام وجبتك وهي ساخنة.</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-md bg-obsidian-surface border border-obsidian-border rounded-3xl p-6 text-white shadow-2xl relative"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-5 left-5 p-2 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-zinc-400 hover:text-white transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="text-center mt-2 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/10">
                <QrIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black font-cairo">
                {orderNumber ? `رمز الاستجابة للطلب #${orderNumber}` : 'رمز تتبع الطلبات (للكاونتر / الطاولة)'}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                {orderNumber
                  ? 'وجه كاميرا الجوال للكود لفتح جهاز النداء الخاص بهذا الطلب مباشرة'
                  : 'اعرض هذا الكود للزبائن ليقوموا بإدخال رقم طلباتهم ومتابعتها'}
              </p>
            </div>

            {/* QR Image Box */}
            <div className="bg-white p-4 rounded-3xl flex items-center justify-center mx-auto shadow-2xl w-64 h-64 border-4 border-emerald-500/30 relative group">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="Buzly QR Code"
                  className="w-full h-full object-contain rounded-xl"
                />
              ) : (
                <div className="animate-pulse text-zinc-400 text-sm">جارِ توليد الرمز...</div>
              )}
            </div>

            {/* Target URL Box */}
            <div className="mt-5 bg-obsidian-card border border-obsidian-border rounded-xl p-3 flex items-center justify-between text-xs text-zinc-300">
              <span className="truncate max-w-[220px] font-mono dir-ltr">{targetUrl}</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
              </button>
            </div>

            {/* Action Buttons: Print, Download, Open */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-xs font-bold transition-colors"
                title="طباعة إيصال ورقي"
              >
                <Printer className="w-3.5 h-3.5 text-zinc-400" />
                <span>طباعة</span>
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-xs font-bold transition-colors"
                title="تحميل صورة الرمز"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" />
                <span>تحميل</span>
              </button>

              <a
                href={targetUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>فتح</span>
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
