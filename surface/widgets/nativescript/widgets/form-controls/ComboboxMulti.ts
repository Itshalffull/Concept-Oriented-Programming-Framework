// ============================================================
// Clef Surface NativeScript Widget — ComboboxMulti
//
// Multi-select searchable dropdown. Renders a text filter with
// checkable options. Selected items appear as chips above the
// dropdown. Supports search filtering and max selection limits.
// ============================================================

import { StackLayout, WrapLayout, GridLayout, Label, TextField, Color } from '@nativescript/core';

// --------------- Types ---------------

export interface ComboboxMultiOption {
  label: string;
  value: string;
}

// --------------- Props ---------------

export interface ComboboxMultiProps {
  options?: ComboboxMultiOption[];
  selected?: string[];
  placeholder?: string;
  label?: string;
  maxSelections?: number;
  disabled?: boolean;
  accentColor?: string;
  onChange?: (selected: string[]) => void;
}

// --------------- Component ---------------

export function createComboboxMulti(props: ComboboxMultiProps = {}): StackLayout {
  const {
    options = [],
    selected: initialSelected = [],
    placeholder = 'Search…',
    label,
    maxSelections,
    disabled = false,
    accentColor = '#2196F3',
    onChange,
  } = props;

  const selectedSet = new Set(initialSelected);
  let isOpen = false;

  const container = new StackLayout();
  container.className = 'clef-combobox-multi';
  container.opacity = disabled ? 0.5 : 1;

  if (label) {
    const titleLabel = new Label();
    titleLabel.text = label;
    titleLabel.className = 'clef-combobox-multi-label';
    titleLabel.fontWeight = 'bold';
    titleLabel.marginBottom = 4;
    container.addChild(titleLabel);
  }

  // Selected chips
  const chipsContainer = new WrapLayout();
  chipsContainer.className = 'clef-combobox-multi-chips';
  chipsContainer.orientation = 'horizontal';

  function renderChips(): void {
    chipsContainer.removeChildren();
    selectedSet.forEach((val) => {
      const opt = options.find((o) => o.value === val);
      if (!opt) return;
      const chip = new Label();
      chip.text = `${opt.label} ✕`;
      chip.className = 'clef-combobox-multi-chip';
      chip.backgroundColor = new Color('#e0e7ff');
      chip.color = new Color('#3730a3');
      chip.borderRadius = 12;
      chip.padding = '2 8';
      chip.margin = 2;
      chip.fontSize = 13;

      if (!disabled) {
        chip.on('tap', () => {
          selectedSet.delete(val);
          onChange?.([...selectedSet]);
          renderChips();
          renderOptions(searchField.text || '');
        });
      }

      chipsContainer.addChild(chip);
    });
  }

  container.addChild(chipsContainer);

  // Toggle trigger
  const triggerLabel = new Label();
  triggerLabel.className = 'clef-combobox-multi-trigger';
  triggerLabel.text = selectedSet.size > 0 ? `${selectedSet.size} selected ▾` : `${placeholder} ▾`;
  triggerLabel.padding = '8 12';
  triggerLabel.borderBottomWidth = 1;
  triggerLabel.borderBottomColor = new Color('#d1d5db');
  container.addChild(triggerLabel);

  // Dropdown
  const dropdown = new StackLayout();
  dropdown.className = 'clef-combobox-multi-dropdown';
  dropdown.visibility = 'collapsed';
  dropdown.backgroundColor = new Color('#FFFFFF');
  dropdown.borderWidth = 1;
  dropdown.borderColor = new Color('#e5e7eb');
  dropdown.borderRadius = 4;

  const searchField = new TextField();
  searchField.className = 'clef-combobox-multi-search';
  searchField.hint = placeholder;
  searchField.padding = '6 8';
  dropdown.addChild(searchField);

  const optionsList = new StackLayout();
  optionsList.className = 'clef-combobox-multi-options';

  function renderOptions(filter: string): void {
    optionsList.removeChildren();
    const filtered = filter
      ? options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase()))
      : options;

    filtered.forEach((option) => {
      const row = new GridLayout();
      row.columns = 'auto, *';
      row.padding = '6 12';
      row.className = 'clef-combobox-multi-option';

      const check = new Label();
      check.col = 0;
      check.text = selectedSet.has(option.value) ? '☑' : '☐';
      check.fontSize = 16;
      check.marginRight = 8;
      check.color = selectedSet.has(option.value) ? new Color(accentColor) : undefined;
      row.addChild(check);

      const optLabel = new Label();
      optLabel.col = 1;
      optLabel.text = option.label;
      optLabel.verticalAlignment = 'middle';
      row.addChild(optLabel);

      if (!disabled) {
        row.on('tap', () => {
          if (selectedSet.has(option.value)) {
            selectedSet.delete(option.value);
          } else {
            if (maxSelections !== undefined && selectedSet.size >= maxSelections) return;
            selectedSet.add(option.value);
          }
          check.text = selectedSet.has(option.value) ? '☑' : '☐';
          check.color = selectedSet.has(option.value) ? new Color(accentColor) : undefined;
          triggerLabel.text = selectedSet.size > 0 ? `${selectedSet.size} selected ▾` : `${placeholder} ▾`;
          onChange?.([...selectedSet]);
          renderChips();
        });
      }

      optionsList.addChild(row);
    });
  }

  renderOptions('');
  dropdown.addChild(optionsList);

  searchField.on('textChange', () => {
    renderOptions(searchField.text || '');
  });

  if (!disabled) {
    triggerLabel.on('tap', () => {
      isOpen = !isOpen;
      dropdown.visibility = isOpen ? 'visible' : 'collapsed';
      if (isOpen) {
        searchField.text = '';
        renderOptions('');
        renderChips();
      }
    });
  }

  container.addChild(dropdown);
  return container;
}

createComboboxMulti.displayName = 'ComboboxMulti';
export default createComboboxMulti;
