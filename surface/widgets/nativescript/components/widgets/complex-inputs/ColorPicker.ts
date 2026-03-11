// ============================================================
// Clef Surface NativeScript Widget — ColorPicker
//
// Color selection with hue/saturation/lightness controls.
// ============================================================

import { StackLayout, Label, TextField, Button, Color } from '@nativescript/core';

export interface ColorPickerProps {
  value?: string;
  defaultValue?: string;
  format?: 'hex' | 'rgb' | 'hsl' | 'oklch';
  swatches?: string[];
  disabled?: boolean;
  name?: string;
  alpha?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onChange?: (color: string) => void;
}

export function createColorPicker(props: ColorPickerProps): StackLayout {
  const {
    value: valueProp, defaultValue = '#000000', format = 'hex',
    swatches, disabled = false, name, alpha = false,
    size = 'md', onChange,
  } = props;

  let currentColor = valueProp ?? defaultValue;
  let isOpen = false;
  const container = new StackLayout();
  container.className = `clef-widget-color-picker clef-size-${size}`;

  const trigger = new StackLayout();
  trigger.className = 'clef-color-picker-trigger';
  trigger.width = 40;
  trigger.height = 40;
  trigger.backgroundColor = new Color(currentColor);
  trigger.accessibilityLabel = 'Select color';
  trigger.on('tap', () => {
    if (disabled) return;
    isOpen = !isOpen;
    content.visibility = isOpen ? 'visible' : 'collapsed';
  });
  container.addChild(trigger);

  const content = new StackLayout();
  content.className = 'clef-color-picker-content';
  content.visibility = 'collapsed';
  content.padding = '12';

  const field = new TextField();
  field.text = currentColor;
  field.accessibilityLabel = `Color value (${format})`;
  field.on('textChange', (args) => {
    const val = args.object.text;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      currentColor = val;
      trigger.backgroundColor = new Color(val);
      onChange?.(val);
    }
  });
  content.addChild(field);

  if (swatches && swatches.length > 0) {
    const swatchContainer = new StackLayout();
    swatchContainer.orientation = 'horizontal';
    swatchContainer.className = 'clef-color-picker-swatches';
    for (const swatch of swatches) {
      const swatchBtn = new StackLayout();
      swatchBtn.width = 24;
      swatchBtn.height = 24;
      swatchBtn.backgroundColor = new Color(swatch);
      swatchBtn.margin = '2';
      swatchBtn.accessibilityLabel = `Select color ${swatch}`;
      swatchBtn.on('tap', () => {
        currentColor = swatch;
        field.text = swatch;
        trigger.backgroundColor = new Color(swatch);
        onChange?.(swatch);
      });
      swatchContainer.addChild(swatchBtn);
    }
    content.addChild(swatchContainer);
  }

  container.addChild(content);
  return container;
}

export default createColorPicker;
