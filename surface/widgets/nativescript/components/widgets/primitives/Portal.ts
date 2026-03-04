// ============================================================
// Clef Surface NativeScript Widget — Portal
//
// Renders children into a separate visual layer. In NativeScript
// this wraps children in a detached container for overlay use.
// ============================================================

import { StackLayout } from '@nativescript/core';
import type { View } from '@nativescript/core';

// --------------- Props ---------------

export interface PortalProps {
  open?: boolean;
  children?: View[];
}

// --------------- Component ---------------

export function createPortal(props: PortalProps): StackLayout {
  const { open = true, children = [] } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-portal';
  container.visibility = open ? 'visible' : 'collapsed';

  for (const child of children) {
    container.addChild(child);
  }

  return container;
}

export default createPortal;
