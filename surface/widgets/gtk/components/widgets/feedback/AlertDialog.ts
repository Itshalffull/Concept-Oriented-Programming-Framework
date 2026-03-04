// ============================================================
// Clef Surface GTK Widget — AlertDialog
//
// Confirmation dialog with title, description, and action
// buttons. Uses Adw.MessageDialog for native GNOME alert
// dialog presentation.
//
// Adapts the alert-dialog.widget spec: anatomy (root, backdrop,
// content, title, description, actions, cancel, action), states
// (open, closed), and connect attributes to GTK4/Adwaita
// rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

// --------------- Props ---------------

export interface AlertDialogProps {
  open?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  parent?: Gtk.Window | null;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// --------------- Component ---------------

/**
 * Creates an Adwaita MessageDialog for confirmation prompts with
 * configurable title, description, and action buttons.
 */
export function createAlertDialog(props: AlertDialogProps = {}): Gtk.Widget {
  const {
    title = 'Confirm',
    description = '',
    confirmLabel = 'OK',
    cancelLabel = 'Cancel',
    destructive = false,
    parent = null,
    onConfirm,
    onCancel,
  } = props;

  const dialog = new Adw.MessageDialog({
    heading: title,
    body: description,
    transientFor: parent,
    modal: true,
  });

  dialog.add_response('cancel', cancelLabel);
  dialog.add_response('confirm', confirmLabel);

  dialog.set_response_appearance(
    'confirm',
    destructive ? Adw.ResponseAppearance.DESTRUCTIVE : Adw.ResponseAppearance.SUGGESTED,
  );

  dialog.set_default_response('confirm');
  dialog.set_close_response('cancel');

  dialog.connect('response', (_dialog: Adw.MessageDialog, response: string) => {
    if (response === 'confirm') {
      onConfirm?.();
    } else {
      onCancel?.();
    }
  });

  return dialog;
}
