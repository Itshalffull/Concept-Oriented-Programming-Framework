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

export interface EvalResultsTableProps { [key: string]: unknown; class?: string; }
export interface EvalResultsTableResult { element: HTMLElement; dispose: () => void; }

export function EvalResultsTable(props: EvalResultsTableProps): EvalResultsTableResult {
  const sig = surfaceCreateSignal<EvalResultsTableState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(evalResultsTableReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'eval-results-table');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Evaluation results');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Summary bar */
  const summaryEl = document.createElement('div');
  summaryEl.setAttribute('data-part', 'summary');

  const scoreEl = document.createElement('span');
  scoreEl.setAttribute('data-part', 'score');
  scoreEl.setAttribute('role', 'status');
  scoreEl.setAttribute('aria-label', 'Overall score: 0%');
  scoreEl.textContent = '0%';
  summaryEl.appendChild(scoreEl);

  const passCountEl = document.createElement('span');
  passCountEl.setAttribute('data-part', 'pass-count');
  passCountEl.setAttribute('aria-label', '0 passed');
  passCountEl.textContent = '0 passed';
  summaryEl.appendChild(passCountEl);

  const failCountEl = document.createElement('span');
  failCountEl.setAttribute('data-part', 'fail-count');
  failCountEl.setAttribute('aria-label', '0 failed');
  failCountEl.textContent = '0 failed';
  summaryEl.appendChild(failCountEl);

  /* Pass/fail ratio bar */
  const passFailBarEl = document.createElement('div');
  passFailBarEl.setAttribute('data-part', 'pass-fail-bar');
  passFailBarEl.setAttribute('role', 'img');
  passFailBarEl.setAttribute('aria-label', '0 passed, 0 failed');
  const passSegment = document.createElement('div');
  passSegment.setAttribute('data-part', 'pass-segment');
  passSegment.setAttribute('data-status', 'pass');
  passSegment.setAttribute('aria-hidden', 'true');
  passSegment.style.width = '50%';
  passFailBarEl.appendChild(passSegment);
  const failSegment = document.createElement('div');
  failSegment.setAttribute('data-part', 'fail-segment');
  failSegment.setAttribute('data-status', 'fail');
  failSegment.setAttribute('aria-hidden', 'true');
  failSegment.style.width = '50%';
  passFailBarEl.appendChild(failSegment);
  summaryEl.appendChild(passFailBarEl);

  root.appendChild(summaryEl);

  /* Filter bar */
  const filterBarEl = document.createElement('div');
  filterBarEl.setAttribute('data-part', 'filter-bar');
  filterBarEl.setAttribute('role', 'toolbar');
  filterBarEl.setAttribute('aria-label', 'Filter results');

  const filterAllBtn = document.createElement('button');
  filterAllBtn.type = 'button';
  filterAllBtn.setAttribute('data-part', 'filter-all');
  filterAllBtn.setAttribute('data-active', 'true');
  filterAllBtn.setAttribute('aria-pressed', 'true');
  filterAllBtn.textContent = 'All (0)';
  filterAllBtn.addEventListener('click', () => { send('FILTER'); });
  filterBarEl.appendChild(filterAllBtn);

  const filterPassBtn = document.createElement('button');
  filterPassBtn.type = 'button';
  filterPassBtn.setAttribute('data-part', 'filter-pass');
  filterPassBtn.setAttribute('data-active', 'false');
  filterPassBtn.setAttribute('aria-pressed', 'false');
  filterPassBtn.textContent = 'Pass (0)';
  filterPassBtn.addEventListener('click', () => { send('FILTER'); });
  filterBarEl.appendChild(filterPassBtn);

  const filterFailBtn = document.createElement('button');
  filterFailBtn.type = 'button';
  filterFailBtn.setAttribute('data-part', 'filter-fail');
  filterFailBtn.setAttribute('data-active', 'false');
  filterFailBtn.setAttribute('aria-pressed', 'false');
  filterFailBtn.textContent = 'Fail (0)';
  filterFailBtn.addEventListener('click', () => { send('FILTER'); });
  filterBarEl.appendChild(filterFailBtn);

  root.appendChild(filterBarEl);

  /* Results table */
  const tableEl = document.createElement('table');
  tableEl.setAttribute('data-part', 'table');
  tableEl.setAttribute('role', 'table');
  tableEl.setAttribute('aria-label', 'Results: 0 passed, 0 failed');

  /* Header row */
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.setAttribute('data-part', 'header-row');
  headerRow.setAttribute('role', 'row');
  const headerCols = [
    { key: 'status', label: 'Status' },
    { key: 'input', label: 'Input' },
    { key: 'actual', label: 'Output' },
    { key: 'expected', label: 'Expected' },
    { key: 'score', label: 'Score' },
  ];
  for (const col of headerCols) {
    const th = document.createElement('th');
    th.setAttribute('data-part', 'header-cell');
    th.setAttribute('role', 'columnheader');
    th.setAttribute('aria-sort', 'none');
    th.style.cursor = 'pointer';
    th.setAttribute('tabindex', '0');
    th.textContent = col.label;
    th.addEventListener('click', () => { send('SORT'); });
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send('SORT');
    });
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  tableEl.appendChild(thead);

  /* Table body with template row */
  const tbody = document.createElement('tbody');
  const dataRow = document.createElement('tr');
  dataRow.setAttribute('data-part', 'row');
  dataRow.setAttribute('role', 'row');
  dataRow.setAttribute('data-status', 'pass');
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

  const statusTd = document.createElement('td');
  statusTd.setAttribute('data-part', 'status');
  statusTd.setAttribute('role', 'cell');
  statusTd.setAttribute('data-pass', 'true');
  const passBadge = document.createElement('span');
  passBadge.setAttribute('data-part', 'pass-fail-badge');
  passBadge.setAttribute('aria-label', 'Passed');
  passBadge.textContent = '\u2713 Pass';
  statusTd.appendChild(passBadge);
  dataRow.appendChild(statusTd);

  const inputTd = document.createElement('td');
  inputTd.setAttribute('data-part', 'input');
  inputTd.setAttribute('role', 'cell');
  inputTd.textContent = 'Input text';
  dataRow.appendChild(inputTd);

  const outputTd = document.createElement('td');
  outputTd.setAttribute('data-part', 'output');
  outputTd.setAttribute('role', 'cell');
  outputTd.textContent = 'Output text';
  dataRow.appendChild(outputTd);

  const expectedTd = document.createElement('td');
  expectedTd.setAttribute('data-part', 'expected');
  expectedTd.setAttribute('role', 'cell');
  expectedTd.textContent = 'Expected text';
  dataRow.appendChild(expectedTd);

  const scoreTd = document.createElement('td');
  scoreTd.setAttribute('data-part', 'score-cell');
  scoreTd.setAttribute('role', 'cell');
  const scoreValue = document.createElement('span');
  scoreValue.setAttribute('data-part', 'score-value');
  scoreValue.textContent = '0';
  scoreTd.appendChild(scoreValue);
  const scoreBar = document.createElement('div');
  scoreBar.setAttribute('data-part', 'score-bar');
  scoreBar.setAttribute('role', 'progressbar');
  scoreBar.setAttribute('aria-valuenow', '0');
  scoreBar.setAttribute('aria-valuemin', '0');
  scoreBar.setAttribute('aria-valuemax', '100');
  scoreBar.setAttribute('aria-label', 'Score: 0');
  const scoreBarFill = document.createElement('div');
  scoreBarFill.setAttribute('data-part', 'score-bar-fill');
  scoreBarFill.setAttribute('data-pass', 'true');
  scoreBarFill.setAttribute('aria-hidden', 'true');
  scoreBarFill.style.width = '0%';
  scoreBar.appendChild(scoreBarFill);
  scoreTd.appendChild(scoreBar);
  dataRow.appendChild(scoreTd);

  tbody.appendChild(dataRow);

  /* Empty row */
  const emptyRow = document.createElement('tr');
  emptyRow.setAttribute('data-part', 'empty-row');
  emptyRow.style.display = 'none';
  const emptyCell = document.createElement('td');
  emptyCell.setAttribute('data-part', 'empty-cell');
  emptyCell.setAttribute('role', 'cell');
  emptyCell.colSpan = 5;
  emptyCell.textContent = 'No test cases match the current filter';
  emptyRow.appendChild(emptyCell);
  tbody.appendChild(emptyRow);

  tableEl.appendChild(tbody);
  root.appendChild(tableEl);

  /* Detail panel */
  const detailEl = document.createElement('div');
  detailEl.setAttribute('data-part', 'detail');
  detailEl.setAttribute('data-visible', 'false');
  detailEl.setAttribute('aria-hidden', 'true');

  const detailContent = document.createElement('div');
  detailContent.setAttribute('data-part', 'detail-content');

  /* Detail header */
  const detailHeader = document.createElement('div');
  detailHeader.setAttribute('data-part', 'detail-header');
  const detailStatus = document.createElement('span');
  detailStatus.setAttribute('data-part', 'detail-status');
  detailStatus.setAttribute('data-pass', 'true');
  detailStatus.textContent = '\u2713 Passed';
  detailHeader.appendChild(detailStatus);
  const detailScore = document.createElement('span');
  detailScore.setAttribute('data-part', 'detail-score');
  detailScore.textContent = 'Score: 0';
  detailHeader.appendChild(detailScore);
  const closeDetailBtn = document.createElement('button');
  closeDetailBtn.type = 'button';
  closeDetailBtn.setAttribute('data-part', 'close-detail');
  closeDetailBtn.setAttribute('aria-label', 'Close detail panel');
  closeDetailBtn.textContent = '\u2715';
  closeDetailBtn.addEventListener('click', () => { send('DESELECT'); });
  detailHeader.appendChild(closeDetailBtn);
  detailContent.appendChild(detailHeader);

  /* Detail sections */
  const sections = [
    { label: 'Input', part: 'detail-input' },
    { label: 'Model Output', part: 'detail-output' },
    { label: 'Expected Output', part: 'detail-expected' },
  ];
  for (const sec of sections) {
    const sectionEl = document.createElement('div');
    sectionEl.setAttribute('data-part', 'detail-section');
    const h4 = document.createElement('h4');
    h4.setAttribute('data-part', 'detail-label');
    h4.textContent = sec.label;
    sectionEl.appendChild(h4);
    const pre = document.createElement('pre');
    pre.setAttribute('data-part', sec.part);
    pre.textContent = '';
    sectionEl.appendChild(pre);
    detailContent.appendChild(sectionEl);
  }

  /* Metrics section */
  const metricsSection = document.createElement('div');
  metricsSection.setAttribute('data-part', 'detail-section');
  const metricsH4 = document.createElement('h4');
  metricsH4.setAttribute('data-part', 'detail-label');
  metricsH4.textContent = 'Metrics';
  metricsSection.appendChild(metricsH4);
  const metricsList = document.createElement('div');
  metricsList.setAttribute('data-part', 'metrics-list');
  metricsSection.appendChild(metricsList);
  detailContent.appendChild(metricsSection);

  detailEl.appendChild(detailContent);
  root.appendChild(detailEl);

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
    const showDetail = s === 'rowSelected';
    detailEl.setAttribute('data-visible', showDetail ? 'true' : 'false');
    detailEl.setAttribute('aria-hidden', showDetail ? 'false' : 'true');
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default EvalResultsTable;
