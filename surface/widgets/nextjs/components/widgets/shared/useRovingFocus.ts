'use client';
import { useCallback, useRef, useState } from 'react';
import { getNextIndex, getPrevIndex, getHomeIndex, getEndIndex } from './rovingFocusLogic.js';

export interface UseRovingFocusProps {
  orientation?: 'horizontal' | 'vertical' | 'both';
  loop?: boolean;
  onFocusChange?: (index: number) => void;
}

export interface RovingFocusItem {
  ref: (el: HTMLElement | null) => void;
  tabIndex: number;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
}

export function useRovingFocus({
  orientation = 'horizontal',
  loop = true,
  onFocusChange,
}: UseRovingFocusProps = {}): {
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
  getItemProps: (index: number) => RovingFocusItem;
} {
  const [focusedIndex, setFocusedIndexState] = useState(0);
  const itemsRef = useRef<(HTMLElement | null)[]>([]);

  const setFocusedIndex = useCallback(
    (index: number) => {
      setFocusedIndexState(index);
      itemsRef.current[index]?.focus();
      onFocusChange?.(index);
    },
    [onFocusChange]
  );

  const getItemProps = useCallback(
    (index: number): RovingFocusItem => ({
      ref: (el: HTMLElement | null) => {
        itemsRef.current[index] = el;
      },
      tabIndex: index === focusedIndex ? 0 : -1,
      onKeyDown: (e: React.KeyboardEvent) => {
        const count = itemsRef.current.filter(Boolean).length;
        const prevKeys = orientation === 'horizontal' ? ['ArrowLeft'] : orientation === 'vertical' ? ['ArrowUp'] : ['ArrowLeft', 'ArrowUp'];
        const nextKeys = orientation === 'horizontal' ? ['ArrowRight'] : orientation === 'vertical' ? ['ArrowDown'] : ['ArrowRight', 'ArrowDown'];

        if (nextKeys.includes(e.key)) {
          e.preventDefault();
          setFocusedIndex(getNextIndex(focusedIndex, count, loop));
        } else if (prevKeys.includes(e.key)) {
          e.preventDefault();
          setFocusedIndex(getPrevIndex(focusedIndex, count, loop));
        } else if (e.key === 'Home') {
          e.preventDefault();
          setFocusedIndex(getHomeIndex());
        } else if (e.key === 'End') {
          e.preventDefault();
          setFocusedIndex(getEndIndex(count));
        }
      },
      onFocus: () => {
        setFocusedIndexState(index);
      },
    }),
    [focusedIndex, orientation, loop, setFocusedIndex]
  );

  return { focusedIndex, setFocusedIndex, getItemProps };
}
