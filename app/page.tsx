'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BrandLogo } from '@/components/BrandLogo';
import {
  Smartphone,
  Store,
  Layers,
  Sparkles,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';

export default function LandingRoleSwitcherPage() {
  return (
    <div className="min-h-screen bg-[#09090B] text-white flex flex-col font-sans selection:bg-emerald-500 selection:text-black relative">
      {/* Subtle Luxury Radial Spotlight */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[480px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/20 via-zinc-950/0 to-transparent pointer-events-none z-0" />

      {/* Main Navbar */}
      <header className="border-b border-white/[0.07] px-4 sm:px-6 py-3.5 bg-[#09090B]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <BrandLogo size="md" />
            <span className="font-extrabold text-xl tracking-tight text-white font-mono">
              CHIMER
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/demo-cafe/staff"
              className="text-xs text-zinc-300 hover:text-white px-3 py-1.5 font-medium transition-colors"
            >
              دخول الكاشير
            </Link>

            <Link
              href="/onboard"
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-colors shadow-sm"
            >
              سجّل مطعمك
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center relative z-10">
        <div className="text-center max-w-3xl mx-auto pt-8 pb-10">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-emerald-400 text-xs font-medium mb-5">
            <span>نظام استدعاء سحابي</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight sm:leading-tight">
            نظام بيجر المطاعم الذكي
            <br />
            <span className="text-zinc-400">
              في متصفح جوال الزبون مباشرة
            </span>
          </h1>

          <p className="text-sm sm:text-base text-zinc-400 mt-4 leading-relaxed max-w-xl mx-auto">
            امسح الكود واستلم إشعارك فور جاهزية طلبك.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/onboard"
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all shadow-sm"
            >
              ابدأ الآن مجاناً
            </Link>

            <Link
              href="/demo-cafe/staff"
              className="px-5 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 font-medium text-sm transition-all"
            >
              معاينة مباشرة
            </Link>
          </div>
        </div>

        {/* 4 Feature Cards (Bento Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto w-full my-6">
          {/* Card 1: Staff Cashier Pad */}
          <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 350, damping: 25 }}>
            <Link
              href="/demo-cafe/staff"
              className="h-full bg-[#111114] hover:bg-[#151519] border border-white/[0.07] hover:border-emerald-500/30 rounded-2xl p-5 transition-all flex flex-col justify-between block group"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Store className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-white mb-6">
                  شاشة الكاشير POS
                </h2>
              </div>
              <div className="w-full py-2 px-3 rounded-xl bg-white/[0.04] group-hover:bg-emerald-500 group-hover:text-black border border-white/[0.06] text-zinc-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all">
                <span>فتح الكاشير</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </div>
            </Link>
          </motion.div>

          {/* Card 2: Kitchen TV Screen */}
          <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 350, damping: 25 }}>
            <Link
              href="/demo-cafe/tv"
              target="_blank"
              className="h-full bg-[#111114] hover:bg-[#151519] border border-white/[0.07] hover:border-amber-500/30 rounded-2xl p-5 transition-all flex flex-col justify-between block group"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-amber-300 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Layers className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-white mb-6">
                  شاشة التلفاز التفاعلية
                </h2>
              </div>
              <div className="w-full py-2 px-3 rounded-xl bg-white/[0.04] group-hover:bg-amber-400 group-hover:text-black border border-white/[0.06] text-zinc-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all">
                <span>عرض شاشة التلفاز</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </div>
            </Link>
          </motion.div>

          {/* Card 3: Customer Tracker */}
          <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 350, damping: 25 }}>
            <Link
              href="/demo-cafe/track"
              target="_blank"
              className="h-full bg-[#111114] hover:bg-[#151519] border border-white/[0.07] hover:border-emerald-500/30 rounded-2xl p-5 transition-all flex flex-col justify-between block group"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-teal-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-white mb-6">
                  شاشة بيجر العميل
                </h2>
              </div>
              <div className="w-full py-2 px-3 rounded-xl bg-white/[0.04] group-hover:bg-emerald-500 group-hover:text-black border border-white/[0.06] text-zinc-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all">
                <span>تجربة شاشة العميل</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </div>
            </Link>
          </motion.div>

          {/* Card 4: Settings & Analytics */}
          <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 350, damping: 25 }}>
            <Link
              href="/demo-cafe/admin"
              className="h-full bg-[#111114] hover:bg-[#151519] border border-white/[0.07] hover:border-purple-500/30 rounded-2xl p-5 transition-all flex flex-col justify-between block group"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-purple-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-white mb-6">
                  إدارة المتجر والطباعة
                </h2>
              </div>
              <div className="w-full py-2 px-3 rounded-xl bg-white/[0.04] group-hover:bg-purple-500 group-hover:text-black border border-white/[0.06] text-zinc-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all">
                <span>إعدادات المتجر والطباعة</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </div>
            </Link>
          </motion.div>
        </div>
      </main>

      {/* Minimal Luxury Footer */}
      <footer className="border-t border-white/[0.07] px-4 py-6 text-center text-xs text-zinc-500 mt-auto">
        <p>Chimer Smart Restaurant Pager © 2026</p>
      </footer>
    </div>
  );
}
