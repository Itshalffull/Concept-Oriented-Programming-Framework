import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type RunListTableState = 'idle' | 'rowSelected';
export type RunListTableEvent =
  | { type: 'SELECT_ROW' }
  | { type: 'SORT' }
  | { type: 'FILTER' }
  | { type: 'PAGE' }
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

/* --- Types --- */

export interface ProcessRun {
  id: string;
  processName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'pending';
  startedAt: string;
  duration?: string;
  outcome?: 'success' | 'failure' | 'cancelled' | 'pending';
}

export interface RunListTableProps {
  [key: string]: unknown;
  class?: string;
  runs: ProcessRun[];
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filterStatus?: string;
  onSelect?: (run: ProcessRun) => void;
  onCancel?: (id: string) => void;
}
export interface RunListTableResult { element: HTMLElement; dispose: () => void; }

/* --- Helpers --- */

const STATUS_ORDER: Record<string, number> = { running: 0, pending: 1, completed: 2, failed: 3, cancelled: 4 };
const STATUS_LABELS: Record<string, string> = { running: 'Running', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled', pending: 'Pending' };
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
    case 'processName': cmp = a.processName.localeCompare(b.processName); break;
    case 'status': cmp = (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5); break;
    case 'startedAt': cmp = a.startedAt.localeCompare(b.startedAt); break;
    case 'duration': cmp = (a.duration ?? '').localeCompare(b.duration ?? ''); break;
    default: cmp = 0;
  }
  return order === 'desc' ? -cmp : cmp;
}

/* --- Component --- */

