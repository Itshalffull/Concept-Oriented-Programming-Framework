'use client';

import { forwardRef, useReducer, type HTMLAttributes } from 'react';
import { modeReducer, type ModeState, type ModeAction } from './ProgressBar.reducer.js';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Current progress value. Omit for indeterminate mode. */
  value?: number;
  /** Minimum value (default 0) */
  min?: number;
  /** Maximum value (default 100) */
  max?: number;
  /** Visible label describing the progress */
  label?: string;
  /** Show the numeric value text */
  showValueText?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(function ProgressBar(
  {
    value,
    min = 0,
    max = 100,
    label,
    showValueText = false,
    size = 'md',
    className,
    ...rest
  },
  ref,
) {
  const [_modeState] = useReducer(
    modeReducer,
    value === undefined ? 'indeterminate' : value >= max ? 'complete' : 'determinate',
  );

  const isIndeterminate = value === undefined;
  const isComplete = !isIndeterminate && value! >= max;
  const dataState = isIndeterminate
    ? 'indeterminate'
    : isComplete
      ? 'complete'
      : 'determinate';

  const percent = isIndeterminate
    ? 0
    : Math.round(((value! - min) / (max - min)) * 100);

  const fillWidth = isIndeterminate ? '100%' : `${percent}%`;
  const valueText = isIndeterminate ? 'Loading' : `${percent}%`;

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label ?? 'Progress'}
      aria-valuenow={isIndeterminate ? undefined : value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={valueText}
      aria-busy={isIndeterminate ? 'true' : 'false'}
      data-surface-widget=""
      data-widget-name="progress-bar"
      data-part="root"
      data-state={dataState}
      data-value={value}
      data-size={size}
      className={className}
      {...rest}
    >
      {label && (
        <span data-part="label">{label}</span>
      )}

      <div
        data-part="track"
        data-state={isIndeterminate ? 'indeterminate' : 'determinate'}
      >
        <div
          data-part="fill"
          data-state={isIndeterminate ? 'indeterminate' : 'determinate'}
          data-animation={isIndeterminate ? 'indeterminate' : 'none'}
          style={{ width: fillWidth }}
        />
      </div>

      {showValueText && !isIndeterminate && (
        <span data-part="valueText" aria-hidden="true">
          {valueText}
        </span>
      )}
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';
export default ProgressBar;
