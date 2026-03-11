// ============================================================
// Clef Surface NativeScript Widget — Presence
//
// Manages mount/unmount animations for child views. Controls
// visibility transitions based on present state.
// ============================================================

import { StackLayout } from '@nativescript/core';
import type { View } from '@nativescript/core';

// --------------- Props ---------------

export interface PresenceProps {
  present?: boolean;
  forceMount?: boolean;
  children?: View[];
  onExitComplete?: () => void;
}

// --------------- Component ---------------

export function createPresence(props: PresenceProps): StackLayout {
  const {
    present = true,
    forceMount = false,
    children = [],
    onExitComplete,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-presence';

  const shouldShow = present || forceMount;
  container.visibility = shouldShow ? 'visible' : 'collapsed';

  for (const child of children) {
    container.addChild(child);
  }

  if (!present && !forceMount) {
    onExitComplete?.();
  }

  return container;
}

export default createPresence;
