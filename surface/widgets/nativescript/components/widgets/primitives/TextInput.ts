// ============================================================
// Clef Surface NativeScript Widget — TextInput
//
// Single-line text input field with label, placeholder, and
// validation states. Wraps NativeScript TextField.
// ============================================================

import { StackLayout, Label, TextField } from '@nativescript/core';

// --------------- Props ---------------

export interface TextInputProps {
  value?: string;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  error?: string;
  type?: 'text' | 'password' | 'email' | 'number';
  name?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

// --------------- Component ---------------

export function createTextInput(props: TextInputProps): StackLayout {
  const {
    value = '',
    placeholder = '',
    label,
    disabled = false,
    readOnly = false,
    required = false,
    error,
    type = 'text',
    name,
    onChange,
    onFocus,
    onBlur,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-text-input';

  if (label) {
    const lbl = new Label();
    lbl.text = required ? `${label} *` : label;
    lbl.className = 'clef-text-input-label';
    lbl.marginBottom = 4;
    container.addChild(lbl);
  }

  const field = new TextField();
  field.text = value;
  field.hint = placeholder;
  field.isEnabled = !disabled;
  field.editable = !readOnly;
  field.secure = type === 'password';
  field.className = `clef-text-input-field${error ? ' clef-input-error' : ''}`;
  field.accessibilityRole = 'textField';
  if (name) field.accessibilityLabel = name;

  if (type === 'email') field.keyboardType = 'email';
  if (type === 'number') field.keyboardType = 'number';

  field.on('textChange', (args: any) => {
    onChange?.(args.object.text);
  });

  if (onFocus) field.on('focus', () => onFocus());
  if (onBlur) field.on('blur', () => onBlur());

  container.addChild(field);

  if (error) {
    const errLabel = new Label();
    errLabel.text = error;
    errLabel.className = 'clef-text-input-error';
    errLabel.color = new (require('@nativescript/core').Color)('#ef4444');
    errLabel.fontSize = 12;
    errLabel.marginTop = 2;
    container.addChild(errLabel);
  }

  return container;
}

export default createTextInput;
