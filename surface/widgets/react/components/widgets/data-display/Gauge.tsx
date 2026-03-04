export type ThresholdLevel = 'normal' | 'warning' | 'critical' | 'none';

export type GaugeState = { current: 'static' | 'normal' | 'warning' | 'critical' };

export type GaugeAction =
  | { type: 'VALUE_CHANGE' }
  | { type: 'THRESHOLD_WARNING' }
  | { type: 'THRESHOLD_CRITICAL' }
  | { type: 'THRESHOLD_NORMAL' };

export function gaugeReducer(state: GaugeState, action: GaugeAction): GaugeState {
  switch (action.type) {
    case 'THRESHOLD_WARNING':
      return { current: 'warning' };
    case 'THRESHOLD_CRITICAL':
      return { current: 'critical' };
    case 'THRESHOLD_NORMAL':
      return { current: 'normal' };
    case 'VALUE_CHANGE':
      return state;
    default:
      return state;
  }
}

export const gaugeInitialState: GaugeState = { current: 'static' };

export interface GaugeThresholds {
  warning: number;
  critical: number;
}

export function getThresholdLevel(
  value: number,
  thresholds?: GaugeThresholds
): ThresholdLevel {
  if (!thresholds) return 'none';
  if (value >= thresholds.critical) return 'critical';
  if (value >= thresholds.warning) return 'warning';
  return 'normal';
}

export function getThresholdColor(level: ThresholdLevel): string {
  switch (level) {
    case 'critical':
      return '#ef4444';
    case 'warning':
      return '#f59e0b';
    case 'normal':
      return '#22c55e';
    default:
      return '#6366f1';
  }
}

import { forwardRef, useReducer, useMemo, useId, type ReactNode } from 'react';

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
