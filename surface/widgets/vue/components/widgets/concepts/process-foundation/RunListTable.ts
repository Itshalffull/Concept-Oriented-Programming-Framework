import { defineComponent, h, ref, computed, type PropType } from 'vue';

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

interface ProcessRun {
  id: string;
  processName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'pending';
  startedAt: string;
  duration?: string;
  outcome?: 'success' | 'failure' | 'cancelled' | 'pending';
}

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

export const RunListTable = defineComponent({
  name: 'RunListTable',
  props: {
    runs: { type: Array as PropType<ProcessRun[]>, required: true },
    pageSize: { type: Number, default: 20 },
    sortBy: { type: String, default: 'startedAt' },
    sortOrder: { type: String as PropType<'asc' | 'desc'>, default: 'desc' },
    filterStatus: { type: String, default: undefined },
  },
  emits: ['select', 'cancel'],
  setup(props, { emit }) {
    const state = ref<RunListTableState>('idle');
    const selectedId = ref<string | null>(null);
    const sortByCol = ref(props.sortBy);
    const sortOrd = ref<'asc' | 'desc'>(props.sortOrder as 'asc' | 'desc');
    const activeFilter = ref<string | undefined>(props.filterStatus);
    const currentPage = ref(0);
    const focusIndex = ref(0);

    function send(event: RunListTableEvent) {
      state.value = runListTableReducer(state.value, event);
    }

    const filteredRuns = computed(() => activeFilter.value ? props.runs.filter((r) => r.status === activeFilter.value) : props.runs);
    const sortedRuns = computed(() => [...filteredRuns.value].sort((a, b) => compareRuns(a, b, sortByCol.value, sortOrd.value)));
    const totalPages = computed(() => Math.max(1, Math.ceil(sortedRuns.value.length / props.pageSize)));
    const pageRuns = computed(() => { const s = currentPage.value * props.pageSize; return sortedRuns.value.slice(s, s + props.pageSize); });

    function handleSort(col: string) {
      if (sortByCol.value === col) sortOrd.value = sortOrd.value === 'asc' ? 'desc' : 'asc';
      else { sortByCol.value = col; sortOrd.value = 'asc'; }
      send({ type: 'SORT', column: col });
    }

    function handleFilter(status: string | undefined) {
      activeFilter.value = status;
      currentPage.value = 0;
      send({ type: 'FILTER', status });
    }

    function handleSelectRow(run: ProcessRun) {
      selectedId.value = run.id;
      send({ type: 'SELECT_ROW', id: run.id });
      emit('select', run);
    }

    function sortIndicator(col: string) {
      if (sortByCol.value !== col) return '';
      return sortOrd.value === 'asc' ? ' \u25B2' : ' \u25BC';
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); focusIndex.value = Math.min(focusIndex.value + 1, pageRuns.value.length - 1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); focusIndex.value = Math.max(focusIndex.value - 1, 0); }
      if (e.key === 'Enter') { e.preventDefault(); const r = pageRuns.value[focusIndex.value]; if (r) handleSelectRow(r); }
      if (e.key === 'Escape') { e.preventDefault(); selectedId.value = null; send({ type: 'DESELECT' }); }
    }

    const COLUMNS = ['status', 'processName', 'startedAt', 'duration', 'outcome'] as const;
    const COL_LABELS: Record<string, string> = { status: 'Status', processName: 'Process', startedAt: 'Started', duration: 'Duration', outcome: 'Outcome' };

    return () => {
      const children: any[] = [];

      // Filter bar
      children.push(h('div', { 'data-part': 'filter-bar', role: 'toolbar', 'aria-label': 'Filter by status' }, [
        h('button', { type: 'button', 'data-part': 'filter-chip', 'data-active': !activeFilter.value ? 'true' : 'false', 'aria-pressed': !activeFilter.value ? 'true' : 'false', onClick: () => handleFilter(undefined) }, `All (${props.runs.length})`),
        ...ALL_STATUSES.map((s) => {
          const count = props.runs.filter((r) => r.status === s).length;
          if (count === 0) return null;
          return h('button', { key: s, type: 'button', 'data-part': 'filter-chip', 'data-status': s, 'data-active': activeFilter.value === s ? 'true' : 'false', 'aria-pressed': activeFilter.value === s ? 'true' : 'false', onClick: () => handleFilter(activeFilter.value === s ? undefined : s) }, `${STATUS_LABELS[s]} (${count})`);
        }),
      ]));

      // Table
      children.push(h('table', { 'data-part': 'table', role: 'table', 'aria-label': 'Run list' }, [
        h('thead', {}, [
          h('tr', { 'data-part': 'header-row', role: 'row' },
            COLUMNS.map((col) => h('th', {
              key: col, 'data-part': 'header-cell', role: 'columnheader',
              'aria-sort': sortByCol.value === col ? (sortOrd.value === 'asc' ? 'ascending' : 'descending') : 'none',
              onClick: () => handleSort(col), style: { cursor: 'pointer' }, tabindex: 0,
              onKeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(col); } },
            }, `${COL_LABELS[col]}${sortIndicator(col)}`)),
          ),
        ]),
        h('tbody', {},
          pageRuns.value.length > 0
            ? pageRuns.value.map((run, index) => {
                const isSelected = selectedId.value === run.id;
                const isFocused = focusIndex.value === index;
                return h('tr', {
                  key: run.id, 'data-part': 'data-row', role: 'row', 'data-status': run.status,
                  'aria-selected': isSelected ? 'true' : 'false', tabindex: isFocused ? 0 : -1,
                  onClick: () => handleSelectRow(run),
                }, [
                  h('td', { 'data-part': 'status', role: 'cell', 'data-status': run.status }, [h('span', { 'data-part': 'status-badge' }, STATUS_LABELS[run.status] ?? run.status)]),
                  h('td', { 'data-part': 'name', role: 'cell' }, run.processName),
                  h('td', { 'data-part': 'start', role: 'cell' }, run.startedAt),
                  h('td', { 'data-part': 'duration', role: 'cell' }, run.duration ?? '\u2014'),
                  h('td', { 'data-part': 'outcome', role: 'cell', 'data-outcome': run.outcome ?? 'pending' }, [h('span', { 'aria-label': `Outcome: ${run.outcome ?? 'pending'}` }, outcomeIcon(run.outcome))]),
                ]);
              })
            : [h('tr', { 'data-part': 'empty-row' }, [h('td', { colspan: 5, 'data-part': 'empty-cell', role: 'cell' }, 'No runs match the current filter')])]
        ),
      ]));

      // Pagination
      if (totalPages.value > 1) {
        children.push(h('nav', { 'data-part': 'pagination', role: 'navigation', 'aria-label': 'Pagination' }, [
          h('button', { type: 'button', 'data-part': 'page-prev', disabled: currentPage.value === 0, onClick: () => { currentPage.value--; focusIndex.value = 0; send({ type: 'PAGE', page: currentPage.value }); }, 'aria-label': 'Previous page' }, '\u2190'),
          h('span', { 'data-part': 'page-info', role: 'status' }, `Page ${currentPage.value + 1} of ${totalPages.value}`),
          h('button', { type: 'button', 'data-part': 'page-next', disabled: currentPage.value >= totalPages.value - 1, onClick: () => { currentPage.value++; focusIndex.value = 0; send({ type: 'PAGE', page: currentPage.value }); }, 'aria-label': 'Next page' }, '\u2192'),
        ]));
      }

      return h('div', {
        role: 'region',
        'aria-label': 'Process runs',
        'data-surface-widget': '',
        'data-widget-name': 'run-list-table',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default RunListTable;
