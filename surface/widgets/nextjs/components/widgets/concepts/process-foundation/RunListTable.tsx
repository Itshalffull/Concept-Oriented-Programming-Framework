/* ---------------------------------------------------------------------------
 * RunListTable — Server Component
 *
 * Table listing process runs with columns for status, process name,
 * start time, duration, and outcome. Supports sorting, filtering by
 * status, pagination, and row selection.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

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

export interface RunListTableProps {
  /** List of process runs. */
  runs: ProcessRun[];
  /** Number of rows per page. */
  pageSize?: number;
  /** Column to sort by. */
  sortBy?: string;
  /** Sort direction. */
  sortOrder?: 'asc' | 'desc';
  /** Status to filter by. */
  filterStatus?: string | undefined;
  /** Current page (0-indexed). */
  page?: number;
  /** ID of selected run. */
  selectedRunId?: string | undefined;
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

export default function RunListTable({
  runs,
  pageSize = 20,
  sortBy = 'startedAt',
  sortOrder = 'desc',
  filterStatus,
  page = 0,
  selectedRunId,
  children,
}: RunListTableProps) {
  const state = selectedRunId ? 'rowSelected' : 'idle';

  const filteredRuns = filterStatus ? runs.filter((r) => r.status === filterStatus) : runs;
  const sortedRuns = [...filteredRuns].sort((a, b) => compareRuns(a, b, sortBy, sortOrder));
  const totalPages = Math.max(1, Math.ceil(sortedRuns.length / pageSize));
  const start = page * pageSize;
  const pageRuns = sortedRuns.slice(start, start + pageSize);

  const sortIndicator = (col: string) => {
    if (sortBy !== col) return '';
    return sortOrder === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  return (
    <div
      role="region"
      aria-label="Process runs"
      data-surface-widget=""
      data-widget-name="run-list-table"
      data-part="root"
      data-state={state}
      tabIndex={0}
    >
      {/* Filter bar */}
      <div data-part="filter-bar" role="toolbar" aria-label="Filter by status">
        <button
          type="button"
          data-part="filter-chip"
          data-active={!filterStatus ? 'true' : 'false'}
          aria-pressed={!filterStatus}
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
              data-active={filterStatus === s ? 'true' : 'false'}
              aria-pressed={filterStatus === s}
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
                aria-sort={sortBy === col ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                tabIndex={0}
              >
                {col === 'processName' ? 'Process' : col === 'startedAt' ? 'Started' : col.charAt(0).toUpperCase() + col.slice(1)}
                {sortIndicator(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRuns.map((run, index) => {
            const isSelected = selectedRunId === run.id;
            return (
              <tr
                key={run.id}
                data-part="data-row"
                role="row"
                data-status={run.status}
                aria-selected={isSelected}
                tabIndex={index === 0 ? 0 : -1}
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
            disabled={page === 0}
            aria-label="Previous page"
          >
            {'\u2190'}
          </button>
          <span data-part="page-info" role="status">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            data-part="page-next"
            disabled={page >= totalPages - 1}
            aria-label="Next page"
          >
            {'\u2192'}
          </button>
        </nav>
      )}

      {children}
    </div>
  );
}

export { RunListTable };
