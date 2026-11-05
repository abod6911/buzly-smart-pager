'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRing, Check, Clock, Sparkles, Volume2 } from 'lucide-react';
import { appleSpringIsland } from '@/lib/motion';
import { OdometerNumber } from '@/components/OdometerNumber';
import { OrderStatus } from '@/types/queue';

interface DynamicIslandTrackerProps {
  orderNumber: string;
  status: OrderStatus;
  estimatedMinutes?: number;
  elapsedMinutes?: number;
  restaurantName: string;
  onTestSound?: () => void;
}

export const DynamicIslandTracker: React.FC<DynamicIslandTrackerProps> = ({
  orderNumber,
  status,
  estimatedMinutes = 10,
  elapsedMinutes = 0,
  restaurantName,
  onTestSound,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const remainingMins = Math.max(1, estimatedMinutes - elapsedMinutes);
  const isReady = status === 'ready';

  return (
    <div className="w-full flex justify-center py-2 px-4 sticky top-2 z-50 pointer-events-none">
      <motion.div
        layoutId="island-pill"
        transition={appleSpringIsland}
        onClick={() => {
          setIsExpanded(!isExpanded);
          if (onTestSound) onTestSound();
        }}
        className={`pointer-events-auto cursor-pointer select-none transition-shadow ${
          isReady
            ? 'bg-emerald-950/90 border border-emerald-400/40 text-white shadow-2xl shadow-emerald-500/25'
            : 'bg-[#000000]/95 border border-white/[0.12] text-white shadow-xl shadow-black/60'
        } backdrop-blur-2xl`}
        style={{
          borderRadius: isReady ? 28 : isExpanded ? 24 : 32,
        }}
      >
        <AnimatePresence mode="wait">
          {isReady ? (
            /* ========================================================= */
            /* 1. EXPANDED EMERALD BANNER FOR READY ORDER                */
            /* ========================================================= */
            <motion.div
              key="island-ready"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={appleSpringIsland}
              className="px-5 py-3 flex items-center justify-between gap-4 max-w-md w-full"
            >
              {/* Left: Animated Ringing Icon with Pulsing Halo */}
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-black font-bold shadow-md shadow-emerald-500/40">
                  <motion.div
                    animate={{ rotate: [-12, 12, -10, 10, -6, 6, 0] }}
                    transition={{ repeat: Infinity, duration: 1.6, repeatDelay: 1.2 }}
                  >
                    <BellRing className="w-5 h-5 text-black stroke-[2.2]" />
                  </motion.div>
                  <span className="absolute -inset-1 rounded-full border border-emerald-400/60 animate-ping opacity-75" />
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400 text-xs font-bold tracking-tight">
                      جاهز للاستلام الآن
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <p className="text-[11px] text-zinc-300 font-normal">
                    طلبك بانتظارك على كاونتر {restaurantName}
                  </p>
                </div>
              </div>

              {/* Right: Bold Order Number */}
              <div className="bg-white/10 border border-white/10 px-3 py-1.5 rounded-2xl flex items-center gap-1">
                <span className="text-zinc-400 text-xs font-mono font-medium">#</span>
                <span className="font-mono text-xl font-bold text-white tabular-nums">
                  {orderNumber}
                </span>
              </div>
            </motion.div>
          ) : (
            /* ========================================================= */
            /* 2. COMPACT OBSIDIAN PILL FOR PREPARING STATE              */
            /* ========================================================= */
            <motion.div
              key="island-preparing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={appleSpringIsland}
              className={`flex items-center gap-3.5 px-4 py-2 transition-all duration-300 ${
                isExpanded ? 'min-w-[280px] justify-between' : 'justify-center'
              }`}
            >
              {/* Left: Rotating Orange Arc + Order Number */}
              <div className="flex items-center gap-2.5">
                <div className="relative w-5 h-5 flex items-center justify-center">
                  <svg className="w-5 h-5 -rotate-90" viewBox="0 0 24 24">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth="2.5"
                      fill="none"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="#FF9500"
                      strokeWidth="2.5"
                      strokeDasharray="56.5"
                      strokeDashoffset="18"
                      strokeLinecap="round"
                      fill="none"
                      className="animate-[spin_4s_linear_infinite]"
                    />
                  </svg>
                  <span className="absolute w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-zinc-400 font-mono text-xs">#</span>
                  <span className="font-mono text-sm font-bold text-white tracking-tight tabular-nums">
                    {orderNumber}
                  </span>
                </div>
              </div>

              {/* Center / Status */}
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-xs text-zinc-300 font-medium">يُحضّر الآن</span>
              </div>

              {/* Right: Dynamic Odometer Minutes */}
              <div className="flex items-center gap-1 bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 rounded-full text-[11px] font-mono text-amber-300">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>~</span>
                <OdometerNumber value={remainingMins} />
                <span>د</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
