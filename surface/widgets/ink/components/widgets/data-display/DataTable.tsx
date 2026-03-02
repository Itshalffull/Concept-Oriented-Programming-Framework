// ============================================================
// Clef Surface Ink Widget — DataTable
//
// Sortable data table with configurable columns, row selection,
// and keyboard navigation. Terminal adaptation: ASCII table with
// box-drawing characters for column/row separators, header
// underline, sort indicators, and selectable row checkboxes.
// See widget spec: repertoire/widgets/data-display/data-table.widget
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface DataTableColumn {
  key: string;
  label: string;
  width?: number;
  sortable?: boolean;
}

// --------------- Props ---------------

export interface DataTableProps {
  /** Column definitions. */
  columns: DataTableColumn[];
  /** Row data — each object uses column keys. */
  data: Record<string, unknown>[];
  /** Currently sorted column key. */
  sortColumn?: string;
  /** Sort direction. */
  sortDirection?: 'ascending' | 'descending' | 'none';
  /** Whether rows are selectable. */
  selectable?: boolean;
  /** Whether data is loading. */
  loading?: boolean;
  /** Message shown when data is empty. */
  emptyMessage?: string;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when a column header is clicked for sorting. */
  onSort?: (column: string, direction: 'ascending' | 'descending') => void;
  /** Callback when a row is selected. */
  onSelectRow?: (rowIndex: number) => void;
}

// --------------- Helpers ---------------

function resolveColumnWidth(col: DataTableColumn, data: Record<string, unknown>[]): number {
  if (col.width) return col.width;
  const headerLen = col.label.length;
  const maxDataLen = data.reduce((max, row) => {
    const val = String(row[col.key] ?? '');
    return Math.max(max, val.length);
  }, 0);
  return Math.max(headerLen, maxDataLen, 3) + 2;
}

// --------------- Component ---------------

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  sortColumn,
  sortDirection = 'none',
  selectable = false,
  loading = false,
  emptyMessage = 'No data available',
  isFocused = false,
  onSort,
  onSelectRow,
}) => {
  const [focusRow, setFocusRow] = useState(0);
  const [focusCol, setFocusCol] = useState(0);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const colWidths = columns.map((col) => resolveColumnWidth(col, data));
  // Extra column for selection checkbox
  const selColWidth = selectable ? 4 : 0;

  const toggleRow = useCallback(
    (rowIndex: number) => {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        if (next.has(rowIndex)) {
          next.delete(rowIndex);
        } else {
          next.add(rowIndex);
        }
        return next;
      });
      onSelectRow?.(rowIndex);
    },
    [onSelectRow],
  );

  useInput(
    (input, key) => {
      if (!isFocused) return;

      // Navigation: header row is index -1 conceptually, data rows are 0..N-1
      // focusRow -1 means header row
      if (key.upArrow) {
        setFocusRow((r) => Math.max(-1, r - 1));
      } else if (key.downArrow) {
        setFocusRow((r) => Math.min(data.length - 1, r + 1));
      } else if (key.leftArrow) {
        setFocusCol((c) => Math.max(0, c - 1));
      } else if (key.rightArrow) {
        setFocusCol((c) => Math.min(columns.length - 1, c + 1));
      } else if (key.return) {
        // If on header row and column is sortable, trigger sort
        if (focusRow === -1) {
          const col = columns[focusCol];
          if (col?.sortable && onSort) {
            const newDir =
              sortColumn === col.key && sortDirection === 'ascending'
                ? 'descending'
                : 'ascending';
            onSort(col.key, newDir);
          }
        }
      } else if (input === ' ' && selectable && focusRow >= 0) {
        toggleRow(focusRow);
      }
    },
    { isActive: isFocused },
  );

  if (loading) {
    return (
      <Box paddingY={1}>
        <Text dimColor>Loading...</Text>
      </Box>
    );
  }

  if (data.length === 0) {
    return (
      <Box paddingY={1}>
        <Text dimColor>{emptyMessage}</Text>
      </Box>
    );
  }

  // Build separator line
  const separatorParts = colWidths.map((w) => '\u2500'.repeat(w));
  const separator = (selectable ? '\u2500'.repeat(selColWidth) + '\u253C' : '') +
    separatorParts.join('\u253C');

  // Sort indicator
  const sortIndicator = (colKey: string): string => {
    if (sortColumn !== colKey) return '';
    return sortDirection === 'ascending' ? ' \u25B2' : sortDirection === 'descending' ? ' \u25BC' : '';
  };

  return (
    <Box flexDirection="column">
      {/* Header row */}
      <Box>
        {selectable && (
          <Box width={selColWidth}>
            <Text dimColor>{'   \u2502'}</Text>
          </Box>
        )}
        {columns.map((col, ci) => {
          const w = colWidths[ci];
          const isFocusedCell = isFocused && focusRow === -1 && focusCol === ci;
          const indicator = sortIndicator(col.key);
          const headerText = (col.label + indicator).padEnd(w, ' ').slice(0, w);
          const sep = ci < columns.length - 1 ? '\u2502' : '';

          return (
            <Box key={`hdr-${col.key}`}>
              <Text
                bold
                color={isFocusedCell ? 'cyan' : undefined}
                inverse={isFocusedCell}
              >
                {headerText}
              </Text>
              {sep && <Text dimColor>{sep}</Text>}
            </Box>
          );
        })}
      </Box>

      {/* Header separator */}
      <Text dimColor>{separator}</Text>

      {/* Data rows */}
      {data.map((row, ri) => {
        const isRowSelected = selectedRows.has(ri);
        const isRowFocused = isFocused && focusRow === ri;

        return (
          <Box key={`row-${ri}`}>
            {selectable && (
              <Box width={selColWidth}>
                <Text color={isRowSelected ? 'green' : undefined}>
                  {isRowSelected ? '[x]' : '[ ]'}
                  {'\u2502'}
                </Text>
              </Box>
            )}
            {columns.map((col, ci) => {
              const w = colWidths[ci];
              const cellValue = String(row[col.key] ?? '').padEnd(w, ' ').slice(0, w);
              const isFocusedCell = isRowFocused && focusCol === ci;
              const sep = ci < columns.length - 1 ? '\u2502' : '';

              return (
                <Box key={`cell-${ri}-${col.key}`}>
                  <Text
                    color={isFocusedCell ? 'cyan' : isRowSelected ? 'green' : undefined}
                    inverse={isFocusedCell}
                  >
                    {cellValue}
                  </Text>
                  {sep && <Text dimColor>{sep}</Text>}
                </Box>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
};

DataTable.displayName = 'DataTable';
export default DataTable;
