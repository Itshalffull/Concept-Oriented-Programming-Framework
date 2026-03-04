// ============================================================
// Clef Surface NativeScript Widget — StatCard
//
// Statistical summary card with trend indicator.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';

export interface StatCardTrend { direction: 'up' | 'down' | 'neutral'; value: string; }

export interface StatCardProps {
  title: string;
  value: string;
  description?: string;
  trend?: StatCardTrend;
  icon?: string;
  variant?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function createStatCard(props: StatCardProps): StackLayout {
  const { title, value, description, trend, icon, variant, size = 'md' } = props;
  const container = new StackLayout();
  container.className = `clef-widget-stat-card clef-size-${size}`;
  container.padding = '16';

  if (icon) {
    const iconLabel = new Label();
    iconLabel.text = icon;
    iconLabel.fontSize = 24;
    container.addChild(iconLabel);
  }

  const titleLabel = new Label();
  titleLabel.text = title;
  titleLabel.opacity = 0.7;
  titleLabel.fontSize = 13;
  container.addChild(titleLabel);

  const valueLabel = new Label();
  valueLabel.text = value;
  valueLabel.fontSize = 28;
  valueLabel.fontWeight = 'bold';
  container.addChild(valueLabel);

  if (trend) {
    const trendRow = new StackLayout();
    trendRow.orientation = 'horizontal';
    const arrow = new Label();
    arrow.text = trend.direction === 'up' ? '\u2191' : trend.direction === 'down' ? '\u2193' : '\u2192';
    trendRow.addChild(arrow);
    const trendValue = new Label();
    trendValue.text = ` ${trend.value}`;
    trendValue.fontSize = 12;
    trendRow.addChild(trendValue);
    container.addChild(trendRow);
  }

  if (description) {
    const desc = new Label();
    desc.text = description;
    desc.opacity = 0.5;
    desc.fontSize = 12;
    container.addChild(desc);
  }
  return container;
}

export default createStatCard;
