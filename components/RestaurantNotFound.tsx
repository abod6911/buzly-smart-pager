'use client';

import React from 'react';
import Link from 'next/link';
import { Store, ArrowRight, PlusCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface RestaurantNotFoundProps {
  slug: string;
}

export const RestaurantNotFound: React.FC<RestaurantNotFoundProps> = ({ slug }) => {
  return (
    <div className="min-h-screen bg-[#09090B] text-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-[#121215] border border-white/[0.08] rounded-3xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden"
      >
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
          <Store className="w-8 h-8 stroke-[1.5]" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-zinc-400 text-xs font-mono mb-3">
          <span>/{slug}</span>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
          المتجر غير مسجل
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-6">
          عذراً، الرابط المطلوب غير مرتبط بأي متجر مفعّل في النظام حالياً. يرجى التحقق من الرابط أو تسجيل المتجر الجديد.
        </p>

        <div className="space-y-2.5">
          <Link
            href="/onboard"
            className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#052E16] font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>تسجيل وتفعيل متجر جديد</span>
          </Link>

          <Link
            href="/"
            className="w-full py-2.5 px-4 rounded-xl bg-[#18181C] hover:bg-[#202026] text-zinc-300 hover:text-white font-medium text-xs flex items-center justify-center gap-2 border border-white/[0.06] transition-colors"
          >
            <span>العودة للرئيسية</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
};
