import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type EvalResultsTableState = 'idle' | 'rowSelected';
export type EvalResultsTableEvent =
  | { type: 'SELECT_ROW' }
  | { type: 'SORT' }
  | { type: 'FILTER' }
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

/* --- Types --- */

export interface EvalTestCase {
  id: string;
  input: string;
  expected: string;
  actual: string;
  score: number;
  pass: boolean;
  metrics?: Record<string, number>;
}

export interface EvalResultsTableProps {
  [key: string]: unknown;
  class?: string;
  testCases: EvalTestCase[];
  overallScore: number;
  passCount: number;
  failCount: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filterStatus?: string;
  showExpected?: boolean;
  onSelect?: (testCase: EvalTestCase) => void;
}
export interface EvalResultsTableResult { element: HTMLElement; dispose: () => void; }

/* --- Helpers --- */

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

/* --- Component --- */

export function EvalResultsTable(props: EvalResultsTableProps): EvalResultsTableResult {
  const sig = surfaceCreateSignal<EvalResultsTableState>('idle');
  const send = (type: string) => sig.set(evalResultsTableReducer(sig.get(), { type } as any));

  const testCases = (props.testCases ?? []) as EvalTestCase[];
  const overallScore = (props.overallScore as number) ?? 0;
  const passCount = (props.passCount as number) ?? 0;
  const failCount = (props.failCount as number) ?? 0;
  const showExpected = props.showExpected !== false;
  const onSelect = props.onSelect as ((tc: EvalTestCase) => void) | undefined;

  let sortByCol = (props.sortBy as string) ?? 'score';
  let sortOrd = (props.sortOrder as 'asc' | 'desc') ?? 'desc';
  let activeFilter: string | undefined = props.filterStatus as string | undefined;
  let selectedId: string | null = null;
  let focusIndex = 0;

  const totalCount = passCount + failCount;
  const passPercent = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;
  const failPercent = totalCount > 0 ? 100 - passPercent : 0;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'eval-results-table');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Evaluation results');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Summary bar
  const summaryEl = document.createElement('div');
  summaryEl.setAttribute('data-part', 'summary');
  root.appendChild(summaryEl);

  const scoreSpan = document.createElement('span');
  scoreSpan.setAttribute('data-part', 'score');
  scoreSpan.setAttribute('role', 'status');
  scoreSpan.setAttribute('aria-label', `Overall score: ${overallScore}%`);
  scoreSpan.textContent = `${overallScore}%`;
  summaryEl.appendChild(scoreSpan);

  const passSpan = document.createElement('span');
  passSpan.setAttribute('data-part', 'pass-count');
  passSpan.setAttribute('aria-label', `${passCount} passed`);
  passSpan.textContent = `${passCount} passed`;
  summaryEl.appendChild(passSpan);

  const failSpan = document.createElement('span');
  failSpan.setAttribute('data-part', 'fail-count');
  failSpan.setAttribute('aria-label', `${failCount} failed`);
  failSpan.textContent = `${failCount} failed`;
  summaryEl.appendChild(failSpan);

  // Pass/fail ratio bar
  const pfBar = document.createElement('div');
  pfBar.setAttribute('data-part', 'pass-fail-bar');
  pfBar.setAttribute('role', 'img');
  pfBar.setAttribute('aria-label', `${passCount} passed, ${failCount} failed`);
  const passSegment = document.createElement('div');
  passSegment.setAttribute('data-part', 'pass-segment');
  passSegment.setAttribute('data-status', 'pass');
  passSegment.style.width = `${passPercent}%`;
  passSegment.setAttribute('aria-hidden', 'true');
  pfBar.appendChild(passSegment);
  const failSegment = document.createElement('div');
  failSegment.setAttribute('data-part', 'fail-segment');
  failSegment.setAttribute('data-status', 'fail');
  failSegment.style.width = `${failPercent}%`;
  failSegment.setAttribute('aria-hidden', 'true');
  pfBar.appendChild(failSegment);
  summaryEl.appendChild(pfBar);

  // Filter bar
  const filterBarEl = document.createElement('div');
  filterBarEl.setAttribute('data-part', 'filter-bar');
  filterBarEl.setAttribute('role', 'toolbar');
  filterBarEl.setAttribute('aria-label', 'Filter results');
  root.appendChild(filterBarEl);

  function rebuildFilterBar() {
    filterBarEl.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.setAttribute('data-part', 'filter-all');
    allBtn.setAttribute('data-active', !activeFilter ? 'true' : 'false');
    allBtn.setAttribute('aria-pressed', String(!activeFilter));
    allBtn.textContent = `All (${testCases.length})`;
    allBtn.addEventListener('click', () => { activeFilter = undefined; send('FILTER'); rebuild(); });
    filterBarEl.appendChild(allBtn);

    const passBtn = document.createElement('button');
    passBtn.type = 'button';
    passBtn.setAttribute('data-part', 'filter-pass');
    passBtn.setAttribute('data-active', activeFilter === 'pass' ? 'true' : 'false');
    passBtn.setAttribute('aria-pressed', String(activeFilter === 'pass'));
    passBtn.textContent = `Pass (${passCount})`;
    passBtn.addEventListener('click', () => { activeFilter = activeFilter === 'pass' ? undefined : 'pass'; send('FILTER'); rebuild(); });
    filterBarEl.appendChild(passBtn);

    const failBtn = document.createElement('button');
    failBtn.type = 'button';
    failBtn.setAttribute('data-part', 'filter-fail');
    failBtn.setAttribute('data-active', activeFilter === 'fail' ? 'true' : 'false');
    failBtn.setAttribute('aria-pressed', String(activeFilter === 'fail'));
    failBtn.textContent = `Fail (${failCount})`;
    failBtn.addEventListener('click', () => { activeFilter = activeFilter === 'fail' ? undefined : 'fail'; send('FILTER'); rebuild(); });
    filterBarEl.appendChild(failBtn);
  }

  // Table
  const tableEl = document.createElement('table');
  tableEl.setAttribute('data-part', 'table');
  tableEl.setAttribute('role', 'table');
  tableEl.setAttribute('aria-label', `Results: ${passCount} passed, ${failCount} failed`);
  root.appendChild(tableEl);

  // Detail panel
  const detailEl = document.createElement('div');
  detailEl.setAttribute('data-part', 'detail');
  detailEl.setAttribute('data-visible', 'false');
  detailEl.setAttribute('aria-hidden', 'true');
  detailEl.style.display = 'none';
  root.appendChild(detailEl);

  function getProcessed(): EvalTestCase[] {
    let filtered = testCases;
    if (activeFilter === 'pass') filtered = testCases.filter((tc) => tc.pass);
    else if (activeFilter === 'fail') filtered = testCases.filter((tc) => !tc.pass);
    return [...filtered].sort((a, b) => compareCases(a, b, sortByCol, sortOrd));
  }

  function sortIndicator(col: string): string {
    if (sortByCol !== col) return '';
    return sortOrd === 'asc' ? ' \u25B2' : ' \u25BC';
  }

  function handleSort(column: string) {
    if (sortByCol === column) sortOrd = sortOrd === 'asc' ? 'desc' : 'asc';
    else { sortByCol = column; sortOrd = 'desc'; }
    send('SORT');
    rebuild();
  }

  function rebuild() {
    rebuildFilterBar();
    tableEl.innerHTML = '';

    const sorted = getProcessed();
    const colCount = showExpected ? 5 : 4;

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.setAttribute('data-part', 'header-row');
    headerRow.setAttribute('role', 'row');

    const columns = [
      { key: 'status', label: 'Status' },
      { key: 'input', label: 'Input' },
      { key: 'actual', label: 'Output' },
      ...(showExpected ? [{ key: 'expected', label: 'Expected' }] : []),
      { key: 'score', label: 'Score' },
    ];

    for (const col of columns) {
      const th = document.createElement('th');
      th.setAttribute('data-part', 'header-cell');
      th.setAttribute('role', 'columnheader');
      th.setAttribute('aria-sort', sortByCol === col.key ? (sortOrd === 'asc' ? 'ascending' : 'descending') : 'none');
      th.style.cursor = 'pointer';
      th.setAttribute('tabindex', '0');
      th.textContent = col.label + sortIndicator(col.key);
      th.addEventListener('click', () => handleSort(col.key));
      th.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSort(col.key); });
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    tableEl.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    if (sorted.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.setAttribute('data-part', 'empty-row');
      const emptyCell = document.createElement('td');
      emptyCell.setAttribute('colspan', String(colCount));
      emptyCell.setAttribute('data-part', 'empty-cell');
      emptyCell.setAttribute('role', 'cell');
      emptyCell.textContent = 'No test cases match the current filter';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    }

    for (let i = 0; i < sorted.length; i++) {
      const tc = sorted[i];
      const isSelected = selectedId === tc.id;
      const isFocused = focusIndex === i;

      const tr = document.createElement('tr');
      tr.setAttribute('data-part', 'row');
      tr.setAttribute('role', 'row');
      tr.setAttribute('data-status', tc.pass ? 'pass' : 'fail');
      tr.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      tr.setAttribute('tabindex', isFocused ? '0' : '-1');

      // Status
      const tdStatus = document.createElement('td');
      tdStatus.setAttribute('data-part', 'status');
      tdStatus.setAttribute('role', 'cell');
      tdStatus.setAttribute('data-pass', tc.pass ? 'true' : 'false');
      const badge = document.createElement('span');
      badge.setAttribute('data-part', 'pass-fail-badge');
      badge.setAttribute('aria-label', tc.pass ? 'Passed' : 'Failed');
      badge.textContent = tc.pass ? '\u2713 Pass' : '\u2717 Fail';
      tdStatus.appendChild(badge);
      tr.appendChild(tdStatus);

      // Input
      const tdInput = document.createElement('td');
      tdInput.setAttribute('data-part', 'input');
      tdInput.setAttribute('role', 'cell');
      tdInput.title = tc.input;
      tdInput.textContent = truncate(tc.input, 80);
      tr.appendChild(tdInput);

      // Output
      const tdOutput = document.createElement('td');
      tdOutput.setAttribute('data-part', 'output');
      tdOutput.setAttribute('role', 'cell');
      tdOutput.title = tc.actual;
      tdOutput.textContent = truncate(tc.actual, 80);
      tr.appendChild(tdOutput);

      // Expected
      if (showExpected) {
        const tdExpected = document.createElement('td');
        tdExpected.setAttribute('data-part', 'expected');
        tdExpected.setAttribute('role', 'cell');
        tdExpected.title = tc.expected;
        tdExpected.textContent = truncate(tc.expected, 80);
        tr.appendChild(tdExpected);
      }

      // Score
      const tdScore = document.createElement('td');
      tdScore.setAttribute('data-part', 'score-cell');
      tdScore.setAttribute('role', 'cell');

      const scoreVal = document.createElement('span');
      scoreVal.setAttribute('data-part', 'score-value');
      scoreVal.textContent = String(tc.score);
      tdScore.appendChild(scoreVal);

      const scoreBar = document.createElement('div');
      scoreBar.setAttribute('data-part', 'score-bar');
      scoreBar.setAttribute('role', 'progressbar');
      scoreBar.setAttribute('aria-valuenow', String(tc.score));
      scoreBar.setAttribute('aria-valuemin', '0');
      scoreBar.setAttribute('aria-valuemax', '100');
      scoreBar.setAttribute('aria-label', `Score: ${tc.score}`);
      const scoreFill = document.createElement('div');
      scoreFill.setAttribute('data-part', 'score-bar-fill');
      scoreFill.setAttribute('data-pass', tc.pass ? 'true' : 'false');
      scoreFill.style.width = `${Math.min(100, tc.score)}%`;
      scoreFill.setAttribute('aria-hidden', 'true');
      scoreBar.appendChild(scoreFill);
      tdScore.appendChild(scoreBar);

      tr.appendChild(tdScore);

      tr.addEventListener('click', () => {
        if (selectedId === tc.id) { selectedId = null; send('DESELECT'); }
        else { selectedId = tc.id; send('SELECT_ROW'); onSelect?.(tc); }
        rebuild();
        rebuildDetail();
      });

      tbody.appendChild(tr);
    }
    tableEl.appendChild(tbody);

    rebuildDetail();
  }

  function rebuildDetail() {
    detailEl.innerHTML = '';
    const sorted = getProcessed();
    const selectedCase = selectedId ? sorted.find((tc) => tc.id === selectedId) : null;

    if (sig.get() === 'rowSelected' && selectedCase) {
      detailEl.style.display = '';
      detailEl.setAttribute('data-visible', 'true');
      detailEl.setAttribute('aria-hidden', 'false');

      const contentDiv = document.createElement('div');
      contentDiv.setAttribute('data-part', 'detail-content');

      // Header
      const headerDiv = document.createElement('div');
      headerDiv.setAttribute('data-part', 'detail-header');

      const statusSpan = document.createElement('span');
      statusSpan.setAttribute('data-part', 'detail-status');
      statusSpan.setAttribute('data-pass', selectedCase.pass ? 'true' : 'false');
      statusSpan.textContent = selectedCase.pass ? '\u2713 Passed' : '\u2717 Failed';
      headerDiv.appendChild(statusSpan);

      const scoreSpan2 = document.createElement('span');
      scoreSpan2.setAttribute('data-part', 'detail-score');
      scoreSpan2.textContent = `Score: ${selectedCase.score}`;
      headerDiv.appendChild(scoreSpan2);

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.setAttribute('data-part', 'close-detail');
      closeBtn.setAttribute('aria-label', 'Close detail panel');
      closeBtn.textContent = '\u2715';
      closeBtn.addEventListener('click', () => { selectedId = null; send('DESELECT'); rebuild(); });
      headerDiv.appendChild(closeBtn);

      contentDiv.appendChild(headerDiv);

      // Input section
      const inputSection = document.createElement('div');
      inputSection.setAttribute('data-part', 'detail-section');
      const inputH4 = document.createElement('h4');
      inputH4.setAttribute('data-part', 'detail-label');
      inputH4.textContent = 'Input';
      inputSection.appendChild(inputH4);
      const inputPre = document.createElement('pre');
      inputPre.setAttribute('data-part', 'detail-input');
      inputPre.textContent = selectedCase.input;
      inputSection.appendChild(inputPre);
      contentDiv.appendChild(inputSection);

      // Output section
      const outputSection = document.createElement('div');
      outputSection.setAttribute('data-part', 'detail-section');
      const outputH4 = document.createElement('h4');
      outputH4.setAttribute('data-part', 'detail-label');
      outputH4.textContent = 'Model Output';
      outputSection.appendChild(outputH4);
      const outputPre = document.createElement('pre');
      outputPre.setAttribute('data-part', 'detail-output');
      outputPre.textContent = selectedCase.actual;
      outputSection.appendChild(outputPre);
      contentDiv.appendChild(outputSection);

      // Expected section
      const expectedSection = document.createElement('div');
      expectedSection.setAttribute('data-part', 'detail-section');
      const expectedH4 = document.createElement('h4');
      expectedH4.setAttribute('data-part', 'detail-label');
      expectedH4.textContent = 'Expected Output';
      expectedSection.appendChild(expectedH4);
      const expectedPre = document.createElement('pre');
      expectedPre.setAttribute('data-part', 'detail-expected');
      expectedPre.textContent = selectedCase.expected;
      expectedSection.appendChild(expectedPre);
      contentDiv.appendChild(expectedSection);

      // Diff
      if (selectedCase.actual !== selectedCase.expected) {
        const diffSection = document.createElement('div');
        diffSection.setAttribute('data-part', 'detail-section');
        const diffH4 = document.createElement('h4');
        diffH4.setAttribute('data-part', 'detail-label');
        diffH4.textContent = 'Diff';
        diffSection.appendChild(diffH4);

        const diffDiv = document.createElement('div');
        diffDiv.setAttribute('data-part', 'detail-diff');

        const diffExpected = document.createElement('div');
        diffExpected.setAttribute('data-part', 'diff-expected');
        diffExpected.setAttribute('aria-label', 'Expected');
        const diffPrefixMinus = document.createElement('span');
        diffPrefixMinus.setAttribute('data-part', 'diff-prefix');
        diffPrefixMinus.textContent = '-';
        diffExpected.appendChild(diffPrefixMinus);
        diffExpected.appendChild(document.createTextNode(` ${selectedCase.expected}`));
        diffDiv.appendChild(diffExpected);

        const diffActual = document.createElement('div');
        diffActual.setAttribute('data-part', 'diff-actual');
        diffActual.setAttribute('aria-label', 'Actual');
        const diffPrefixPlus = document.createElement('span');
        diffPrefixPlus.setAttribute('data-part', 'diff-prefix');
        diffPrefixPlus.textContent = '+';
        diffActual.appendChild(diffPrefixPlus);
        diffActual.appendChild(document.createTextNode(` ${selectedCase.actual}`));
        diffDiv.appendChild(diffActual);

        diffSection.appendChild(diffDiv);
        contentDiv.appendChild(diffSection);
      }

      // Metrics
      if (selectedCase.metrics && Object.keys(selectedCase.metrics).length > 0) {
        const metricsSection = document.createElement('div');
        metricsSection.setAttribute('data-part', 'detail-section');
        const metricsH4 = document.createElement('h4');
        metricsH4.setAttribute('data-part', 'detail-label');
        metricsH4.textContent = 'Metrics';
        metricsSection.appendChild(metricsH4);

        const metricsList = document.createElement('div');
        metricsList.setAttribute('data-part', 'metrics-list');

        for (const [metric, value] of Object.entries(selectedCase.metrics)) {
          const metricItem = document.createElement('div');
          metricItem.setAttribute('data-part', 'metric-item');

          const nameSpan = document.createElement('span');
          nameSpan.setAttribute('data-part', 'metric-name');
          nameSpan.textContent = metric;
          metricItem.appendChild(nameSpan);

          const valSpan = document.createElement('span');
          valSpan.setAttribute('data-part', 'metric-value');
          valSpan.textContent = String(value);
          metricItem.appendChild(valSpan);

          const metricBar = document.createElement('div');
          metricBar.setAttribute('data-part', 'metric-bar');
          metricBar.setAttribute('role', 'progressbar');
          metricBar.setAttribute('aria-valuenow', String(value));
          metricBar.setAttribute('aria-valuemin', '0');
          metricBar.setAttribute('aria-valuemax', '100');
          const metricFill = document.createElement('div');
          metricFill.setAttribute('data-part', 'metric-bar-fill');
          metricFill.style.width = `${Math.min(100, value)}%`;
          metricFill.setAttribute('aria-hidden', 'true');
          metricBar.appendChild(metricFill);
          metricItem.appendChild(metricBar);

          metricsList.appendChild(metricItem);
        }

        metricsSection.appendChild(metricsList);
        contentDiv.appendChild(metricsSection);
      }

      detailEl.appendChild(contentDiv);
    } else {
      detailEl.style.display = 'none';
      detailEl.setAttribute('data-visible', 'false');
      detailEl.setAttribute('aria-hidden', 'true');
    }
  }

  rebuild();

  // Keyboard
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    const sorted = getProcessed();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusIndex = Math.min(focusIndex + 1, sorted.length - 1);
      rebuild();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusIndex = Math.max(focusIndex - 1, 0);
      rebuild();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const tc = sorted[focusIndex];
      if (tc) {
        if (selectedId === tc.id) { selectedId = null; send('DESELECT'); }
        else { selectedId = tc.id; send('SELECT_ROW'); onSelect?.(tc); }
        rebuild();
      }
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

export default EvalResultsTable;
