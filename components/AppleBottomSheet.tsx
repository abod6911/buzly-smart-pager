'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { appleSpringModal } from '@/lib/motion';

interface AppleBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const AppleBottomSheet: React.FC<AppleBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-md',
}) => {
  // Lock background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // If dragged down by more than 100px or with strong downward velocity, dismiss
    if (info.offset.y > 100 || info.velocity.y > 400) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Apple Vibrancy Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-2xl backdrop-saturate-150"
          />

          {/* Interactive Sheet Container */}
          <motion.div
            initial={{ y: '100%', opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={appleSpringModal}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.8 }}
            onDragEnd={handleDragEnd}
            className={`relative z-10 w-full ${maxWidth} bg-[#121216] sm:rounded-3xl rounded-t-3xl border border-white/[0.1] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] select-none`}
          >
            {/* iOS Top Drag Pill Handle */}
            <div className="pt-3 pb-2 flex justify-center cursor-grab active:cursor-grabbing touch-none">
              <div className="w-10 h-1.2 rounded-full bg-white/20 hover:bg-white/30 transition-colors" />
            </div>

            {/* Header (Optional) */}
            {(title || subtitle) && (
              <div className="px-6 py-2 flex items-center justify-between border-b border-white/[0.06]">
                <div>
                  {title && (
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {title}
                    </h3>
                  )}
                  {subtitle && (
                    <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Content Viewport */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
