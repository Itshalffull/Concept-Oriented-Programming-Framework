// ============================================================
// Clef Surface NativeScript Widget — ViewToggle
//
// Toggle between different view modes (grid/list/etc).
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';

export interface ViewToggleOption { value: string; label: string; icon?: string; }

export interface ViewToggleProps {
  options: ViewToggleOption[];
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function createViewToggle(props: ViewToggleProps): StackLayout {
  const { options, value: valueProp, defaultValue, disabled = false, onChange, size = 'md' } = props;
  let currentValue = valueProp ?? defaultValue ?? (options[0]?.value ?? '');
  const container = new StackLayout();
  container.className = `clef-widget-view-toggle clef-size-${size}`;
  container.orientation = 'horizontal';
  container.accessibilityRole = 'radiogroup';

  for (const option of options) {
    const btn = new Button();
    btn.text = option.icon || option.label;
    btn.className = option.value === currentValue ? 'clef-view-toggle-active' : 'clef-view-toggle-inactive';
    btn.isEnabled = !disabled;
    btn.accessibilityRole = 'radio';
    btn.accessibilityLabel = option.label;
    btn.accessibilityState = { selected: option.value === currentValue };
    btn.on('tap', () => {
      if (disabled) return;
      currentValue = option.value;
      onChange?.(option.value);
    });
    container.addChild(btn);
  }
  return container;
}

export default createViewToggle;
