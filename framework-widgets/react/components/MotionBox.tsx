// ============================================================
// MotionBox — A <div> that applies CSS transitions derived from
// a COIF MotionTransition configuration.
//
// Supports the prefers-reduced-motion user preference via a
// data attribute so that ancestor CSS can zero out durations.
// When reduced motion is detected through matchMedia, transitions
// are collapsed to 0ms automatically.
// ============================================================

import React, {
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
import { motionToCSS } from '../../shared/coif-bridge.js';

// --------------- Props ---------------

export interface MotionBoxProps extends HTMLAttributes<HTMLDivElement> {
  /** One or more COIF transition configs to apply. */
  transitions: MotionTransition[];
  /** Available named durations for resolution. */
  durations: MotionDuration[];
  /** Available named easings for resolution. */
  easings: MotionEasing[];
  /**
   * Force reduced-motion mode regardless of OS setting.
   * @default undefined  (follows prefers-reduced-motion media query)
   */
  reducedMotion?: boolean;
  /** Additional class name. */
  className?: string;
  /** Additional inline styles. */
  style?: CSSProperties;
  children?: ReactNode;
}

// --------------- Hook: prefers-reduced-motion ---------------

function usePrefersReducedMotion(): boolean {
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
}

// --------------- Component ---------------

export const MotionBox: React.FC<MotionBoxProps> = ({
  transitions,
  durations,
  easings,
  reducedMotion: forcedReducedMotion,
  className,
  style,
  children,
  ...rest
}) => {
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
      data-coif-motion=""
      data-reduced-motion={isReduced ? '' : undefined}
    >
      {children}
    </div>
  );
};

MotionBox.displayName = 'MotionBox';
export default MotionBox;
