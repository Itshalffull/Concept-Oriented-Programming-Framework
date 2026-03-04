// ============================================================
// Clef Surface NativeScript Widget — Badge
//
// Small count or status indicator. Renders a colored label
// overlay with optional max count truncation.
// ============================================================

import { StackLayout, Label, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface BadgeProps {
  value?: string | number;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
  max?: number;
  dot?: boolean;
  visible?: boolean;
}

const VARIANT_COLORS: Record<string, string> = {
  default: '#6b7280',
  primary: '#3b82f6',
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
};

// --------------- Component ---------------

export function createBadge(props: BadgeProps): StackLayout {
  const {
    value,
    variant = 'default',
    max = 99,
    dot = false,
    visible = true,
  } = props;

  const container = new StackLayout();
  container.className = `clef-widget-badge clef-variant-${variant}`;
  container.visibility = visible ? 'visible' : 'collapsed';
  container.horizontalAlignment = 'center';
  container.verticalAlignment = 'middle';
  container.backgroundColor = new Color(VARIANT_COLORS[variant] ?? VARIANT_COLORS.default);
  container.borderRadius = 10;
  container.padding = dot ? '4' : '2 6';

  if (!dot && value !== undefined) {
    const lbl = new Label();
    const numVal = typeof value === 'number' ? value : parseInt(value, 10);
    lbl.text = !isNaN(numVal) && numVal > max ? `${max}+` : String(value);
    lbl.fontSize = 11;
    lbl.color = new Color('#ffffff');
    lbl.horizontalAlignment = 'center';
    container.addChild(lbl);
  }

  return container;
}

export default createBadge;
