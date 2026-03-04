// ============================================================
// Clef Surface NativeScript Widget — Textarea
//
// Multi-line text input with label, placeholder, and
// character count. Wraps NativeScript TextView.
// ============================================================

import { StackLayout, Label, TextView } from '@nativescript/core';

// --------------- Props ---------------

export interface TextareaProps {
  value?: string;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  rows?: number;
  maxLength?: number;
  showCount?: boolean;
  error?: string;
  onChange?: (value: string) => void;
}

// --------------- Component ---------------

export function createTextarea(props: TextareaProps): StackLayout {
  const {
    value = '',
    placeholder = '',
    label,
    disabled = false,
    readOnly = false,
    required = false,
    rows = 4,
    maxLength,
    showCount = false,
    error,
    onChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-textarea';

  if (label) {
    const lbl = new Label();
    lbl.text = required ? `${label} *` : label;
    lbl.className = 'clef-textarea-label';
    lbl.marginBottom = 4;
    container.addChild(lbl);
  }

  const tv = new TextView();
  tv.text = value;
  tv.hint = placeholder;
  tv.isEnabled = !disabled;
  tv.editable = !readOnly;
  tv.height = rows * 20;
  tv.className = `clef-textarea-field${error ? ' clef-input-error' : ''}`;
  tv.accessibilityRole = 'textField';

  tv.on('textChange', (args: any) => {
    const text = args.object.text;
    if (maxLength && text.length > maxLength) return;
    onChange?.(text);
  });

  container.addChild(tv);

  if (showCount || error) {
    const footer = new StackLayout();
    footer.orientation = 'horizontal';
    footer.marginTop = 2;

    if (error) {
      const errLabel = new Label();
      errLabel.text = error;
      errLabel.color = new (require('@nativescript/core').Color)('#ef4444');
      errLabel.fontSize = 12;
      footer.addChild(errLabel);
    }

    if (showCount) {
      const countLabel = new Label();
      countLabel.text = maxLength ? `${value.length}/${maxLength}` : String(value.length);
      countLabel.fontSize = 12;
      countLabel.horizontalAlignment = 'right';
      countLabel.opacity = 0.6;
      footer.addChild(countLabel);
    }

    container.addChild(footer);
  }

  return container;
}

export default createTextarea;
