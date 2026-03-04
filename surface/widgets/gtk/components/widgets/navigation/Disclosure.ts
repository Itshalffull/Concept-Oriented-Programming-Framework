// ============================================================
// Clef Surface GTK Widget — Disclosure
//
// Simple show/hide toggle for content. Uses Gtk.Expander for
// native disclosure triangle behavior with expandable content.
//
// Adapts the disclosure.widget spec: anatomy (root, trigger,
// content), states (open, closed), and connect attributes
// to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface DisclosureProps {
  label?: string;
  open?: boolean;
  content?: Gtk.Widget | null;
  onChange?: (open: boolean) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 Expander widget for simple show/hide
 * disclosure of content.
 */
export function createDisclosure(props: DisclosureProps = {}): Gtk.Widget {
  const {
    label = 'Details',
    open = false,
    content = null,
    onChange,
  } = props;

  const expander = new Gtk.Expander({
    label,
    expanded: open,
  });

  if (content) {
    expander.set_child(content);
  }

  if (onChange) {
    expander.connect('notify::expanded', () => {
      onChange(expander.get_expanded());
    });
  }

  return expander;
}
