// ============================================================
// Clef Surface NativeScript Widget — NavigationWidgets
//
// Navigation helper widgets for NativeScript. Provides a set
// of small, composable navigation primitives: back button,
// forward button, close button, and a combined navigation
// bar strip with title and leading/trailing action slots.
// ============================================================

import {
  StackLayout,
  GridLayout,
  FlexboxLayout,
  Label,
  Button,
  Color,
} from '@nativescript/core';

// --------------- Types ---------------

export interface NavAction {
  icon?: string;
  label?: string;
  onTap?: () => void;
}

// --------------- Props ---------------

export interface NavigationWidgetsProps {
  title?: string;
  subtitle?: string;
  leading?: NavAction[];
  trailing?: NavAction[];
  showBackButton?: boolean;
  onBack?: () => void;
  backgroundColor?: string;
  titleColor?: string;
  subtitleColor?: string;
  actionColor?: string;
  borderColor?: string;
  height?: number;
  padding?: number;
}

// --------------- Helpers ---------------

function createActionButton(action: NavAction, color: string): StackLayout {
  const btn = new StackLayout();
  btn.className = 'clef-nav-action';
  btn.padding = 8;
  btn.horizontalAlignment = 'center';
  btn.verticalAlignment = 'middle';

  if (action.icon) {
    const iconLabel = new Label();
    iconLabel.text = action.icon;
    iconLabel.fontSize = 18;
    iconLabel.color = new Color(color);
    iconLabel.horizontalAlignment = 'center';
    btn.addChild(iconLabel);
  }

  if (action.label) {
    const labelView = new Label();
    labelView.text = action.label;
    labelView.fontSize = 12;
    labelView.color = new Color(color);
    labelView.horizontalAlignment = 'center';
    btn.addChild(labelView);
  }

  if (action.onTap) {
    btn.on('tap', action.onTap);
  }

  return btn;
}

// --------------- Component ---------------

export function createNavigationWidgets(props: NavigationWidgetsProps = {}): GridLayout {
  const {
    title = '',
    subtitle = '',
    leading = [],
    trailing = [],
    showBackButton = false,
    onBack,
    backgroundColor = '#FFFFFF',
    titleColor = '#111827',
    subtitleColor = '#6B7280',
    actionColor = '#2563EB',
    borderColor = '#E5E7EB',
    height = 56,
    padding = 8,
  } = props;

  const container = new GridLayout();
  container.className = 'clef-navigation-widgets';
  container.columns = 'auto, *, auto';
  container.height = height;
  container.backgroundColor = new Color(backgroundColor);
  container.borderBottomWidth = 1;
  container.borderColor = new Color(borderColor);
  container.padding = padding;

  // Leading actions
  const leadingSlot = new FlexboxLayout();
  leadingSlot.className = 'clef-navigation-widgets-leading';
  leadingSlot.flexDirection = 'row';
  leadingSlot.alignItems = 'center';
  GridLayout.setColumn(leadingSlot, 0);

  if (showBackButton) {
    const backAction: NavAction = { icon: '\u2190', onTap: onBack };
    leadingSlot.addChild(createActionButton(backAction, actionColor));
  }

  leading.forEach((action) => {
    leadingSlot.addChild(createActionButton(action, actionColor));
  });

  container.addChild(leadingSlot);

  // Center — title and subtitle
  const centerSlot = new StackLayout();
  centerSlot.className = 'clef-navigation-widgets-center';
  centerSlot.verticalAlignment = 'middle';
  centerSlot.horizontalAlignment = 'center';
  GridLayout.setColumn(centerSlot, 1);

  if (title) {
    const titleLabel = new Label();
    titleLabel.text = title;
    titleLabel.color = new Color(titleColor);
    titleLabel.fontWeight = 'bold';
    titleLabel.fontSize = 17;
    titleLabel.horizontalAlignment = 'center';
    centerSlot.addChild(titleLabel);
  }

  if (subtitle) {
    const subtitleLabel = new Label();
    subtitleLabel.text = subtitle;
    subtitleLabel.color = new Color(subtitleColor);
    subtitleLabel.fontSize = 12;
    subtitleLabel.horizontalAlignment = 'center';
    centerSlot.addChild(subtitleLabel);
  }

  container.addChild(centerSlot);

  // Trailing actions
  const trailingSlot = new FlexboxLayout();
  trailingSlot.className = 'clef-navigation-widgets-trailing';
  trailingSlot.flexDirection = 'row';
  trailingSlot.alignItems = 'center';
  GridLayout.setColumn(trailingSlot, 2);

  trailing.forEach((action) => {
    trailingSlot.addChild(createActionButton(action, actionColor));
  });

  container.addChild(trailingSlot);

  return container;
}

createNavigationWidgets.displayName = 'NavigationWidgets';
export default createNavigationWidgets;
