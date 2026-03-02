// ============================================================
// Clef Surface NativeScript Widget — Button
//
// NativeScript clickable button with configurable label, style
// variant, and tap handler. Supports primary, secondary, and
// outline visual variants.
// ============================================================

import { Button as NsButton, Color } from '@nativescript/core';

// --------------- Variant Styles ---------------

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text';

const VARIANT_STYLES: Record<ButtonVariant, {
  backgroundColor: string;
  textColor: string;
  borderWidth: number;
  borderColor: string;
}> = {
  primary: { backgroundColor: '#6200EE', textColor: '#FFFFFF', borderWidth: 0, borderColor: 'transparent' },
  secondary: { backgroundColor: '#03DAC6', textColor: '#000000', borderWidth: 0, borderColor: 'transparent' },
  outline: { backgroundColor: 'transparent', textColor: '#6200EE', borderWidth: 2, borderColor: '#6200EE' },
  text: { backgroundColor: 'transparent', textColor: '#6200EE', borderWidth: 0, borderColor: 'transparent' },
};

// --------------- Props ---------------

export interface ButtonProps {
  text?: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  fontSize?: number;
  borderRadius?: number;
  onTap?: () => void;
}

// --------------- Component ---------------

export function createButton(props: ButtonProps = {}): NsButton {
  const {
    text = 'Button',
    variant = 'primary',
    disabled = false,
    fontSize = 14,
    borderRadius = 4,
    onTap,
  } = props;

  const button = new NsButton();
  button.text = text;
  button.fontSize = fontSize;
  button.borderRadius = borderRadius;
  button.isEnabled = !disabled;
  button.className = `clef-button clef-button--${variant}`;

  const style = VARIANT_STYLES[variant];
  button.backgroundColor = new Color(style.backgroundColor);
  button.color = new Color(style.textColor);
  button.borderWidth = style.borderWidth;
  button.borderColor = new Color(style.borderColor);
  button.padding = '8 16';
  button.fontWeight = 'bold';
  button.textTransform = 'uppercase';

  if (disabled) {
    button.opacity = 0.5;
  }

  if (onTap) {
    button.on('tap', onTap);
  }

  return button;
}

createButton.displayName = 'Button';
export default createButton;
