'use client';

/**
 * DataTable — Sortable, filterable table
 * Implements repertoire/widgets/data-display/data-table.widget
 */

import React, { useState, useCallback } from 'react';

export interface ColumnDef {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

export interface DataTableProps {
  columns: ColumnDef[];
  data: Record<string, unknown>[];
  sortable?: boolean;
  ariaLabel?: string;
  emptyMessage?: string;
  onRowClick?: (row: Record<string, unknown>) => void;
}

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  sortable = false,
  ariaLabel = 'Data table',
  emptyMessage = 'No data available',
  onRowClick,
}) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = useCallback(
    (key: string) => {
      if (!sortable) return;
      if (sortColumn === key) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortColumn(key);
        setSortDirection('asc');
      }
    },
    [sortable, sortColumn],
  );

  const sortedData = React.useMemo(() => {
    if (!sortColumn) return data;
    return [...data].sort((a, b) => {
      const aVal = String(a[sortColumn] ?? '');
      const bVal = String(b[sortColumn] ?? '');
      const cmp = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [data, sortColumn, sortDirection]);

  if (data.length === 0) {
    return (
      <div data-part="empty-state" role="status">
        <div data-part="title">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <table data-part="data-table" role="grid" aria-label={ariaLabel}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              onClick={sortable && col.sortable !== false ? () => handleSort(col.key) : undefined}
              style={sortable && col.sortable !== false ? { cursor: 'pointer' } : undefined}
              aria-sort={
                sortColumn === col.key
                  ? sortDirection === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : undefined
              }
            >
              {col.label}
              {sortColumn === col.key && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedData.map((row, i) => (
          <tr
            key={i}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={onRowClick ? { cursor: 'pointer' } : undefined}
          >
            {columns.map((col) => (
              <td key={col.key}>
                {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default DataTable;
