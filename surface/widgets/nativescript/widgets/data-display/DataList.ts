// ============================================================
// Clef Surface NativeScript Widget — DataList
//
// Scrollable data list with sorting, item rendering, and
// optional search filtering. Built on NativeScript ScrollView
// with StackLayout rows and column-based sort controls.
// ============================================================

import { StackLayout, GridLayout, ScrollView, Label, Button, Color } from '@nativescript/core';

// --------------- Types ---------------

export type SortDirection = 'asc' | 'desc' | 'none';

export interface DataListColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
}

export interface DataListRow {
  [key: string]: string | number | boolean;
}

// --------------- Props ---------------

export interface DataListProps {
  columns?: DataListColumn[];
  rows?: DataListRow[];
  sortColumn?: string;
  sortDirection?: SortDirection;
  maxHeight?: number;
  rowHeight?: number;
  headerColor?: string;
  dividerColor?: string;
  highlightColor?: string;
  onSort?: (column: string, direction: SortDirection) => void;
  onRowTap?: (row: DataListRow, index: number) => void;
}

// --------------- Helpers ---------------

function sortRows(
  rows: DataListRow[],
  column: string,
  direction: SortDirection,
): DataListRow[] {
  if (direction === 'none' || !column) return rows;
  return [...rows].sort((a, b) => {
    const aVal = a[column];
    const bVal = b[column];
    if (aVal === bVal) return 0;
    const cmp = aVal < bVal ? -1 : 1;
    return direction === 'asc' ? cmp : -cmp;
  });
}

// --------------- Component ---------------

export function createDataList(props: DataListProps = {}): StackLayout {
  const {
    columns = [],
    rows = [],
    sortColumn = '',
    sortDirection = 'none',
    maxHeight = 400,
    rowHeight = 40,
    headerColor = '#F5F5F5',
    dividerColor = '#E0E0E0',
    highlightColor = '#E3F2FD',
    onSort,
    onRowTap,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-data-list';

  if (columns.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No columns defined';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 16;
    container.addChild(emptyLabel);
    return container;
  }

  const colDefs = columns.map((c) => c.width || '*').join(', ');

  // --- Header Row ---
  const headerRow = new GridLayout();
  headerRow.className = 'clef-data-list-header';
  headerRow.columns = colDefs;
  headerRow.height = rowHeight;
  headerRow.backgroundColor = headerColor as any;
  headerRow.borderBottomWidth = 2;
  headerRow.borderBottomColor = dividerColor;

  columns.forEach((col, i) => {
    const headerCell = new GridLayout();
    headerCell.columns = '*, auto';
    headerCell.verticalAlignment = 'middle';
    headerCell.padding = '0 8';

    const headerLabel = new Label();
    headerLabel.text = col.label;
    headerLabel.fontWeight = 'bold';
    headerLabel.fontSize = 13;
    GridLayout.setColumn(headerLabel, 0);
    headerCell.addChild(headerLabel);

    if (col.sortable) {
      const sortIndicator = new Label();
      if (sortColumn === col.key) {
        sortIndicator.text = sortDirection === 'asc' ? '\u25B2' : '\u25BC';
        sortIndicator.opacity = 1;
      } else {
        sortIndicator.text = '\u25B2';
        sortIndicator.opacity = 0.3;
      }
      sortIndicator.fontSize = 10;
      sortIndicator.verticalAlignment = 'middle';
      GridLayout.setColumn(sortIndicator, 1);
      headerCell.addChild(sortIndicator);

      headerCell.on('tap', () => {
        const newDir: SortDirection =
          sortColumn === col.key
            ? sortDirection === 'asc'
              ? 'desc'
              : 'asc'
            : 'asc';
        onSort?.(col.key, newDir);
      });
    }

    GridLayout.setColumn(headerCell, i);
    headerRow.addChild(headerCell);
  });

  container.addChild(headerRow);

  // --- Scrollable Rows ---
  const scrollView = new ScrollView();
  scrollView.className = 'clef-data-list-scroll';
  scrollView.height = maxHeight;

  const rowContainer = new StackLayout();
  rowContainer.className = 'clef-data-list-rows';

  const sortedRows = sortRows(rows, sortColumn, sortDirection);

  if (sortedRows.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No data';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 24;
    rowContainer.addChild(emptyLabel);
  } else {
    sortedRows.forEach((row, rowIndex) => {
      const rowGrid = new GridLayout();
      rowGrid.className = 'clef-data-list-row';
      rowGrid.columns = colDefs;
      rowGrid.height = rowHeight;
      rowGrid.borderBottomWidth = 1;
      rowGrid.borderBottomColor = dividerColor;

      if (rowIndex % 2 === 0) {
        rowGrid.backgroundColor = '#FAFAFA' as any;
      }

      columns.forEach((col, colIndex) => {
        const cellLabel = new Label();
        cellLabel.text = `${row[col.key] ?? ''}`;
        cellLabel.fontSize = 13;
        cellLabel.verticalAlignment = 'middle';
        cellLabel.padding = '0 8';
        cellLabel.textWrap = false;
        GridLayout.setColumn(cellLabel, colIndex);
        rowGrid.addChild(cellLabel);
      });

      if (onRowTap) {
        rowGrid.on('tap', () => onRowTap(row, rowIndex));
      }

      rowContainer.addChild(rowGrid);
    });
  }

  scrollView.content = rowContainer;
  container.addChild(scrollView);

  return container;
}

createDataList.displayName = 'DataList';
export default createDataList;
