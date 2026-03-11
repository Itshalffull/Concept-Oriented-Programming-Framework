// ============================================================
// Clef Surface NativeScript Widget — FloatingToolbar
//
// Floating action toolbar that can be repositioned.
// ============================================================

import { StackLayout } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface FloatingToolbarProps {
  visible?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children?: View[];
}

export function createFloatingToolbar(props: FloatingToolbarProps): StackLayout {
  const { visible = true, position = 'bottom', children = [] } = props;
  const container = new StackLayout();
  container.className = `clef-widget-floating-toolbar clef-position-${position}`;
  container.orientation = 'horizontal';
  container.visibility = visible ? 'visible' : 'collapsed';
  container.accessibilityRole = 'toolbar';
  for (const child of children) container.addChild(child);
  return container;
}

export default createFloatingToolbar;
