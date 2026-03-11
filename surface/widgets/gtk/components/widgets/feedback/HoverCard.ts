// ============================================================
// Clef Surface GTK Widget — HoverCard
//
// Rich popover displayed on hover. Uses Gtk.Popover attached
// to a target widget with enter/leave event controllers for
// hover-based activation.
//
// Adapts the hover-card.widget spec: anatomy (root, trigger,
// content, arrow), states (open, closed), and connect
// attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface HoverCardProps {
  target?: Gtk.Widget | null;
  content?: Gtk.Widget | null;
  delay?: number;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 hover card as a Gtk.Popover shown on pointer
 * hover over the target widget.
 */
export function createHoverCard(props: HoverCardProps = {}): Gtk.Widget {
  const {
    target = null,
    content = null,
    delay = 300,
  } = props;

  const popover = new Gtk.Popover();

  if (content) {
    popover.set_child(content);
  }

  if (target) {
    popover.set_parent(target);

    let hoverTimeout: number | null = null;

    const motionCtrl = new Gtk.EventControllerMotion();
    motionCtrl.connect('enter', () => {
      hoverTimeout = setTimeout(() => popover.popup(), delay) as unknown as number;
    });
    motionCtrl.connect('leave', () => {
      if (hoverTimeout !== null) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
      popover.popdown();
    });
    target.add_controller(motionCtrl);
  }

  return popover;
}
