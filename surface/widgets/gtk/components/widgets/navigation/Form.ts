// ============================================================
// Clef Surface GTK Widget — Form
//
// Form container with submit handling. Wraps child form
// controls in a Gtk.Box with a submit button and optional
// validation state display.
//
// Adapts the form.widget spec: anatomy (root, fields,
// submitButton, resetButton, errorSummary), states (idle,
// submitting, valid, invalid), and connect attributes to
// GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface FormProps {
  submitLabel?: string;
  resetLabel?: string | null;
  disabled?: boolean;
  content?: Gtk.Widget | null;
  onSubmit?: () => void;
  onReset?: () => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 form container with a submit button and
 * optional reset button wrapping child form controls.
 */
export function createForm(props: FormProps = {}): Gtk.Widget {
  const {
    submitLabel = 'Submit',
    resetLabel = null,
    disabled = false,
    content = null,
    onSubmit,
    onReset,
  } = props;

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 12,
  });

  if (content) {
    box.append(content);
  }

  // Button row
  const buttonRow = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
    halign: Gtk.Align.END,
  });

  if (resetLabel) {
    const resetBtn = new Gtk.Button({ label: resetLabel });
    resetBtn.set_sensitive(!disabled);
    if (onReset) resetBtn.connect('clicked', onReset);
    buttonRow.append(resetBtn);
  }

  const submitBtn = new Gtk.Button({ label: submitLabel });
  submitBtn.get_style_context().add_class('suggested-action');
  submitBtn.set_sensitive(!disabled);
  if (onSubmit) submitBtn.connect('clicked', onSubmit);
  buttonRow.append(submitBtn);

  box.append(buttonRow);
  return box;
}
