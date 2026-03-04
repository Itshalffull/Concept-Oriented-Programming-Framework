// ============================================================
// Clef Surface NativeScript Widget — DataList
//
// Key-value pair list for displaying structured data.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';

export interface DataListItem { label: string; value: string; }

export interface DataListProps {
  items: DataListItem[];
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
}

export function createDataList(props: DataListProps): StackLayout {
  const { items, orientation = 'vertical', size = 'md' } = props;
  const container = new StackLayout();
  container.className = `clef-widget-data-list clef-size-${size}`;

  for (const item of items) {
    const row = new StackLayout();
    row.orientation = orientation === 'horizontal' ? 'horizontal' : 'vertical';
    row.padding = '4 0';

    const keyLabel = new Label();
    keyLabel.text = item.label;
    keyLabel.fontWeight = 'bold';
    keyLabel.opacity = 0.7;
    if (orientation === 'horizontal') keyLabel.marginRight = 8;
    row.addChild(keyLabel);

    const valueLabel = new Label();
    valueLabel.text = item.value;
    valueLabel.textWrap = true;
    row.addChild(valueLabel);

    container.addChild(row);
  }
  return container;
}

export default createDataList;
