// ============================================================
// Clef Surface NativeScript Widget — ColorPicker
//
// Color selection control with hue/saturation/brightness sliders,
// a hex input field, preset color swatches, and a live preview
// box showing the currently selected color.
//
// Adapts the color-picker.widget spec: anatomy (root, trigger,
// swatch, swatchGroup, swatchTrigger, input), states (popover,
// interaction, focus), and connect attributes to NativeScript
// rendering via Slider controls and layout containers.
// ============================================================

import {
  StackLayout,
  GridLayout,
  WrapLayout,
  Label,
  Slider,
  TextField,
  ContentView,
  Color,
} from '@nativescript/core';

// --------------- Helpers ---------------

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// --------------- Props ---------------

export interface ColorPickerProps {
  value?: string;
  presets?: string[];
  enabled?: boolean;
  onColorChange?: (hex: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a NativeScript color picker with hue, saturation, and
 * brightness sliders, a hex text input, preset swatches, and a
 * live preview of the selected color.
 */
export function createColorPicker(props: ColorPickerProps = {}): StackLayout {
  const {
    value = '#FF0000',
    presets = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF', '#000000'],
    enabled = true,
    onColorChange,
  } = props;

  let hue = 0;
  let saturation = 100;
  let brightness = 100;

  const container = new StackLayout();
  container.className = 'clef-widget-color-picker';
  container.padding = 8;

  // -- Preview box --
  const preview = new ContentView();
  preview.height = 48;
  preview.borderRadius = 8;
  preview.borderWidth = 1;
  preview.borderColor = '#CCCCCC';
  preview.backgroundColor = value as any;
  preview.marginBottom = 12;
  container.addChild(preview);

  // -- Hex label on preview --
  const hexPreviewLabel = new Label();
  hexPreviewLabel.text = value;
  hexPreviewLabel.horizontalAlignment = 'center';
  hexPreviewLabel.fontSize = 14;
  hexPreviewLabel.fontWeight = 'bold';
  hexPreviewLabel.marginBottom = 4;
  container.addChild(hexPreviewLabel);

  function updateColor(): void {
    const [r, g, b] = hsvToRgb(hue, saturation / 100, brightness / 100);
    const hex = rgbToHex(r, g, b);
    preview.backgroundColor = new Color(hex);
    hexPreviewLabel.text = hex;
    hexInput.text = hex;
    if (onColorChange) onColorChange(hex);
  }

  // -- Hue slider --
  const hueLabel = new Label();
  hueLabel.text = 'Hue';
  hueLabel.fontSize = 12;
  hueLabel.opacity = 0.7;
  container.addChild(hueLabel);

  const hueSlider = new Slider();
  hueSlider.minValue = 0;
  hueSlider.maxValue = 360;
  hueSlider.value = hue;
  hueSlider.isEnabled = enabled;
  hueSlider.marginBottom = 8;
  hueSlider.on('valueChange', () => {
    hue = Math.round(hueSlider.value);
    updateColor();
  });
  container.addChild(hueSlider);

  // -- Saturation slider --
  const satLabel = new Label();
  satLabel.text = 'Saturation';
  satLabel.fontSize = 12;
  satLabel.opacity = 0.7;
  container.addChild(satLabel);

  const satSlider = new Slider();
  satSlider.minValue = 0;
  satSlider.maxValue = 100;
  satSlider.value = saturation;
  satSlider.isEnabled = enabled;
  satSlider.marginBottom = 8;
  satSlider.on('valueChange', () => {
    saturation = Math.round(satSlider.value);
    updateColor();
  });
  container.addChild(satSlider);

  // -- Brightness slider --
  const briLabel = new Label();
  briLabel.text = 'Brightness';
  briLabel.fontSize = 12;
  briLabel.opacity = 0.7;
  container.addChild(briLabel);

  const briSlider = new Slider();
  briSlider.minValue = 0;
  briSlider.maxValue = 100;
  briSlider.value = brightness;
  briSlider.isEnabled = enabled;
  briSlider.marginBottom = 12;
  briSlider.on('valueChange', () => {
    brightness = Math.round(briSlider.value);
    updateColor();
  });
  container.addChild(briSlider);

  // -- Hex text input --
  const hexInputLabel = new Label();
  hexInputLabel.text = 'Hex Color';
  hexInputLabel.fontSize = 12;
  hexInputLabel.opacity = 0.7;
  container.addChild(hexInputLabel);

  const hexInput = new TextField();
  hexInput.text = value;
  hexInput.hint = '#RRGGBB';
  hexInput.isEnabled = enabled;
  hexInput.marginBottom = 12;
  hexInput.borderWidth = 1;
  hexInput.borderColor = '#CCCCCC';
  hexInput.borderRadius = 4;
  hexInput.padding = 8;
  hexInput.on('textChange', () => {
    const text = hexInput.text.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(text)) {
      preview.backgroundColor = new Color(text);
      hexPreviewLabel.text = text.toUpperCase();
      if (onColorChange) onColorChange(text.toUpperCase());
    }
  });
  container.addChild(hexInput);

  // -- Preset swatches --
  const presetsLabel = new Label();
  presetsLabel.text = 'Presets';
  presetsLabel.fontSize = 12;
  presetsLabel.opacity = 0.7;
  presetsLabel.marginBottom = 4;
  container.addChild(presetsLabel);

  const swatchGrid = new WrapLayout();
  swatchGrid.orientation = 'horizontal';
  swatchGrid.itemWidth = 40;
  swatchGrid.itemHeight = 40;

  presets.forEach((preset) => {
    const swatch = new ContentView();
    swatch.width = 32;
    swatch.height = 32;
    swatch.borderRadius = 16;
    swatch.backgroundColor = preset as any;
    swatch.borderWidth = 1;
    swatch.borderColor = '#CCCCCC';
    swatch.margin = 4;
    if (enabled) {
      swatch.on('tap', () => {
        hexInput.text = preset;
        preview.backgroundColor = new Color(preset);
        hexPreviewLabel.text = preset;
        if (onColorChange) onColorChange(preset);
      });
    }
    swatchGrid.addChild(swatch);
  });

  container.addChild(swatchGrid);

  if (!enabled) {
    container.opacity = 0.38;
  }

  return container;
}

createColorPicker.displayName = 'ColorPicker';
export default createColorPicker;
