import {
  StackLayout,
  Label,
  Button,
  ScrollView,
} from '@nativescript/core';

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

export interface ProcessRun {
  id: string;
  processName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'pending';
  startedAt: string;
  duration?: string;
  outcome?: 'success' | 'failure' | 'cancelled' | 'pending';
}

export interface RunListTableProps {
  runs: ProcessRun[];
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filterStatus?: string;
  onSelect?: (run: ProcessRun) => void;
  onCancel?: (id: string) => void;
}

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
    case 'processName': cmp = a.processName.localeCompare(b.processName); break;
    case 'status': cmp = (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5); break;
    case 'startedAt': cmp = a.startedAt.localeCompare(b.startedAt); break;
    case 'duration': cmp = (a.duration ?? '').localeCompare(b.duration ?? ''); break;
    default: cmp = 0;
  }
  return order === 'desc' ? -cmp : cmp;
}

export function createRunListTable(props: RunListTableProps): {
  view: StackLayout;
  dispose: () => void;
} {
  let state: RunListTableState = 'idle';
  let selectedId: string | null = null;
  let sortByCol = props.sortBy ?? 'startedAt';
  let sortOrd: 'asc' | 'desc' = props.sortOrder ?? 'desc';
  let activeFilter: string | undefined = props.filterStatus;
  let currentPage = 0;
  const pageSize = props.pageSize ?? 20;
  const disposers: (() => void)[] = [];

  function send(event: RunListTableEvent) {
    state = runListTableReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'run-list-table';
  root.automationText = 'Process runs';

  // Filter bar
  const filterBar = new StackLayout();
  filterBar.orientation = 'horizontal';
  root.addChild(filterBar);

  // Column headers
  const headerRow = new StackLayout();
  headerRow.orientation = 'horizontal';
  headerRow.marginTop = 8;
  headerRow.className = 'header-row';
  root.addChild(headerRow);

  // Rows
  const rowScroll = new ScrollView();
  const rowContainer = new StackLayout();
  rowScroll.content = rowContainer;
  root.addChild(rowScroll);

  // Pagination
  const pagRow = new StackLayout();
  pagRow.orientation = 'horizontal';
  pagRow.marginTop = 8;

  const prevBtn = new Button();
  prevBtn.text = '\u2190';
  prevBtn.on('tap', () => {
    currentPage = Math.max(0, currentPage - 1);
    send({ type: 'PAGE', page: currentPage });
  });
  pagRow.addChild(prevBtn);

  const pageLbl = new Label();
  pageLbl.marginLeft = 8;
  pageLbl.marginRight = 8;
  pagRow.addChild(pageLbl);

  const nextBtn = new Button();
  nextBtn.text = '\u2192';
  nextBtn.on('tap', () => {
    const filtered = activeFilter ? props.runs.filter((r) => r.status === activeFilter) : props.runs;
    const tp = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.min(tp - 1, currentPage + 1);
    send({ type: 'PAGE', page: currentPage });
  });
  pagRow.addChild(nextBtn);
  root.addChild(pagRow);

  function sortIndicator(col: string): string {
    if (sortByCol !== col) return '';
    return sortOrd === 'asc' ? ' \u25B2' : ' \u25BC';
  }

  function update() {
    // Filter bar
    filterBar.removeChildren();
    const allBtn = new Button();
    allBtn.text = `All (${props.runs.length})`;
    allBtn.className = !activeFilter ? 'filter-active' : 'filter-chip';
    allBtn.on('tap', () => {
      activeFilter = undefined;
      currentPage = 0;
      send({ type: 'FILTER', status: undefined });
    });
    filterBar.addChild(allBtn);

    for (const s of ALL_STATUSES) {
      const count = props.runs.filter((r) => r.status === s).length;
      if (count === 0) continue;
      const btn = new Button();
      btn.text = `${STATUS_LABELS[s]} (${count})`;
      btn.className = activeFilter === s ? 'filter-active' : 'filter-chip';
      btn.on('tap', () => {
        activeFilter = activeFilter === s ? undefined : s;
        currentPage = 0;
        send({ type: 'FILTER', status: activeFilter });
      });
      filterBar.addChild(btn);
    }

    // Column headers
    headerRow.removeChildren();
    const columns = ['status', 'processName', 'startedAt', 'duration', 'outcome'] as const;
    const colLabels: Record<string, string> = {
      status: 'Status',
      processName: 'Process',
      startedAt: 'Started',
      duration: 'Duration',
      outcome: 'Outcome',
    };
    for (const col of columns) {
      const colBtn = new Button();
      colBtn.text = `${colLabels[col]}${sortIndicator(col)}`;
      colBtn.className = 'header-cell';
      colBtn.on('tap', () => {
        if (sortByCol === col) {
          sortOrd = sortOrd === 'asc' ? 'desc' : 'asc';
        } else {
          sortByCol = col;
          sortOrd = 'asc';
        }
        send({ type: 'SORT', column: col });
      });
      headerRow.addChild(colBtn);
    }

    // Filter and sort
    const filtered = activeFilter ? props.runs.filter((r) => r.status === activeFilter) : props.runs;
    const sorted = [...filtered].sort((a, b) => compareRuns(a, b, sortByCol, sortOrd));
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const pageRuns = sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

    // Rows
    rowContainer.removeChildren();
    if (pageRuns.length === 0) {
      const emptyLbl = new Label();
      emptyLbl.text = 'No runs match the current filter';
      emptyLbl.textAlignment = 'center';
      emptyLbl.padding = 16;
      rowContainer.addChild(emptyLbl);
    } else {
      for (const run of pageRuns) {
        const row = new StackLayout();
        row.orientation = 'horizontal';
        row.padding = '6 8';
        row.marginBottom = 2;
        row.borderWidth = selectedId === run.id ? 2 : 0;
        row.borderColor = '#3b82f6';
        row.className = `data-row status-${run.status}`;

        const statusLbl = new Label();
        statusLbl.text = STATUS_LABELS[run.status] ?? run.status;
        statusLbl.width = 80;
        row.addChild(statusLbl);

        const nameLbl = new Label();
        nameLbl.text = run.processName;
        nameLbl.width = 120;
        row.addChild(nameLbl);

        const startLbl = new Label();
        startLbl.text = run.startedAt;
        startLbl.width = 100;
        startLbl.fontSize = 12;
        row.addChild(startLbl);

        const durLbl = new Label();
        durLbl.text = run.duration ?? '\u2014';
        durLbl.width = 60;
        durLbl.fontSize = 12;
        row.addChild(durLbl);

        const outLbl = new Label();
        outLbl.text = outcomeIcon(run.outcome);
        outLbl.width = 30;
        row.addChild(outLbl);

        row.on('tap', () => {
          selectedId = run.id;
          send({ type: 'SELECT_ROW', id: run.id });
          props.onSelect?.(run);
        });

        rowContainer.addChild(row);
      }
    }

    // Pagination
    if (totalPages > 1) {
      pagRow.visibility = 'visible';
      prevBtn.isEnabled = currentPage > 0;
      nextBtn.isEnabled = currentPage < totalPages - 1;
      pageLbl.text = `Page ${currentPage + 1} of ${totalPages}`;
    } else {
      pagRow.visibility = 'collapsed';
    }
  }

  update();

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createRunListTable;
