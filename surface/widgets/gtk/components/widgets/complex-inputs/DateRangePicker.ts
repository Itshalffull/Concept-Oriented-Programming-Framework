// ============================================================
// Clef Surface GTK Widget — DateRangePicker
//
// Date range selection with start and end date pickers.
// Renders as two date trigger buttons with calendar popovers
// for selecting a date range.
//
// Adapts the date-range-picker.widget spec: anatomy (root,
// startTrigger, endTrigger, calendar, rangeHighlight), states
// (selectingStart, selectingEnd, complete), and connect
// attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface DateRangePickerProps {
  startDate?: string | null;
  endDate?: string | null;
  disabled?: boolean;
  onRangeChange?: (start: string, end: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 date range picker with two date selection
 * buttons for start and end dates.
 */
export function createDateRangePicker(props: DateRangePickerProps = {}): Gtk.Widget {
  const {
    startDate = null,
    endDate = null,
    disabled = false,
    onRangeChange,
  } = props;

  let currentStart = startDate ?? '';
  let currentEnd = endDate ?? '';

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });

  // Start date picker
  const startBtn = new Gtk.Button({ label: currentStart || 'Start date' });
  startBtn.set_sensitive(!disabled);
  const startPopover = new Gtk.Popover();
  const startCal = new Gtk.Calendar();

  startCal.connect('day-selected', () => {
    currentStart = startCal.get_date().format('%Y-%m-%d') ?? '';
    startBtn.set_label(currentStart);
    startPopover.popdown();
    if (currentStart && currentEnd) {
      onRangeChange?.(currentStart, currentEnd);
    }
  });

  startPopover.set_child(startCal);
  startPopover.set_parent(startBtn);
  startBtn.connect('clicked', () => startPopover.popup());

  box.append(startBtn);
  box.append(new Gtk.Label({ label: '\u2014' })); // em dash

  // End date picker
  const endBtn = new Gtk.Button({ label: currentEnd || 'End date' });
  endBtn.set_sensitive(!disabled);
  const endPopover = new Gtk.Popover();
  const endCal = new Gtk.Calendar();

  endCal.connect('day-selected', () => {
    currentEnd = endCal.get_date().format('%Y-%m-%d') ?? '';
    endBtn.set_label(currentEnd);
    endPopover.popdown();
    if (currentStart && currentEnd) {
      onRangeChange?.(currentStart, currentEnd);
    }
  });

  endPopover.set_child(endCal);
  endPopover.set_parent(endBtn);
  endBtn.connect('clicked', () => endPopover.popup());

  box.append(endBtn);

  return box;
}
