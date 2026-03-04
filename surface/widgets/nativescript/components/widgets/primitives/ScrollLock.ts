// ============================================================
// Clef Surface NativeScript Widget — ScrollLock
//
// Prevents scrolling on a parent scroll container while active.
// Used in conjunction with modals and overlays.
// ============================================================

import { StackLayout } from '@nativescript/core';
import type { View } from '@nativescript/core';

// --------------- Props ---------------

export interface ScrollLockProps {
  active?: boolean;
  children?: View[];
}

// --------------- Component ---------------

export function createScrollLock(props: ScrollLockProps): StackLayout {
  const { active = true, children = [] } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-scroll-lock';

  if (active) {
    container.className += ' clef-scroll-locked';
    container.isUserInteractionEnabled = false;
  }

  for (const child of children) {
    container.addChild(child);
  }

  return container;
}

export default createScrollLock;
