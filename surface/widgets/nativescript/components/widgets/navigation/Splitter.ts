// ============================================================
// Clef Surface NativeScript Widget — Splitter
//
// Resizable split pane layout with draggable divider.
// ============================================================

import { GridLayout, StackLayout, Label } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface SplitterProps {
  orientation?: 'horizontal' | 'vertical';
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  children?: View[];
  onResize?: (size: number) => void;
}

export function createSplitter(props: SplitterProps): GridLayout {
  const {
    orientation = 'horizontal', defaultSize = 50,
    minSize = 10, maxSize = 90, children = [], onResize,
  } = props;

  const container = new GridLayout();
  container.className = `clef-widget-splitter clef-orientation-${orientation}`;

  if (children[0]) container.addChild(children[0]);

  const handle = new StackLayout();
  handle.className = 'clef-splitter-handle';
  handle.width = orientation === 'horizontal' ? 4 : undefined;
  handle.height = orientation === 'vertical' ? 4 : undefined;
  handle.accessibilityRole = 'adjustable';
  handle.accessibilityLabel = 'Resize handle';
  container.addChild(handle);

  if (children[1]) container.addChild(children[1]);

  return container;
}

export default createSplitter;
