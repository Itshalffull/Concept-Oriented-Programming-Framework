'use client';
import { forwardRef, useReducer, useMemo, useId, type ReactNode } from 'react';
import {
  gaugeReducer,
  gaugeInitialState,
  getThresholdLevel,
  getThresholdColor,
  type GaugeThresholds,
} from './Gauge.reducer.js';

// Props from gauge.widget spec
export type { GaugeThresholds };

export interface GaugeProps {
  value: number;
  min?: number;
  max?: number;
  thresholds?: GaugeThresholds;
  ariaLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: ReactNode;
}

export const Gauge = forwardRef<HTMLDivElement, GaugeProps>(
  function Gauge(
    {
      value,
      min = 0,
      max = 100,
      thresholds,
      ariaLabel,
      size = 'md',
      className,
      children,
    },
    ref
  ) {
    const [state] = useReducer(gaugeReducer, gaugeInitialState);
    const labelId = useId();

    const clampedValue = Math.min(Math.max(value, min), max);
    const percentage = (clampedValue - min) / (max - min);
    const thresholdLevel = getThresholdLevel(clampedValue, thresholds);

    const resolvedState = thresholds
      ? thresholdLevel === 'none'
        ? 'static'
        : thresholdLevel
      : state.current;

    // SVG arc calculation for a 270-degree gauge
    const svgSize = 200;
    const cx = svgSize / 2;
    const cy = svgSize / 2;
    const radius = 80;
    const strokeWidth = 12;
    const startAngle = 135; // degrees from 12 o'clock
    const endAngle = 405; // 270-degree sweep
    const sweepAngle = endAngle - startAngle;
    const fillAngle = startAngle + sweepAngle * percentage;

    const polarToCartesian = useMemo(
      () =>
        (angle: number) => {
          const rad = ((angle - 90) * Math.PI) / 180;
          return {
            x: cx + radius * Math.cos(rad),
            y: cy + radius * Math.sin(rad),
          };
        },
      [cx, cy]
    );

    const describeArc = useMemo(
      () =>
        (start: number, end: number) => {
          const s = polarToCartesian(start);
          const e = polarToCartesian(end);
          const largeArc = end - start > 180 ? 1 : 0;
          return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
        },
      [polarToCartesian]
    );

    const trackPath = useMemo(
      () => describeArc(startAngle, endAngle),
      [describeArc]
    );

    const fillPath = useMemo(
      () => (percentage > 0 ? describeArc(startAngle, fillAngle) : ''),
      [describeArc, fillAngle, percentage]
    );

    const fillColor = getThresholdColor(thresholdLevel);

    return (
      <div
        ref={ref}
        className={className}
        role="meter"
        aria-label={ariaLabel}
        aria-valuenow={clampedValue}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={`${clampedValue} of ${max}`}
        data-surface-widget=""
        data-widget-name="gauge"
        data-part="gauge"
        data-threshold={thresholdLevel}
        data-state={resolvedState}
        data-size={size}
      >
        <svg
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          style={{ width: '100%', height: 'auto' }}
        >
          {/* Track (background arc) */}
          <path
            d={trackPath}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            data-part="track"
            aria-hidden="true"
          />
          {/* Fill (value arc) */}
          {percentage > 0 && (
            <path
              d={fillPath}
              fill="none"
              stroke={fillColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              data-part="fill"
              data-percentage={Math.round(percentage * 100)}
              data-threshold={thresholdLevel}
              aria-hidden="true"
            />
          )}
          {/* Center value text */}
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            data-part="value"
            aria-live="polite"
            aria-atomic="true"
            data-threshold={thresholdLevel}
            style={{ fontSize: '2rem', fontWeight: 'bold' }}
          >
            {clampedValue}
          </text>
        </svg>
        {ariaLabel && (
          <span id={labelId} data-part="label">
            {ariaLabel}
          </span>
        )}
        {children}
      </div>
    );
  }
);

Gauge.displayName = 'Gauge';
export default Gauge;
