// ============================================================
// Clef Surface NativeScript Widget — Badge
//
// Small count or status badge. Displays a numeric count or
// short text label inside a rounded container. Supports
// dot-only mode and configurable colors.
// ============================================================

import { StackLayout, Label, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface BadgeProps {
  count?: number;
  label?: string;
  dot?: boolean;
  maxCount?: number;
  backgroundColor?: string;
  textColor?: string;
  size?: 'small' | 'medium' | 'large';
  visible?: boolean;
}

// --------------- Size Scale ---------------

const SIZE_SCALE: Record<string, { minWidth: number; height: number; fontSize: number; dotSize: number }> = {
  small: { minWidth: 16, height: 16, fontSize: 10, dotSize: 8 },
  medium: { minWidth: 20, height: 20, fontSize: 12, dotSize: 10 },
  large: { minWidth: 24, height: 24, fontSize: 14, dotSize: 12 },
};

// --------------- Component ---------------

export function createBadge(props: BadgeProps = {}): StackLayout {
  const {
    count,
    label,
    dot = false,
    maxCount = 99,
    backgroundColor = '#ef4444',
    textColor = '#FFFFFF',
    size = 'medium',
    visible = true,
  } = props;

  const scale = SIZE_SCALE[size];

  const container = new StackLayout();
  container.className = 'clef-badge';
  container.horizontalAlignment = 'center';
  container.verticalAlignment = 'middle';
  container.backgroundColor = new Color(backgroundColor);
  container.visibility = visible ? 'visible' : 'collapsed';

  if (dot) {
    container.width = scale.dotSize;
    container.height = scale.dotSize;
    container.borderRadius = scale.dotSize / 2;
    return container;
  }

  container.minWidth = scale.height;
  container.height = scale.height;
  container.borderRadius = scale.height / 2;
  container.padding = '0 4';

  const text = new Label();
  text.className = 'clef-badge-text';
  text.color = new Color(textColor);
  text.fontSize = scale.fontSize;
  text.textAlignment = 'center';
  text.verticalAlignment = 'middle';

  if (label !== undefined) {
    text.text = label;
  } else if (count !== undefined) {
    text.text = count > maxCount ? `${maxCount}+` : String(count);
  } else {
    text.text = '';
  }

  container.addChild(text);
  return container;
}

createBadge.displayName = 'Badge';
export default createBadge;
