// ============================================================
// Clef Surface NativeScript Widget — Separator
//
// Visual divider line between content sections. Supports
// horizontal and vertical orientations.
// ============================================================

import { StackLayout, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  color?: string;
  thickness?: number;
  marginY?: number;
  marginX?: number;
}

// --------------- Component ---------------

export function createSeparator(props: SeparatorProps): StackLayout {
  const {
    orientation = 'horizontal',
    color = '#e5e7eb',
    thickness = 1,
    marginY = 8,
    marginX = 0,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-separator';
  container.backgroundColor = new Color(color);
  container.accessibilityRole = 'none';

  if (orientation === 'horizontal') {
    container.height = thickness;
    container.marginTop = marginY;
    container.marginBottom = marginY;
    container.marginLeft = marginX;
    container.marginRight = marginX;
  } else {
    container.width = thickness;
    container.marginLeft = marginX;
    container.marginRight = marginX;
    container.marginTop = marginY;
    container.marginBottom = marginY;
  }

  return container;
}

export default createSeparator;
