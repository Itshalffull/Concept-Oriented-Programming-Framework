// ============================================================
// Clef Surface NativeScript Widget — StatCard
//
// Metric display card showing a key value with label, trend
// indicator, comparison text, and optional icon. Designed for
// dashboards and analytics surfaces.
// ============================================================

import { StackLayout, GridLayout, Label, ContentView, Color } from '@nativescript/core';

// --------------- Types ---------------

export type TrendDirection = 'up' | 'down' | 'neutral';
export type StatCardSize = 'small' | 'medium' | 'large';

// --------------- Props ---------------

export interface StatCardProps {
  label?: string;
  value?: string | number;
  previousValue?: string | number;
  trend?: TrendDirection;
  trendValue?: string;
  icon?: string;
  size?: StatCardSize;
  backgroundColor?: string;
  valueColor?: string;
  trendUpColor?: string;
  trendDownColor?: string;
  trendNeutralColor?: string;
  borderRadius?: number;
  onTap?: () => void;
}

// --------------- Constants ---------------

const TREND_ARROWS: Record<TrendDirection, string> = {
  up: '\u2191',
  down: '\u2193',
  neutral: '\u2192',
};

const SIZE_SCALES: Record<StatCardSize, { valueFontSize: number; labelFontSize: number; padding: number; iconSize: number }> = {
  small: { valueFontSize: 20, labelFontSize: 11, padding: 12, iconSize: 20 },
  medium: { valueFontSize: 28, labelFontSize: 13, padding: 16, iconSize: 24 },
  large: { valueFontSize: 36, labelFontSize: 15, padding: 20, iconSize: 32 },
};

// --------------- Component ---------------

export function createStatCard(props: StatCardProps = {}): StackLayout {
  const {
    label = 'Metric',
    value = '0',
    previousValue,
    trend = 'neutral',
    trendValue,
    icon,
    size = 'medium',
    backgroundColor = '#FFFFFF',
    valueColor = '#212121',
    trendUpColor = '#388E3C',
    trendDownColor = '#D32F2F',
    trendNeutralColor = '#757575',
    borderRadius = 12,
    onTap,
  } = props;

  const scale = SIZE_SCALES[size];

  const container = new StackLayout();
  container.className = `clef-stat-card clef-stat-card-${size}`;
  container.backgroundColor = backgroundColor as any;
  container.borderRadius = borderRadius;
  container.padding = scale.padding;
  container.androidElevation = 4;

  if (onTap) {
    container.on('tap', onTap);
  }

  // --- Top row: icon + label ---
  const topRow = new GridLayout();
  topRow.columns = icon ? 'auto, *' : '*';
  topRow.marginBottom = 8;

  if (icon) {
    const iconLabel = new Label();
    iconLabel.text = icon;
    iconLabel.fontSize = scale.iconSize;
    iconLabel.opacity = 0.6;
    iconLabel.verticalAlignment = 'middle';
    iconLabel.marginRight = 8;
    GridLayout.setColumn(iconLabel, 0);
    topRow.addChild(iconLabel);
  }

  const labelText = new Label();
  labelText.text = label;
  labelText.className = 'clef-stat-card-label';
  labelText.fontSize = scale.labelFontSize;
  labelText.opacity = 0.6;
  labelText.fontWeight = 'bold';
  labelText.letterSpacing = 0.5;
  labelText.verticalAlignment = 'middle';
  GridLayout.setColumn(labelText, icon ? 1 : 0);
  topRow.addChild(labelText);

  container.addChild(topRow);

  // --- Value ---
  const valueLabel = new Label();
  valueLabel.text = `${value}`;
  valueLabel.className = 'clef-stat-card-value';
  valueLabel.fontWeight = 'bold';
  valueLabel.fontSize = scale.valueFontSize;
  valueLabel.color = new Color(valueColor);
  valueLabel.marginBottom = 4;
  container.addChild(valueLabel);

  // --- Trend row ---
  const trendColor =
    trend === 'up' ? trendUpColor : trend === 'down' ? trendDownColor : trendNeutralColor;

  const trendRow = new GridLayout();
  trendRow.columns = 'auto, auto, *';

  const trendArrow = new Label();
  trendArrow.text = TREND_ARROWS[trend];
  trendArrow.className = 'clef-stat-card-trend-arrow';
  trendArrow.fontSize = scale.labelFontSize + 2;
  trendArrow.fontWeight = 'bold';
  trendArrow.color = new Color(trendColor);
  trendArrow.verticalAlignment = 'middle';
  GridLayout.setColumn(trendArrow, 0);
  trendRow.addChild(trendArrow);

  if (trendValue) {
    const trendLabel = new Label();
    trendLabel.text = ` ${trendValue}`;
    trendLabel.className = 'clef-stat-card-trend-value';
    trendLabel.fontSize = scale.labelFontSize;
    trendLabel.fontWeight = 'bold';
    trendLabel.color = new Color(trendColor);
    trendLabel.verticalAlignment = 'middle';
    GridLayout.setColumn(trendLabel, 1);
    trendRow.addChild(trendLabel);
  }

  if (previousValue !== undefined) {
    const prevLabel = new Label();
    prevLabel.text = `  vs ${previousValue}`;
    prevLabel.className = 'clef-stat-card-prev';
    prevLabel.fontSize = scale.labelFontSize - 1;
    prevLabel.opacity = 0.4;
    prevLabel.verticalAlignment = 'middle';
    GridLayout.setColumn(prevLabel, 2);
    trendRow.addChild(prevLabel);
  }

  container.addChild(trendRow);

  return container;
}

createStatCard.displayName = 'StatCard';
export default createStatCard;
