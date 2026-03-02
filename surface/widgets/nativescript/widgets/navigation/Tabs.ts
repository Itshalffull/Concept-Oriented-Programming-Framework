// ============================================================
// Clef Surface NativeScript Widget — Tabs
//
// Tabbed navigation for NativeScript. Renders a horizontal
// strip of tab buttons with an active indicator, plus a
// content area that swaps visibility based on the selected
// tab index.
// ============================================================

import {
  StackLayout,
  GridLayout,
  FlexboxLayout,
  ScrollView,
  Label,
  Color,
} from '@nativescript/core';

// --------------- Types ---------------

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  badge?: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface TabsProps {
  tabs?: TabItem[];
  activeTabId?: string;
  variant?: 'underline' | 'pill' | 'enclosed';
  scrollable?: boolean;
  onTabChange?: (tabId: string) => void;
  backgroundColor?: string;
  tabBarBackgroundColor?: string;
  textColor?: string;
  activeTextColor?: string;
  activeIndicatorColor?: string;
  disabledColor?: string;
  badgeColor?: string;
  badgeTextColor?: string;
  borderColor?: string;
  fontSize?: number;
  tabPadding?: number;
  gap?: number;
}

// --------------- Component ---------------

export function createTabs(props: TabsProps = {}): StackLayout {
  const {
    tabs = [],
    activeTabId = tabs.length > 0 ? tabs[0].id : '',
    variant = 'underline',
    scrollable = false,
    onTabChange,
    backgroundColor = '#FFFFFF',
    tabBarBackgroundColor = '#FFFFFF',
    textColor = '#6B7280',
    activeTextColor = '#2563EB',
    activeIndicatorColor = '#2563EB',
    disabledColor = '#D1D5DB',
    badgeColor = '#EF4444',
    badgeTextColor = '#FFFFFF',
    borderColor = '#E5E7EB',
    fontSize = 14,
    tabPadding = 12,
    gap = 0,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-tabs';
  container.backgroundColor = new Color(backgroundColor);

  // Tab bar
  const tabBarOuter = scrollable ? new ScrollView() : undefined;
  if (tabBarOuter) {
    tabBarOuter.orientation = 'horizontal';
    tabBarOuter.className = 'clef-tabs-bar-scroll';
  }

  const tabBar = new FlexboxLayout();
  tabBar.className = `clef-tabs-bar clef-tabs-bar-${variant}`;
  tabBar.flexDirection = 'row';
  tabBar.backgroundColor = new Color(tabBarBackgroundColor);

  if (variant === 'underline') {
    tabBar.borderBottomWidth = 1;
    tabBar.borderColor = new Color(borderColor);
  } else if (variant === 'enclosed') {
    tabBar.borderBottomWidth = 1;
    tabBar.borderColor = new Color(borderColor);
  }

  const tabButtons: StackLayout[] = [];

  tabs.forEach((tab) => {
    const isActive = tab.id === activeTabId;
    const isDisabled = !!tab.disabled;

    const tabButton = new StackLayout();
    tabButton.className = isActive
      ? 'clef-tabs-tab clef-tabs-tab-active'
      : isDisabled
        ? 'clef-tabs-tab clef-tabs-tab-disabled'
        : 'clef-tabs-tab';
    tabButton.padding = tabPadding;
    tabButton.horizontalAlignment = 'center';
    tabButton.isUserInteractionEnabled = !isDisabled;
    tabButton.opacity = isDisabled ? 0.5 : 1;
    tabButton.marginRight = gap;

    // Variant styling
    if (variant === 'underline' && isActive) {
      tabButton.borderBottomWidth = 2;
      tabButton.borderColor = new Color(activeIndicatorColor);
    } else if (variant === 'pill') {
      tabButton.borderRadius = 20;
      if (isActive) {
        tabButton.backgroundColor = new Color(activeIndicatorColor);
      }
    } else if (variant === 'enclosed' && isActive) {
      tabButton.borderWidth = 1;
      tabButton.borderBottomWidth = 0;
      tabButton.borderColor = new Color(borderColor);
      tabButton.borderRadius = 6;
      tabButton.backgroundColor = new Color(backgroundColor);
    }

    // Inner layout
    const inner = new FlexboxLayout();
    inner.flexDirection = 'row';
    inner.alignItems = 'center';
    inner.justifyContent = 'center';

    if (tab.icon) {
      const iconLabel = new Label();
      iconLabel.text = tab.icon;
      iconLabel.fontSize = 16;
      iconLabel.marginRight = 6;
      iconLabel.color = new Color(
        isDisabled ? disabledColor : isActive ? (variant === 'pill' ? '#FFFFFF' : activeTextColor) : textColor
      );
      inner.addChild(iconLabel);
    }

    const labelView = new Label();
    labelView.text = tab.label;
    labelView.fontSize = fontSize;
    labelView.fontWeight = isActive ? 'bold' : 'normal';
    labelView.color = new Color(
      isDisabled ? disabledColor : isActive ? (variant === 'pill' ? '#FFFFFF' : activeTextColor) : textColor
    );
    inner.addChild(labelView);

    if (tab.badge) {
      const badge = new Label();
      badge.text = tab.badge;
      badge.fontSize = 10;
      badge.fontWeight = 'bold';
      badge.color = new Color(badgeTextColor);
      badge.backgroundColor = new Color(badgeColor);
      badge.borderRadius = 8;
      badge.padding = '1 5';
      badge.marginLeft = 6;
      badge.verticalAlignment = 'middle';
      inner.addChild(badge);
    }

    tabButton.addChild(inner);

    if (!isDisabled) {
      tabButton.on('tap', () => {
        if (onTabChange) onTabChange(tab.id);
      });
    }

    tabBar.addChild(tabButton);
    tabButtons.push(tabButton);
  });

  if (tabBarOuter) {
    tabBarOuter.content = tabBar;
    container.addChild(tabBarOuter);
  } else {
    container.addChild(tabBar);
  }

  // Content area placeholder
  const contentArea = new StackLayout();
  contentArea.className = 'clef-tabs-content';
  contentArea.padding = tabPadding;
  container.addChild(contentArea);

  return container;
}

createTabs.displayName = 'Tabs';
export default createTabs;
