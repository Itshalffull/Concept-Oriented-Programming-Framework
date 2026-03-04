// ============================================================
// Clef Surface GTK Widget — DatePicker
//
// Date selection control with a calendar popup. Uses
// Gtk.Calendar inside a Gtk.Popover triggered by a button
// displaying the selected date.
//
// Adapts the date-picker.widget spec: anatomy (root, trigger,
// calendar, navigation, grid, dayCell), states (open, closed,
// selected), and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface DatePickerProps {
  value?: string | null;
  placeholder?: string;
  disabled?: boolean;
  onDateChange?: (date: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 date picker with a button trigger and
 * calendar popover for date selection.
 */
export function createDatePicker(props: DatePickerProps = {}): Gtk.Widget {
  const {
    value = null,
    placeholder = 'Select date...',
    disabled = false,
    onDateChange,
  } = props;

  const button = new Gtk.Button({ label: value ?? placeholder });
  button.set_sensitive(!disabled);

  const popover = new Gtk.Popover();
  const calendar = new Gtk.Calendar();

  calendar.connect('day-selected', () => {
    const dt = calendar.get_date();
    const dateStr = dt.format('%Y-%m-%d') ?? '';
    button.set_label(dateStr);
    onDateChange?.(dateStr);
    popover.popdown();
  });

  popover.set_child(calendar);
  popover.set_parent(button);

  button.connect('clicked', () => popover.popup());

  return button;
}
