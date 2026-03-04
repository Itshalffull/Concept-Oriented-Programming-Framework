// ============================================================
// Clef Surface NativeScript Widget — Avatar
//
// Displays a user avatar with image loading states and
// fallback initials. Maps to NativeScript Image + Label views.
// ============================================================

import {
  StackLayout,
  Label,
  Image,
  Color,
} from '@nativescript/core';

// --------------- Helpers ---------------

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const SIZE_MAP: Record<string, number> = { xs: 24, sm: 32, md: 40, lg: 56 };

// --------------- Props ---------------

export interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  delayMs?: number;
}

// --------------- Component ---------------

export function createAvatar(props: AvatarProps): StackLayout {
  const { src, name = '', size = 'md', delayMs = 0 } = props;

  const dim = SIZE_MAP[size] ?? 40;
  const container = new StackLayout();
  container.className = 'clef-widget-avatar';
  container.width = dim;
  container.height = dim;
  container.horizontalAlignment = 'center';
  container.verticalAlignment = 'middle';
  container.accessibilityLabel = name;
  container.accessibilityRole = 'image';

  const fallbackLabel = new Label();
  fallbackLabel.text = getInitials(name);
  fallbackLabel.horizontalAlignment = 'center';
  fallbackLabel.verticalAlignment = 'middle';
  fallbackLabel.fontSize = dim * 0.4;
  container.addChild(fallbackLabel);

  if (src) {
    const img = new Image();
    img.src = src;
    img.width = dim;
    img.height = dim;
    img.stretch = 'aspectFill';
    img.visibility = 'collapsed';

    img.on('loaded', () => {
      const show = () => {
        img.visibility = 'visible';
        fallbackLabel.visibility = 'collapsed';
      };
      if (delayMs > 0) {
        setTimeout(show, delayMs);
      } else {
        show();
      }
    });

    img.on('error', () => {
      img.visibility = 'collapsed';
      fallbackLabel.visibility = 'visible';
    });

    container.addChild(img);
  }

  return container;
}

export default createAvatar;
