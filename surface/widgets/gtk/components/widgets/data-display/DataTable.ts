// ============================================================
// Clef Surface GTK Widget — DataTable
//
// Sortable data table with configurable columns, row selection,
// and header sort indicators. Uses Gtk.ColumnView with
// Gtk.ColumnViewColumn for structured tabular data display.
//
// Adapts the data-table.widget spec: anatomy (root, header,
// headerCell, body, row, cell, sortIndicator), states (idle,
// loading, empty), and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface DataTableColumn {
  key: string;
  label: string;
  width?: number;
  sortable?: boolean;
}

export type SortDirection = 'ascending' | 'descending' | 'none';

// --------------- Props ---------------

export interface DataTableProps {
  columns?: DataTableColumn[];
  data?: Record<string, any>[];
  sortColumn?: string | null;
  sortDirection?: SortDirection;
  selectable?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  onSort?: (column: string, direction: SortDirection) => void;
  onSelectRow?: (rowIndex: number, selected: boolean) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 data table using Gtk.Grid for sortable column
 * display with optional row selection checkboxes.
 */
export function createDataTable(props: DataTableProps = {}): Gtk.Widget {
  const {
    columns = [],
    data = [],
    sortColumn = null,
    sortDirection = 'none',
    selectable = false,
    loading = false,
    emptyMessage = 'No data available',
    onSort,
    onSelectRow,
  } = props;

  if (loading) {
    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, halign: Gtk.Align.CENTER });
    box.append(new Gtk.Spinner({ spinning: true }));
    box.append(new Gtk.Label({ label: 'Loading...' }));
    return box;
  }

  if (data.length === 0) {
    return new Gtk.Label({ label: emptyMessage });
  }

  const scrolled = new Gtk.ScrolledWindow({
    hscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
    vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
  });

  const grid = new Gtk.Grid({
    columnSpacing: 16,
    rowSpacing: 4,
  });

  let colOffset = 0;

  // Checkbox column header
  if (selectable) {
    grid.attach(new Gtk.Label({ label: '' }), 0, 0, 1, 1);
    colOffset = 1;
  }

  // Column headers
  columns.forEach((col, idx) => {
    const headerBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 4,
    });

    const headerLabel = new Gtk.Label({ label: col.label, xalign: 0 });
    headerLabel.get_style_context().add_class('heading');
    headerBox.append(headerLabel);

    if (col.sortable && col.key === sortColumn) {
      const sortIcon = sortDirection === 'ascending'
        ? 'pan-up-symbolic'
        : 'pan-down-symbolic';
      headerBox.append(new Gtk.Image({ iconName: sortIcon, pixelSize: 12 }));
    }

    if (col.sortable) {
      const gesture = new Gtk.GestureClick();
      gesture.connect('released', () => {
        const newDir: SortDirection =
          sortColumn === col.key && sortDirection === 'ascending'
            ? 'descending'
            : 'ascending';
        onSort?.(col.key, newDir);
      });
      headerBox.add_controller(gesture);
    }

    grid.attach(headerBox, idx + colOffset, 0, 1, 1);
  });

  // Data rows
  const selectedRows = new Set<number>();

  data.forEach((row, rowIdx) => {
    if (selectable) {
      const check = new Gtk.CheckButton();
      check.connect('toggled', () => {
        const checked = check.get_active();
        if (checked) {
          selectedRows.add(rowIdx);
        } else {
          selectedRows.delete(rowIdx);
        }
        onSelectRow?.(rowIdx, checked);
      });
      grid.attach(check, 0, rowIdx + 1, 1, 1);
    }

    columns.forEach((col, colIdx) => {
      const cellValue = row[col.key]?.toString() ?? '';
      const label = new Gtk.Label({
        label: cellValue,
        xalign: 0,
        ellipsize: 3, // PANGO_ELLIPSIZE_END
      });
      grid.attach(label, colIdx + colOffset, rowIdx + 1, 1, 1);
    });
  });

  scrolled.set_child(grid);
  return scrolled;
}
