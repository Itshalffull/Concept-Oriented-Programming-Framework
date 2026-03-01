'use client';

import { forwardRef, useReducer, type HTMLAttributes } from 'react';
import { displayReducer, type DisplayState, type DisplayAction } from './Badge.reducer.js';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  /** Text content of the badge (count, status, or category) */
  label?: string;
  /** Visual variant */
  variant?: 'filled' | 'outline' | 'dot';
  /** Colour token */
  color?: string;
  /** Numeric cap -- values above this render as "max+" */
  max?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  {
    label,
    variant = 'filled',
    color,
    max,
    size = 'md',
    className,
    ...rest
  },
  ref,
) {
  const [displayState] = useReducer(
    displayReducer,
    variant === 'dot' ? 'dot' : 'static',
  );

  const isDot = variant === 'dot';

  const resolvedLabel = (() => {
    if (isDot) return '';
    if (max !== undefined && label !== undefined) {
      const num = Number(label);
      if (!Number.isNaN(num) && num > max) return `${max}+`;
    }
    return label ?? '';
  })();

  const ariaLabel = label
    ? label
    : isDot
      ? 'Status indicator'
      : 'Badge';

  return (
    <span
      ref={ref}
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
      data-surface-widget=""
      data-widget-name="badge"
      data-part="root"
      data-state={isDot ? 'dot' : displayState}
      data-variant={variant}
      data-size={size}
      data-color={color}
      className={className}
      {...rest}
    >
      {!isDot && (
        <span
          data-part="label"
          aria-hidden={isDot ? 'true' : 'false'}
        >
          {resolvedLabel}
        </span>
      )}
    </span>
  );
});

Badge.displayName = 'Badge';
export default Badge;
