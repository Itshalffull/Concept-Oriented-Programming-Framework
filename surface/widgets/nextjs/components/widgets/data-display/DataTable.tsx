'use client';
import {
  forwardRef,
  useReducer,
  useCallback,
  useId,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { dataTableReducer } from './DataTable.reducer.js';

// Props from data-table.widget spec
export interface DataTableColumn<T = Record<string, unknown>> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => ReactNode;
}

export interface DataTableProps<T = Record<string, unknown>> {
  columns: DataTableColumn<T>[];
  data: T[];
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
  footer?: ReactNode;
  pagination?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export const DataTable = forwardRef<HTMLTableElement, DataTableProps>(
  function DataTable(
    {
      columns,
      data,
      sortable = true,
      selectable = false,
      stickyHeader = false,
      sortColumn: controlledSortColumn,
      sortDirection: controlledSortDirection = 'none',
      ariaLabel,
      loading = false,
      emptyMessage = 'No data available',
      size = 'md',
      onSort,
      onRowSelect,
      onRowDeselect,
      footer,
      pagination,
      className,
      children,
    },
    ref
  ) {
    const [state, dispatch] = useReducer(dataTableReducer, {
      current: loading ? 'loading' : data.length === 0 ? 'empty' : 'idle',
      sortColumn: controlledSortColumn ?? null,
      sortDirection: controlledSortDirection,
      selectedRows: new Set<number>(),
    });
    const baseId = useId();

    const activeSortColumn = controlledSortColumn ?? state.sortColumn;
    const activeSortDirection = controlledSortDirection !== 'none'
      ? controlledSortDirection
      : state.sortDirection;

    const tableState = loading ? 'loading' : data.length === 0 ? 'empty' : 'idle';

    const handleSort = useCallback(
      (columnKey: string) => {
        if (!sortable) return;
        dispatch({ type: 'SORT', column: columnKey });
        const nextDirection: 'ascending' | 'descending' =
          activeSortColumn === columnKey && activeSortDirection === 'ascending'
            ? 'descending'
            : 'ascending';
        onSort?.(columnKey, nextDirection);
        // Auto-complete sort for sync usage
        setTimeout(() => dispatch({ type: 'SORT_COMPLETE' }), 0);
      },
      [sortable, activeSortColumn, activeSortDirection, onSort]
    );

    const handleHeaderKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTableCellElement>, columnKey: string) => {
        if (e.key === 'Enter' && sortable) {
          e.preventDefault();
          handleSort(columnKey);
        }
      },
      [sortable, handleSort]
    );

    const handleRowClick = useCallback(
      (index: number) => {
        if (!selectable) return;
        if (state.selectedRows.has(index)) {
          dispatch({ type: 'DESELECT_ROW', index });
          onRowDeselect?.(index);
        } else {
          dispatch({ type: 'SELECT_ROW', index });
          onRowSelect?.(index);
        }
      },
      [selectable, state.selectedRows, onRowSelect, onRowDeselect]
    );

    const handleRowKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTableRowElement>, index: number) => {
        if (e.key === ' ' && selectable) {
          e.preventDefault();
          handleRowClick(index);
        }
      },
      [selectable, handleRowClick]
    );

    return (
      <div
        data-surface-widget=""
        data-widget-name="data-table"
        data-state={tableState}
        data-selectable={selectable ? 'true' : 'false'}
        data-size={size}
      >
        <table
          ref={ref}
          className={className}
          role={sortable ? 'grid' : 'table'}
          aria-label={ariaLabel}
          aria-rowcount={data.length}
          aria-colcount={columns.length}
          aria-busy={loading ? 'true' : 'false'}
        >
          <thead
            role="rowgroup"
            data-sticky={stickyHeader ? 'true' : 'false'}
          >
            <tr role="row">
              {columns.map((col, colIndex) => {
                const isSorted = activeSortColumn === col.key;
                const sortDir = isSorted ? activeSortDirection : 'none';
                return (
                  <th
                    key={col.key}
                    role="columnheader"
                    aria-sort={sortDir}
                    aria-colindex={colIndex + 1}
                    data-sortable={sortable && col.sortable !== false ? 'true' : 'false'}
                    data-sorted={isSorted ? 'true' : 'false'}
                    data-sort-direction={sortDir}
                    tabIndex={sortable && col.sortable !== false ? 0 : -1}
                    onClick={() => {
                      if (col.sortable !== false) handleSort(col.key);
                    }}
                    onKeyDown={(e) => {
                      if (col.sortable !== false) handleHeaderKeyDown(e, col.key);
                    }}
                  >
                    {col.header}
                    {isSorted && (
                      <span
                        aria-hidden="true"
                        data-direction={sortDir}
                        data-visible="true"
                      >
                        {sortDir === 'ascending' ? ' \u25B2' : ' \u25BC'}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody
            role="rowgroup"
            data-state={loading ? 'loading' : 'idle'}
          >
            {data.length === 0 && !loading && (
              <tr role="row">
                <td
                  role="gridcell"
                  colSpan={columns.length}
                  data-part="empty-state"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
            {data.map((row, rowIndex) => {
              const isSelected = state.selectedRows.has(rowIndex);
              return (
                <tr
                  key={`${baseId}-row-${rowIndex}`}
                  role="row"
                  aria-rowindex={rowIndex + 1}
                  aria-selected={selectable ? (isSelected ? 'true' : 'false') : undefined}
                  data-state={isSelected ? 'selected' : 'idle'}
                  data-selectable={selectable ? 'true' : 'false'}
                  onClick={() => handleRowClick(rowIndex)}
                  onKeyDown={(e) => handleRowKeyDown(e, rowIndex)}
                >
                  {columns.map((col, colIndex) => {
                    const cellValue = (row as Record<string, unknown>)[col.key];
                    return (
                      <td
                        key={col.key}
                        role="gridcell"
                        aria-colindex={colIndex + 1}
                        data-part="cell"
                      >
                        {col.render ? col.render(cellValue, row) : String(cellValue ?? '')}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          {footer && (
            <tfoot role="rowgroup" data-part="footer">
              <tr role="row" data-part="footer-row">
                <td role="cell" data-part="footer-cell" colSpan={columns.length}>
                  {footer}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
        {pagination && (
          <div data-part="pagination" aria-label="Table pagination">
            {pagination}
          </div>
        )}
        {children}
      </div>
    );
  }
);

DataTable.displayName = 'DataTable';
export default DataTable;
