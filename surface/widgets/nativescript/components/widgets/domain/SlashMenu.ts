// ============================================================
// Clef Surface NativeScript Widget — SlashMenu
//
// Slash-command menu for inserting block types.
// ============================================================

import { StackLayout, Label, TextField } from '@nativescript/core';

export interface BlockTypeDef { id: string; label: string; description?: string; icon?: string; }

export interface SlashMenuProps {
  items?: BlockTypeDef[];
  open?: boolean;
  query?: string;
  onSelect?: (id: string) => void;
  onClose?: () => void;
}

export function createSlashMenu(props: SlashMenuProps): StackLayout {
  const { items = [], open = false, query = '', onSelect, onClose } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-slash-menu';
  container.visibility = open ? 'visible' : 'collapsed';
  container.accessibilityRole = 'menu';

  for (const item of items) {
    const row = new StackLayout();
    row.orientation = 'horizontal';
    row.padding = '8';
    if (item.icon) { const ic = new Label(); ic.text = item.icon; ic.marginRight = 8; row.addChild(ic); }
    const lbl = new Label();
    lbl.text = item.label;
    row.addChild(lbl);
    if (item.description) { const desc = new Label(); desc.text = item.description; desc.opacity = 0.5; desc.marginLeft = 8; row.addChild(desc); }
    row.on('tap', () => onSelect?.(item.id));
    container.addChild(row);
  }
  return container;
}

export default createSlashMenu;
