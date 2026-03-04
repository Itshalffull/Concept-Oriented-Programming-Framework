// ============================================================
// Clef Surface NativeScript Widget — ChipInput
//
// Text field that converts entries into deletable chips.
// Supports free-form or constrained value entry.
// ============================================================

import { StackLayout, Label, Button, TextField } from '@nativescript/core';

// --------------- Props ---------------

export interface ChipInputProps {
  values?: string[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  maxItems?: number;
  onChange?: (values: string[]) => void;
}

// --------------- Component ---------------

export function createChipInput(props: ChipInputProps): StackLayout {
  const {
    values = [],
    placeholder = 'Add item...',
    label,
    disabled = false,
    maxItems,
    onChange,
  } = props;

  let items = [...values];

  const container = new StackLayout();
  container.className = 'clef-widget-chip-input';

  if (label) {
    const lbl = new Label();
    lbl.text = label;
    lbl.fontWeight = 'bold';
    lbl.marginBottom = 4;
    container.addChild(lbl);
  }

  const chipsRow = new StackLayout();
  chipsRow.orientation = 'horizontal';
  chipsRow.className = 'clef-chip-input-chips';

  function renderChips() {
    while (chipsRow.getChildrenCount() > 0) {
      chipsRow.removeChild(chipsRow.getChildAt(0));
    }
    for (const item of items) {
      const chip = new StackLayout();
      chip.orientation = 'horizontal';
      chip.padding = '2 6';
      chip.className = 'clef-chip-input-chip';

      const chipLabel = new Label();
      chipLabel.text = item;
      chip.addChild(chipLabel);

      const removeBtn = new Button();
      removeBtn.text = '\u2715';
      removeBtn.className = 'clef-chip-remove';
      removeBtn.isEnabled = !disabled;
      removeBtn.on('tap', () => {
        items = items.filter((v: string) => v !== item);
        onChange?.(items);
        renderChips();
      });
      chip.addChild(removeBtn);

      chipsRow.addChild(chip);
    }
  }

  renderChips();
  container.addChild(chipsRow);

  const input = new TextField();
  input.hint = placeholder;
  input.isEnabled = !disabled && (!maxItems || items.length < maxItems);
  input.className = 'clef-chip-input-field';

  input.on('returnPress', (args: any) => {
    const text = args.object.text?.trim();
    if (text && !items.includes(text)) {
      if (!maxItems || items.length < maxItems) {
        items = [...items, text];
        args.object.text = '';
        onChange?.(items);
        renderChips();
      }
    }
  });

  container.addChild(input);
  return container;
}

export default createChipInput;
