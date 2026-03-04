// ============================================================
// Clef Surface NativeScript Widget — Icon
//
// Renders an icon glyph or image with configurable size and
// color. Supports font-icon text or image source.
// ============================================================

import { StackLayout, Label, Image, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface IconProps {
  name?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: string;
  accessibilityLabel?: string;
}

const SIZE_MAP: Record<string, number> = { xs: 12, sm: 16, md: 24, lg: 32 };

// --------------- Component ---------------

export function createIcon(props: IconProps): StackLayout {
  const {
    name,
    src,
    size = 'md',
    color,
    accessibilityLabel,
  } = props;

  const dim = SIZE_MAP[size] ?? 24;
  const container = new StackLayout();
  container.className = 'clef-widget-icon';
  container.width = dim;
  container.height = dim;
  container.horizontalAlignment = 'center';
  container.verticalAlignment = 'middle';
  container.accessibilityRole = 'image';
  if (accessibilityLabel) {
    container.accessibilityLabel = accessibilityLabel;
  }

  if (src) {
    const img = new Image();
    img.src = src;
    img.width = dim;
    img.height = dim;
    img.stretch = 'aspectFit';
    if (color) img.className = `clef-icon-tint`;
    container.addChild(img);
  } else {
    const lbl = new Label();
    lbl.text = name ?? '';
    lbl.fontSize = dim;
    lbl.horizontalAlignment = 'center';
    lbl.verticalAlignment = 'middle';
    if (color) lbl.color = new Color(color);
    container.addChild(lbl);
  }

  return container;
}

export default createIcon;
