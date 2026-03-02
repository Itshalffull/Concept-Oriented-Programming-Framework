// ============================================================
// Clef Surface NativeScript Widget — Textarea
//
// Multi-line text input using NativeScript TextView. Supports
// placeholder text, character count, max length enforcement,
// and auto-grow behavior.
// ============================================================

import { StackLayout, GridLayout, Label, TextView, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface TextareaProps {
  value?: string;
  placeholder?: string;
  label?: string;
  maxLength?: number;
  rows?: number;
  showCount?: boolean;
  disabled?: boolean;
  hint?: string;
  onChange?: (value: string) => void;
}

// --------------- Component ---------------

export function createTextarea(props: TextareaProps = {}): StackLayout {
  const {
    value: initialValue = '',
    placeholder = '',
    label,
    maxLength,
    rows = 4,
    showCount = false,
    disabled = false,
    hint,
    onChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-textarea';
  container.opacity = disabled ? 0.5 : 1;

  if (label) {
    const titleLabel = new Label();
    titleLabel.text = label;
    titleLabel.className = 'clef-textarea-label';
    titleLabel.fontWeight = 'bold';
    titleLabel.marginBottom = 4;
    container.addChild(titleLabel);
  }

  const textView = new TextView();
  textView.className = 'clef-textarea-field';
  textView.text = initialValue;
  textView.hint = placeholder;
  textView.height = rows * 24;
  textView.isEnabled = !disabled;
  textView.borderWidth = 1;
  textView.borderColor = new Color('#d1d5db');
  textView.borderRadius = 4;
  textView.padding = 8;

  container.addChild(textView);

  // Footer row: hint + count
  const footerRow = new GridLayout();
  footerRow.columns = '*, auto';
  footerRow.marginTop = 2;

  if (hint) {
    const hintLabel = new Label();
    hintLabel.col = 0;
    hintLabel.text = hint;
    hintLabel.className = 'clef-textarea-hint';
    hintLabel.fontSize = 11;
    hintLabel.opacity = 0.6;
    footerRow.addChild(hintLabel);
  }

  let countLabel: Label | undefined;
  if (showCount || maxLength !== undefined) {
    countLabel = new Label();
    countLabel.col = 1;
    countLabel.className = 'clef-textarea-count';
    countLabel.fontSize = 11;
    countLabel.opacity = 0.6;
    const len = initialValue.length;
    countLabel.text = maxLength !== undefined ? `${len}/${maxLength}` : String(len);
    footerRow.addChild(countLabel);
  }

  textView.on('textChange', () => {
    let text = textView.text || '';

    if (maxLength !== undefined && text.length > maxLength) {
      text = text.slice(0, maxLength);
      textView.text = text;
    }

    if (countLabel) {
      const len = text.length;
      countLabel.text = maxLength !== undefined ? `${len}/${maxLength}` : String(len);
      if (maxLength !== undefined && len >= maxLength) {
        countLabel.color = new Color('#ef4444');
      } else {
        countLabel.color = undefined;
      }
    }

    onChange?.(text);
  });

  if (hint || showCount || maxLength !== undefined) {
    container.addChild(footerRow);
  }

  return container;
}

createTextarea.displayName = 'Textarea';
export default createTextarea;
