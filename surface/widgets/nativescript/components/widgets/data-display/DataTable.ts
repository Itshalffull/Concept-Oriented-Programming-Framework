// ============================================================
// Clef Surface NativeScript Widget — DataTable
//
// Sortable, selectable data table with header and rows.
// ============================================================

import { StackLayout, GridLayout, Label, ScrollView } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface DataTableColumn { key: string; header: string; sortable?: boolean; }

export interface DataTableProps {
  columns: DataTableColumn[];
  data: Record<string, unknown>[];
  sortable?: boolean;
  selectable?: boolean;
  stickyHeader?: boolean;
  sortColumn?: string;
  sortDirection?: 'ascending' | 'descending' | 'none';
  ariaLabel?: string;
  loading?: boolean;
  emptyMessage?: string;
  size?: 'sm' | 'md' | 'lg';
  onSort?: (column: string, direction: 'ascending' | 'descending') => void;
  onRowSelect?: (index: number) => void;
  onRowDeselect?: (index: number) => void;
  footer?: View;
  pagination?: View;
  children?: View[];
}

export function createDataTable(props: DataTableProps): StackLayout {
  const {
    columns, data, sortable = true, selectable = false,
    stickyHeader = false, sortColumn, sortDirection = 'none',
    ariaLabel = 'Data table', loading = false,
    emptyMessage = 'No data available', size = 'md',
    onSort, onRowSelect, onRowDeselect, footer, pagination, children = [],
  } = props;

  const container = new StackLayout();
  container.className = `clef-widget-data-table clef-size-${size}`;
  container.accessibilityLabel = ariaLabel;

  const headerRow = new StackLayout();
  headerRow.orientation = 'horizontal';
  headerRow.className = 'clef-data-table-header';
  for (const col of columns) {
    const headerCell = new Label();
    headerCell.text = col.header + (sortColumn === col.key ? (sortDirection === 'ascending' ? ' \u25B2' : ' \u25BC') : '');
    headerCell.fontWeight = 'bold';
    headerCell.className = 'clef-data-table-header-cell';
    if (sortable && col.sortable !== false) {
      headerCell.on('tap', () => {
        const dir = sortColumn === col.key && sortDirection === 'ascending' ? 'descending' : 'ascending';
        onSort?.(col.key, dir);
      });
    }
    headerRow.addChild(headerCell);
  }
  container.addChild(headerRow);

  if (loading) {
    const loadingLabel = new Label();
    loadingLabel.text = 'Loading...';
    loadingLabel.horizontalAlignment = 'center';
    container.addChild(loadingLabel);
  } else if (data.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = emptyMessage;
    emptyLabel.horizontalAlignment = 'center';
    container.addChild(emptyLabel);
  } else {
    for (let i = 0; i < data.length; i++) {
      const row = new StackLayout();
      row.orientation = 'horizontal';
      row.className = 'clef-data-table-row';
      if (selectable) {
        row.on('tap', () => onRowSelect?.(i));
      }
      for (const col of columns) {
        const cell = new Label();
        cell.text = String(data[i][col.key] ?? '');
        cell.className = 'clef-data-table-cell';
        row.addChild(cell);
      }
      container.addChild(row);
    }
  }

  if (footer) container.addChild(footer);
  if (pagination) container.addChild(pagination);
  for (const child of children) container.addChild(child);

  return container;
}

export default createDataTable;
