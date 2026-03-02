// ============================================================
// Clef Surface NativeScript Widget — VisuallyHidden
//
// NativeScript accessibility-only content container. Content
// is hidden from visual display but remains accessible to
// screen readers via the accessibilityLabel property.
// ============================================================

import { StackLayout } from '@nativescript/core';

// --------------- Props ---------------

export interface VisuallyHiddenProps {
  accessibilityLabel?: string;
  accessibilityHint?: string;
  padding?: number;
}

// --------------- Component ---------------

export function createVisuallyHidden(props: VisuallyHiddenProps = {}): StackLayout {
  const {
    accessibilityLabel = '',
    accessibilityHint = '',
    padding = 0,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-visually-hidden';
  container.padding = padding;

  // Hide from visual display
  container.width = 1;
  container.height = 1;
  container.opacity = 0;
  container.marginLeft = -1;
  container.marginTop = -1;

  // Keep accessible to screen readers
  container.accessibilityLabel = accessibilityLabel;
  container.accessibilityHint = accessibilityHint;
  container.accessibilityHidden = false;

  // Prevent the element from affecting layout flow
  container.isLayoutValid = false as any;

  return container;
}

createVisuallyHidden.displayName = 'VisuallyHidden';
export default createVisuallyHidden;
