// ============================================================
// Clef Surface NativeScript Widget — InlineEdit
//
// Inline text editing. Displays a read-only label that
// transitions to an editable TextField on tap/double-tap.
// Supports save, cancel, and validation feedback.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  TextField,
  Button,
  Color,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export interface InlineEditProps {
  value?: string;
  placeholder?: string;
  editing?: boolean;
  disabled?: boolean;
  multiline?: boolean;
  maxLength?: number;
  fontSize?: number;
  fontWeight?: string;
  validationError?: string;
  saveOnBlur?: boolean;
  accentColor?: string;
  onSave?: (value: string) => void;
  onCancel?: () => void;
  onChange?: (value: string) => void;
  onEditStart?: () => void;
}

// --------------- Component ---------------

export function createInlineEdit(props: InlineEditProps = {}): StackLayout {
  const {
    value = '',
    placeholder = 'Click to edit...',
    editing = false,
    disabled = false,
    maxLength,
    fontSize = 14,
    fontWeight = 'normal',
    validationError,
    accentColor = '#06b6d4',
    onSave,
    onCancel,
    onChange,
    onEditStart,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-inline-edit';

  if (editing && !disabled) {
    // Edit mode
    const editRow = new GridLayout();
    editRow.columns = '*, auto, auto';

    const textField = new TextField();
    textField.text = value;
    textField.hint = placeholder;
    textField.fontSize = fontSize;
    textField.color = new Color('#e0e0e0');
    textField.backgroundColor = new Color('#0d0d1a');
    textField.borderBottomWidth = 2;
    textField.borderBottomColor = new Color(validationError ? '#ef4444' : accentColor);
    textField.padding = 4;
    if (maxLength) textField.maxLength = maxLength;

    let currentText = value;
    textField.on('textChange', (args: any) => {
      currentText = args.object.text;
      onChange?.(currentText);
    });

    GridLayout.setColumn(textField, 0);
    editRow.addChild(textField);

    // Save button
    const saveBtn = new Button();
    saveBtn.text = '\u2714';
    saveBtn.fontSize = 14;
    saveBtn.width = 32;
    saveBtn.height = 32;
    saveBtn.marginLeft = 4;
    saveBtn.color = new Color('#22c55e');
    saveBtn.on('tap', () => onSave?.(currentText));
    GridLayout.setColumn(saveBtn, 1);
    editRow.addChild(saveBtn);

    // Cancel button
    const cancelBtn = new Button();
    cancelBtn.text = '\u2716';
    cancelBtn.fontSize = 14;
    cancelBtn.width = 32;
    cancelBtn.height = 32;
    cancelBtn.marginLeft = 2;
    cancelBtn.color = new Color('#ef4444');
    cancelBtn.on('tap', () => onCancel?.());
    GridLayout.setColumn(cancelBtn, 2);
    editRow.addChild(cancelBtn);

    container.addChild(editRow);

    // Character count
    if (maxLength) {
      const charCount = new Label();
      charCount.text = `${value.length}/${maxLength}`;
      charCount.fontSize = 10;
      charCount.opacity = 0.4;
      charCount.horizontalAlignment = 'right';
      container.addChild(charCount);
    }

    // Validation error
    if (validationError) {
      const errorLabel = new Label();
      errorLabel.text = `\u2716 ${validationError}`;
      errorLabel.fontSize = 11;
      errorLabel.color = new Color('#ef4444');
      errorLabel.marginTop = 2;
      container.addChild(errorLabel);
    }
  } else {
    // Display mode
    const displayRow = new GridLayout();
    displayRow.columns = '*, auto';
    displayRow.padding = 4;
    displayRow.borderRadius = 4;

    const displayLabel = new Label();
    displayLabel.text = value || placeholder;
    displayLabel.fontSize = fontSize;
    displayLabel.fontWeight = fontWeight;
    displayLabel.color = new Color(value ? '#e0e0e0' : '#666666');
    displayLabel.textWrap = true;
    GridLayout.setColumn(displayLabel, 0);
    displayRow.addChild(displayLabel);

    if (!disabled) {
      const editIcon = new Label();
      editIcon.text = '\u270E';
      editIcon.fontSize = 12;
      editIcon.opacity = 0.3;
      editIcon.verticalAlignment = 'middle';
      editIcon.marginLeft = 4;
      GridLayout.setColumn(editIcon, 1);
      displayRow.addChild(editIcon);

      // Hover-like touch feedback
      displayRow.on(GestureTypes.touch as any, (args: any) => {
        if (args.action === 'down') {
          displayRow.backgroundColor = new Color('#ffffff10');
        } else {
          displayRow.backgroundColor = new Color('#00000000');
        }
      });

      displayRow.on(GestureTypes.tap as any, () => onEditStart?.());
      displayRow.on(GestureTypes.doubleTap as any, () => onEditStart?.());
    }

    container.addChild(displayRow);
  }

  return container;
}

export default createInlineEdit;
