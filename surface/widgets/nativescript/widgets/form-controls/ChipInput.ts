// ============================================================
// Clef Surface NativeScript Widget — ChipInput
//
// Tag/chip input field. Users type text and press enter to
// create chips. Each chip is displayed as a removable label.
// Supports max chip count and validation.
// ============================================================

import { StackLayout, WrapLayout, Label, TextField, Button, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface ChipInputProps {
  chips?: string[];
  placeholder?: string;
  label?: string;
  maxChips?: number;
  disabled?: boolean;
  chipColor?: string;
  chipTextColor?: string;
  onAdd?: (chip: string) => void;
  onRemove?: (chip: string, index: number) => void;
  onChange?: (chips: string[]) => void;
}

// --------------- Component ---------------

export function createChipInput(props: ChipInputProps = {}): StackLayout {
  const {
    chips: initialChips = [],
    placeholder = 'Type and press enter…',
    label,
    maxChips,
    disabled = false,
    chipColor = '#e0e7ff',
    chipTextColor = '#3730a3',
    onAdd,
    onRemove,
    onChange,
  } = props;

  const chipList = [...initialChips];

  const container = new StackLayout();
  container.className = 'clef-chip-input';
  container.opacity = disabled ? 0.5 : 1;

  if (label) {
    const titleLabel = new Label();
    titleLabel.text = label;
    titleLabel.className = 'clef-chip-input-label';
    titleLabel.fontWeight = 'bold';
    titleLabel.marginBottom = 4;
    container.addChild(titleLabel);
  }

  const chipsContainer = new WrapLayout();
  chipsContainer.className = 'clef-chip-input-chips';
  chipsContainer.orientation = 'horizontal';

  function renderChips(): void {
    chipsContainer.removeChildren();
    chipList.forEach((chip, index) => {
      const chipView = new StackLayout();
      chipView.className = 'clef-chip';
      chipView.orientation = 'horizontal';
      chipView.backgroundColor = new Color(chipColor);
      chipView.borderRadius = 12;
      chipView.padding = '2 8';
      chipView.margin = 2;

      const chipLabel = new Label();
      chipLabel.text = chip;
      chipLabel.color = new Color(chipTextColor);
      chipLabel.fontSize = 13;
      chipLabel.verticalAlignment = 'middle';
      chipView.addChild(chipLabel);

      if (!disabled) {
        const removeBtn = new Button();
        removeBtn.text = '✕';
        removeBtn.className = 'clef-chip-remove';
        removeBtn.fontSize = 11;
        removeBtn.width = 20;
        removeBtn.height = 20;
        removeBtn.borderRadius = 10;
        removeBtn.padding = 0;
        removeBtn.marginLeft = 4;
        removeBtn.on('tap', () => {
          chipList.splice(index, 1);
          onRemove?.(chip, index);
          onChange?.([...chipList]);
          renderChips();
        });
        chipView.addChild(removeBtn);
      }

      chipsContainer.addChild(chipView);
    });
  }

  renderChips();
  container.addChild(chipsContainer);

  if (!disabled) {
    const input = new TextField();
    input.className = 'clef-chip-input-field';
    input.hint = placeholder;
    input.marginTop = 4;

    input.on('returnPress', () => {
      const value = (input.text || '').trim();
      if (!value) return;
      if (maxChips !== undefined && chipList.length >= maxChips) return;
      if (chipList.includes(value)) return;

      chipList.push(value);
      input.text = '';
      onAdd?.(value);
      onChange?.([...chipList]);
      renderChips();
    });

    container.addChild(input);
  }

  return container;
}

createChipInput.displayName = 'ChipInput';
export default createChipInput;
