'use client';

/**
 * DataTable — Sortable, filterable table with expandable rows.
 * Implements repertoire/widgets/data-display/data-table.widget
 *
 * Rows with a `_children` array field can be expanded to reveal a nested
 * sub-table, enabling recursive tree rendering in table views.
 *
 * Keyboard navigation (KB-18):
 * The root container carries data-keybinding-scope="app.display.table" so
 * the global useKeyBindings dispatcher routes arrow-key events through the
 * KeyBinding / ActionBinding pipeline. The widget listens for the resulting
 * `clef:display-nav` CustomEvent and updates its selection state.
 *
 * Navigation signals: table-row-prev, table-row-next, table-cell-prev,
 * table-cell-next, table-row-activate, table-row-toggle-expand.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';

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

  // Keyboard navigation state (KB-18)
  const [selectedRow, setSelectedRow] = useState<number>(-1);
  const [selectedCol, setSelectedCol] = useState<number>(-1);
  const rootRef = useRef<HTMLTableElement>(null);

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

  // ── Keyboard navigation (KB-18) ───────────────────────────────────
  // Listen for `clef:display-nav` CustomEvents dispatched by the
  // DisplayNav/dispatch ActionBinding. The global useKeyBindings hook
  // intercepts arrow-key events within scope "app.display.table" and
  // routes them through the KeyBinding → ActionBinding pipeline, which
  // fires a CustomEvent that this handler receives.
  //
  // Stable refs keep the event listener stable across renders without
  // needing to re-register on every sortedData/column change.
  const sortedDataRef = useRef(sortedData);
  sortedDataRef.current = sortedData;
  const colCountRef = useRef(columns.length);
  colCountRef.current = columns.length;
  const onRowClickRef = useRef(onRowClick);
  onRowClickRef.current = onRowClick;
  const toggleExpandRef = useRef(toggleExpand);
  toggleExpandRef.current = toggleExpand;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const handleNav = (e: Event) => {
      const { action } = (e as CustomEvent<{ action: string }>).detail;

      setSelectedRow(prev => {
        const rows = sortedDataRef.current;
        if (rows.length === 0) return prev;
        switch (action) {
          case 'table-row-prev':
            return prev <= 0 ? 0 : prev - 1;
          case 'table-row-next':
            return Math.min(rows.length - 1, prev < 0 ? 0 : prev + 1);
          case 'table-row-activate': {
            const row = rows[prev >= 0 ? prev : 0];
            if (row) onRowClickRef.current?.(row);
            return prev;
          }
          case 'table-row-toggle-expand': {
            const idx = prev >= 0 ? prev : 0;
            toggleExpandRef.current(idx);
            return prev;
          }
          default:
            return prev;
        }
      });

      setSelectedCol(prev => {
        const colCount = colCountRef.current;
        if (colCount === 0) return prev;
        switch (action) {
          case 'table-cell-prev':
            return prev <= 0 ? 0 : prev - 1;
          case 'table-cell-next':
            return Math.min(colCount - 1, prev < 0 ? 0 : prev + 1);
          default:
            return prev;
        }
      });
    };

    el.addEventListener('clef:display-nav', handleNav);
    return () => el.removeEventListener('clef:display-nav', handleNav);
  }, []); // stable — reads current values through refs

  if (data.length === 0) {
    return (
      <div data-part="empty-state" role="status">
        <div data-part="title">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <table
      ref={rootRef}
      data-part="data-table"
      data-surface="display-table"
      data-keybinding-scope="app.display.table"
      role="grid"
      aria-label={ariaLabel}
      tabIndex={0}
    >
      <thead>
        <tr>
          {hasExpandableRows && <th data-part="expand-cell" aria-hidden="true" />}
          {columns.map((col) => (
            <th
              key={col.key}
              onClick={sortable && col.sortable !== false && !col.headerRender ? () => handleSort(col.key) : undefined}
              data-sortable={sortable && col.sortable !== false && !col.headerRender ? 'true' : undefined}
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
                data-clickable={onRowClick ? 'true' : undefined}
                data-selected={selectedRow === i ? 'true' : undefined}
                aria-selected={selectedRow === i}
              >
                {hasExpandableRows && (
                  <td
                    data-part="expand-cell"
                    onClick={isExpandable ? (e) => { e.stopPropagation(); toggleExpand(i); } : undefined}
                  >
                    {isExpandable && (
                      <span data-part="expand-toggle" data-state={isExpanded ? 'expanded' : 'collapsed'}>
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
                    data-part="nested-table"
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
