// ============================================================
// Clef Surface NativeScript Widget — Toolbar
//
// Horizontal toolbar container for action buttons.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface ToolbarProps {
  ariaLabel?: string;
  orientation?: 'horizontal' | 'vertical';
  children?: View[];
}

export interface ToolbarGroupProps { children?: View[]; }
export interface ToolbarSeparatorProps {}

export function createToolbar(props: ToolbarProps): StackLayout {
  const { ariaLabel = 'Toolbar', orientation = 'horizontal', children = [] } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-toolbar';
  container.orientation = orientation === 'horizontal' ? 'horizontal' : 'vertical';
  container.accessibilityRole = 'toolbar';
  container.accessibilityLabel = ariaLabel;
  for (const child of children) container.addChild(child);
  return container;
}

export function createToolbarGroup(props: ToolbarGroupProps): StackLayout {
  const { children = [] } = props;
  const container = new StackLayout();
  container.className = 'clef-toolbar-group';
  container.orientation = 'horizontal';
  for (const child of children) container.addChild(child);
  return container;
}

export function createToolbarSeparator(): StackLayout {
  const sep = new StackLayout();
  sep.className = 'clef-toolbar-separator';
  sep.width = 1;
  return sep;
}

export default createToolbar;
