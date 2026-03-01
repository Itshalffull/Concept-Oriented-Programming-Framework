'use client';
import { forwardRef, useReducer, useId, type ReactNode } from 'react';
import { statCardReducer, statCardInitialState } from './StatCard.reducer.js';

// Props from stat-card.widget spec
export interface StatCardTrend {
  direction: 'up' | 'down' | 'neutral';
  value: string;
}

export interface StatCardProps {
  label: string;
  value: string;
  trend?: StatCardTrend;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: ReactNode;
}

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  function StatCard(
    {
      label,
      value,
      trend,
      description,
      size = 'md',
      className,
      children,
    },
    ref
  ) {
    const [state] = useReducer(statCardReducer, statCardInitialState);
    const labelId = useId();
    const descriptionId = useId();
    const trendDirection = trend?.direction ?? 'none';

    return (
      <div
        ref={ref}
        className={className}
        role="region"
        aria-label={label}
        aria-roledescription="statistic"
        data-surface-widget=""
        data-widget-name="stat-card"
        data-part="stat-card"
        data-trend={trendDirection}
        data-state={state.current}
        data-size={size}
      >
        <span id={labelId} data-part="label">
          {label}
        </span>
        <span
          data-part="value"
          data-trend={trendDirection}
          aria-live="polite"
          aria-atomic="true"
        >
          {value}
        </span>
        {trend && (
          <div
            data-part="trend"
            data-direction={trend.direction}
            data-visible="true"
            aria-label={`${trend.direction} by ${trend.value}`}
          >
            <span
              data-part="trend-icon"
              data-direction={trend.direction}
              aria-hidden="true"
            >
              {trend.direction === 'up' && '\u2191'}
              {trend.direction === 'down' && '\u2193'}
              {trend.direction === 'neutral' && '\u2192'}
            </span>
            <span data-part="trend-value" data-direction={trend.direction}>
              {trend.value}
            </span>
          </div>
        )}
        {description && (
          <span id={descriptionId} data-part="description">
            {description}
          </span>
        )}
        {children}
      </div>
    );
  }
);

StatCard.displayName = 'StatCard';
export default StatCard;
