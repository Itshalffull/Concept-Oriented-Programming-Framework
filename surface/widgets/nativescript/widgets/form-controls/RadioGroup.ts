// ============================================================
// Clef Surface NativeScript Widget — RadioGroup
//
// Group of radio buttons allowing single selection. Renders
// a list of tappable rows with radio indicators and labels.
// Supports orientation, disabled items, and change callbacks.
// ============================================================

import { StackLayout, GridLayout, Label, Color } from '@nativescript/core';

// --------------- Types ---------------

export interface OptionItem {
  label: string;
  value: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface RadioGroupProps {
  options?: OptionItem[];
  value?: string;
  label?: string;
  orientation?: 'vertical' | 'horizontal';
  disabled?: boolean;
  accentColor?: string;
  onChange?: (value: string) => void;
}

// --------------- Component ---------------

export function createRadioGroup(props: RadioGroupProps = {}): StackLayout {
  const {
    options = [],
    value: initialValue = '',
    label,
    orientation = 'vertical',
    disabled = false,
    accentColor = '#2196F3',
    onChange,
  } = props;

  let currentValue = initialValue;
  const indicators: { value: string; indicator: Label; nameLabel: Label }[] = [];

  const container = new StackLayout();
  container.className = 'clef-radio-group';

  if (label) {
    const titleLabel = new Label();
    titleLabel.text = label;
    titleLabel.className = 'clef-radio-group-label';
    titleLabel.fontWeight = 'bold';
    titleLabel.marginBottom = 4;
    container.addChild(titleLabel);
  }

  const listContainer = new StackLayout();
  listContainer.className = 'clef-radio-group-list';
  if (orientation === 'horizontal') {
    listContainer.orientation = 'horizontal';
  }

  function updateSelection(): void {
    indicators.forEach(({ value, indicator, nameLabel }) => {
      const isSelected = value === currentValue;
      indicator.text = isSelected ? '◉' : '○';
      indicator.color = isSelected ? new Color(accentColor) : undefined;
      nameLabel.fontWeight = isSelected ? 'bold' : 'normal';
    });
  }

  options.forEach((option) => {
    const row = new GridLayout();
    row.columns = 'auto, *';
    row.className = 'clef-radio-item';
    row.padding = 6;
    row.opacity = disabled || option.disabled ? 0.5 : 1;

    const indicator = new Label();
    indicator.col = 0;
    indicator.text = option.value === currentValue ? '◉' : '○';
    indicator.fontSize = 18;
    indicator.marginRight = 8;
    indicator.color = option.value === currentValue ? new Color(accentColor) : undefined;
    row.addChild(indicator);

    const nameLabel = new Label();
    nameLabel.col = 1;
    nameLabel.text = option.label;
    nameLabel.verticalAlignment = 'middle';
    nameLabel.fontWeight = option.value === currentValue ? 'bold' : 'normal';
    row.addChild(nameLabel);

    indicators.push({ value: option.value, indicator, nameLabel });

    if (!disabled && !option.disabled) {
      row.on('tap', () => {
        currentValue = option.value;
        updateSelection();
        onChange?.(option.value);
      });
    }

    listContainer.addChild(row);
  });

  container.addChild(listContainer);
  return container;
}

createRadioGroup.displayName = 'RadioGroup';
export default createRadioGroup;
