'use client';

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';

interface MuhabBrandBadgeProps {
  className?: string;
  variant?: 'minimal' | 'badge';
}

export const MuhabBrandBadge: React.FC<MuhabBrandBadgeProps> = ({
  className = '',
  variant = 'minimal',
}) => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  if (variant === 'badge') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-[11px] text-zinc-400 select-none tracking-wide font-sans ${className}`}
      >
        <span>{isAr ? 'تم تطوير وبناء هذا الموقع بواسطة' : 'Designed & Built by'}</span>
        <span className="font-bold text-white tracking-wider">MUHAB</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 font-sans tracking-wide select-none ${className}`}
    >
      <span>{isAr ? 'تم تطوير وبناء هذا الموقع بواسطة' : 'Designed & Built by'}</span>
      <span className="font-semibold text-zinc-300 tracking-wider hover:text-white transition-colors">
        MUHAB
      </span>
    </div>
  );
};
