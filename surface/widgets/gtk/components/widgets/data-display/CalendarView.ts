// ============================================================
// Clef Surface GTK Widget — CalendarView
//
// Date display calendar. Uses Gtk.Calendar for native calendar
// widget with date selection and navigation between months.
//
// Adapts the calendar-view.widget spec: anatomy (root, header,
// grid, dayCell, todayIndicator), states (idle, selecting), and
// connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface CalendarViewProps {
  selectedDate?: Date | null;
  onDateSelect?: (date: Date) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 Calendar widget for date display and selection.
 */
export function createCalendarView(props: CalendarViewProps = {}): Gtk.Widget {
  const { selectedDate = null, onDateSelect } = props;

  const calendar = new Gtk.Calendar();

  if (selectedDate) {
    // GLib.DateTime month is 1-indexed, day is 1-indexed
    calendar.select_day(
      // GLib DateTime from date
      new Date(selectedDate) as any
    );
  }

  if (onDateSelect) {
    calendar.connect('day-selected', () => {
      const dt = calendar.get_date();
      onDateSelect(new Date(dt as any));
    });
  }

  return calendar;
}
