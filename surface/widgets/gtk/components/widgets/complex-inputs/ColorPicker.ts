// ============================================================
// Clef Surface GTK Widget — ColorPicker
//
// Color selection control with a Gtk.ColorDialogButton or
// manual HSV sliders, preset swatches, and hex input field.
//
// Adapts the color-picker.widget spec: anatomy (root, trigger,
// swatch, swatchGroup, swatchTrigger, input), states (popover,
// interaction, focus), and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Helpers ---------------

function hexToRgba(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return null;
  return {
    r: parseInt(cleaned.substring(0, 2), 16) / 255,
    g: parseInt(cleaned.substring(2, 4), 16) / 255,
    b: parseInt(cleaned.substring(4, 6), 16) / 255,
  };
}

// --------------- Props ---------------

export interface ColorPickerProps {
  value?: string;
  presets?: string[];
  disabled?: boolean;
  onColorChange?: (hex: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 color picker with Gtk.ColorDialogButton,
 * preset swatches, and hex input field.
 */
export function createColorPicker(props: ColorPickerProps = {}): Gtk.Widget {
  const {
    value = '#FF0000',
    presets = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF', '#000000'],
    disabled = false,
    onColorChange,
  } = props;

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
  });

  // Color button using ColorDialogButton
  const colorDialog = new Gtk.ColorDialog();
  const colorButton = new Gtk.ColorDialogButton({ dialog: colorDialog });
  colorButton.set_sensitive(!disabled);

  // Set initial color
  const rgba = new (Gtk as any).gdk.RGBA();
  const parsed = hexToRgba(value);
  if (parsed) {
    rgba.red = parsed.r;
    rgba.green = parsed.g;
    rgba.blue = parsed.b;
    rgba.alpha = 1.0;
    colorButton.set_rgba(rgba);
  }

  colorButton.connect('notify::rgba', () => {
    const color = colorButton.get_rgba();
    const r = Math.round(color.red * 255).toString(16).padStart(2, '0');
    const g = Math.round(color.green * 255).toString(16).padStart(2, '0');
    const b = Math.round(color.blue * 255).toString(16).padStart(2, '0');
    onColorChange?.(`#${r}${g}${b}`.toUpperCase());
  });

  container.append(colorButton);

  // Hex input
  const hexEntry = new Gtk.Entry({
    text: value,
    placeholderText: '#RRGGBB',
  });
  hexEntry.set_sensitive(!disabled);
  hexEntry.connect('activate', () => {
    const text = hexEntry.get_text().trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(text)) {
      onColorChange?.(text.toUpperCase());
    }
  });
  container.append(hexEntry);

  // Preset swatches
  const presetLabel = new Gtk.Label({ label: 'Presets', xalign: 0 });
  presetLabel.get_style_context().add_class('dim-label');
  container.append(presetLabel);

  const swatchBox = new Gtk.FlowBox({
    selectionMode: Gtk.SelectionMode.NONE,
    maxChildrenPerLine: 8,
    homogeneous: true,
  });

  presets.forEach((preset) => {
    const btn = new Gtk.Button({ label: '' });
    btn.set_size_request(32, 32);
    btn.set_sensitive(!disabled);
    btn.set_tooltip_text(preset);
    btn.connect('clicked', () => {
      hexEntry.set_text(preset);
      onColorChange?.(preset);
    });
    swatchBox.insert(btn, -1);
  });

  container.append(swatchBox);

  return container;
}
