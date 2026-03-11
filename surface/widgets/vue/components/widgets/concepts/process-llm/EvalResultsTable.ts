import { defineComponent, h, ref, computed, type PropType } from 'vue';

export type EvalResultsTableState = 'idle' | 'rowSelected';
export type EvalResultsTableEvent =
  | { type: 'SELECT_ROW'; id?: string }
  | { type: 'SORT'; column?: string }
  | { type: 'FILTER'; status?: string }
  | { type: 'DESELECT' };

export function evalResultsTableReducer(state: EvalResultsTableState, event: EvalResultsTableEvent): EvalResultsTableState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_ROW') return 'rowSelected';
      if (event.type === 'SORT') return 'idle';
      if (event.type === 'FILTER') return 'idle';
      return state;
    case 'rowSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_ROW') return 'rowSelected';
      return state;
    default:
      return state;
  }
}

interface EvalTestCase {
  id: string;
  input: string;
  expected: string;
  actual: string;
  score: number;
  pass: boolean;
  metrics?: Record<string, number>;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

function compareCases(a: EvalTestCase, b: EvalTestCase, key: string, order: 'asc' | 'desc'): number {
  let cmp = 0;
  switch (key) {
    case 'score': cmp = a.score - b.score; break;
    case 'status': cmp = (a.pass ? 1 : 0) - (b.pass ? 1 : 0); break;
    case 'input': cmp = a.input.localeCompare(b.input); break;
    case 'actual': cmp = a.actual.localeCompare(b.actual); break;
    case 'expected': cmp = a.expected.localeCompare(b.expected); break;
    default: cmp = 0;
  }
  return order === 'desc' ? -cmp : cmp;
}

export const EvalResultsTable = defineComponent({
  name: 'EvalResultsTable',
  props: {
    testCases: { type: Array as PropType<EvalTestCase[]>, required: true },
    overallScore: { type: Number, required: true },
    passCount: { type: Number, required: true },
    failCount: { type: Number, required: true },
    sortBy: { type: String, default: 'score' },
    sortOrder: { type: String as PropType<'asc' | 'desc'>, default: 'desc' },
    filterStatus: { type: String, default: undefined },
    showExpected: { type: Boolean, default: true },
  },
  emits: ['select'],
  setup(props, { emit, slots }) {
    const state = ref<EvalResultsTableState>('idle');
    const selectedId = ref<string | null>(null);
    const sortByCol = ref(props.sortBy);
    const sortOrd = ref<'asc' | 'desc'>(props.sortOrder as 'asc' | 'desc');
    const activeFilter = ref<string | undefined>(props.filterStatus);
    const focusIndex = ref(0);

    function send(event: EvalResultsTableEvent) {
      state.value = evalResultsTableReducer(state.value, event);
    }

    const filteredCases = computed(() => {
      if (!activeFilter.value) return props.testCases;
      if (activeFilter.value === 'pass') return props.testCases.filter((tc) => tc.pass);
      if (activeFilter.value === 'fail') return props.testCases.filter((tc) => !tc.pass);
      return props.testCases;
    });

    const sortedCases = computed(() => [...filteredCases.value].sort((a, b) => compareCases(a, b, sortByCol.value, sortOrd.value)));

    const selectedCase = computed(() => selectedId.value ? sortedCases.value.find((tc) => tc.id === selectedId.value) ?? null : null);

    const totalCount = computed(() => props.passCount + props.failCount);
    const passPercent = computed(() => totalCount.value > 0 ? Math.round((props.passCount / totalCount.value) * 100) : 0);
    const failPercent = computed(() => totalCount.value > 0 ? 100 - passPercent.value : 0);

    function handleSort(column: string) {
      if (sortByCol.value === column) sortOrd.value = sortOrd.value === 'asc' ? 'desc' : 'asc';
      else { sortByCol.value = column; sortOrd.value = 'desc'; }
      send({ type: 'SORT', column });
    }

    function handleFilter(status: string | undefined) {
      activeFilter.value = status;
      send({ type: 'FILTER', status });
    }

    function handleSelectRow(tc: EvalTestCase) {
      if (selectedId.value === tc.id) {
        selectedId.value = null;
        send({ type: 'DESELECT' });
      } else {
        selectedId.value = tc.id;
        send({ type: 'SELECT_ROW', id: tc.id });
        emit('select', tc);
      }
    }

    function handleDeselect() {
      selectedId.value = null;
      send({ type: 'DESELECT' });
    }

    function sortIndicator(col: string): string {
      if (sortByCol.value !== col) return '';
      return sortOrd.value === 'asc' ? ' \u25B2' : ' \u25BC';
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); focusIndex.value = Math.min(focusIndex.value + 1, sortedCases.value.length - 1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); focusIndex.value = Math.max(focusIndex.value - 1, 0); }
      if (e.key === 'Enter') { e.preventDefault(); const tc = sortedCases.value[focusIndex.value]; if (tc) handleSelectRow(tc); }
      if (e.key === 'Escape') { e.preventDefault(); handleDeselect(); }
    }

    function renderHeaderCell(col: string, label: string) {
      return h('th', {
        key: col, 'data-part': 'header-cell', role: 'columnheader',
        'aria-sort': sortByCol.value === col ? (sortOrd.value === 'asc' ? 'ascending' : 'descending') : 'none',
        onClick: () => handleSort(col), style: { cursor: 'pointer' }, tabindex: 0,
        onKeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') handleSort(col); },
      }, `${label}${sortIndicator(col)}`);
    }

    return () => {
      const children: any[] = [];

      // Summary bar
      children.push(h('div', { 'data-part': 'summary' }, [
        h('span', { 'data-part': 'score', role: 'status', 'aria-label': `Overall score: ${props.overallScore}%` }, `${props.overallScore}%`),
        h('span', { 'data-part': 'pass-count', 'aria-label': `${props.passCount} passed` }, `${props.passCount} passed`),
        h('span', { 'data-part': 'fail-count', 'aria-label': `${props.failCount} failed` }, `${props.failCount} failed`),
        h('div', { 'data-part': 'pass-fail-bar', role: 'img', 'aria-label': `${props.passCount} passed, ${props.failCount} failed` }, [
          h('div', { 'data-part': 'pass-segment', 'data-status': 'pass', style: { width: `${passPercent.value}%` }, 'aria-hidden': 'true' }),
          h('div', { 'data-part': 'fail-segment', 'data-status': 'fail', style: { width: `${failPercent.value}%` }, 'aria-hidden': 'true' }),
        ]),
      ]));

      // Filter buttons
      children.push(h('div', { 'data-part': 'filter-bar', role: 'toolbar', 'aria-label': 'Filter results' }, [
        h('button', { type: 'button', 'data-part': 'filter-all', 'data-active': !activeFilter.value ? 'true' : 'false', 'aria-pressed': !activeFilter.value ? 'true' : 'false', onClick: () => handleFilter(undefined) }, `All (${props.testCases.length})`),
        h('button', { type: 'button', 'data-part': 'filter-pass', 'data-active': activeFilter.value === 'pass' ? 'true' : 'false', 'aria-pressed': activeFilter.value === 'pass' ? 'true' : 'false', onClick: () => handleFilter(activeFilter.value === 'pass' ? undefined : 'pass') }, `Pass (${props.passCount})`),
        h('button', { type: 'button', 'data-part': 'filter-fail', 'data-active': activeFilter.value === 'fail' ? 'true' : 'false', 'aria-pressed': activeFilter.value === 'fail' ? 'true' : 'false', onClick: () => handleFilter(activeFilter.value === 'fail' ? undefined : 'fail') }, `Fail (${props.failCount})`),
      ]));

      // Results table
      const headerCells = [
        renderHeaderCell('status', 'Status'),
        renderHeaderCell('input', 'Input'),
        renderHeaderCell('actual', 'Output'),
      ];
      if (props.showExpected) headerCells.push(renderHeaderCell('expected', 'Expected'));
      headerCells.push(renderHeaderCell('score', 'Score'));

      const rows = sortedCases.value.length > 0
        ? sortedCases.value.map((tc, index) => {
            const isSelected = selectedId.value === tc.id;
            const isFocused = focusIndex.value === index;
            const cells = [
              h('td', { 'data-part': 'status', role: 'cell', 'data-pass': tc.pass ? 'true' : 'false' }, [
                h('span', { 'data-part': 'pass-fail-badge', 'aria-label': tc.pass ? 'Passed' : 'Failed' }, tc.pass ? '\u2713 Pass' : '\u2717 Fail'),
              ]),
              h('td', { 'data-part': 'input', role: 'cell', title: tc.input }, truncate(tc.input, 80)),
              h('td', { 'data-part': 'output', role: 'cell', title: tc.actual }, truncate(tc.actual, 80)),
            ];
            if (props.showExpected) {
              cells.push(h('td', { 'data-part': 'expected', role: 'cell', title: tc.expected }, truncate(tc.expected, 80)));
            }
            cells.push(h('td', { 'data-part': 'score-cell', role: 'cell' }, [
              h('span', { 'data-part': 'score-value' }, String(tc.score)),
              h('div', { 'data-part': 'score-bar', role: 'progressbar', 'aria-valuenow': tc.score, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': `Score: ${tc.score}` }, [
                h('div', { 'data-part': 'score-bar-fill', 'data-pass': tc.pass ? 'true' : 'false', style: { width: `${Math.min(100, tc.score)}%` }, 'aria-hidden': 'true' }),
              ]),
            ]));

            return h('tr', {
              key: tc.id, 'data-part': 'row', role: 'row',
              'data-status': tc.pass ? 'pass' : 'fail',
              'aria-selected': isSelected ? 'true' : 'false',
              tabindex: isFocused ? 0 : -1,
              onClick: () => handleSelectRow(tc),
              onKeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectRow(tc); } },
            }, cells);
          })
        : [h('tr', { 'data-part': 'empty-row' }, [
            h('td', { colspan: props.showExpected ? 5 : 4, 'data-part': 'empty-cell', role: 'cell' }, 'No test cases match the current filter'),
          ])];

