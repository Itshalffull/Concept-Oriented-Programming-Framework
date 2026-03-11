// ============================================================
// Clef Surface GTK Widget — Drawer
//
// Slide-out panel from the edge of the screen. Uses
// Adw.Flap or Gtk.Revealer to create a drawer that slides
// in from the start/end side with overlay or push behavior.
//
// Adapts the drawer.widget spec: anatomy (root, backdrop,
// content, header, body, close), states (open, closed), and
// connect attributes to GTK4/Adwaita rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface DrawerProps {
  open?: boolean;
  side?: 'start' | 'end';
  title?: string | null;
  width?: number;
  content?: Gtk.Widget | null;
  onClose?: () => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 drawer panel using Gtk.Revealer for slide-out
 * panel behavior from the screen edge.
 */
export function createDrawer(props: DrawerProps = {}): Gtk.Widget {
  const {
    open = false,
    side = 'start',
    title = null,
    width = 300,
    content = null,
    onClose,
  } = props;

  const revealer = new Gtk.Revealer({
    revealChild: open,
    transitionType: side === 'end'
      ? Gtk.RevealerTransitionType.SLIDE_LEFT
      : Gtk.RevealerTransitionType.SLIDE_RIGHT,
    transitionDuration: 250,
  });

  const drawerBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    widthRequest: width,
  });
  drawerBox.get_style_context().add_class('background');

  // Header with title and close button
  const header = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });

  if (title) {
    const titleLabel = new Gtk.Label({ label: title, hexpand: true, xalign: 0 });
    titleLabel.get_style_context().add_class('title-3');
    header.append(titleLabel);
  }

  const closeBtn = new Gtk.Button({ iconName: 'window-close-symbolic' });
  closeBtn.get_style_context().add_class('flat');
  if (onClose) {
    closeBtn.connect('clicked', onClose);
  }
  header.append(closeBtn);

  drawerBox.append(header);
  drawerBox.append(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }));

  if (content) {
    drawerBox.append(content);
  }

  revealer.set_child(drawerBox);
  return revealer;
}
