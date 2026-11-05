'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRing, Volume2, ShieldCheck, Sparkles } from 'lucide-react';

interface AudioUnlockOverlayProps {
  isVisible: boolean;
  onUnlock: () => Promise<void> | void;
}

export const AudioUnlockOverlay: React.FC<AudioUnlockOverlayProps> = ({
  isVisible,
  onUnlock,
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="fixed bottom-6 inset-x-4 max-w-md mx-auto z-50 pointer-events-auto"
        >
          <div className="bg-[#121216]/95 backdrop-blur-xl border-2 border-emerald-500/40 rounded-3xl p-5 shadow-2xl shadow-emerald-500/10 text-center relative overflow-hidden">
            {/* Top Glow Accent */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />

            <div className="flex items-center justify-center gap-2 mb-2">
              <motion.div
                animate={{ rotate: [-10, 10, -6, 6, 0] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400"
              >
                <BellRing className="w-5 h-5" strokeWidth={2} />
              </motion.div>
            </div>

            <h3 className="text-base font-bold text-white font-cairo">
              اضغط لتفعيل جرس الرنين والاهتزاز
            </h3>
            <p className="text-xs text-zinc-300 mt-1 max-w-xs mx-auto leading-relaxed">
              تفرض متصفحات الجوال نقرة واحدة للسماح بالرنين حتى لو كانت الشاشة مقفلة أو وضعت الهاتف في جيبك.
            </p>

            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={onUnlock}
              className="mt-4 w-full py-3.5 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-colors select-none"
            >
              <Volume2 className="w-4 h-4 text-black stroke-[2.5]" />
              <span>تفعيل الرنين والاهتزاز الفوري</span>
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
