// ============================================================
// Clef Surface NativeScript Widget — Icon
//
// NativeScript icon display widget. Renders icons from font
// glyphs (e.g., Material Icons) or image resources. Supports
// configurable size and color.
// ============================================================

import { Label as NsLabel, Image, Color, StackLayout } from '@nativescript/core';

// --------------- Props ---------------

export interface IconProps {
  /** Unicode glyph character for font-based icons */
  glyph?: string;
  /** Font family for glyph rendering (e.g., 'MaterialIcons') */
  fontFamily?: string;
  /** Image resource path for image-based icons */
  src?: string;
  size?: number;
  color?: string;
}

// --------------- Component ---------------

export function createIcon(props: IconProps = {}): StackLayout {
  const {
    glyph,
    fontFamily = 'MaterialIcons',
    src,
    size = 24,
    color = '#333333',
  } = props;

  const container = new StackLayout();
  container.className = 'clef-icon';
  container.width = size;
  container.height = size;
  container.horizontalAlignment = 'center';
  container.verticalAlignment = 'middle';

  if (src) {
    // Image-based icon
    const image = new Image();
    image.src = src;
    image.width = size;
    image.height = size;
    image.stretch = 'aspectFit';
    image.className = 'clef-icon__image';
    container.addChild(image);
  } else {
    // Font glyph-based icon
    const label = new NsLabel();
    label.text = glyph ?? '\uE5CD'; // default: close icon
    label.fontFamily = fontFamily;
    label.fontSize = size;
    label.color = new Color(color);
    label.textAlignment = 'center';
    label.verticalAlignment = 'middle';
    label.horizontalAlignment = 'center';
    label.className = 'clef-icon__glyph';
    container.addChild(label);
  }

  return container;
}

createIcon.displayName = 'Icon';
export default createIcon;
