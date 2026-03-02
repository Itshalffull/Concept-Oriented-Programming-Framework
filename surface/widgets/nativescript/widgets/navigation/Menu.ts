// ============================================================
// Clef Surface NativeScript Widget — Menu
//
// Dropdown/popup menu for NativeScript. Renders a vertical
// list of menu items, each with an optional icon, label,
// shortcut hint, and submenu indicator. Supports dividers
// and disabled items.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Color,
} from '@nativescript/core';

// --------------- Types ---------------

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  dividerAfter?: boolean;
  onTap?: () => void;
}

// --------------- Props ---------------

export interface MenuProps {
  items?: MenuItem[];
  width?: number;
  backgroundColor?: string;
  textColor?: string;
  disabledColor?: string;
  hoverColor?: string;
  iconColor?: string;
  shortcutColor?: string;
  dividerColor?: string;
  borderColor?: string;
  borderRadius?: number;
  elevation?: number;
  padding?: number;
}

// --------------- Component ---------------

export function createMenu(props: MenuProps = {}): StackLayout {
  const {
    items = [],
    width = 220,
    backgroundColor = '#FFFFFF',
    textColor = '#111827',
    disabledColor = '#D1D5DB',
    hoverColor = '#F3F4F6',
    iconColor = '#6B7280',
    shortcutColor = '#9CA3AF',
    dividerColor = '#E5E7EB',
    borderColor = '#E5E7EB',
    borderRadius = 8,
    elevation = 8,
    padding = 4,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-menu';
  container.width = width;
  container.backgroundColor = new Color(backgroundColor);
  container.borderRadius = borderRadius;
  container.borderWidth = 1;
  container.borderColor = new Color(borderColor);
  container.padding = padding;
  container.androidElevation = elevation;

  items.forEach((item) => {
    const row = new GridLayout();
    row.className = item.disabled ? 'clef-menu-item clef-menu-item-disabled' : 'clef-menu-item';
    row.columns = 'auto, *, auto';
    row.padding = 10;
    row.borderRadius = 4;
    row.isUserInteractionEnabled = !item.disabled;

    // Icon column
    if (item.icon) {
      const iconLabel = new Label();
      iconLabel.text = item.icon;
      iconLabel.fontSize = 16;
      iconLabel.color = new Color(item.disabled ? disabledColor : iconColor);
      iconLabel.marginRight = 10;
      iconLabel.verticalAlignment = 'middle';
      GridLayout.setColumn(iconLabel, 0);
      row.addChild(iconLabel);
    }

    // Label column
    const labelView = new Label();
    labelView.text = item.label;
    labelView.fontSize = 14;
    labelView.color = new Color(item.disabled ? disabledColor : textColor);
    labelView.verticalAlignment = 'middle';
    GridLayout.setColumn(labelView, 1);
    row.addChild(labelView);

    // Shortcut column
    if (item.shortcut) {
      const shortcutLabel = new Label();
      shortcutLabel.text = item.shortcut;
      shortcutLabel.fontSize = 12;
      shortcutLabel.color = new Color(shortcutColor);
      shortcutLabel.verticalAlignment = 'middle';
      shortcutLabel.horizontalAlignment = 'right';
      GridLayout.setColumn(shortcutLabel, 2);
      row.addChild(shortcutLabel);
    }

    // Tap handling with highlight feedback
    if (item.onTap && !item.disabled) {
      row.on('tap', () => {
        row.backgroundColor = new Color(hoverColor);
        setTimeout(() => {
          row.backgroundColor = new Color('transparent');
        }, 150);
        item.onTap!();
      });
    }

    container.addChild(row);

    // Divider
    if (item.dividerAfter) {
      const divider = new StackLayout();
      divider.className = 'clef-menu-divider';
      divider.height = 1;
      divider.backgroundColor = new Color(dividerColor);
      divider.marginTop = 4;
      divider.marginBottom = 4;
      container.addChild(divider);
    }
  });

  return container;
}

createMenu.displayName = 'Menu';
export default createMenu;
