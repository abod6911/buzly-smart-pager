'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, ExternalLink, QrCode as QrIcon, Download } from 'lucide-react';
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
        width: 320,
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
            <div className="text-center mt-2 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <QrIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold font-cairo">
                {orderNumber ? `رمز الاستجابة للطلب #${orderNumber}` : 'رمز تتبع الطلبات (للطاولة / الكاونتر)'}
              </h3>
              <p className="text-sm text-zinc-400 mt-1">
                {orderNumber
                  ? 'امسح الكود لفتح جهاز النداء وتتبع الطلب مباشرة'
                  : 'اطبع أو اعرض هذا الكود للزبائن لمتابعة طلباتهم'}
              </p>
            </div>

            {/* QR Image Box */}
            <div className="bg-white p-4 rounded-2xl flex items-center justify-center mx-auto shadow-inner w-64 h-64 border-4 border-emerald-500/20">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="Buzly QR Code"
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <div className="animate-pulse text-zinc-400 text-sm">جارِ توليد الرمز...</div>
              )}
            </div>

            {/* Target URL Box */}
            <div className="mt-5 bg-obsidian-card border border-obsidian-border rounded-xl p-3 flex items-center justify-between text-xs text-zinc-300">
              <span className="truncate max-w-[240px] font-mono dir-ltr">{targetUrl}</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-medium transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={handleDownload}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-sm font-semibold transition-colors"
              >
                <Download className="w-4 h-4 text-zinc-400" />
                <span>تحميل الصورة</span>
              </button>
              <a
                href={targetUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>فتح الرابط</span>
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
