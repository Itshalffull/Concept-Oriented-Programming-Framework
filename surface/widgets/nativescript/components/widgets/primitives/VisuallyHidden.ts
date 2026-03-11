// ============================================================
// Clef Surface NativeScript Widget — VisuallyHidden
//
// Hides content visually while keeping it accessible to screen
// readers. Sets zero dimensions and clips overflow.
// ============================================================

import { StackLayout } from '@nativescript/core';
import type { View } from '@nativescript/core';

// --------------- Props ---------------

export interface VisuallyHiddenProps {
  children?: View[];
}

// --------------- Component ---------------

export function createVisuallyHidden(props: VisuallyHiddenProps): StackLayout {
  const { children = [] } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-visually-hidden';
  container.width = 1;
  container.height = 1;
  container.opacity = 0;
  container.clipToBounds = true;

  for (const child of children) {
    container.addChild(child);
  }

  return container;
}

export default createVisuallyHidden;
