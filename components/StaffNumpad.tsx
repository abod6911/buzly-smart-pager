'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Delete, RotateCcw, Clock, Sparkles } from 'lucide-react';
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

  // Handle number click
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

  // Support physical keyboard typing for ultra-fast POS operation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in notes input
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
    <div className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-5 shadow-2xl flex flex-col justify-between h-full">
      {/* Top Display */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wider font-semibold text-zinc-400">
            إدخال طلب جديد
          </span>
          <span className="text-[11px] text-zinc-400 bg-obsidian-card px-2 py-0.5 rounded-md border border-obsidian-border">
            لوحة مفاتيح سريعة
          </span>
        </div>

        {/* Display Screen */}
        <div className="relative bg-obsidian-400 border-2 border-obsidian-border rounded-2xl p-4 min-h-[84px] flex items-center justify-between mb-4 shadow-inner">
          <div className="flex items-baseline gap-2">
            <span className="text-zinc-500 font-mono text-2xl font-bold">#</span>
            <span
              className={`font-mono text-4xl sm:text-5xl font-extrabold tracking-wider transition-colors ${
                orderNumber ? 'text-white' : 'text-zinc-600'
              }`}
            >
              {orderNumber || '000'}
            </span>
          </div>

          {orderNumber && (
            <button
              onClick={handleClear}
              className="p-2 rounded-xl bg-obsidian-card hover:bg-obsidian-border text-zinc-400 hover:text-rose-400 transition-colors"
              title="مسح"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          )}

          {justAdded && (
            <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-[2px] rounded-2xl flex items-center justify-center text-emerald-400 font-bold text-lg animate-fade-in">
              <Sparkles className="w-5 h-5 ml-2" /> تم إضافة الطلب بنجاح!
            </div>
          )}
        </div>

        {/* Estimated Prep Time Selectors */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-buzly-amber" /> الوقت المتوقع للتحضير
            </span>
            <span className="font-bold text-buzly-amber font-mono">{estimatedMinutes} دقيقة</span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {PRESET_MINUTES.map((mins) => {
              const isSelected = estimatedMinutes === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    soundManager.playKeyClick();
                    setEstimatedMinutes(mins);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-buzly-amber text-black shadow-lg shadow-buzly-amber/30 scale-105'
                      : 'bg-obsidian-card hover:bg-obsidian-border text-zinc-300 border border-obsidian-border'
                  }`}
                >
                  {mins} د
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Note toggle */}
        <div className="mb-4">
          {!showNotes ? (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="text-xs text-zinc-400 hover:text-emerald-400 underline transition-colors"
            >
              + إضافة ملاحظة أو صنف (اختياري)
            </button>
          ) : (
            <input
              type="text"
              placeholder="مثال: برجر دبل جبن سفري"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-obsidian-card border border-obsidian-border rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          )}
        </div>
      </div>

      {/* Numeric Keypad Grid (1-9, C, 0, Backspace) */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-14 sm:h-16 rounded-2xl bg-obsidian-card hover:bg-obsidian-border text-white text-2xl font-bold font-mono border border-obsidian-border active:scale-95 transition-all flex items-center justify-center shadow-sm select-none"
            >
              {digit}
            </button>
          ))}

          {/* Clear Key */}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 sm:h-16 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-lg font-bold border border-rose-500/20 active:scale-95 transition-all flex items-center justify-center select-none"
          >
            مسح
          </button>

          {/* Zero Key */}
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 sm:h-16 rounded-2xl bg-obsidian-card hover:bg-obsidian-border text-white text-2xl font-bold font-mono border border-obsidian-border active:scale-95 transition-all flex items-center justify-center shadow-sm select-none"
          >
            0
          </button>

          {/* Backspace Key */}
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 sm:h-16 rounded-2xl bg-obsidian-card hover:bg-obsidian-border text-zinc-300 text-xl border border-obsidian-border active:scale-95 transition-all flex items-center justify-center select-none"
            title="تراجع"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Submit Button */}
        <button
          type="button"
          disabled={!orderNumber.trim() || isSubmitting}
          onClick={handleSubmit}
          className={`w-full py-4 px-6 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all shadow-xl select-none ${
            orderNumber.trim() && !isSubmitting
              ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/25 active:scale-[0.98] cursor-pointer'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
          }`}
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>إضافة إلى الطابور (Add to Queue)</span>
        </button>
      </div>
    </div>
  );
};
