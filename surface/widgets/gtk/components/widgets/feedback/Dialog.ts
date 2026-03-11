// ============================================================
// Clef Surface GTK Widget — Dialog
//
// Modal overlay that captures focus and blocks interaction with
// the underlying content until dismissed. Supports a title bar,
// description, arbitrary body content, and optional close button.
//
// Uses Adw.Window or Gtk.Window as a modal dialog with
// title, description, body content, and close IconButton.
// See widget spec: repertoire/widgets/feedback/dialog.widget
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

// --------------- Props ---------------

export interface DialogProps {
  open?: boolean;
  title?: string | null;
  description?: string | null;
  closable?: boolean;
  parent?: Gtk.Window | null;
  onClose?: () => void;
  content?: Gtk.Widget | null;
}

// --------------- Component ---------------

/**
 * Creates a GTK4/Adwaita modal dialog with title, description,
 * body content, and optional close button.
 */
export function createDialog(props: DialogProps = {}): Gtk.Widget {
  const {
    open = false,
    title = null,
    description = null,
    closable = true,
    parent = null,
    onClose,
    content = null,
  } = props;

  const dialog = new Adw.Window({
    title: title ?? '',
    modal: true,
    transientFor: parent,
    defaultWidth: 400,
    defaultHeight: 300,
  });

  const toolbarView = new Adw.ToolbarView();

  // Header bar with close button
  const headerBar = new Adw.HeaderBar();
  toolbarView.add_top_bar(headerBar);

  // Content area
  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 12,
    marginTop: 16,
    marginBottom: 16,
    marginStart: 16,
    marginEnd: 16,
  });

  if (description) {
    const descLabel = new Gtk.Label({
      label: description,
      wrap: true,
      xalign: 0,
    });
    descLabel.get_style_context().add_class('dim-label');
    box.append(descLabel);
  }

  if (content) {
    box.append(content);
  }

  toolbarView.set_content(box);
  dialog.set_content(toolbarView);

  if (onClose) {
    dialog.connect('close-request', () => {
      onClose();
      return false;
    });
  }

  if (open) {
    dialog.present();
  }

  return dialog;
}
