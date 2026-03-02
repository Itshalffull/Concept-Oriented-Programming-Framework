// ============================================================
// Clef Surface NativeScript Widget — Checkbox
//
// NativeScript single checkbox built from a tappable GridLayout
// with a visual check indicator and optional label text.
// ============================================================

import { GridLayout, Label as NsLabel, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface CheckboxProps {
  checked?: boolean;
  label?: string;
  disabled?: boolean;
  size?: number;
  checkedColor?: string;
  uncheckedColor?: string;
  onChange?: (checked: boolean) => void;
}

// --------------- Component ---------------

export function createCheckbox(props: CheckboxProps = {}): GridLayout {
  const {
    checked = false,
    label,
    disabled = false,
    size = 22,
    checkedColor = '#6200EE',
    uncheckedColor = '#757575',
    onChange,
  } = props;

  let isChecked = checked;

  const container = new GridLayout();
  container.className = 'clef-checkbox';
  container.columns = `${size},*`;
  container.verticalAlignment = 'middle';
  container.padding = '4 0';
  container.isUserInteractionEnabled = !disabled;

  if (disabled) {
    container.opacity = 0.5;
  }

  // Check box indicator
  const box = new GridLayout();
  box.width = size;
  box.height = size;
  box.borderRadius = 3;
  box.borderWidth = 2;
  box.horizontalAlignment = 'center';
  box.verticalAlignment = 'middle';
  box.col = 0;
  box.className = 'clef-checkbox__box';

  // Check mark
  const checkMark = new NsLabel();
  checkMark.text = '\u2713';
  checkMark.fontSize = size * 0.65;
  checkMark.textAlignment = 'center';
  checkMark.verticalAlignment = 'middle';
  checkMark.horizontalAlignment = 'center';
  checkMark.className = 'clef-checkbox__mark';

  const applyState = () => {
    if (isChecked) {
      box.backgroundColor = new Color(checkedColor);
      box.borderColor = new Color(checkedColor);
      checkMark.color = new Color('#FFFFFF');
      checkMark.visibility = 'visible';
    } else {
      box.backgroundColor = new Color('transparent');
      box.borderColor = new Color(uncheckedColor);
      checkMark.visibility = 'collapse';
    }
  };

  applyState();
  box.addChild(checkMark);
  container.addChild(box);

  // Optional label
  if (label) {
    const labelView = new NsLabel();
    labelView.text = label;
    labelView.fontSize = 14;
    labelView.verticalAlignment = 'middle';
    labelView.marginLeft = 8;
    labelView.col = 1;
    labelView.className = 'clef-checkbox__label';
    container.addChild(labelView);
  }

  // Tap toggle
  container.on('tap', () => {
    if (disabled) return;
    isChecked = !isChecked;
    applyState();
    if (onChange) onChange(isChecked);
  });

  return container;
}

createCheckbox.displayName = 'Checkbox';
export default createCheckbox;
