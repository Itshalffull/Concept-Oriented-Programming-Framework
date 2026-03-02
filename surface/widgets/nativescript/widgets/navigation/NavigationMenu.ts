// ============================================================
// Clef Surface NativeScript Widget — NavigationMenu
//
// Main app navigation for NativeScript. Renders a scrollable
// vertical list of navigation items, each with an icon, label,
// optional badge, and active-state highlighting. Supports
// grouped sections with section headers.
// ============================================================

import {
  StackLayout,
  GridLayout,
  ScrollView,
  Label,
  Color,
} from '@nativescript/core';

// --------------- Types ---------------

export interface NavigationItem {
  id: string;
  label: string;
  icon?: string;
  badge?: string;
  onTap?: () => void;
}

export interface NavigationGroup {
  title?: string;
  items: NavigationItem[];
}

// --------------- Props ---------------

export interface NavigationMenuProps {
  groups?: NavigationGroup[];
  activeItemId?: string;
  backgroundColor?: string;
  textColor?: string;
  activeTextColor?: string;
  activeBackgroundColor?: string;
  badgeColor?: string;
  badgeTextColor?: string;
  sectionTitleColor?: string;
  borderColor?: string;
  width?: number;
  padding?: number;
  itemPadding?: number;
  borderRadius?: number;
  onItemTap?: (itemId: string) => void;
}

// --------------- Component ---------------

export function createNavigationMenu(props: NavigationMenuProps = {}): StackLayout {
  const {
    groups = [],
    activeItemId = '',
    backgroundColor = '#FFFFFF',
    textColor = '#374151',
    activeTextColor = '#2563EB',
    activeBackgroundColor = '#EFF6FF',
    badgeColor = '#EF4444',
    badgeTextColor = '#FFFFFF',
    sectionTitleColor = '#9CA3AF',
    borderColor = '#E5E7EB',
    width = 260,
    padding = 8,
    itemPadding = 10,
    borderRadius = 8,
    onItemTap,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-navigation-menu';
  container.width = width;
  container.backgroundColor = new Color(backgroundColor);
  container.borderRadius = borderRadius;
  container.borderWidth = 1;
  container.borderColor = new Color(borderColor);

  const scrollView = new ScrollView();
  scrollView.className = 'clef-navigation-menu-scroll';

  const content = new StackLayout();
  content.className = 'clef-navigation-menu-content';
  content.padding = padding;

  groups.forEach((group, groupIndex) => {
    // Section header
    if (group.title) {
      const sectionTitle = new Label();
      sectionTitle.text = group.title.toUpperCase();
      sectionTitle.className = 'clef-navigation-menu-section-title';
      sectionTitle.color = new Color(sectionTitleColor);
      sectionTitle.fontSize = 11;
      sectionTitle.fontWeight = 'bold';
      sectionTitle.letterSpacing = 1;
      sectionTitle.padding = `${groupIndex > 0 ? 16 : 8} ${itemPadding} 6 ${itemPadding}`;
      content.addChild(sectionTitle);
    }

    // Navigation items
    group.items.forEach((item) => {
      const isActive = item.id === activeItemId;

      const row = new GridLayout();
      row.className = isActive ? 'clef-navigation-menu-item clef-navigation-menu-item-active' : 'clef-navigation-menu-item';
      row.columns = 'auto, *, auto';
      row.padding = itemPadding;
      row.borderRadius = 6;
      row.backgroundColor = new Color(isActive ? activeBackgroundColor : 'transparent');
      row.marginBottom = 2;

      // Icon
      if (item.icon) {
        const iconLabel = new Label();
        iconLabel.text = item.icon;
        iconLabel.fontSize = 18;
        iconLabel.color = new Color(isActive ? activeTextColor : textColor);
        iconLabel.marginRight = 10;
        iconLabel.verticalAlignment = 'middle';
        GridLayout.setColumn(iconLabel, 0);
        row.addChild(iconLabel);
      }

      // Label
      const labelView = new Label();
      labelView.text = item.label;
      labelView.fontSize = 14;
      labelView.fontWeight = isActive ? 'bold' : 'normal';
      labelView.color = new Color(isActive ? activeTextColor : textColor);
      labelView.verticalAlignment = 'middle';
      GridLayout.setColumn(labelView, 1);
      row.addChild(labelView);

      // Badge
      if (item.badge) {
        const badge = new Label();
        badge.text = item.badge;
        badge.fontSize = 11;
        badge.fontWeight = 'bold';
        badge.color = new Color(badgeTextColor);
        badge.backgroundColor = new Color(badgeColor);
        badge.borderRadius = 10;
        badge.padding = '2 6';
        badge.verticalAlignment = 'middle';
        badge.horizontalAlignment = 'right';
        GridLayout.setColumn(badge, 2);
        row.addChild(badge);
      }

      // Tap
      row.on('tap', () => {
        if (item.onTap) item.onTap();
        if (onItemTap) onItemTap(item.id);
      });

      content.addChild(row);
    });
  });

  scrollView.content = content;
  container.addChild(scrollView);

  return container;
}

createNavigationMenu.displayName = 'NavigationMenu';
export default createNavigationMenu;
