// ============================================================
// Clef Surface NativeScript Widget — Separator
//
// NativeScript horizontal or vertical separator line. Renders
// as a thin StackLayout with configurable thickness, color,
// and margin spacing.
// ============================================================

import { StackLayout, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  thickness?: number;
  color?: string;
  margin?: number;
}

// --------------- Component ---------------

export function createSeparator(props: SeparatorProps = {}): StackLayout {
  const {
    orientation = 'horizontal',
    thickness = 1,
    color = '#E0E0E0',
    margin = 8,
  } = props;

  const separator = new StackLayout();
  separator.className = `clef-separator clef-separator--${orientation}`;
  separator.backgroundColor = new Color(color);

  if (orientation === 'horizontal') {
    separator.height = thickness;
    separator.horizontalAlignment = 'stretch';
    separator.marginTop = margin;
    separator.marginBottom = margin;
  } else {
    separator.width = thickness;
    separator.verticalAlignment = 'stretch';
    separator.marginLeft = margin;
    separator.marginRight = margin;
  }

  return separator;
}

createSeparator.displayName = 'Separator';
export default createSeparator;
