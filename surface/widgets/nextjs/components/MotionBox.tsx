'use client';

// ============================================================
// MotionBox — Next.js client component <div> that applies CSS
// transitions derived from a Clef Surface MotionTransition
// configuration.
//
// Supports the prefers-reduced-motion user preference via a
// data attribute so that ancestor CSS can zero out durations.
// When reduced motion is detected through matchMedia,
// transitions are collapsed to 0ms automatically.
//
// 'use client' required for matchMedia subscription.
// Functional component only — no classes.
// ============================================================

import {
  useMemo,
  useEffect,
  useState,
  type ReactNode,
  type CSSProperties,
  type HTMLAttributes,
} from 'react';

import type {
  MotionTransition,
  MotionDuration,
  MotionEasing,
} from '../../shared/types.js';
import { motionToCSS } from '../../shared/surface-bridge.js';

// --------------- Props ---------------

export interface MotionBoxProps extends HTMLAttributes<HTMLDivElement> {
  /** One or more Clef Surface transition configs to apply. */
  readonly transitions: MotionTransition[];
  /** Available named durations for resolution. */
  readonly durations: MotionDuration[];
  /** Available named easings for resolution. */
  readonly easings: MotionEasing[];
  /**
   * Force reduced-motion mode regardless of OS setting.
   * @default undefined  (follows prefers-reduced-motion media query)
   */
  readonly reducedMotion?: boolean;
  /** Additional class name. */
  readonly className?: string;
  /** Additional inline styles. */
  readonly style?: CSSProperties;
  readonly children?: ReactNode;
}

// --------------- Hook: prefers-reduced-motion ---------------

const usePrefersReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);

    // Modern browsers support addEventListener on MediaQueryList
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    // Fallback for older browsers
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, []);

  return reduced;
};

// --------------- Component ---------------

export const MotionBox = ({
  transitions,
  durations,
  easings,
  reducedMotion: forcedReducedMotion,
  className,
  style,
  children,
  ...rest
}: MotionBoxProps): ReactNode => {
  const osReduced = usePrefersReducedMotion();
  const isReduced = forcedReducedMotion ?? osReduced;

  const transitionString = useMemo(() => {
    if (isReduced) {
      // Collapse all transitions to instant
      return transitions
        .map((t) => `${t.property} 0ms linear`)
        .join(', ');
    }

    return transitions
      .map((t) => motionToCSS(t, durations, easings))
      .join(', ');
  }, [transitions, durations, easings, isReduced]);

  const mergedStyle = useMemo<CSSProperties>(
    () => ({
      transition: transitionString || undefined,
      ...style,
    }),
    [transitionString, style]
  );

  return (
    <div
      {...rest}
      className={className}
      style={mergedStyle}
      data-surface-motion=""
      data-surface-adapter="nextjs"
      data-reduced-motion={isReduced ? '' : undefined}
    >
      {children}
    </div>
  );
};

MotionBox.displayName = 'MotionBox';
export default MotionBox;
