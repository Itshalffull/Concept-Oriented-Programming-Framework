// ============================================================
// Clef Surface NativeScript Widget — FocusTrap
//
// NativeScript focus trap container that constrains focus
// navigation within its child views. Useful for modal dialogs
// and overlay panels where focus should not escape.
// ============================================================

import { StackLayout, View } from '@nativescript/core';

// --------------- Props ---------------

export interface FocusTrapProps {
  active?: boolean;
  returnFocusOnDeactivate?: boolean;
  padding?: number;
}

// --------------- Component ---------------

export function createFocusTrap(props: FocusTrapProps = {}): StackLayout {
  const {
    active = true,
    returnFocusOnDeactivate = true,
    padding = 0,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-focus-trap';
  container.padding = padding;

  let previousFocus: View | null = null;
  let isActive = active;

  const activate = () => {
    isActive = true;
    container.className = 'clef-focus-trap clef-focus-trap--active';

    // Store reference to previously focused element
    const page = container.page;
    if (page) {
      previousFocus = (page as any).__clefLastFocused ?? null;
    }

    // Focus the first focusable child
    const firstChild = container.getChildAt(0);
    if (firstChild && typeof (firstChild as any).focus === 'function') {
      (firstChild as any).focus();
    }
  };

  const deactivate = () => {
    isActive = false;
    container.className = 'clef-focus-trap';

    // Return focus to the previously focused element
    if (returnFocusOnDeactivate && previousFocus) {
      if (typeof (previousFocus as any).focus === 'function') {
        (previousFocus as any).focus();
      }
      previousFocus = null;
    }
  };

  // Track focus movement within the container
  container.on('loaded', () => {
    if (isActive) {
      activate();
    }
  });

  (container as any).__clefFocusTrap = {
    activate,
    deactivate,
    get isActive() { return isActive; },
  };

  return container;
}

createFocusTrap.displayName = 'FocusTrap';
export default createFocusTrap;
