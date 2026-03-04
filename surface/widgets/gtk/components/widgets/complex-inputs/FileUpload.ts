// ============================================================
// Clef Surface GTK Widget — FileUpload
//
// File selection and upload control. Uses Gtk.FileDialog for
// native file chooser with drag-and-drop support and file
// list display.
//
// Adapts the file-upload.widget spec: anatomy (root, dropzone,
// fileList, fileItem, removeButton, trigger), states (idle,
// dragOver, uploading, complete, error), and connect attributes
// to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface FileUploadProps {
  accept?: string | null;
  multiple?: boolean;
  disabled?: boolean;
  label?: string;
  onFilesSelected?: (files: string[]) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 file upload control with a button trigger
 * and selected file list display.
 */
export function createFileUpload(props: FileUploadProps = {}): Gtk.Widget {
  const {
    multiple = false,
    disabled = false,
    label = 'Choose files...',
    onFilesSelected,
  } = props;

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
  });

  // Drop zone / trigger area
  const dropZone = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
    halign: Gtk.Align.CENTER,
  });
  dropZone.get_style_context().add_class('card');

  dropZone.append(new Gtk.Image({
    iconName: 'document-open-symbolic',
    pixelSize: 32,
  }));
  dropZone.append(new Gtk.Label({ label }));

  const browseBtn = new Gtk.Button({ label: 'Browse' });
  browseBtn.get_style_context().add_class('suggested-action');
  browseBtn.set_sensitive(!disabled);

  browseBtn.connect('clicked', () => {
    const dialog = new Gtk.FileDialog();
    // File dialog opening is async in GTK4
    if (multiple) {
      dialog.open_multiple(null, null, (_dialog: Gtk.FileDialog, result: any) => {
        try {
          const fileList = dialog.open_multiple_finish(result);
          const paths: string[] = [];
          for (let i = 0; i < fileList.get_n_items(); i++) {
            const file = fileList.get_item(i);
            paths.push((file as any).get_path());
          }
          onFilesSelected?.(paths);
        } catch {
          // User cancelled
        }
      });
    } else {
      dialog.open(null, null, (_dialog: Gtk.FileDialog, result: any) => {
        try {
          const file = dialog.open_finish(result);
          onFilesSelected?.([(file as any).get_path()]);
        } catch {
          // User cancelled
        }
      });
    }
  });

  dropZone.append(browseBtn);
  container.append(dropZone);

  // File list (initially empty)
  const fileListBox = new Gtk.ListBox({
    selectionMode: Gtk.SelectionMode.NONE,
  });
  container.append(fileListBox);

  return container;
}
