// ============================================================
// Clef Surface GTK Widget — SegmentedControl
//
// Horizontal toggle group for selecting between a small set of
// options. Renders as linked Gtk.ToggleButton widgets in a
// Gtk.Box with the "linked" CSS class.
//
// Adapts the segmented-control.widget spec: anatomy (root,
// item, indicator), states (selected, unselected, disabled),
// and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface SegmentedControlOption {
  label: string;
  value: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface SegmentedControlProps {
  value?: string | null;
  options?: SegmentedControlOption[];
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 segmented control as a row of linked toggle
 * buttons for mutual-exclusive selection.
 */
export function createSegmentedControl(props: SegmentedControlProps = {}): Gtk.Widget {
  const {
    value = null,
    options = [],
    disabled = false,
    onValueChange,
  } = props;

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 0,
  });
  box.get_style_context().add_class('linked');

  const buttons: Gtk.ToggleButton[] = [];

  options.forEach((option) => {
    const btn = new Gtk.ToggleButton({
      label: option.label,
      active: option.value === value,
    });
    btn.set_sensitive(!disabled && !option.disabled);

    btn.connect('toggled', () => {
      if (btn.get_active()) {
        // Deactivate all other buttons
        buttons.forEach((other) => {
          if (other !== btn && other.get_active()) {
            other.set_active(false);
          }
        });
        onValueChange?.(option.value);
      }
    });

    buttons.push(btn);
    box.append(btn);
  });

  return box;
}
