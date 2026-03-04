// ============================================================
// Clef Surface NativeScript Widget — ColorLabelPicker
//
// Labeled color tag selector for categorization.
// ============================================================

import { StackLayout, Label, Color } from '@nativescript/core';

export interface LabelDef { id: string; name: string; color: string; }

export interface ColorLabelPickerProps {
  labels?: LabelDef[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export function createColorLabelPicker(props: ColorLabelPickerProps): StackLayout {
  const { labels = [], selectedId, onSelect } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-color-label-picker';
  container.accessibilityRole = 'radiogroup';

  for (const lbl of labels) {
    const row = new StackLayout();
    row.orientation = 'horizontal';
    row.padding = '4 8';
    row.className = lbl.id === selectedId ? 'clef-label-selected' : 'clef-label';
    const dot = new StackLayout();
    dot.width = 12;
    dot.height = 12;
    dot.borderRadius = 6;
    dot.backgroundColor = new Color(lbl.color);
    dot.marginRight = 8;
    dot.verticalAlignment = 'middle';
    row.addChild(dot);
    const nameLabel = new Label();
    nameLabel.text = lbl.name;
    row.addChild(nameLabel);
    row.on('tap', () => onSelect?.(lbl.id));
    container.addChild(row);
  }
  return container;
}

export default createColorLabelPicker;
