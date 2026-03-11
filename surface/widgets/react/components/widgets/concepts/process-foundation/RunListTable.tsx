/* ---------------------------------------------------------------------------
 * RunListTable — Table listing process runs
 *
 * Shows runs with columns for status, process name, start time, duration,
 * and outcome. Supports sorting, filtering by status, pagination, and
 * row selection for drill-down into run details.
 * ------------------------------------------------------------------------- */

export type RunListTableState = 'idle' | 'rowSelected';
export type RunListTableEvent =
  | { type: 'SELECT_ROW'; id?: string }
  | { type: 'SORT'; column?: string }
  | { type: 'FILTER'; status?: string }
  | { type: 'PAGE'; page?: number }
  | { type: 'DESELECT' };

export function runListTableReducer(state: RunListTableState, event: RunListTableEvent): RunListTableState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_ROW') return 'rowSelected';
      if (event.type === 'SORT') return 'idle';
      if (event.type === 'FILTER') return 'idle';
      if (event.type === 'PAGE') return 'idle';
      return state;
    case 'rowSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_ROW') return 'rowSelected';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useCallback,
  useMemo,
  useReducer,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface ProcessRun {
  id: string;
  processName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'pending';
  startedAt: string;
  duration?: string;
  outcome?: 'success' | 'failure' | 'cancelled' | 'pending';
}

export interface RunListTableProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect'> {
  /** List of process runs */
  runs: ProcessRun[];
  /** Number of rows per page */
  pageSize?: number;
  /** Column to sort by */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Status to filter by */
  filterStatus?: string | undefined;
  /** Called when a row is selected */
  onSelect?: (run: ProcessRun) => void;
  /** Called when a run is cancelled */
  onCancel?: (id: string) => void;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const STATUS_ORDER: Record<string, number> = { running: 0, pending: 1, completed: 2, failed: 3, cancelled: 4 };
const STATUS_LABELS: Record<string, string> = {
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  pending: 'Pending',
};

const ALL_STATUSES = ['running', 'pending', 'completed', 'failed', 'cancelled'] as const;

function outcomeIcon(outcome: string | undefined): string {
  switch (outcome) {
    case 'success': return '\u2713';
    case 'failure': return '\u2717';
    case 'cancelled': return '\u2014';
    default: return '\u25CB';
  }
}

type SortKey = 'processName' | 'status' | 'startedAt' | 'duration';

