// ============================================================
// Clef Surface GTK Widget — PermissionMatrix
//
// Grid-based role/permission matrix editor. Rows represent
// roles, columns represent permissions, cells are checkboxes.
//
// Adapts the permission-matrix.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface PermissionMatrixProps {
  roles?: string[];
  permissions?: string[];
  matrix?: Record<string, Record<string, boolean>>;
  disabled?: boolean;
  onChange?: (role: string, permission: string, granted: boolean) => void;
}

// --------------- Component ---------------

export function createPermissionMatrix(props: PermissionMatrixProps = {}): Gtk.Widget {
  const { roles = [], permissions = [], matrix = {}, disabled = false, onChange } = props;

  const scrolled = new Gtk.ScrolledWindow({ hscrollbarPolicy: Gtk.PolicyType.AUTOMATIC, vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC });
  const grid = new Gtk.Grid({ columnSpacing: 8, rowSpacing: 4 });

  // Header row
  grid.attach(new Gtk.Label({ label: '' }), 0, 0, 1, 1);
  permissions.forEach((perm, col) => {
    const label = new Gtk.Label({ label: perm });
    label.get_style_context().add_class('heading');
    grid.attach(label, col + 1, 0, 1, 1);
  });

  // Role rows
  roles.forEach((role, rowIdx) => {
    grid.attach(new Gtk.Label({ label: role, xalign: 0 }), 0, rowIdx + 1, 1, 1);
    permissions.forEach((perm, colIdx) => {
      const check = new Gtk.CheckButton({ active: matrix[role]?.[perm] ?? false });
      check.set_sensitive(!disabled);
      check.connect('toggled', () => onChange?.(role, perm, check.get_active()));
      grid.attach(check, colIdx + 1, rowIdx + 1, 1, 1);
    });
  });

  scrolled.set_child(grid);
  return scrolled;
}
