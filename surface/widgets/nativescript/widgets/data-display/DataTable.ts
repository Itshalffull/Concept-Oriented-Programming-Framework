// ============================================================
// Clef Surface NativeScript Widget — DataTable
//
// Tabular data display with headers and rows using NativeScript
// GridLayout. Supports column alignment, striped rows, sticky
// header styling, and row selection.
// ============================================================

import { StackLayout, GridLayout, ScrollView, Label, Color } from '@nativescript/core';

// --------------- Types ---------------

export type ColumnAlignment = 'left' | 'center' | 'right';

export interface DataTableColumn {
  key: string;
  header: string;
  width?: string;
  alignment?: ColumnAlignment;
  formatter?: (value: any) => string;
}

export interface DataTableRow {
  [key: string]: any;
}

// --------------- Props ---------------

export interface DataTableProps {
  columns?: DataTableColumn[];
  rows?: DataTableRow[];
  striped?: boolean;
  bordered?: boolean;
  compact?: boolean;
  maxHeight?: number;
  headerBackgroundColor?: string;
  headerTextColor?: string;
  stripedColor?: string;
  borderColor?: string;
  selectedIndex?: number;
  selectedColor?: string;
  onRowTap?: (row: DataTableRow, index: number) => void;
}

// --------------- Helpers ---------------

function alignmentToNS(align: ColumnAlignment): 'left' | 'center' | 'right' {
  return align;
}

// --------------- Component ---------------

export function createDataTable(props: DataTableProps = {}): StackLayout {
  const {
    columns = [],
    rows = [],
    striped = true,
    bordered = true,
    compact = false,
    maxHeight = 500,
    headerBackgroundColor = '#37474F',
    headerTextColor = '#FFFFFF',
    stripedColor = '#FAFAFA',
    borderColor = '#E0E0E0',
    selectedIndex = -1,
    selectedColor = '#BBDEFB',
    onRowTap,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-data-table';

  if (columns.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No columns configured';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 16;
    container.addChild(emptyLabel);
    return container;
  }

  const cellPadding = compact ? '4 6' : '8 12';
  const rowMinHeight = compact ? 32 : 44;
  const colDefs = columns.map((c) => c.width || '*').join(', ');

  // --- Header ---
  const headerGrid = new GridLayout();
  headerGrid.className = 'clef-data-table-header';
  headerGrid.columns = colDefs;
  headerGrid.height = rowMinHeight;
  headerGrid.backgroundColor = headerBackgroundColor as any;

  if (bordered) {
    headerGrid.borderBottomWidth = 2;
    headerGrid.borderBottomColor = borderColor;
  }

  columns.forEach((col, i) => {
    const headerLabel = new Label();
    headerLabel.text = col.header;
    headerLabel.fontWeight = 'bold';
    headerLabel.fontSize = compact ? 12 : 13;
    headerLabel.color = new Color(headerTextColor);
    headerLabel.verticalAlignment = 'middle';
    headerLabel.padding = cellPadding;
    headerLabel.horizontalAlignment = alignmentToNS(col.alignment || 'left');
    GridLayout.setColumn(headerLabel, i);
    headerGrid.addChild(headerLabel);
  });

  container.addChild(headerGrid);

  // --- Body ---
  const scrollView = new ScrollView();
  scrollView.className = 'clef-data-table-body';
  scrollView.height = maxHeight;

  const body = new StackLayout();

  if (rows.length === 0) {
    const emptyRow = new Label();
    emptyRow.text = 'No records';
    emptyRow.opacity = 0.5;
    emptyRow.horizontalAlignment = 'center';
    emptyRow.marginTop = 24;
    body.addChild(emptyRow);
  } else {
    rows.forEach((row, rowIndex) => {
      const rowGrid = new GridLayout();
      rowGrid.className = 'clef-data-table-row';
      rowGrid.columns = colDefs;
      rowGrid.minHeight = rowMinHeight;

      // Styling
      if (rowIndex === selectedIndex) {
        rowGrid.backgroundColor = selectedColor as any;
      } else if (striped && rowIndex % 2 === 1) {
        rowGrid.backgroundColor = stripedColor as any;
      }

      if (bordered) {
        rowGrid.borderBottomWidth = 1;
        rowGrid.borderBottomColor = borderColor;
      }

      columns.forEach((col, colIndex) => {
        const rawValue = row[col.key];
        const displayValue = col.formatter ? col.formatter(rawValue) : `${rawValue ?? ''}`;

        const cellLabel = new Label();
        cellLabel.text = displayValue;
        cellLabel.fontSize = compact ? 12 : 13;
        cellLabel.verticalAlignment = 'middle';
        cellLabel.padding = cellPadding;
        cellLabel.textWrap = false;
        cellLabel.horizontalAlignment = alignmentToNS(col.alignment || 'left');
        GridLayout.setColumn(cellLabel, colIndex);
        rowGrid.addChild(cellLabel);
      });

      if (onRowTap) {
        rowGrid.on('tap', () => onRowTap(row, rowIndex));
      }

      body.addChild(rowGrid);
    });
  }

  scrollView.content = body;
  container.addChild(scrollView);

  return container;
}

createDataTable.displayName = 'DataTable';
export default createDataTable;
