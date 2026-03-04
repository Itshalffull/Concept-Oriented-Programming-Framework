// ============================================================
// Clef Surface NativeScript Widget — Outliner
//
// Hierarchical outline editor with indentation and nesting.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';

export interface OutlineItem { id: string; text: string; children?: OutlineItem[]; collapsed?: boolean; }

export interface OutlinerProps {
  items?: OutlineItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onToggle?: (id: string) => void;
  onChange?: (id: string, text: string) => void;
}

export function createOutliner(props: OutlinerProps): StackLayout {
  const { items = [], selectedId, onSelect, onToggle, onChange } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-outliner';

  function renderItems(itemList, depth) {
    for (const item of itemList) {
      const row = new StackLayout();
      row.orientation = 'horizontal';
      row.paddingLeft = depth * 20;
      row.padding = `4 4 4 ${depth * 20}`;
      row.className = item.id === selectedId ? 'clef-outline-item-selected' : 'clef-outline-item';

      if (item.children && item.children.length > 0) {
        const expander = new Label();
        expander.text = item.collapsed ? '\u25B6' : '\u25BC';
        expander.marginRight = 4;
        expander.on('tap', () => onToggle?.(item.id));
        row.addChild(expander);
      } else {
        const bullet = new Label();
        bullet.text = '\u2022';
        bullet.marginRight = 4;
        row.addChild(bullet);
      }

      const textLabel = new Label();
      textLabel.text = item.text;
      textLabel.textWrap = true;
      row.addChild(textLabel);
      row.on('tap', () => onSelect?.(item.id));
      container.addChild(row);

      if (item.children && !item.collapsed) {
        renderItems(item.children, depth + 1);
      }
    }
  }
  renderItems(items, 0);
  return container;
}

export default createOutliner;
