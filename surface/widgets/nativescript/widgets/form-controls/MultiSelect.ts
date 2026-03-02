// ============================================================
// Clef Surface NativeScript Widget — MultiSelect
//
// Multi-select list showing all options with check indicators.
// Unlike ComboboxMulti, all options are always visible without
// a dropdown or search filter. Supports disabled items.
// ============================================================

import { StackLayout, GridLayout, Label, Color } from '@nativescript/core';

// --------------- Types ---------------

export interface MultiSelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface MultiSelectProps {
  options?: MultiSelectOption[];
  selected?: string[];
  label?: string;
  disabled?: boolean;
  maxSelections?: number;
  accentColor?: string;
  onChange?: (selected: string[]) => void;
}

// --------------- Component ---------------

export function createMultiSelect(props: MultiSelectProps = {}): StackLayout {
  const {
    options = [],
    selected: initialSelected = [],
    label,
    disabled = false,
    maxSelections,
    accentColor = '#2196F3',
    onChange,
  } = props;

  const selectedSet = new Set(initialSelected);

  const container = new StackLayout();
  container.className = 'clef-multi-select';
  container.opacity = disabled ? 0.5 : 1;

  if (label) {
    const titleLabel = new Label();
    titleLabel.text = label;
    titleLabel.className = 'clef-multi-select-label';
    titleLabel.fontWeight = 'bold';
    titleLabel.marginBottom = 4;
    container.addChild(titleLabel);
  }

  // Selection count
  const countLabel = new Label();
  countLabel.className = 'clef-multi-select-count';
  countLabel.text = `${selectedSet.size} selected`;
  countLabel.fontSize = 12;
  countLabel.opacity = 0.6;
  countLabel.marginBottom = 4;
  container.addChild(countLabel);

  // Options list
  options.forEach((option) => {
    const row = new GridLayout();
    row.columns = 'auto, *';
    row.className = 'clef-multi-select-item';
    row.padding = 6;
    row.opacity = option.disabled ? 0.5 : 1;

    const indicator = new Label();
    indicator.col = 0;
    indicator.text = selectedSet.has(option.value) ? '☑' : '☐';
    indicator.fontSize = 18;
    indicator.marginRight = 8;
    indicator.color = selectedSet.has(option.value) ? new Color(accentColor) : undefined;
    row.addChild(indicator);

    const optionLabel = new Label();
    optionLabel.col = 1;
    optionLabel.text = option.label;
    optionLabel.verticalAlignment = 'middle';
    row.addChild(optionLabel);

    if (!disabled && !option.disabled) {
      row.on('tap', () => {
        if (selectedSet.has(option.value)) {
          selectedSet.delete(option.value);
          indicator.text = '☐';
          indicator.color = undefined;
        } else {
          if (maxSelections !== undefined && selectedSet.size >= maxSelections) return;
          selectedSet.add(option.value);
          indicator.text = '☑';
          indicator.color = new Color(accentColor);
        }
        countLabel.text = `${selectedSet.size} selected`;
        onChange?.([...selectedSet]);
      });
    }

    container.addChild(row);
  });

  return container;
}

createMultiSelect.displayName = 'MultiSelect';
export default createMultiSelect;
