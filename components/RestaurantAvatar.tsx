'use client';

import React, { useState } from 'react';
import { Store } from 'lucide-react';

interface RestaurantAvatarProps {
  logoUrl?: string | null;
  name?: string;
  themeColor?: string;
  className?: string;
  textSize?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_MAP = {
  sm: {
    container: 'w-9 h-9 rounded-xl',
    text: 'text-xs font-bold',
    icon: 'w-4 h-4',
  },
  md: {
    container: 'w-10 h-10 sm:w-11 sm:h-11 rounded-2xl',
    text: 'text-sm font-bold',
    icon: 'w-5 h-5',
  },
  lg: {
    container: 'w-12 h-12 lg:w-14 lg:h-14 rounded-2xl',
    text: 'text-lg font-bold',
    icon: 'w-6 h-6',
  },
  xl: {
    container: 'w-20 h-20 sm:w-24 sm:h-24 rounded-3xl',
    text: 'text-3xl font-black',
    icon: 'w-10 h-10',
  },
};

export const RestaurantAvatar: React.FC<RestaurantAvatarProps> = ({
  logoUrl,
  name,
  themeColor = '#10B981',
  className,
  textSize,
  size = 'md',
}) => {
  const [imgError, setImgError] = useState<boolean>(false);
  const trimmedName = (name || '').trim();
  const initial = trimmedName ? trimmedName.charAt(0).toUpperCase() : '';

  const activeSize = SIZE_MAP[size] || SIZE_MAP.md;
  const containerClass = className || activeSize.container;
  const textClass = textSize || activeSize.text;

  if (logoUrl && !imgError) {
    return (
      <div className={`${containerClass} overflow-hidden bg-[#18181E] border border-white/10 shrink-0 flex items-center justify-center shadow-sm`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={trimmedName || 'Restaurant Logo'}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${containerClass} overflow-hidden border border-white/10 shrink-0 flex items-center justify-center text-white shadow-sm select-none`}
      style={{ backgroundColor: themeColor }}
    >
      {initial ? (
        <span className={textClass}>{initial}</span>
      ) : (
        <Store className={`${activeSize.icon} text-white`} />
      )}
    </div>
  );
};
