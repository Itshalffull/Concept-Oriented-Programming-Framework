// ============================================================
// Clef Surface NativeScript Widget — Drawer
//
// Slide-in panel from screen edge.
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface DrawerProps {
  open?: boolean;
  side?: 'left' | 'right' | 'top' | 'bottom';
  title?: string;
  description?: string;
  closeOnOutsideClick?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: View[];
}

export function createDrawer(props: DrawerProps): StackLayout {
  const {
    open = false, side = 'right', title, description,
    closeOnOutsideClick = true, onOpenChange, children = [],
  } = props;

  const container = new StackLayout();
  container.className = `clef-widget-drawer clef-side-${side}`;
  container.visibility = open ? 'visible' : 'collapsed';
  container.accessibilityRole = 'none';

  if (title) {
    const titleLabel = new Label();
    titleLabel.text = title;
    titleLabel.fontWeight = 'bold';
    titleLabel.fontSize = 18;
    container.addChild(titleLabel);
  }

  if (description) {
    const desc = new Label();
    desc.text = description;
    desc.textWrap = true;
    desc.marginTop = 4;
    container.addChild(desc);
  }

  for (const child of children) container.addChild(child);

  const closeBtn = new Button();
  closeBtn.text = '\u2715';
  closeBtn.accessibilityLabel = 'Close drawer';
  closeBtn.on('tap', () => onOpenChange?.(false));
  container.addChild(closeBtn);

  return container;
}

export default createDrawer;
