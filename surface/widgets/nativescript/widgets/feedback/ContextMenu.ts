// ============================================================
// Clef Surface NativeScript Widget — ContextMenu
//
// Context menu (analogous to right-click / long-press menu)
// rendered as an overlay list of action items. Each item can
// have a label, icon, optional shortcut hint, and a disabled
// state. Supports separators between groups of items.
// ============================================================

import { StackLayout, GridLayout, Label, Color, ContentView } from '@nativescript/core';

// --------------- Types ---------------

export interface ContextMenuItem {
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
  onTap?: () => void;
}

export interface ContextMenuSeparator {
  separator: true;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

// --------------- Props ---------------

export interface ContextMenuProps {
  items: ContextMenuEntry[];
  visible?: boolean;
  width?: number;
  backgroundColor?: string;
  borderRadius?: number;
  elevation?: number;
  onClose?: () => void;
}

// --------------- Helpers ---------------

function isSeparator(entry: ContextMenuEntry): entry is ContextMenuSeparator {
  return 'separator' in entry && entry.separator === true;
}

// --------------- Component ---------------

export function createContextMenu(props: ContextMenuProps = { items: [] }): StackLayout {
  const {
    items,
    visible = true,
    width = 220,
    backgroundColor = '#FFFFFF',
    borderRadius = 8,
    elevation = 8,
    onClose,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-context-menu';
  container.width = width;
  container.backgroundColor = backgroundColor as any;
  container.borderRadius = borderRadius;
  container.borderWidth = 1;
  container.borderColor = '#E0E0E0';
  container.androidElevation = elevation;
  container.padding = '4 0';
  container.visibility = visible ? 'visible' : 'collapse';

  items.forEach((entry) => {
    if (isSeparator(entry)) {
      // --- Separator ---
      const sep = new ContentView();
      sep.className = 'clef-context-menu-separator';
      sep.height = 1;
      sep.backgroundColor = '#E0E0E0' as any;
      sep.margin = '4 0';
      container.addChild(sep);
      return;
    }

    const item = entry as ContextMenuItem;
    const row = new GridLayout();
    row.className = item.destructive
      ? 'clef-context-menu-item clef-context-menu-item-destructive'
      : 'clef-context-menu-item';
    row.columns = 'auto, *, auto';
    row.padding = '10 16';
    row.opacity = item.disabled ? 0.38 : 1;

    // --- Icon ---
    if (item.icon) {
      const iconLabel = new Label();
      iconLabel.text = item.icon;
      iconLabel.className = 'clef-context-menu-icon';
      iconLabel.fontSize = 16;
      iconLabel.verticalAlignment = 'middle';
      iconLabel.marginRight = 12;
      iconLabel.color = item.destructive ? new Color('#D32F2F') : new Color('#424242');
      GridLayout.setColumn(iconLabel, 0);
      row.addChild(iconLabel);
    }

    // --- Label ---
    const labelView = new Label();
    labelView.text = item.label;
    labelView.className = 'clef-context-menu-label';
    labelView.fontSize = 14;
    labelView.verticalAlignment = 'middle';
    labelView.color = item.destructive ? new Color('#D32F2F') : new Color('#212121');
    labelView.textWrap = false;
    GridLayout.setColumn(labelView, 1);
    row.addChild(labelView);

    // --- Shortcut hint ---
    if (item.shortcut) {
      const shortcutLabel = new Label();
      shortcutLabel.text = item.shortcut;
      shortcutLabel.className = 'clef-context-menu-shortcut';
      shortcutLabel.fontSize = 12;
      shortcutLabel.color = new Color('#9E9E9E');
      shortcutLabel.verticalAlignment = 'middle';
      shortcutLabel.marginLeft = 16;
      GridLayout.setColumn(shortcutLabel, 2);
      row.addChild(shortcutLabel);
    }

    // --- Tap handler ---
    if (!item.disabled && item.onTap) {
      const handler = item.onTap;
      row.on('tap', () => {
        handler();
        container.visibility = 'collapse';
        if (onClose) onClose();
      });
    }

    container.addChild(row);
  });

  return container;
}

createContextMenu.displayName = 'ContextMenu';
export default createContextMenu;
