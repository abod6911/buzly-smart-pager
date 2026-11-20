'use client';

import React from 'react';
import { QrCode, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { MuhabBrandBadge } from '@/components/MuhabBrandBadge';

interface RestaurantNotFoundProps {
  slug: string;
}

export const RestaurantNotFound: React.FC<RestaurantNotFoundProps> = ({ slug }) => {
  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleBack = () => {
    if (typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = `/${slug}/track`;
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans selection:bg-[#34C759] selection:text-black">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full bg-[#161618] border border-white/[0.08] rounded-[32px] p-7 sm:p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative overflow-hidden"
      >
        {/* Soft Apple Alert Icon */}
        <div className="w-16 h-16 rounded-full bg-white/[0.05] border border-white/[0.08] text-amber-400 flex items-center justify-center mx-auto mb-5">
          <QrCode className="w-7 h-7 stroke-[1.75]" />
        </div>

        {/* Clean Identifier Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-zinc-400 text-xs font-mono mb-4">
          <span>#{slug}</span>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-white mb-2.5 tracking-tight">
          الرابط غير متاح حالياً
        </h1>

        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-6">
          عذراً، هذا الرابط غير مرتبط بطلب نشط في النظام. يرجى مسح رمز QR المطبوع على فاتورتك أو مراجعة الكاونتر لمتابعة طلبك.
        </p>

        {/* Customer Safe Actions - NO ADMIN OR ONBOARDING LINKS */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleReload}
            className="w-full py-3.5 px-4 rounded-[20px] bg-white/[0.08] hover:bg-white/[0.14] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>إعادة التحقق</span>
          </button>

          <button
            type="button"
            onClick={handleBack}
            className="w-full py-3 px-4 rounded-[18px] bg-white/[0.02] hover:bg-white/[0.06] text-zinc-400 hover:text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>الرجوع للخلف</span>
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-white/[0.05] text-[11px] text-zinc-400 font-sans flex items-center justify-center">
          <MuhabBrandBadge />
        </div>
      </motion.div>
    </div>
  );
};
