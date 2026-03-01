'use client';
import { useEffect } from 'react';

export function useScrollLock(enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;
    const original = document.body.style.overflow;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = original;
      document.body.style.paddingRight = '';
    };
  }, [enabled]);
}
