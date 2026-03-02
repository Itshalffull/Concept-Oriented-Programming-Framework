// ============================================================
// Clef Surface NativeScript Widget — CheckboxGroup
//
// Group of checkboxes allowing multiple selections. Renders
// a list of tappable rows with check indicators and labels.
// Supports orientation, disabled state, and change callbacks.
// ============================================================

import { StackLayout, GridLayout, Label, Color } from '@nativescript/core';

// --------------- Types ---------------

export interface OptionItem {
  label: string;
  value: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface CheckboxGroupProps {
  options?: OptionItem[];
  selected?: string[];
  label?: string;
  orientation?: 'vertical' | 'horizontal';
  disabled?: boolean;
  accentColor?: string;
  onChange?: (selected: string[]) => void;
}

// --------------- Component ---------------

export function createCheckboxGroup(props: CheckboxGroupProps = {}): StackLayout {
  const {
    options = [],
    selected: initialSelected = [],
    label,
    orientation = 'vertical',
    disabled = false,
    accentColor = '#2196F3',
    onChange,
  } = props;

  const selectedSet = new Set(initialSelected);

  const container = new StackLayout();
  container.className = 'clef-checkbox-group';

  if (label) {
    const titleLabel = new Label();
    titleLabel.text = label;
    titleLabel.className = 'clef-checkbox-group-label';
    titleLabel.fontWeight = 'bold';
    titleLabel.marginBottom = 4;
    container.addChild(titleLabel);
  }

  const listContainer = new StackLayout();
  listContainer.className = 'clef-checkbox-group-list';
  if (orientation === 'horizontal') {
    listContainer.orientation = 'horizontal';
  }

  options.forEach((option) => {
    const row = new GridLayout();
    row.columns = 'auto, *';
    row.className = 'clef-checkbox-item';
    row.padding = 6;
    row.opacity = disabled || option.disabled ? 0.5 : 1;

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
          selectedSet.add(option.value);
          indicator.text = '☑';
          indicator.color = new Color(accentColor);
        }
        onChange?.([...selectedSet]);
      });
    }

    listContainer.addChild(row);
  });

  container.addChild(listContainer);
  return container;
}

createCheckboxGroup.displayName = 'CheckboxGroup';
export default createCheckboxGroup;
