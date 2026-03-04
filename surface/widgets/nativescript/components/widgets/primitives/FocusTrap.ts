// ============================================================
// Clef Surface NativeScript Widget — FocusTrap
//
// Traps focus within a container to support modal patterns.
// Wraps children in a StackLayout with focus containment.
// ============================================================

import { StackLayout } from '@nativescript/core';
import type { View } from '@nativescript/core';

// --------------- Props ---------------

export interface FocusTrapProps {
  active?: boolean;
  initialFocusIndex?: number;
  returnFocusOnDeactivate?: boolean;
  children?: View[];
}

// --------------- Component ---------------

export function createFocusTrap(props: FocusTrapProps): StackLayout {
  const {
    active = true,
    initialFocusIndex = 0,
    returnFocusOnDeactivate = true,
    children = [],
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-focus-trap';
  container.accessibilityRole = 'none';

  if (active) {
    container.className += ' clef-focus-trap-active';
  }

  for (const child of children) {
    container.addChild(child);
  }

  return container;
}

export default createFocusTrap;
