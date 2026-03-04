// ============================================================
// Clef Surface NativeScript Widget — Sidebar
//
// Collapsible sidebar navigation with groups and items.
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';

export interface SidebarItem { id: string; label: string; icon?: string; href?: string; badge?: string; }
export interface SidebarGroup { label: string; items: SidebarItem[]; }

export interface SidebarProps {
  groups?: SidebarGroup[];
  items?: SidebarItem[];
  activeId?: string;
  collapsed?: boolean;
  collapsible?: boolean;
  onNavigate?: (id: string) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function createSidebar(props: SidebarProps): StackLayout {
  const {
    groups = [], items = [], activeId, collapsed = false,
    collapsible = true, onNavigate, onCollapsedChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-sidebar';
  container.accessibilityRole = 'navigation';

  if (collapsible) {
    const toggleBtn = new Button();
    toggleBtn.text = collapsed ? '\u25B6' : '\u25C0';
    toggleBtn.accessibilityLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    toggleBtn.on('tap', () => onCollapsedChange?.(!collapsed));
    container.addChild(toggleBtn);
  }

  const renderItems = (sidebarItems) => {
    for (const item of sidebarItems) {
      const row = new StackLayout();
      row.orientation = 'horizontal';
      row.padding = '8 12';
      row.className = item.id === activeId ? 'clef-sidebar-item-active' : 'clef-sidebar-item';
      if (item.icon && !collapsed) {
        const icon = new Label();
        icon.text = item.icon;
        icon.marginRight = 8;
        row.addChild(icon);
      }
      if (!collapsed) {
        const lbl = new Label();
        lbl.text = item.label;
        row.addChild(lbl);
      }
      row.on('tap', () => onNavigate?.(item.id));
      container.addChild(row);
    }
  };

  for (const group of groups) {
    if (!collapsed) {
      const groupLabel = new Label();
      groupLabel.text = group.label;
      groupLabel.fontWeight = 'bold';
      groupLabel.opacity = 0.6;
      groupLabel.padding = '8 12 4 12';
      groupLabel.fontSize = 11;
      container.addChild(groupLabel);
    }
    renderItems(group.items);
  }
  renderItems(items);

  return container;
}

export default createSidebar;
