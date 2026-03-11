// ============================================================
// Clef Surface NativeScript Widget — Button
//
// Interactive button with variant, size, loading, and disabled
// states. Uses NativeScript Button view with tap handling.
// ============================================================

import {
  StackLayout,
  Label,
  Button as NSButton,
  ActivityIndicator,
} from '@nativescript/core';

// --------------- Props ---------------

export interface ButtonProps {
  variant?: 'filled' | 'outline' | 'text' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  iconPosition?: 'start' | 'end';
  onClick?: () => void;
}

// --------------- Component ---------------

export function createButton(props: ButtonProps): StackLayout {
  const {
    variant = 'filled',
    size = 'md',
    disabled = false,
    loading = false,
    label = '',
    iconPosition = 'start',
    onClick,
  } = props;

  const container = new StackLayout();
  container.className = `clef-widget-button clef-variant-${variant} clef-size-${size}`;
  container.orientation = 'horizontal';
  container.horizontalAlignment = 'center';
  container.verticalAlignment = 'middle';
  container.isEnabled = !disabled && !loading;
  container.accessibilityRole = 'button';
  container.accessibilityState = { disabled: disabled || loading, busy: loading };

  if (loading) {
    const spinner = new ActivityIndicator();
    spinner.busy = true;
    spinner.width = 16;
    spinner.height = 16;
    spinner.marginRight = 4;
    container.addChild(spinner);
  }

  const btn = new NSButton();
  btn.text = label;
  btn.isEnabled = !disabled && !loading;
  btn.className = `clef-button-inner clef-size-${size}`;

  if (onClick && !disabled && !loading) {
    btn.on('tap', () => onClick());
  }

  container.addChild(btn);

  return container;
}

export default createButton;