      children.push(h('table', { 'data-part': 'table', role: 'table', 'aria-label': `Results: ${props.passCount} passed, ${props.failCount} failed` }, [
        h('thead', {}, [h('tr', { 'data-part': 'header-row', role: 'row' }, headerCells)]),
        h('tbody', {}, rows),
      ]));

      // Detail panel
      const sc = selectedCase.value;
      children.push(h('div', {
        'data-part': 'detail',
        'data-visible': state.value === 'rowSelected' && sc ? 'true' : 'false',
        'aria-hidden': !(state.value === 'rowSelected' && sc) ? 'true' : 'false',
      }, sc ? [
        h('div', { 'data-part': 'detail-content' }, [
          h('div', { 'data-part': 'detail-header' }, [
            h('span', { 'data-part': 'detail-status', 'data-pass': sc.pass ? 'true' : 'false' }, sc.pass ? '\u2713 Passed' : '\u2717 Failed'),
            h('span', { 'data-part': 'detail-score' }, `Score: ${sc.score}`),
            h('button', { type: 'button', 'data-part': 'close-detail', onClick: handleDeselect, 'aria-label': 'Close detail panel' }, '\u2715'),
          ]),
          h('div', { 'data-part': 'detail-section' }, [
            h('h4', { 'data-part': 'detail-label' }, 'Input'),
            h('pre', { 'data-part': 'detail-input' }, sc.input),
          ]),
          h('div', { 'data-part': 'detail-section' }, [
            h('h4', { 'data-part': 'detail-label' }, 'Model Output'),
            h('pre', { 'data-part': 'detail-output' }, sc.actual),
          ]),
          h('div', { 'data-part': 'detail-section' }, [
            h('h4', { 'data-part': 'detail-label' }, 'Expected Output'),
            h('pre', { 'data-part': 'detail-expected' }, sc.expected),
          ]),
          // Diff view
          sc.actual !== sc.expected ? h('div', { 'data-part': 'detail-section' }, [
            h('h4', { 'data-part': 'detail-label' }, 'Diff'),
            h('div', { 'data-part': 'detail-diff' }, [
              h('div', { 'data-part': 'diff-expected', 'aria-label': 'Expected' }, [h('span', { 'data-part': 'diff-prefix' }, '-'), ` ${sc.expected}`]),
              h('div', { 'data-part': 'diff-actual', 'aria-label': 'Actual' }, [h('span', { 'data-part': 'diff-prefix' }, '+'), ` ${sc.actual}`]),
            ]),
          ]) : null,
          // Per-metric breakdown
          sc.metrics && Object.keys(sc.metrics).length > 0 ? h('div', { 'data-part': 'detail-section' }, [
            h('h4', { 'data-part': 'detail-label' }, 'Metrics'),
            h('div', { 'data-part': 'metrics-list' },
              Object.entries(sc.metrics).map(([metric, value]) => h('div', { key: metric, 'data-part': 'metric-item' }, [
                h('span', { 'data-part': 'metric-name' }, metric),
                h('span', { 'data-part': 'metric-value' }, String(value)),
                h('div', { 'data-part': 'metric-bar', role: 'progressbar', 'aria-valuenow': value, 'aria-valuemin': 0, 'aria-valuemax': 100 }, [
                  h('div', { 'data-part': 'metric-bar-fill', style: { width: `${Math.min(100, value)}%` }, 'aria-hidden': 'true' }),
                ]),
              ])),
            ),
          ]) : null,
        ]),
      ] : null));

      if (slots.default) children.push(slots.default());

      return h('div', {
        role: 'region',
        'aria-label': 'Evaluation results',
        'data-surface-widget': '',
        'data-widget-name': 'eval-results-table',
        'data-part': 'root',
        'data-state': state.value,
        onKeydown: handleKeydown,
        tabindex: 0,
      }, children);
    };
  },
});

export default EvalResultsTable;
