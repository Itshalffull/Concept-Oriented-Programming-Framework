// ============================================================
// Clef Surface NativeScript Widget — ColorLabelPicker
//
// Label with color selection. Displays a palette of predefined
// colours and renders the selected colour alongside a text
// label. Supports custom colours, selection callbacks, and
// disabled state.
// ============================================================

import {
  StackLayout,
  GridLayout,
  WrapLayout,
  Label,
  Button,
  Color,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export interface LabelDef {
  text: string;
  color: string;
}

export interface ColorLabelPickerProps {
  labels?: LabelDef[];
  selectedIndex?: number;
  palette?: string[];
  showPalette?: boolean;
  showHexInput?: boolean;
  swatchSize?: number;
  columns?: number;
  disabled?: boolean;
  accentColor?: string;
  onSelect?: (index: number, label: LabelDef) => void;
  onColorChange?: (index: number, color: string) => void;
  onAddLabel?: () => void;
  onRemoveLabel?: (index: number) => void;
}

// --------------- Default Palette ---------------

const DEFAULT_PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#ffffff',
  '#000000', '#f59e0b', '#10b981', '#6366f1', '#d946ef',
  '#14b8a6', '#f43f5e', '#84cc16', '#0ea5e9', '#a855f7',
];

// --------------- Component ---------------

export function createColorLabelPicker(props: ColorLabelPickerProps = {}): StackLayout {
  const {
    labels = [],
    selectedIndex,
    palette = DEFAULT_PALETTE,
    showPalette = true,
    showHexInput = false,
    swatchSize = 28,
    columns = 5,
    disabled = false,
    accentColor = '#06b6d4',
    onSelect,
    onColorChange,
    onAddLabel,
    onRemoveLabel,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-color-label-picker';
  container.padding = 8;

  // Label list
  const labelList = new StackLayout();
  labelList.marginBottom = 8;

  labels.forEach((labelDef, index) => {
    const isSelected = index === selectedIndex;

    const row = new GridLayout();
    row.columns = 'auto, *, auto';
    row.padding = 6;
    row.marginBottom = 2;
    row.borderRadius = 4;
    row.borderWidth = isSelected ? 2 : 1;
    row.borderColor = new Color(isSelected ? accentColor : '#333333');

    // Colour swatch
    const swatch = new Label();
    swatch.text = ' ';
    swatch.width = 20;
    swatch.height = 20;
    swatch.borderRadius = 4;
    swatch.backgroundColor = new Color(labelDef.color);
    swatch.borderWidth = 1;
    swatch.borderColor = new Color('#555555');
    swatch.marginRight = 8;
    swatch.verticalAlignment = 'middle';
    GridLayout.setColumn(swatch, 0);
    row.addChild(swatch);

    // Label text
    const textLabel = new Label();
    textLabel.text = labelDef.text;
    textLabel.color = new Color('#e0e0e0');
    textLabel.verticalAlignment = 'middle';
    textLabel.fontSize = 13;
    GridLayout.setColumn(textLabel, 1);
    row.addChild(textLabel);

    // Remove button
    if (!disabled) {
      const removeBtn = new Button();
      removeBtn.text = '\u2716';
      removeBtn.fontSize = 10;
      removeBtn.width = 24;
      removeBtn.height = 24;
      removeBtn.on('tap', () => onRemoveLabel?.(index));
      GridLayout.setColumn(removeBtn, 2);
      row.addChild(removeBtn);
    }

    if (!disabled) {
      row.on(GestureTypes.tap as any, () => onSelect?.(index, labelDef));
    }

    labelList.addChild(row);
  });

  // Empty state
  if (labels.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No labels defined';
    emptyLabel.opacity = 0.4;
    emptyLabel.horizontalAlignment = 'center';
    labelList.addChild(emptyLabel);
  }

  container.addChild(labelList);

  // Add label button
  if (!disabled) {
    const addBtn = new Button();
    addBtn.text = '+ Add Label';
    addBtn.fontSize = 12;
    addBtn.horizontalAlignment = 'left';
    addBtn.marginBottom = 8;
    addBtn.on('tap', () => onAddLabel?.());
    container.addChild(addBtn);
  }

  // Colour palette
  if (showPalette && selectedIndex !== undefined && selectedIndex >= 0) {
    const paletteHeader = new Label();
    paletteHeader.text = 'Pick Colour';
    paletteHeader.fontSize = 11;
    paletteHeader.opacity = 0.5;
    paletteHeader.marginBottom = 4;
    container.addChild(paletteHeader);

    const paletteGrid = new WrapLayout();
    paletteGrid.orientation = 'horizontal';

    palette.forEach((c) => {
      const swatch = new StackLayout();
      swatch.width = swatchSize;
      swatch.height = swatchSize;
      swatch.borderRadius = 4;
      swatch.backgroundColor = new Color(c);
      swatch.marginRight = 4;
      swatch.marginBottom = 4;
      swatch.borderWidth = 2;

      const isCurrentColor = labels[selectedIndex] && labels[selectedIndex].color === c;
      swatch.borderColor = new Color(isCurrentColor ? accentColor : '#33333300');

      if (isCurrentColor) {
        const checkmark = new Label();
        checkmark.text = '\u2714';
        checkmark.color = new Color(c === '#ffffff' || c === '#000000' ? '#888888' : '#ffffff');
        checkmark.fontSize = 12;
        checkmark.horizontalAlignment = 'center';
        checkmark.verticalAlignment = 'middle';
        swatch.addChild(checkmark);
      }

      if (!disabled) {
        swatch.on(GestureTypes.tap as any, () => onColorChange?.(selectedIndex, c));
      }

      paletteGrid.addChild(swatch);
    });

    container.addChild(paletteGrid);
  }

  return container;
}

export default createColorLabelPicker;
