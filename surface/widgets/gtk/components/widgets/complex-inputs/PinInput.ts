// ============================================================
// Clef Surface GTK Widget — PinInput
//
// Multi-digit PIN/OTP code entry. Renders as a row of
// individual Gtk.Entry fields, each accepting a single character
// with automatic focus advancement.
//
// Adapts the pin-input.widget spec: anatomy (root, input,
// separator), states (idle, focused, complete, error), and
// connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface PinInputProps {
  length?: number;
  mask?: boolean;
  disabled?: boolean;
  onComplete?: (pin: string) => void;
  onChange?: (pin: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 PIN input as a row of single-character entry
 * fields with automatic focus advancement.
 */
export function createPinInput(props: PinInputProps = {}): Gtk.Widget {
  const {
    length = 4,
    mask = false,
    disabled = false,
    onComplete,
    onChange,
  } = props;

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
    halign: Gtk.Align.CENTER,
  });

  const entries: Gtk.Entry[] = [];

  for (let i = 0; i < length; i++) {
    const entry = new Gtk.Entry({
      maxLength: 1,
      widthChars: 2,
      xalign: 0.5,
      visibility: !mask,
    });
    entry.set_sensitive(!disabled);

    entry.connect('changed', () => {
      const text = entry.get_text();
      if (text.length === 1 && i < length - 1) {
        entries[i + 1].grab_focus();
      }

      const pin = entries.map((e) => e.get_text()).join('');
      onChange?.(pin);
      if (pin.length === length) {
        onComplete?.(pin);
      }
    });

    // Handle backspace to go to previous field
    const keyCtrl = new Gtk.EventControllerKey();
    keyCtrl.connect('key-pressed', (_ctrl: Gtk.EventControllerKey, keyval: number) => {
      if (keyval === 0xff08 && entry.get_text().length === 0 && i > 0) { // BackSpace
        entries[i - 1].grab_focus();
        return true;
      }
      return false;
    });
    entry.add_controller(keyCtrl);

    entries.push(entry);
    box.append(entry);
  }

  return box;
}
