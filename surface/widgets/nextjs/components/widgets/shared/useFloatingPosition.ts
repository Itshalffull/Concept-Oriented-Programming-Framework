'use client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export type Placement =
  | 'top' | 'top-start' | 'top-end'
  | 'bottom' | 'bottom-start' | 'bottom-end'
  | 'left' | 'left-start' | 'left-end'
  | 'right' | 'right-start' | 'right-end';

export interface FloatingPosition {
  x: number;
  y: number;
  placement: Placement;
}

export interface UseFloatingPositionProps {
  placement?: Placement;
  offset?: number;
  enabled?: boolean;
}

export function useFloatingPosition(
  anchorRef: RefObject<HTMLElement | null>,
  floatingRef: RefObject<HTMLElement | null>,
  { placement = 'bottom', offset = 8, enabled = true }: UseFloatingPositionProps = {}
): FloatingPosition {
  const [position, setPosition] = useState<FloatingPosition>({ x: 0, y: 0, placement });

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    const floating = floatingRef.current;
    if (!anchor || !floating) return;

    const anchorRect = anchor.getBoundingClientRect();
    const floatingRect = floating.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let x = 0;
    let y = 0;
    let actualPlacement = placement;
    const [side, align] = placement.split('-') as [string, string | undefined];

    // Compute position based on side
    switch (side) {
      case 'top':
        x = anchorRect.left + anchorRect.width / 2 - floatingRect.width / 2;
        y = anchorRect.top - floatingRect.height - offset;
        if (y < 0) { y = anchorRect.bottom + offset; actualPlacement = `bottom${align ? `-${align}` : ''}` as Placement; }
        break;
      case 'bottom':
        x = anchorRect.left + anchorRect.width / 2 - floatingRect.width / 2;
        y = anchorRect.bottom + offset;
        if (y + floatingRect.height > viewportH) { y = anchorRect.top - floatingRect.height - offset; actualPlacement = `top${align ? `-${align}` : ''}` as Placement; }
        break;
      case 'left':
        x = anchorRect.left - floatingRect.width - offset;
        y = anchorRect.top + anchorRect.height / 2 - floatingRect.height / 2;
        if (x < 0) { x = anchorRect.right + offset; actualPlacement = `right${align ? `-${align}` : ''}` as Placement; }
        break;
      case 'right':
        x = anchorRect.right + offset;
        y = anchorRect.top + anchorRect.height / 2 - floatingRect.height / 2;
        if (x + floatingRect.width > viewportW) { x = anchorRect.left - floatingRect.width - offset; actualPlacement = `left${align ? `-${align}` : ''}` as Placement; }
        break;
    }

    // Alignment adjustments
    if (align === 'start') {
      if (side === 'top' || side === 'bottom') x = anchorRect.left;
      else y = anchorRect.top;
    } else if (align === 'end') {
      if (side === 'top' || side === 'bottom') x = anchorRect.right - floatingRect.width;
      else y = anchorRect.bottom - floatingRect.height;
    }

    // Clamp to viewport
    x = Math.max(0, Math.min(x, viewportW - floatingRect.width));
    y = Math.max(0, Math.min(y, viewportH - floatingRect.height));

    setPosition({ x, y, placement: actualPlacement });
  }, [anchorRef, floatingRef, placement, offset]);

  useEffect(() => {
    if (!enabled) return;
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [enabled, update]);

  return position;
}
