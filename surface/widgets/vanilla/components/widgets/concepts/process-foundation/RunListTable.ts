/* ---------------------------------------------------------------------------
 * RunListTable — Vanilla implementation
 *
 * Table listing process runs with sort, filter by status, pagination,
 * row selection, and keyboard navigation.
 * ------------------------------------------------------------------------- */

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

export interface ProcessRun {
  id: string;
  processName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'pending';
  startedAt: string;
  duration?: string;
  outcome?: 'success' | 'failure' | 'cancelled' | 'pending';
}

export interface RunListTableProps {
  [key: string]: unknown; className?: string;
  runs?: ProcessRun[];
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filterStatus?: string;
  onSelect?: (run: ProcessRun) => void;
  onCancel?: (id: string) => void;
}
export interface RunListTableOptions { target: HTMLElement; props: RunListTableProps; }

let _runListTableUid = 0;

const STATUS_ORDER: Record<string, number> = { running: 0, pending: 1, completed: 2, failed: 3, cancelled: 4 };
const STATUS_LABELS: Record<string, string> = { running: 'Running', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled', pending: 'Pending' };
const ALL_STATUSES = ['running', 'pending', 'completed', 'failed', 'cancelled'] as const;

function outcomeIcon(outcome: string | undefined): string {
  switch (outcome) { case 'success': return '\u2713'; case 'failure': return '\u2717'; case 'cancelled': return '\u2014'; default: return '\u25CB'; }
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

export class RunListTable {
  private el: HTMLElement;
  private props: RunListTableProps;
  private state: RunListTableState = 'idle';
  private disposers: Array<() => void> = [];
  private selectedId: string | null = null;
  private sortByCol: string;
  private sortOrd: 'asc' | 'desc';
  private activeFilter: string | undefined;
  private currentPage = 0;
  private focusIndex = 0;

  constructor(options: RunListTableOptions) {
    this.props = { ...options.props };
    this.sortByCol = (this.props.sortBy as string) ?? 'startedAt';
    this.sortOrd = (this.props.sortOrder as 'asc' | 'desc') ?? 'desc';
    this.activeFilter = this.props.filterStatus as string | undefined;
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'run-list-table');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'region');
    this.el.setAttribute('aria-label', 'Process runs');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'run-list-table-' + (++_runListTableUid);
    const onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKeyDown));
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  send(type: string): void { this.state = runListTableReducer(this.state, { type } as any); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<RunListTableProps>): void { Object.assign(this.props, props); this.cleanupRender(); this.el.innerHTML = ''; this.render(); }
  destroy(): void { this.cleanup(); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private cleanupRender(): void { const kept = this.disposers.slice(0, 1); for (let i = 1; i < this.disposers.length; i++) this.disposers[i](); this.disposers = kept; }
  private rerender(): void { this.cleanupRender(); this.el.innerHTML = ''; this.render(); }

  private get runs(): ProcessRun[] { return (this.props.runs ?? []) as ProcessRun[]; }
  private get pageSize(): number { return (this.props.pageSize as number) ?? 20; }

  private get filteredRuns(): ProcessRun[] {
    if (!this.activeFilter) return this.runs;
    return this.runs.filter(r => r.status === this.activeFilter);
  }

  private get sortedRuns(): ProcessRun[] {
    return [...this.filteredRuns].sort((a, b) => compareRuns(a, b, this.sortByCol, this.sortOrd));
  }

  private get totalPages(): number { return Math.max(1, Math.ceil(this.sortedRuns.length / this.pageSize)); }

  private get pageRuns(): ProcessRun[] {
    const start = this.currentPage * this.pageSize;
    return this.sortedRuns.slice(start, start + this.pageSize);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') { e.preventDefault(); this.focusIndex = Math.min(this.focusIndex + 1, this.pageRuns.length - 1); this.rerender(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); this.focusIndex = Math.max(this.focusIndex - 1, 0); this.rerender(); }
    if (e.key === 'Enter') { e.preventDefault(); const run = this.pageRuns[this.focusIndex]; if (run) this.handleSelectRow(run); }
    if (e.key === 'Escape') { e.preventDefault(); this.handleDeselect(); }
  }

  private handleSelectRow(run: ProcessRun): void { this.selectedId = run.id; this.send('SELECT_ROW'); this.props.onSelect?.(run); this.rerender(); }
  private handleDeselect(): void { this.selectedId = null; this.send('DESELECT'); this.rerender(); }

  private sortIndicator(col: string): string {
    if (this.sortByCol !== col) return '';
    return this.sortOrd === 'asc' ? ' \u25B2' : ' \u25BC';
  }

  private render(): void {
    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className as string;

    // Filter bar
    const filterBar = document.createElement('div');
    filterBar.setAttribute('data-part', 'filter-bar');
    filterBar.setAttribute('role', 'toolbar');
    filterBar.setAttribute('aria-label', 'Filter by status');

    const allBtn = document.createElement('button');
    allBtn.setAttribute('type', 'button');
    allBtn.setAttribute('data-part', 'filter-chip');
    allBtn.setAttribute('data-active', !this.activeFilter ? 'true' : 'false');
    allBtn.setAttribute('aria-pressed', String(!this.activeFilter));
    allBtn.textContent = `All (${this.runs.length})`;
    const onAllFilter = () => { this.activeFilter = undefined; this.currentPage = 0; this.send('FILTER'); this.rerender(); };
    allBtn.addEventListener('click', onAllFilter);
    this.disposers.push(() => allBtn.removeEventListener('click', onAllFilter));
    filterBar.appendChild(allBtn);

    for (const s of ALL_STATUSES) {
      const count = this.runs.filter(r => r.status === s).length;
      if (count === 0) continue;
      const btn = document.createElement('button');
      btn.setAttribute('type', 'button');
      btn.setAttribute('data-part', 'filter-chip');
      btn.setAttribute('data-status', s);
      btn.setAttribute('data-active', this.activeFilter === s ? 'true' : 'false');
      btn.setAttribute('aria-pressed', String(this.activeFilter === s));
      btn.textContent = `${STATUS_LABELS[s]} (${count})`;
      const onFilter = () => { this.activeFilter = this.activeFilter === s ? undefined : s; this.currentPage = 0; this.send('FILTER'); this.rerender(); };
      btn.addEventListener('click', onFilter);
      this.disposers.push(() => btn.removeEventListener('click', onFilter));
      filterBar.appendChild(btn);
    }
    this.el.appendChild(filterBar);

    // Table
    const table = document.createElement('table');
    table.setAttribute('data-part', 'table');
    table.setAttribute('role', 'table');
    table.setAttribute('aria-label', 'Run list');

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
      th.setAttribute('aria-sort', this.sortByCol === col.key ? (this.sortOrd === 'asc' ? 'ascending' : 'descending') : 'none');
      th.setAttribute('tabindex', '0');
      th.style.cursor = 'pointer';
      th.textContent = col.label + this.sortIndicator(col.key);
      const onSort = () => {
        if (this.sortByCol === col.key) this.sortOrd = this.sortOrd === 'asc' ? 'desc' : 'asc';
        else { this.sortByCol = col.key; this.sortOrd = 'asc'; }
        this.send('SORT');
        this.rerender();
      };
      th.addEventListener('click', onSort);
      th.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(); } });
      this.disposers.push(() => th.removeEventListener('click', onSort));
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    const pageRuns = this.pageRuns;
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
    } else {
      pageRuns.forEach((run, index) => {
        const isSelected = this.selectedId === run.id;
        const isFocused = this.focusIndex === index;
        const tr = document.createElement('tr');
        tr.setAttribute('data-part', 'data-row');
        tr.setAttribute('role', 'row');
        tr.setAttribute('data-status', run.status);
        tr.setAttribute('aria-selected', String(isSelected));
        tr.setAttribute('tabindex', isFocused ? '0' : '-1');
        const onClick = () => this.handleSelectRow(run);
        tr.addEventListener('click', onClick);
        this.disposers.push(() => tr.removeEventListener('click', onClick));

        // Status
        const statusTd = document.createElement('td');
        statusTd.setAttribute('data-part', 'status');
        statusTd.setAttribute('role', 'cell');
        statusTd.setAttribute('data-status', run.status);
        const badge = document.createElement('span');
        badge.setAttribute('data-part', 'status-badge');
        badge.setAttribute('aria-label', `Status: ${run.status}`);
        badge.textContent = STATUS_LABELS[run.status] ?? run.status;
        statusTd.appendChild(badge);
        tr.appendChild(statusTd);

        // Name
        const nameTd = document.createElement('td');
        nameTd.setAttribute('data-part', 'name');
        nameTd.setAttribute('role', 'cell');
        nameTd.textContent = run.processName;
        tr.appendChild(nameTd);

        // Start
        const startTd = document.createElement('td');
        startTd.setAttribute('data-part', 'start');
        startTd.setAttribute('role', 'cell');
        startTd.textContent = run.startedAt;
        tr.appendChild(startTd);

        // Duration
        const durationTd = document.createElement('td');
        durationTd.setAttribute('data-part', 'duration');
        durationTd.setAttribute('role', 'cell');
        durationTd.textContent = run.duration ?? '\u2014';
        tr.appendChild(durationTd);

        // Outcome
        const outcomeTd = document.createElement('td');
        outcomeTd.setAttribute('data-part', 'outcome');
        outcomeTd.setAttribute('role', 'cell');
        outcomeTd.setAttribute('data-outcome', run.outcome ?? 'pending');
        const outcomeSpan = document.createElement('span');
        outcomeSpan.setAttribute('aria-label', `Outcome: ${run.outcome ?? 'pending'}`);
        outcomeSpan.textContent = outcomeIcon(run.outcome);
        outcomeTd.appendChild(outcomeSpan);
        tr.appendChild(outcomeTd);

        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);
    this.el.appendChild(table);

    // Pagination
    if (this.totalPages > 1) {
      const nav = document.createElement('nav');
      nav.setAttribute('data-part', 'pagination');
      nav.setAttribute('role', 'navigation');
      nav.setAttribute('aria-label', 'Pagination');

      const prevBtn = document.createElement('button');
      prevBtn.setAttribute('type', 'button');
      prevBtn.setAttribute('data-part', 'page-prev');
      prevBtn.setAttribute('aria-label', 'Previous page');
      prevBtn.textContent = '\u2190';
      if (this.currentPage === 0) prevBtn.setAttribute('disabled', '');
      const onPrev = () => { this.currentPage--; this.focusIndex = 0; this.send('PAGE'); this.rerender(); };
      prevBtn.addEventListener('click', onPrev);
      this.disposers.push(() => prevBtn.removeEventListener('click', onPrev));
      nav.appendChild(prevBtn);

      const info = document.createElement('span');
      info.setAttribute('data-part', 'page-info');
      info.setAttribute('role', 'status');
      info.textContent = `Page ${this.currentPage + 1} of ${this.totalPages}`;
      nav.appendChild(info);

      const nextBtn = document.createElement('button');
      nextBtn.setAttribute('type', 'button');
      nextBtn.setAttribute('data-part', 'page-next');
      nextBtn.setAttribute('aria-label', 'Next page');
      nextBtn.textContent = '\u2192';
      if (this.currentPage >= this.totalPages - 1) nextBtn.setAttribute('disabled', '');
      const onNext = () => { this.currentPage++; this.focusIndex = 0; this.send('PAGE'); this.rerender(); };
      nextBtn.addEventListener('click', onNext);
      this.disposers.push(() => nextBtn.removeEventListener('click', onNext));
      nav.appendChild(nextBtn);

      this.el.appendChild(nav);
    }
  }
}

export default RunListTable;
