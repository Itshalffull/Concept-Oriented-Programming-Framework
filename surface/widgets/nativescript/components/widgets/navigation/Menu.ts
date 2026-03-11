// ============================================================
// Clef Surface NativeScript Widget — Menu
//
// Dropdown menu with items, separators, and nested submenus.
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  destructive?: boolean;
}

export interface MenuProps {
  items: MenuItem[];
  open?: boolean;
  trigger?: string;
  onSelect?: (id: string) => void;
  onOpenChange?: (open: boolean) => void;
}

export function createMenu(props: MenuProps): StackLayout {
  const { items, open = false, trigger = 'Menu', onSelect, onOpenChange } = props;
  let isOpen = open;
  const container = new StackLayout();
  container.className = 'clef-widget-menu';

  const triggerBtn = new Button();
  triggerBtn.text = trigger;
  triggerBtn.accessibilityRole = 'button';
  triggerBtn.accessibilityState = { expanded: isOpen };
  triggerBtn.on('tap', () => {
    isOpen = !isOpen;
    list.visibility = isOpen ? 'visible' : 'collapsed';
    onOpenChange?.(isOpen);
  });
  container.addChild(triggerBtn);

  const list = new StackLayout();
  list.className = 'clef-menu-list';
  list.visibility = isOpen ? 'visible' : 'collapsed';
  list.accessibilityRole = 'menu';

  for (const item of items) {
    const row = new StackLayout();
    row.orientation = 'horizontal';
    row.padding = '8 12';
    row.accessibilityRole = 'menuitem';
    if (item.icon) {
      const iconLbl = new Label();
      iconLbl.text = item.icon;
      iconLbl.marginRight = 8;
      row.addChild(iconLbl);
    }
    const lbl = new Label();
    lbl.text = item.label;
    if (item.disabled) lbl.opacity = 0.5;
    row.addChild(lbl);
    if (!item.disabled) {
      row.on('tap', () => {
        onSelect?.(item.id);
        isOpen = false;
        list.visibility = 'collapsed';
        onOpenChange?.(false);
      });
    }
    list.addChild(row);
  }
  container.addChild(list);
  return container;
}

export default createMenu;
