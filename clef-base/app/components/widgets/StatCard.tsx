'use client';

/**
 * StatCard — Key performance indicator display
 * Implements repertoire/widgets/data-display/stat-card.widget
 */

import React from 'react';

export interface StatCardProps {
  label: string;
  value: string;
  trend?: { direction: 'up' | 'down' | 'neutral'; value: string };
  description?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, trend, description }) => {
  return (
    <div
      role="region"
      aria-label={label}
      aria-roledescription="statistic"
      data-part="stat-card"
      data-trend={trend?.direction ?? 'none'}
    >
      <span data-part="label">{label}</span>
      <span data-part="value" aria-live="polite" aria-atomic="true">
        {value}
      </span>
      {trend && (
        <div
          data-part="trend"
          data-direction={trend.direction}
          data-visible="true"
          aria-label={`${trend.direction} by ${trend.value}`}
        >
          <span data-part="trend-icon" data-direction={trend.direction} aria-hidden="true">
            {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
          </span>
          <span data-part="trend-value" data-direction={trend.direction}>
            {trend.value}
          </span>
        </div>
      )}
      {description && <span data-part="description">{description}</span>}
    </div>
  );
};

export default StatCard;
