// ============================================================
// Clef Surface NativeScript Widget — NavigationMenu
//
// Hierarchical navigation menu with groups and items.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';

export interface NavigationMenuItem {
  id: string;
  label: string;
  href?: string;
  icon?: string;
  children?: NavigationMenuItem[];
}

export interface NavigationMenuProps {
  items: NavigationMenuItem[];
  activeId?: string;
  orientation?: 'horizontal' | 'vertical';
  onNavigate?: (id: string, href?: string) => void;
}

export function createNavigationMenu(props: NavigationMenuProps): StackLayout {
  const { items, activeId, orientation = 'horizontal', onNavigate } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-navigation-menu';
  container.orientation = orientation === 'horizontal' ? 'horizontal' : 'vertical';
  container.accessibilityRole = 'navigation';

  for (const item of items) {
    const menuItem = new Label();
    menuItem.text = item.label;
    menuItem.className = item.id === activeId ? 'clef-nav-item-active' : 'clef-nav-item';
    menuItem.padding = '8 12';
    menuItem.on('tap', () => onNavigate?.(item.id, item.href));
    container.addChild(menuItem);
  }
  return container;
}

export default createNavigationMenu;
