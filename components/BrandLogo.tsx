'use client';

import React, { useState } from 'react';
import { Bell } from 'lucide-react';

interface BrandLogoProps {
  className?: string;
  imgClassName?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 rounded-xl',
  md: 'w-10 h-10 rounded-2xl',
  lg: 'w-12 h-12 rounded-2xl',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className,
  imgClassName = 'w-full h-full object-cover',
  alt = 'Chimer Pager Logo',
  size = 'md',
}) => {
  const [srcIndex, setSrcIndex] = useState<number>(0);
  const sources = ['/logo.png', '/logo.jpg'];

  const containerClass = className || `${SIZE_CLASSES[size]} overflow-hidden border border-emerald-500/30 flex items-center justify-center bg-black shadow-lg shadow-emerald-500/10 shrink-0`;

  if (srcIndex < sources.length) {
    return (
      <div className={containerClass}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sources[srcIndex]}
          alt={alt}
          className={imgClassName}
          onError={() => setSrcIndex((prev) => prev + 1)}
        />
      </div>
    );
  }

  // Fallback in the ultra-rare case an asset is blocked
  return (
    <div className={containerClass}>
      <Bell className="w-5 h-5 text-emerald-400" />
    </div>
  );
};
