// ============================================================
// Clef Surface NativeScript Widget — ContextMenu
//
// Context menu triggered by long-press with menu items.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  destructive?: boolean;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  open?: boolean;
  onSelect?: (id: string) => void;
  onOpenChange?: (open: boolean) => void;
  children?: View[];
}

export function createContextMenu(props: ContextMenuProps): StackLayout {
  const { items, open = false, onSelect, onOpenChange, children = [] } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-context-menu';

  for (const child of children) container.addChild(child);

  const menu = new StackLayout();
  menu.className = 'clef-context-menu-list';
  menu.visibility = open ? 'visible' : 'collapsed';
  menu.accessibilityRole = 'menu';

  for (const item of items) {
    const menuItem = new StackLayout();
    menuItem.orientation = 'horizontal';
    menuItem.padding = '8 12';
    menuItem.accessibilityRole = 'menuitem';
    menuItem.accessibilityLabel = item.label;

    if (item.icon) {
      const iconLabel = new Label();
      iconLabel.text = item.icon;
      iconLabel.marginRight = 8;
      menuItem.addChild(iconLabel);
    }

    const label = new Label();
    label.text = item.label;
    if (item.disabled) label.opacity = 0.5;
    menuItem.addChild(label);

    if (!item.disabled) {
      menuItem.on('tap', () => {
        onSelect?.(item.id);
        onOpenChange?.(false);
      });
    }

    menu.addChild(menuItem);
  }

  container.addChild(menu);
  return container;
}

export default createContextMenu;
