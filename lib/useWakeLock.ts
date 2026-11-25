'use client';

import { useEffect, useRef, useState } from 'react';

export function useWakeLock(shouldStayAwake: boolean): {
  isActive: boolean;
  isSupported: boolean;
} {
  const [isActive, setIsActive] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
    setIsSupported(supported);
    if (!supported) return;

    let cancelled = false;

    const acquire = async () => {
      if (cancelled || !shouldStayAwake) return;
      if (document.visibilityState !== 'visible') return;
      if (sentinelRef.current) return;

      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          await sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        setIsActive(true);
        sentinel.addEventListener('release', () => {
          sentinelRef.current = null;
          if (!cancelled) setIsActive(false);
        });
      } catch {
        if (!cancelled) setIsActive(false);
      }
    };

    const release = async () => {
      if (sentinelRef.current) {
        const s = sentinelRef.current;
        sentinelRef.current = null;
        setIsActive(false);
        await s.release().catch(() => {});
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && shouldStayAwake) {
        acquire();
      }
    };

    if (shouldStayAwake) {
      acquire();
      document.addEventListener('visibilitychange', onVisibilityChange);
    } else {
      release();
    }

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      release();
    };
  }, [shouldStayAwake]);

  return { isActive, isSupported };
}
