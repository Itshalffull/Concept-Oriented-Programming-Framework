'use client';

/**
 * DataTable — Sortable, filterable table with expandable rows.
 * Implements repertoire/widgets/data-display/data-table.widget
 *
 * Rows with a `_children` array field can be expanded to reveal a nested
 * sub-table, enabling recursive tree rendering in table views.
 */

import React, { useState, useCallback } from 'react';

export interface ColumnDef {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: Record<string, unknown>, index?: number) => React.ReactNode;
  /** Custom header cell renderer — used for checkbox select-all columns */
  headerRender?: () => React.ReactNode;
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
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

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

  const toggleExpand = useCallback((index: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const sortedData = React.useMemo(() => {
    if (!sortColumn) return data;
    return [...data].sort((a, b) => {
      const aVal = String(a[sortColumn] ?? '');
      const bVal = String(b[sortColumn] ?? '');
      const cmp = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [data, sortColumn, sortDirection]);

  // Check if any rows have expandable children
  const hasExpandableRows = data.some(row =>
    Array.isArray(row._children) && (row._children as unknown[]).length > 0
  );

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
          {hasExpandableRows && <th style={{ width: 28 }} />}
          {columns.map((col) => (
            <th
              key={col.key}
              onClick={sortable && col.sortable !== false && !col.headerRender ? () => handleSort(col.key) : undefined}
              style={sortable && col.sortable !== false && !col.headerRender ? { cursor: 'pointer' } : undefined}
              aria-sort={
                sortColumn === col.key
                  ? sortDirection === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : undefined
              }
            >
              {col.headerRender ? col.headerRender() : (
                <>
                  {col.label}
                  {sortColumn === col.key && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                </>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedData.map((row, i) => {
          const children = Array.isArray(row._children) ? row._children as Record<string, unknown>[] : null;
          const isExpandable = children && children.length > 0;
          const isExpanded = expanded.has(i);

          return (
            <React.Fragment key={i}>
              <tr
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {hasExpandableRows && (
                  <td
                    style={{ width: 28, padding: '0 4px', textAlign: 'center' }}
                    onClick={isExpandable ? (e) => { e.stopPropagation(); toggleExpand(i); } : undefined}
                  >
                    {isExpandable && (
                      <span style={{
                        display: 'inline-block',
                        fontSize: '10px',
                        cursor: 'pointer',
                        color: 'var(--palette-on-surface-variant)',
                        transition: 'transform 0.15s',
                        transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                        userSelect: 'none',
                      }}>
                        ▼
                      </span>
                    )}
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(row[col.key], row, i) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
              {/* Expanded children — nested table */}
              {isExpanded && children && (
                <tr>
                  <td
                    colSpan={columns.length + (hasExpandableRows ? 1 : 0)}
                    style={{ padding: '0 0 0 24px', background: 'var(--palette-surface-variant)' }}
                  >
                    <DataTable
                      columns={columns}
                      data={children}
                      sortable={sortable}
                      ariaLabel={`${ariaLabel} — nested`}
                      onRowClick={onRowClick}
                    />
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
};

export default DataTable;
