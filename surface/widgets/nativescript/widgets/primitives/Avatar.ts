// ============================================================
// Clef Surface NativeScript Widget — Avatar
//
// NativeScript user avatar circle displaying either an image
// or fallback initials. Supports configurable size, background
// color, and border styling.
// ============================================================

import { GridLayout, Label as NsLabel, Image, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface AvatarProps {
  src?: string;
  initials?: string;
  size?: number;
  backgroundColor?: string;
  textColor?: string;
  borderWidth?: number;
  borderColor?: string;
}

// --------------- Component ---------------

export function createAvatar(props: AvatarProps = {}): GridLayout {
  const {
    src,
    initials = '?',
    size = 40,
    backgroundColor = '#6200EE',
    textColor = '#FFFFFF',
    borderWidth = 0,
    borderColor = '#00000020',
  } = props;

  const container = new GridLayout();
  container.className = 'clef-avatar';
  container.width = size;
  container.height = size;
  container.borderRadius = size / 2;
  container.backgroundColor = new Color(backgroundColor);
  container.horizontalAlignment = 'center';
  container.verticalAlignment = 'middle';

  if (borderWidth > 0) {
    container.borderWidth = borderWidth;
    container.borderColor = new Color(borderColor);
  }

  if (src) {
    const image = new Image();
    image.src = src;
    image.width = size;
    image.height = size;
    image.borderRadius = size / 2;
    image.stretch = 'aspectFill';
    image.className = 'clef-avatar__image';
    container.addChild(image);
  } else {
    const label = new NsLabel();
    label.text = initials.substring(0, 2).toUpperCase();
    label.color = new Color(textColor);
    label.fontSize = size * 0.4;
    label.fontWeight = 'bold';
    label.textAlignment = 'center';
    label.verticalAlignment = 'middle';
    label.horizontalAlignment = 'center';
    label.className = 'clef-avatar__initials';
    container.addChild(label);
  }

  return container;
}

createAvatar.displayName = 'Avatar';
export default createAvatar;
