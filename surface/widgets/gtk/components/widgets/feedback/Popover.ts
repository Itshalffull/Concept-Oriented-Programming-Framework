// ============================================================
// Clef Surface GTK Widget — Popover
//
// Floating content panel anchored to a trigger element. Uses
// Gtk.Popover for native popover behavior with arrow pointing
// to the anchor widget.
//
// Adapts the popover.widget spec: anatomy (root, trigger,
// positioner, content, arrow, close), states (open, closed),
// and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface PopoverProps {
  target?: Gtk.Widget | null;
  content?: Gtk.Widget | null;
  position?: Gtk.PositionType;
  hasArrow?: boolean;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 Popover anchored to a target widget with
 * configurable position and arrow display.
 */
export function createPopover(props: PopoverProps = {}): Gtk.Widget {
  const {
    target = null,
    content = null,
    position = Gtk.PositionType.BOTTOM,
    hasArrow = true,
  } = props;

  const popover = new Gtk.Popover({
    position,
    hasArrow,
  });

  if (content) {
    popover.set_child(content);
  }

  if (target) {
    popover.set_parent(target);
  }

  return popover;
}
