'use client';
import { useEffect, useRef } from 'react';

export function useFocusReturn(enabled: boolean = true): void {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    return () => {
      const el = previouslyFocused.current;
      if (el && typeof el.focus === 'function') {
        // Defer to next microtask to allow DOM cleanup
        queueMicrotask(() => el.focus());
      }
    };
  }, [enabled]);
}
