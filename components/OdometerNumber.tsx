'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { appleSpringOdometer } from '@/lib/motion';

interface OdometerDigitProps {
  digit: string;
  className?: string;
}

function OdometerDigit({ digit, className = '' }: OdometerDigitProps) {
  const num = parseInt(digit, 10);
  if (isNaN(num)) {
    return <span className={className}>{digit}</span>;
  }

  return (
    <span
      className={`inline-block relative overflow-hidden h-[1.15em] align-middle tabular-nums select-none ${className}`}
      style={{ lineHeight: '1.15em' }}
    >
      <motion.span
        className="flex flex-col"
        initial={{ y: 0 }}
        animate={{ y: `-${num * 10}%` }}
        transition={appleSpringOdometer}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span
            key={n}
            className="flex items-center justify-center h-[1.15em]"
            style={{ height: '1.15em' }}
          >
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

interface OdometerNumberProps {
  value: string | number;
  className?: string;
}

export const OdometerNumber: React.FC<OdometerNumberProps> = ({
  value,
  className = '',
}) => {
  const characters = String(value).split('');

  return (
    <span
      dir="ltr"
      style={{ direction: 'ltr', unicodeBidi: 'isolate' }}
      className={`inline-flex flex-row items-center font-mono tabular-nums ${className}`}
    >
      {characters.map((char, index) => (
        <OdometerDigit key={index} digit={char} className={className} />
      ))}
    </span>
  );
};
