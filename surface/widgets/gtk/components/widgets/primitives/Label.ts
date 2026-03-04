// ============================================================
// Clef Surface GTK Widget — Label
//
// Accessible form-control label with optional required-field
// indicator. Uses Gtk.Label with mnemonic support to associate
// with a target widget.
//
// Adapts the label.widget spec: anatomy (root), states (idle),
// and connect attributes (data-part, data-required, for)
// to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface LabelProps {
  text?: string;
  required?: boolean;
  htmlFor?: Gtk.Widget | null;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 Label widget for form controls, appending
 * a red asterisk when the field is required.
 */
export function createLabel(props: LabelProps = {}): Gtk.Widget {
  const {
    text = '',
    required = false,
    htmlFor = null,
  } = props;

  const displayText = required ? `${text} <span foreground="red">*</span>` : text;

  const label = new Gtk.Label({
    label: displayText,
    useMarkup: required,
    xalign: 0,
  });

  if (htmlFor) {
    label.set_mnemonic_widget(htmlFor);
  }

  return label;
}