export function RunListTable(props: RunListTableProps): RunListTableResult {
  const sig = surfaceCreateSignal<RunListTableState>('idle');
  const send = (type: string) => sig.set(runListTableReducer(sig.get(), { type } as any));

  const runs = (props.runs ?? []) as ProcessRun[];
  const pageSize = (props.pageSize as number) ?? 20;
  const onSelect = props.onSelect as ((run: ProcessRun) => void) | undefined;

  let sortByCol = (props.sortBy as string) ?? 'startedAt';
  let sortOrd = (props.sortOrder as 'asc' | 'desc') ?? 'desc';
  let activeFilter: string | undefined = props.filterStatus as string | undefined;
  let currentPage = 0;
  let selectedId: string | null = null;
  let focusIndex = 0;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'run-list-table');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Process runs');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Filter bar
  const filterBarEl = document.createElement('div');
  filterBarEl.setAttribute('data-part', 'filter-bar');
  filterBarEl.setAttribute('role', 'toolbar');
  filterBarEl.setAttribute('aria-label', 'Filter by status');
  root.appendChild(filterBarEl);

  function rebuildFilterBar() {
    filterBarEl.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.setAttribute('data-part', 'filter-chip');
    allBtn.setAttribute('data-active', !activeFilter ? 'true' : 'false');
    allBtn.setAttribute('aria-pressed', String(!activeFilter));
    allBtn.textContent = `All (${runs.length})`;
    allBtn.addEventListener('click', () => {
      activeFilter = undefined;
      currentPage = 0;
      send('FILTER');
      rebuild();
    });
    filterBarEl.appendChild(allBtn);

    for (const s of ALL_STATUSES) {
      const count = runs.filter((r) => r.status === s).length;
      if (count === 0) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-part', 'filter-chip');
      btn.setAttribute('data-status', s);
      btn.setAttribute('data-active', activeFilter === s ? 'true' : 'false');
      btn.setAttribute('aria-pressed', String(activeFilter === s));
      btn.textContent = `${STATUS_LABELS[s]} (${count})`;
      btn.addEventListener('click', () => {
        activeFilter = activeFilter === s ? undefined : s;
        currentPage = 0;
        send('FILTER');
        rebuild();
      });
      filterBarEl.appendChild(btn);
    }
  }

  // Table
  const tableEl = document.createElement('table');
  tableEl.setAttribute('data-part', 'table');
  tableEl.setAttribute('role', 'table');
  tableEl.setAttribute('aria-label', 'Run list');
  root.appendChild(tableEl);

  // Pagination
  const paginationEl = document.createElement('nav');
  paginationEl.setAttribute('data-part', 'pagination');
  paginationEl.setAttribute('role', 'navigation');
  paginationEl.setAttribute('aria-label', 'Pagination');
  root.appendChild(paginationEl);

  function getProcessed(): ProcessRun[] {
    let filtered = activeFilter ? runs.filter((r) => r.status === activeFilter) : runs;
    return [...filtered].sort((a, b) => compareRuns(a, b, sortByCol, sortOrd));
  }

  function sortIndicator(col: string): string {
    if (sortByCol !== col) return '';
    return sortOrd === 'asc' ? ' \u25B2' : ' \u25BC';
  }

  function rebuild() {
    rebuildFilterBar();
    tableEl.innerHTML = '';

    const sorted = getProcessed();
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const start = currentPage * pageSize;
    const pageRuns = sorted.slice(start, start + pageSize);

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.setAttribute('data-part', 'header-row');
    headerRow.setAttribute('role', 'row');

    const columns = [
      { key: 'status', label: 'Status' },
      { key: 'processName', label: 'Process' },
      { key: 'startedAt', label: 'Started' },
      { key: 'duration', label: 'Duration' },
      { key: 'outcome', label: 'Outcome' },
    ];

    for (const col of columns) {
      const th = document.createElement('th');
      th.setAttribute('data-part', 'header-cell');
      th.setAttribute('role', 'columnheader');
      th.setAttribute('aria-sort', sortByCol === col.key ? (sortOrd === 'asc' ? 'ascending' : 'descending') : 'none');
      th.style.cursor = 'pointer';
      th.setAttribute('tabindex', '0');
      th.textContent = col.label + sortIndicator(col.key);
      th.addEventListener('click', () => {
        if (sortByCol === col.key) sortOrd = sortOrd === 'asc' ? 'desc' : 'asc';
        else { sortByCol = col.key; sortOrd = 'asc'; }
        send('SORT');
        rebuild();
      });
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    tableEl.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    if (pageRuns.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.setAttribute('data-part', 'empty-row');
      const emptyCell = document.createElement('td');
      emptyCell.setAttribute('colspan', '5');
      emptyCell.setAttribute('data-part', 'empty-cell');
      emptyCell.setAttribute('role', 'cell');
      emptyCell.textContent = 'No runs match the current filter';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    }

    for (let i = 0; i < pageRuns.length; i++) {
      const run = pageRuns[i];
      const isSelected = selectedId === run.id;
      const isFocused = focusIndex === i;

      const tr = document.createElement('tr');
      tr.setAttribute('data-part', 'data-row');
      tr.setAttribute('role', 'row');
      tr.setAttribute('data-status', run.status);
      tr.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      tr.setAttribute('tabindex', isFocused ? '0' : '-1');

      // Status
      const tdStatus = document.createElement('td');
      tdStatus.setAttribute('data-part', 'status');
      tdStatus.setAttribute('role', 'cell');
      tdStatus.setAttribute('data-status', run.status);
      const statusBadge = document.createElement('span');
      statusBadge.setAttribute('aria-label', `Status: ${run.status}`);
      statusBadge.setAttribute('data-part', 'status-badge');
      statusBadge.textContent = STATUS_LABELS[run.status] ?? run.status;
      tdStatus.appendChild(statusBadge);
      tr.appendChild(tdStatus);

      // Name
      const tdName = document.createElement('td');
      tdName.setAttribute('data-part', 'name');
      tdName.setAttribute('role', 'cell');
      tdName.textContent = run.processName;
      tr.appendChild(tdName);

      // Started
      const tdStart = document.createElement('td');
      tdStart.setAttribute('data-part', 'start');
      tdStart.setAttribute('role', 'cell');
      tdStart.textContent = run.startedAt;
      tr.appendChild(tdStart);

      // Duration
      const tdDuration = document.createElement('td');
      tdDuration.setAttribute('data-part', 'duration');
      tdDuration.setAttribute('role', 'cell');
      tdDuration.textContent = run.duration ?? '\u2014';
      tr.appendChild(tdDuration);

      // Outcome
      const tdOutcome = document.createElement('td');
      tdOutcome.setAttribute('data-part', 'outcome');
      tdOutcome.setAttribute('role', 'cell');
      tdOutcome.setAttribute('data-outcome', run.outcome ?? 'pending');
      const outcomeSpan = document.createElement('span');
      outcomeSpan.setAttribute('aria-label', `Outcome: ${run.outcome ?? 'pending'}`);
      outcomeSpan.textContent = outcomeIcon(run.outcome);
      tdOutcome.appendChild(outcomeSpan);
      tr.appendChild(tdOutcome);

      tr.addEventListener('click', () => {
        selectedId = run.id;
        send('SELECT_ROW');
        onSelect?.(run);
        rebuild();
      });

      tbody.appendChild(tr);
    }
    tableEl.appendChild(tbody);

    // Pagination
    paginationEl.innerHTML = '';
    if (totalPages > 1) {
      paginationEl.style.display = '';
      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.setAttribute('data-part', 'page-prev');
      prevBtn.disabled = currentPage === 0;
      prevBtn.setAttribute('aria-label', 'Previous page');
      prevBtn.textContent = '\u2190';
      prevBtn.addEventListener('click', () => { currentPage = Math.max(0, currentPage - 1); focusIndex = 0; send('PAGE'); rebuild(); });
      paginationEl.appendChild(prevBtn);

      const infoSpan = document.createElement('span');
      infoSpan.setAttribute('data-part', 'page-info');
      infoSpan.setAttribute('role', 'status');
      infoSpan.textContent = `Page ${currentPage + 1} of ${totalPages}`;
      paginationEl.appendChild(infoSpan);

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.setAttribute('data-part', 'page-next');
      nextBtn.disabled = currentPage >= totalPages - 1;
      nextBtn.setAttribute('aria-label', 'Next page');
      nextBtn.textContent = '\u2192';
      nextBtn.addEventListener('click', () => { currentPage = Math.min(totalPages - 1, currentPage + 1); focusIndex = 0; send('PAGE'); rebuild(); });
      paginationEl.appendChild(nextBtn);
    } else {
      paginationEl.style.display = 'none';
    }
  }

  rebuild();

  // Keyboard
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    const sorted = getProcessed();
    const start = currentPage * pageSize;
    const pageRuns = sorted.slice(start, start + pageSize);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusIndex = Math.min(focusIndex + 1, pageRuns.length - 1);
      rebuild();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusIndex = Math.max(focusIndex - 1, 0);
      rebuild();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const run = pageRuns[focusIndex];
      if (run) { selectedId = run.id; send('SELECT_ROW'); onSelect?.(run); rebuild(); }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      selectedId = null;
      send('DESELECT');
      rebuild();
    }
  });

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default RunListTable;
