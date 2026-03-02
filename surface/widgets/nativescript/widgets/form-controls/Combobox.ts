// ============================================================
// Clef Surface NativeScript Widget — Combobox
//
// Searchable single-select dropdown. Renders a text field
// that filters a list of options. Selecting an option updates
// the display and triggers the onChange callback.
// ============================================================

import { StackLayout, Label, TextField, Color } from '@nativescript/core';

// --------------- Types ---------------

export interface ComboboxOption {
  label: string;
  value: string;
}

// --------------- Props ---------------

export interface ComboboxProps {
  options?: ComboboxOption[];
  value?: string;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  accentColor?: string;
  onChange?: (value: string) => void;
}

// --------------- Component ---------------

export function createCombobox(props: ComboboxProps = {}): StackLayout {
  const {
    options = [],
    value: initialValue = '',
    placeholder = 'Search…',
    label,
    disabled = false,
    accentColor = '#2196F3',
    onChange,
  } = props;

  let currentValue = initialValue;
  let isOpen = false;

  const container = new StackLayout();
  container.className = 'clef-combobox';
  container.opacity = disabled ? 0.5 : 1;

  if (label) {
    const titleLabel = new Label();
    titleLabel.text = label;
    titleLabel.className = 'clef-combobox-label';
    titleLabel.fontWeight = 'bold';
    titleLabel.marginBottom = 4;
    container.addChild(titleLabel);
  }

  // Selected display
  const selectedLabel = new Label();
  selectedLabel.className = 'clef-combobox-selected';
  const selectedOption = options.find((o) => o.value === currentValue);
  selectedLabel.text = selectedOption ? selectedOption.label : placeholder;
  selectedLabel.color = selectedOption ? undefined : new Color('#9ca3af');
  selectedLabel.padding = '8 12';
  selectedLabel.borderBottomWidth = 1;
  selectedLabel.borderBottomColor = new Color('#d1d5db');

  const dropdown = new StackLayout();
  dropdown.className = 'clef-combobox-dropdown';
  dropdown.visibility = 'collapsed';
  dropdown.backgroundColor = new Color('#FFFFFF');
  dropdown.borderWidth = 1;
  dropdown.borderColor = new Color('#e5e7eb');
  dropdown.borderRadius = 4;

  const searchField = new TextField();
  searchField.className = 'clef-combobox-search';
  searchField.hint = placeholder;
  searchField.padding = '6 8';
  dropdown.addChild(searchField);

  const optionsList = new StackLayout();
  optionsList.className = 'clef-combobox-options';

  function renderOptions(filter: string): void {
    optionsList.removeChildren();
    const filtered = filter
      ? options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase()))
      : options;

    filtered.forEach((option) => {
      const row = new Label();
      row.text = option.label;
      row.className = 'clef-combobox-option';
      row.padding = '8 12';
      row.color = option.value === currentValue ? new Color(accentColor) : undefined;
      row.fontWeight = option.value === currentValue ? 'bold' : 'normal';

      row.on('tap', () => {
        currentValue = option.value;
        selectedLabel.text = option.label;
        selectedLabel.color = undefined;
        dropdown.visibility = 'collapsed';
        isOpen = false;
        onChange?.(option.value);
      });

      optionsList.addChild(row);
    });

    if (filtered.length === 0) {
      const emptyLabel = new Label();
      emptyLabel.text = 'No results';
      emptyLabel.padding = '8 12';
      emptyLabel.opacity = 0.5;
      optionsList.addChild(emptyLabel);
    }
  }

  renderOptions('');
  dropdown.addChild(optionsList);

  searchField.on('textChange', () => {
    renderOptions(searchField.text || '');
  });

  if (!disabled) {
    selectedLabel.on('tap', () => {
      isOpen = !isOpen;
      dropdown.visibility = isOpen ? 'visible' : 'collapsed';
      if (isOpen) {
        searchField.text = '';
        renderOptions('');
      }
    });
  }

  container.addChild(selectedLabel);
  container.addChild(dropdown);
  return container;
}

createCombobox.displayName = 'Combobox';
export default createCombobox;