function compareRuns(a: ProcessRun, b: ProcessRun, key: string, order: 'asc' | 'desc'): number {
  let cmp = 0;
  switch (key) {
    case 'processName':
      cmp = a.processName.localeCompare(b.processName);
      break;
    case 'status':
      cmp = (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5);
      break;
    case 'startedAt':
    case 'started_at':
      cmp = a.startedAt.localeCompare(b.startedAt);
      break;
    case 'duration':
      cmp = (a.duration ?? '').localeCompare(b.duration ?? '');
      break;
    default:
      cmp = 0;
  }
  return order === 'desc' ? -cmp : cmp;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const RunListTable = forwardRef<HTMLDivElement, RunListTableProps>(function RunListTable(
  {
    runs,
    pageSize = 20,
    sortBy: initialSortBy = 'startedAt',
    sortOrder: initialSortOrder = 'desc',
    filterStatus: initialFilterStatus,
    onSelect,
    onCancel,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(runListTableReducer, 'idle');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortByCol, setSortByCol] = useState(initialSortBy);
  const [sortOrd, setSortOrd] = useState<'asc' | 'desc'>(initialSortOrder);
  const [activeFilter, setActiveFilter] = useState<string | undefined>(initialFilterStatus);
  const [currentPage, setCurrentPage] = useState(0);
  const [focusIndex, setFocusIndex] = useState(0);

  // Filter
  const filteredRuns = useMemo(() => {
    if (!activeFilter) return runs;
    return runs.filter((r) => r.status === activeFilter);
  }, [runs, activeFilter]);

  // Sort
  const sortedRuns = useMemo(() => {
    return [...filteredRuns].sort((a, b) => compareRuns(a, b, sortByCol, sortOrd));
  }, [filteredRuns, sortByCol, sortOrd]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sortedRuns.length / pageSize));
  const pageRuns = useMemo(() => {
    const start = currentPage * pageSize;
    return sortedRuns.slice(start, start + pageSize);
  }, [sortedRuns, currentPage, pageSize]);

  const handleSort = useCallback((column: string) => {
    if (sortByCol === column) {
      setSortOrd((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortByCol(column);
      setSortOrd('asc');
    }
    send({ type: 'SORT', column });
  }, [sortByCol]);

  const handleFilter = useCallback((status: string | undefined) => {
    setActiveFilter(status);
    setCurrentPage(0);
    send({ type: 'FILTER', status });
  }, []);

  const handleSelectRow = useCallback((run: ProcessRun) => {
    setSelectedId(run.id);
    send({ type: 'SELECT_ROW', id: run.id });
    onSelect?.(run);
  }, [onSelect]);

  const handleDeselect = useCallback(() => {
    setSelectedId(null);
    send({ type: 'DESELECT' });
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    setFocusIndex(0);
    send({ type: 'PAGE', page });
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIndex((prev) => Math.min(prev + 1, pageRuns.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIndex((prev) => Math.max(prev - 1, 0));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const run = pageRuns[focusIndex];
      if (run) handleSelectRow(run);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleDeselect();
    }
  }, [pageRuns, focusIndex, handleSelectRow, handleDeselect]);

  const sortIndicator = (col: string) => {
    if (sortByCol !== col) return '';
    return sortOrd === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Process runs"
      data-surface-widget=""
      data-widget-name="run-list-table"
      data-part="root"
      data-state={state}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      {...rest}
    >
      {/* Filter bar */}
      <div data-part="filter-bar" role="toolbar" aria-label="Filter by status">
        <button
          type="button"
          data-part="filter-chip"
          data-active={!activeFilter ? 'true' : 'false'}
          aria-pressed={!activeFilter}
          onClick={() => handleFilter(undefined)}
        >
          All ({runs.length})
        </button>
        {ALL_STATUSES.map((s) => {
          const count = runs.filter((r) => r.status === s).length;
          if (count === 0) return null;
          return (
            <button
              key={s}
              type="button"
              data-part="filter-chip"
              data-status={s}
              data-active={activeFilter === s ? 'true' : 'false'}
              aria-pressed={activeFilter === s}
              onClick={() => handleFilter(activeFilter === s ? undefined : s)}
            >
              {STATUS_LABELS[s]} ({count})
            </button>
          );
        })}
      </div>

      {/* Data table */}
      <table data-part="table" role="table" aria-label="Run list">
        <thead>
          <tr data-part="header-row" role="row">
            {(['status', 'processName', 'startedAt', 'duration', 'outcome'] as const).map((col) => (
              <th
                key={col}
                data-part="header-cell"
                role="columnheader"
                aria-sort={sortByCol === col ? (sortOrd === 'asc' ? 'ascending' : 'descending') : 'none'}
                onClick={() => handleSort(col)}
                style={{ cursor: 'pointer' }}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSort(col);
                  }
                }}
              >
                {col === 'processName' ? 'Process' : col === 'startedAt' ? 'Started' : col.charAt(0).toUpperCase() + col.slice(1)}
                {sortIndicator(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRuns.map((run, index) => {
            const isSelected = selectedId === run.id;
            const isFocused = focusIndex === index;
            return (
              <tr
                key={run.id}
                data-part="data-row"
                role="row"
                data-status={run.status}
                aria-selected={isSelected}
                tabIndex={isFocused ? 0 : -1}
                onClick={() => handleSelectRow(run)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectRow(run);
                  }
                }}
              >
                <td data-part="status" role="cell" data-status={run.status}>
                  <span aria-label={`Status: ${run.status}`} data-part="status-badge">
                    {STATUS_LABELS[run.status] ?? run.status}
                  </span>
                </td>
                <td data-part="name" role="cell">
                  {run.processName}
                </td>
                <td data-part="start" role="cell">
                  {run.startedAt}
                </td>
                <td data-part="duration" role="cell">
                  {run.duration ?? '\u2014'}
                </td>
                <td data-part="outcome" role="cell" data-outcome={run.outcome ?? 'pending'}>
                  <span aria-label={`Outcome: ${run.outcome ?? 'pending'}`}>
                    {outcomeIcon(run.outcome)}
                  </span>
                </td>
              </tr>
            );
          })}
          {pageRuns.length === 0 && (
            <tr data-part="empty-row">
              <td colSpan={5} data-part="empty-cell" role="cell">
                No runs match the current filter
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav data-part="pagination" role="navigation" aria-label="Pagination">
          <button
            type="button"
            data-part="page-prev"
            disabled={currentPage === 0}
            onClick={() => handlePageChange(currentPage - 1)}
            aria-label="Previous page"
          >
            {'\u2190'}
          </button>
          <span data-part="page-info" role="status">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            type="button"
            data-part="page-next"
            disabled={currentPage >= totalPages - 1}
            onClick={() => handlePageChange(currentPage + 1)}
            aria-label="Next page"
          >
            {'\u2192'}
          </button>
        </nav>
      )}

      {children}
    </div>
  );
});

RunListTable.displayName = 'RunListTable';
export { RunListTable };
export default RunListTable;
