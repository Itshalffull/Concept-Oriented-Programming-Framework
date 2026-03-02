// ============================================================
// Clef Surface NativeScript Widget — Sidebar
//
// Sidebar navigation panel for NativeScript. Renders a
// vertically-scrolling navigation panel with a header area,
// grouped menu items, and an optional footer section. Can be
// positioned on the left or right side of the screen.
// ============================================================

import {
  StackLayout,
  GridLayout,
  ScrollView,
  Label,
  Color,
} from '@nativescript/core';

// --------------- Types ---------------

export interface SidebarItem {
  id: string;
  label: string;
  icon?: string;
  badge?: string;
  onTap?: () => void;
}

export interface SidebarGroup {
  title?: string;
  items: SidebarItem[];
  collapsible?: boolean;
}

// --------------- Props ---------------

export interface SidebarProps {
  header?: string;
  headerSubtitle?: string;
  groups?: SidebarGroup[];
  footerLabel?: string;
  activeItemId?: string;
  position?: 'left' | 'right';
  width?: number;
  backgroundColor?: string;
  headerColor?: string;
  textColor?: string;
  activeTextColor?: string;
  activeBackgroundColor?: string;
  sectionTitleColor?: string;
  badgeColor?: string;
  badgeTextColor?: string;
  footerColor?: string;
  borderColor?: string;
  padding?: number;
  onItemTap?: (itemId: string) => void;
}

// --------------- Component ---------------

export function createSidebar(props: SidebarProps = {}): StackLayout {
  const {
    header = '',
    headerSubtitle = '',
    groups = [],
    footerLabel = '',
    activeItemId = '',
    position = 'left',
    width = 260,
    backgroundColor = '#F9FAFB',
    headerColor = '#111827',
    textColor = '#374151',
    activeTextColor = '#2563EB',
    activeBackgroundColor = '#EFF6FF',
    sectionTitleColor = '#9CA3AF',
    badgeColor = '#EF4444',
    badgeTextColor = '#FFFFFF',
    footerColor = '#9CA3AF',
    borderColor = '#E5E7EB',
    padding = 12,
    onItemTap,
  } = props;

  const container = new StackLayout();
  container.className = `clef-sidebar clef-sidebar-${position}`;
  container.width = width;
  container.backgroundColor = new Color(backgroundColor);

  if (position === 'left') {
    container.borderRightWidth = 1;
  } else {
    container.borderLeftWidth = 1;
  }
  container.borderColor = new Color(borderColor);

  // Header
  if (header) {
    const headerContainer = new StackLayout();
    headerContainer.className = 'clef-sidebar-header';
    headerContainer.padding = `${padding + 4} ${padding} ${padding} ${padding}`;
    headerContainer.borderBottomWidth = 1;
    headerContainer.borderColor = new Color(borderColor);

    const headerLabel = new Label();
    headerLabel.text = header;
    headerLabel.color = new Color(headerColor);
    headerLabel.fontWeight = 'bold';
    headerLabel.fontSize = 18;
    headerContainer.addChild(headerLabel);

    if (headerSubtitle) {
      const subtitleLabel = new Label();
      subtitleLabel.text = headerSubtitle;
      subtitleLabel.color = new Color(sectionTitleColor);
      subtitleLabel.fontSize = 12;
      subtitleLabel.marginTop = 2;
      headerContainer.addChild(subtitleLabel);
    }

    container.addChild(headerContainer);
  }

  // Scrollable nav content
  const scrollView = new ScrollView();
  scrollView.className = 'clef-sidebar-scroll';
  scrollView.verticalAlignment = 'top';

  const navContent = new StackLayout();
  navContent.className = 'clef-sidebar-nav';
  navContent.padding = padding;

  groups.forEach((group, groupIndex) => {
    if (group.title) {
      const sectionTitle = new Label();
      sectionTitle.text = group.title.toUpperCase();
      sectionTitle.className = 'clef-sidebar-section-title';
      sectionTitle.color = new Color(sectionTitleColor);
      sectionTitle.fontSize = 11;
      sectionTitle.fontWeight = 'bold';
      sectionTitle.letterSpacing = 0.8;
      sectionTitle.marginTop = groupIndex > 0 ? 16 : 0;
      sectionTitle.marginBottom = 6;
      navContent.addChild(sectionTitle);
    }

    group.items.forEach((item) => {
      const isActive = item.id === activeItemId;

      const row = new GridLayout();
      row.className = isActive ? 'clef-sidebar-item clef-sidebar-item-active' : 'clef-sidebar-item';
      row.columns = 'auto, *, auto';
      row.padding = 10;
      row.borderRadius = 6;
      row.backgroundColor = new Color(isActive ? activeBackgroundColor : 'transparent');
      row.marginBottom = 2;

      if (item.icon) {
        const iconLabel = new Label();
        iconLabel.text = item.icon;
        iconLabel.fontSize = 16;
        iconLabel.color = new Color(isActive ? activeTextColor : textColor);
        iconLabel.marginRight = 10;
        iconLabel.verticalAlignment = 'middle';
        GridLayout.setColumn(iconLabel, 0);
        row.addChild(iconLabel);
      }

      const labelView = new Label();
      labelView.text = item.label;
      labelView.fontSize = 14;
      labelView.fontWeight = isActive ? 'bold' : 'normal';
      labelView.color = new Color(isActive ? activeTextColor : textColor);
      labelView.verticalAlignment = 'middle';
      GridLayout.setColumn(labelView, 1);
      row.addChild(labelView);

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

      row.on('tap', () => {
        if (item.onTap) item.onTap();
        if (onItemTap) onItemTap(item.id);
      });

      navContent.addChild(row);
    });
  });

  scrollView.content = navContent;
  container.addChild(scrollView);

  // Footer
  if (footerLabel) {
    const footer = new StackLayout();
    footer.className = 'clef-sidebar-footer';
    footer.padding = padding;
    footer.borderTopWidth = 1;
    footer.borderColor = new Color(borderColor);
    footer.verticalAlignment = 'bottom';

    const footerText = new Label();
    footerText.text = footerLabel;
    footerText.color = new Color(footerColor);
    footerText.fontSize = 12;
    footerText.horizontalAlignment = 'center';
    footer.addChild(footerText);

    container.addChild(footer);
  }

  return container;
}

createSidebar.displayName = 'Sidebar';
export default createSidebar;
