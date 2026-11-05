'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, RotateCcw, Clock, Check, X, FileText } from 'lucide-react';
import { soundManager } from '@/lib/audio';

interface StaffNumpadProps {
  onAddOrder: (orderNumber: string, estimatedMinutes: number, notes?: string) => Promise<unknown>;
  isSubmitting?: boolean;
}

const PRESET_MINUTES = [5, 10, 15, 20, 30];

export const StaffNumpad: React.FC<StaffNumpadProps> = ({ onAddOrder, isSubmitting = false }) => {
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(10);
  const [notes, setNotes] = useState<string>('');
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [justAdded, setJustAdded] = useState<boolean>(false);

  const handleDigit = (digit: string) => {
    soundManager.playKeyClick();
    if (orderNumber.length < 5) {
      setOrderNumber((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    soundManager.playKeyClick();
    setOrderNumber((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    soundManager.playKeyClick();
    setOrderNumber('');
    setNotes('');
  };

  const handleSubmit = useCallback(async () => {
    if (!orderNumber.trim()) return;

    soundManager.unlock();
    await onAddOrder(orderNumber.trim(), estimatedMinutes, notes.trim() || undefined);

    setJustAdded(true);
    setOrderNumber('');
    setNotes('');
    setShowNotes(false);
    setTimeout(() => setJustAdded(false), 1200);
  }, [orderNumber, estimatedMinutes, notes, onAddOrder]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Enter') {
          handleSubmit();
        }
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        soundManager.playKeyClick();
        setOrderNumber((prev) => (prev.length < 5 ? prev + e.key : prev));
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        soundManager.playKeyClick();
        setOrderNumber((prev) => prev.slice(0, -1));
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        soundManager.playKeyClick();
        setOrderNumber('');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit]);

  return (
    <div className="bg-[#121215] border border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between h-full">
      {/* Top Display */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-zinc-300">
            إدخال رقم الطلب
          </span>
          <span className="text-[11px] font-mono text-zinc-500 bg-white/[0.03] px-2 py-0.5 rounded border border-white/[0.06]">
            لوحة سريعة
          </span>
        </div>

        {/* Tactile LCD Readout */}
        <div className="relative bg-[#09090B] border border-white/[0.08] rounded-xl px-4 py-3.5 min-h-[76px] flex items-center justify-between mb-3.5">
          <div className="flex items-baseline gap-2">
            <span className="text-zinc-500 font-mono text-xl font-bold">#</span>
            <span
              className={`font-mono text-4xl sm:text-5xl font-bold tracking-widest tabular-nums transition-colors ${
                orderNumber ? 'text-white' : 'text-zinc-700'
              }`}
            >
              {orderNumber || '000'}
            </span>
          </div>

          {orderNumber && (
            <button
              onClick={handleClear}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors"
              title="مسح"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {justAdded && (
            <div className="absolute inset-0 bg-emerald-950/90 border border-emerald-500/40 rounded-xl flex items-center justify-center text-emerald-400 font-medium text-sm gap-1.5 animate-fade-in">
              <Check className="w-4 h-4" />
              <span>تمت إضافة الطلب</span>
            </div>
          )}
        </div>

        {/* Estimated Prep Time: Segmented Control Bar */}
        <div className="mb-3.5">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span>الوقت المقدر</span>
            </span>
            <span className="font-mono text-xs font-semibold text-zinc-200 tabular-nums">
              {estimatedMinutes} دقيقة
            </span>
          </div>

          <div className="bg-[#18181C] p-1 rounded-xl border border-white/[0.06] grid grid-cols-5 gap-1">
            {PRESET_MINUTES.map((mins) => {
              const isSelected = estimatedMinutes === mins;
              return (
                <motion.button
                  key={mins}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => {
                    soundManager.playKeyClick();
                    setEstimatedMinutes(mins);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-mono font-medium tabular-nums transition-colors ${
                    isSelected
                      ? 'bg-zinc-800 text-white shadow-sm border border-white/10'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {mins} د
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Optional Note input */}
        <div className="mb-3.5">
          {!showNotes ? (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5 text-zinc-500" />
              <span>إضافة ملاحظة على الطلب</span>
            </button>
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder="ملاحظات الطلب (مثال: برجر سفري بدون بصل)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#18181C] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
              />
              <button
                type="button"
                onClick={() => {
                  setNotes('');
                  setShowNotes(false);
                }}
                className="absolute left-2.5 top-2.5 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tactile Numeric Keypad Grid (Standard POS: 1-9, C, 0, Backspace) */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <motion.button
              key={digit}
              type="button"
              whileTap={{ scale: 0.94 }}
              whileHover={{ scale: 1.01 }}
              onClick={() => handleDigit(digit)}
              className="h-12 sm:h-14 rounded-xl bg-[#18181C] hover:bg-[#202026] text-white text-xl font-mono font-semibold tabular-nums border border-white/[0.06] transition-colors flex items-center justify-center select-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
            >
              {digit}
            </motion.button>
          ))}

          {/* Clear Key */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.01 }}
            onClick={handleClear}
            className="h-12 sm:h-14 rounded-xl bg-[#18181C] hover:bg-rose-950/30 text-rose-400 text-sm font-semibold border border-white/[0.06] transition-colors flex items-center justify-center select-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
          >
            مسح
          </motion.button>

          {/* Zero Key */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.01 }}
            onClick={() => handleDigit('0')}
            className="h-12 sm:h-14 rounded-xl bg-[#18181C] hover:bg-[#202026] text-white text-xl font-mono font-semibold tabular-nums border border-white/[0.06] transition-colors flex items-center justify-center select-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
          >
            0
          </motion.button>

          {/* Backspace Key */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.01 }}
            onClick={handleBackspace}
            className="h-12 sm:h-14 rounded-xl bg-[#18181C] hover:bg-[#202026] text-zinc-300 text-sm border border-white/[0.06] transition-colors flex items-center justify-center select-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
            title="تراجع"
          >
            <RotateCcw className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Primary CTA Submit Button */}
        <motion.button
          type="button"
          whileTap={orderNumber.trim() && !isSubmitting ? { scale: 0.96 } : undefined}
          whileHover={orderNumber.trim() && !isSubmitting ? { scale: 1.01 } : undefined}
          disabled={!orderNumber.trim() || isSubmitting}
          onClick={handleSubmit}
          className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors select-none ${
            orderNumber.trim() && !isSubmitting
              ? 'bg-emerald-500 hover:bg-emerald-400 text-[#052E16] shadow-sm cursor-pointer font-bold'
              : 'bg-zinc-900 text-zinc-600 border border-white/[0.04] cursor-not-allowed'
          }`}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>إضافة للانتظار</span>
        </motion.button>
      </div>
    </div>
  );
};
