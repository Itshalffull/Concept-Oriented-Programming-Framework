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

export interface RunListTableProps { [key: string]: unknown; class?: string; }
export interface RunListTableResult { element: HTMLElement; dispose: () => void; }

export function RunListTable(props: RunListTableProps): RunListTableResult {
  const sig = surfaceCreateSignal<RunListTableState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(runListTableReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'run-list-table');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Process runs');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Filter bar */
  const filterBarEl = document.createElement('div');
  filterBarEl.setAttribute('data-part', 'filter-bar');
  filterBarEl.setAttribute('role', 'toolbar');
  filterBarEl.setAttribute('aria-label', 'Filter by status');

  const allFilterBtn = document.createElement('button');
  allFilterBtn.type = 'button';
  allFilterBtn.setAttribute('data-part', 'filter-chip');
  allFilterBtn.setAttribute('data-active', 'true');
  allFilterBtn.setAttribute('aria-pressed', 'true');
  allFilterBtn.textContent = 'All (0)';
  allFilterBtn.addEventListener('click', () => { send('FILTER'); });
  filterBarEl.appendChild(allFilterBtn);

  for (const s of ALL_STATUSES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-part', 'filter-chip');
    btn.setAttribute('data-status', s);
    btn.setAttribute('data-active', 'false');
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = `${STATUS_LABELS[s]} (0)`;
    btn.addEventListener('click', () => { send('FILTER'); });
    filterBarEl.appendChild(btn);
  }
  root.appendChild(filterBarEl);

  /* Data table */
  const tableEl = document.createElement('table');
  tableEl.setAttribute('data-part', 'table');
  tableEl.setAttribute('role', 'table');
  tableEl.setAttribute('aria-label', 'Run list');

  /* Header row */
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
    th.setAttribute('aria-sort', 'none');
    th.style.cursor = 'pointer';
    th.setAttribute('tabindex', '0');
    th.textContent = col.label;
    th.addEventListener('click', () => { send('SORT'); });
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        send('SORT');
      }
    });
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  tableEl.appendChild(thead);

  /* Body with template row */
  const tbody = document.createElement('tbody');
  const dataRow = document.createElement('tr');
  dataRow.setAttribute('data-part', 'data-row');
  dataRow.setAttribute('role', 'row');
  dataRow.setAttribute('data-status', 'pending');
  dataRow.setAttribute('aria-selected', 'false');
  dataRow.setAttribute('tabindex', '0');
  dataRow.style.cursor = 'pointer';
  dataRow.addEventListener('click', () => { send('SELECT_ROW'); });
  dataRow.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      send('SELECT_ROW');
    }
  });

  const statusCell = document.createElement('td');
  statusCell.setAttribute('data-part', 'status');
  statusCell.setAttribute('role', 'cell');
  const statusBadge = document.createElement('span');
  statusBadge.setAttribute('data-part', 'status-badge');
  statusBadge.textContent = 'Pending';
  statusCell.appendChild(statusBadge);
  dataRow.appendChild(statusCell);

  const nameCell = document.createElement('td');
  nameCell.setAttribute('data-part', 'name');
  nameCell.setAttribute('role', 'cell');
  nameCell.textContent = 'Process';
  dataRow.appendChild(nameCell);

  const startCell = document.createElement('td');
  startCell.setAttribute('data-part', 'start');
  startCell.setAttribute('role', 'cell');
  startCell.textContent = '\u2014';
  dataRow.appendChild(startCell);

  const durationCell = document.createElement('td');
  durationCell.setAttribute('data-part', 'duration');
  durationCell.setAttribute('role', 'cell');
  durationCell.textContent = '\u2014';
  dataRow.appendChild(durationCell);

  const outcomeCell = document.createElement('td');
  outcomeCell.setAttribute('data-part', 'outcome');
  outcomeCell.setAttribute('role', 'cell');
  outcomeCell.setAttribute('data-outcome', 'pending');
  const outcomeSpan = document.createElement('span');
  outcomeSpan.setAttribute('aria-label', 'Outcome: pending');
  outcomeSpan.textContent = outcomeIcon('pending');
  outcomeCell.appendChild(outcomeSpan);
  dataRow.appendChild(outcomeCell);

  tbody.appendChild(dataRow);

  /* Empty row */
  const emptyRow = document.createElement('tr');
  emptyRow.setAttribute('data-part', 'empty-row');
  emptyRow.style.display = 'none';
  const emptyCell = document.createElement('td');
  emptyCell.setAttribute('data-part', 'empty-cell');
  emptyCell.setAttribute('role', 'cell');
  emptyCell.colSpan = 5;
  emptyCell.textContent = 'No runs match the current filter';
  emptyRow.appendChild(emptyCell);
  tbody.appendChild(emptyRow);

  tableEl.appendChild(tbody);
  root.appendChild(tableEl);

  /* Pagination */
  const paginationEl = document.createElement('nav');
  paginationEl.setAttribute('data-part', 'pagination');
  paginationEl.setAttribute('role', 'navigation');
  paginationEl.setAttribute('aria-label', 'Pagination');
  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.setAttribute('data-part', 'page-prev');
  prevBtn.setAttribute('aria-label', 'Previous page');
  prevBtn.textContent = '\u2190';
  prevBtn.addEventListener('click', () => { send('PAGE'); });
  paginationEl.appendChild(prevBtn);
  const pageInfo = document.createElement('span');
  pageInfo.setAttribute('data-part', 'page-info');
  pageInfo.setAttribute('role', 'status');
  pageInfo.textContent = 'Page 1 of 1';
  paginationEl.appendChild(pageInfo);
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.setAttribute('data-part', 'page-next');
  nextBtn.setAttribute('aria-label', 'Next page');
  nextBtn.textContent = '\u2192';
  nextBtn.addEventListener('click', () => { send('PAGE'); });
  paginationEl.appendChild(nextBtn);
  root.appendChild(paginationEl);

  /* Keyboard navigation */
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      send('SELECT_ROW');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      send('DESELECT');
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    dataRow.setAttribute('aria-selected', s === 'rowSelected' ? 'true' : 'false');
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default RunListTable;
