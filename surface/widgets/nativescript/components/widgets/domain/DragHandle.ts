// ============================================================
// Clef Surface NativeScript Widget — DragHandle
//
// Drag handle indicator for reorderable items.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';

export interface DragHandleProps {
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
  label?: string;
}

export function createDragHandle(props: DragHandleProps): StackLayout {
  const { orientation = 'vertical', disabled = false, label = 'Drag to reorder' } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-drag-handle';
  container.isEnabled = !disabled;
  container.accessibilityLabel = label;
  container.accessibilityRole = 'button';
  const icon = new Label();
  icon.text = orientation === 'vertical' ? '\u2261' : '\u2550';
  icon.fontSize = 18;
  icon.opacity = disabled ? 0.3 : 0.6;
  container.addChild(icon);
  return container;
}

export default createDragHandle;
