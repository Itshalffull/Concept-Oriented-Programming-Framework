// ============================================================
// Clef Surface NativeScript Widget — TextInput
//
// NativeScript text input field wrapping the core TextField.
// Supports placeholder, secure entry, configurable styling,
// and text-change callback.
// ============================================================

import { StackLayout, TextField, Label as NsLabel, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface TextInputProps {
  text?: string;
  hint?: string;
  label?: string;
  secure?: boolean;
  editable?: boolean;
  maxLength?: number;
  keyboardType?: 'text' | 'email' | 'number' | 'phone' | 'url';
  returnKeyType?: 'done' | 'next' | 'go' | 'search' | 'send';
  fontSize?: number;
  borderColor?: string;
  focusBorderColor?: string;
  onTextChange?: (text: string) => void;
  onReturn?: () => void;
}

// --------------- Keyboard Type Map ---------------

const KEYBOARD_MAP: Record<string, string> = {
  text: 'text',
  email: 'email',
  number: 'number',
  phone: 'phone',
  url: 'url',
};

// --------------- Component ---------------

export function createTextInput(props: TextInputProps = {}): StackLayout {
  const {
    text = '',
    hint = '',
    label,
    secure = false,
    editable = true,
    maxLength = 0,
    keyboardType = 'text',
    returnKeyType = 'done',
    fontSize = 14,
    borderColor = '#BDBDBD',
    focusBorderColor = '#6200EE',
    onTextChange,
    onReturn,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-text-input';

  // Optional label above the field
  if (label) {
    const labelView = new NsLabel();
    labelView.text = label;
    labelView.fontSize = 12;
    labelView.color = new Color('#757575');
    labelView.marginBottom = 4;
    labelView.className = 'clef-text-input__label';
    container.addChild(labelView);
  }

  // Text field
  const field = new TextField();
  field.text = text;
  field.hint = hint;
  field.secure = secure;
  field.editable = editable;
  field.fontSize = fontSize;
  field.padding = '8 12';
  field.borderWidth = 1;
  field.borderColor = new Color(borderColor);
  field.borderRadius = 4;
  field.keyboardType = KEYBOARD_MAP[keyboardType] as any;
  field.returnKeyType = returnKeyType as any;
  field.className = 'clef-text-input__field';

  if (maxLength > 0) {
    field.maxLength = maxLength;
  }

  if (!editable) {
    field.opacity = 0.6;
  }

  // Focus styling
  field.on('focus', () => {
    field.borderColor = new Color(focusBorderColor);
    field.borderWidth = 2;
  });

  field.on('blur', () => {
    field.borderColor = new Color(borderColor);
    field.borderWidth = 1;
  });

  // Text change callback
  if (onTextChange) {
    field.on('textChange', () => {
      onTextChange(field.text);
    });
  }

  // Return key callback
  if (onReturn) {
    field.on('returnPress', onReturn);
  }

  container.addChild(field);

  (container as any).__clefTextInput = { field };

  return container;
}

createTextInput.displayName = 'TextInput';
export default createTextInput;
