/* ---------------------------------------------------------------------------
 * EvalResultsTable — Vanilla implementation
 *
 * Evaluation results table for LLM evaluation runs with summary bar,
 * pass/fail filter, sortable columns, detail panel with diff view
 * and per-metric breakdowns.
 * ------------------------------------------------------------------------- */

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
  [key: string]: unknown; className?: string;
  testCases?: EvalTestCase[];
  overallScore?: number;
  passCount?: number;
  failCount?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filterStatus?: string;
  showExpected?: boolean;
  onSelect?: (testCase: EvalTestCase) => void;
}
export interface EvalResultsTableOptions { target: HTMLElement; props: EvalResultsTableProps; }

let _evalResultsTableUid = 0;

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

export class EvalResultsTable {
  private el: HTMLElement;
  private props: EvalResultsTableProps;
  private state: EvalResultsTableState = 'idle';
  private disposers: Array<() => void> = [];
  private selectedId: string | null = null;
  private sortByCol: string;
  private sortOrd: 'asc' | 'desc';
  private activeFilter: string | undefined;
  private focusIndex = 0;

  constructor(options: EvalResultsTableOptions) {
    this.props = { ...options.props };
    this.sortByCol = (this.props.sortBy as string) ?? 'score';
    this.sortOrd = (this.props.sortOrder as 'asc' | 'desc') ?? 'desc';
    this.activeFilter = this.props.filterStatus as string | undefined;
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'eval-results-table');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'region');
    this.el.setAttribute('aria-label', 'Evaluation results');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'eval-results-table-' + (++_evalResultsTableUid);
    const onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKeyDown));
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  send(type: string): void { this.state = evalResultsTableReducer(this.state, { type } as any); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<EvalResultsTableProps>): void { Object.assign(this.props, props); this.cleanupRender(); this.el.innerHTML = ''; this.render(); }
  destroy(): void { this.cleanup(); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private cleanupRender(): void { const kept = this.disposers.slice(0, 1); for (let i = 1; i < this.disposers.length; i++) this.disposers[i](); this.disposers = kept; }
  private rerender(): void { this.cleanupRender(); this.el.innerHTML = ''; this.render(); }

  private get testCases(): EvalTestCase[] { return (this.props.testCases ?? []) as EvalTestCase[]; }
  private get overallScore(): number { return (this.props.overallScore as number) ?? 0; }
  private get passCount(): number { return (this.props.passCount as number) ?? 0; }
  private get failCount(): number { return (this.props.failCount as number) ?? 0; }
  private get showExpected(): boolean { return this.props.showExpected !== false; }

  private get filteredCases(): EvalTestCase[] {
    if (!this.activeFilter) return this.testCases;
    if (this.activeFilter === 'pass') return this.testCases.filter(tc => tc.pass);
    if (this.activeFilter === 'fail') return this.testCases.filter(tc => !tc.pass);
    return this.testCases;
  }

  private get sortedCases(): EvalTestCase[] {
    return [...this.filteredCases].sort((a, b) => compareCases(a, b, this.sortByCol, this.sortOrd));
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') { e.preventDefault(); this.focusIndex = Math.min(this.focusIndex + 1, this.sortedCases.length - 1); this.rerender(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); this.focusIndex = Math.max(this.focusIndex - 1, 0); this.rerender(); }
    if (e.key === 'Enter') { e.preventDefault(); const tc = this.sortedCases[this.focusIndex]; if (tc) this.handleSelectRow(tc); }
    if (e.key === 'Escape') { e.preventDefault(); this.handleDeselect(); }
  }

  private handleSelectRow(tc: EvalTestCase): void {
    if (this.selectedId === tc.id) { this.selectedId = null; this.send('DESELECT'); }
    else { this.selectedId = tc.id; this.send('SELECT_ROW'); this.props.onSelect?.(tc); }
    this.rerender();
  }

  private handleDeselect(): void { this.selectedId = null; this.send('DESELECT'); this.rerender(); }

  private sortIndicator(col: string): string {
    if (this.sortByCol !== col) return '';
    return this.sortOrd === 'asc' ? ' \u25B2' : ' \u25BC';
  }

  private render(): void {
    const totalCount = this.passCount + this.failCount;
    const passPercent = totalCount > 0 ? Math.round((this.passCount / totalCount) * 100) : 0;
    const failPercent = totalCount > 0 ? 100 - passPercent : 0;
    const sorted = this.sortedCases;
    const selectedCase = this.selectedId ? sorted.find(tc => tc.id === this.selectedId) : null;

    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className as string;

    // Summary bar
    const summary = document.createElement('div');
    summary.setAttribute('data-part', 'summary');

    const scoreSpan = document.createElement('span');
    scoreSpan.setAttribute('data-part', 'score');
    scoreSpan.setAttribute('role', 'status');
    scoreSpan.setAttribute('aria-label', `Overall score: ${this.overallScore}%`);
    scoreSpan.textContent = `${this.overallScore}%`;
    summary.appendChild(scoreSpan);

    const passSpan = document.createElement('span');
    passSpan.setAttribute('data-part', 'pass-count');
    passSpan.setAttribute('aria-label', `${this.passCount} passed`);
    passSpan.textContent = `${this.passCount} passed`;
    summary.appendChild(passSpan);

    const failSpan = document.createElement('span');
    failSpan.setAttribute('data-part', 'fail-count');
    failSpan.setAttribute('aria-label', `${this.failCount} failed`);
    failSpan.textContent = `${this.failCount} failed`;
    summary.appendChild(failSpan);

    const pfBar = document.createElement('div');
    pfBar.setAttribute('data-part', 'pass-fail-bar');
    pfBar.setAttribute('role', 'img');
    pfBar.setAttribute('aria-label', `${this.passCount} passed, ${this.failCount} failed`);
    const passSeg = document.createElement('div');
    passSeg.setAttribute('data-part', 'pass-segment');
    passSeg.setAttribute('data-status', 'pass');
    passSeg.style.width = `${passPercent}%`;
    passSeg.setAttribute('aria-hidden', 'true');
    pfBar.appendChild(passSeg);
    const failSeg = document.createElement('div');
    failSeg.setAttribute('data-part', 'fail-segment');
    failSeg.setAttribute('data-status', 'fail');
    failSeg.style.width = `${failPercent}%`;
    failSeg.setAttribute('aria-hidden', 'true');
    pfBar.appendChild(failSeg);
    summary.appendChild(pfBar);
    this.el.appendChild(summary);

    // Filter bar
    const filterBar = document.createElement('div');
    filterBar.setAttribute('data-part', 'filter-bar');
    filterBar.setAttribute('role', 'toolbar');
    filterBar.setAttribute('aria-label', 'Filter results');

    const allBtn = document.createElement('button');
    allBtn.setAttribute('type', 'button');
    allBtn.setAttribute('data-part', 'filter-all');
    allBtn.setAttribute('data-active', !this.activeFilter ? 'true' : 'false');
    allBtn.setAttribute('aria-pressed', String(!this.activeFilter));
    allBtn.textContent = `All (${this.testCases.length})`;
    const onAll = () => { this.activeFilter = undefined; this.send('FILTER'); this.rerender(); };
    allBtn.addEventListener('click', onAll);
    this.disposers.push(() => allBtn.removeEventListener('click', onAll));
    filterBar.appendChild(allBtn);

    const passBtn = document.createElement('button');
    passBtn.setAttribute('type', 'button');
    passBtn.setAttribute('data-part', 'filter-pass');
    passBtn.setAttribute('data-active', this.activeFilter === 'pass' ? 'true' : 'false');
    passBtn.setAttribute('aria-pressed', String(this.activeFilter === 'pass'));
    passBtn.textContent = `Pass (${this.passCount})`;
    const onPass = () => { this.activeFilter = this.activeFilter === 'pass' ? undefined : 'pass'; this.send('FILTER'); this.rerender(); };
    passBtn.addEventListener('click', onPass);
    this.disposers.push(() => passBtn.removeEventListener('click', onPass));
    filterBar.appendChild(passBtn);

    const failBtn = document.createElement('button');
    failBtn.setAttribute('type', 'button');
    failBtn.setAttribute('data-part', 'filter-fail');
    failBtn.setAttribute('data-active', this.activeFilter === 'fail' ? 'true' : 'false');
    failBtn.setAttribute('aria-pressed', String(this.activeFilter === 'fail'));
    failBtn.textContent = `Fail (${this.failCount})`;
    const onFail = () => { this.activeFilter = this.activeFilter === 'fail' ? undefined : 'fail'; this.send('FILTER'); this.rerender(); };
    failBtn.addEventListener('click', onFail);
    this.disposers.push(() => failBtn.removeEventListener('click', onFail));
    filterBar.appendChild(failBtn);
    this.el.appendChild(filterBar);

    // Table
    const table = document.createElement('table');
    table.setAttribute('data-part', 'table');
    table.setAttribute('role', 'table');
    table.setAttribute('aria-label', `Results: ${this.passCount} passed, ${this.failCount} failed`);

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.setAttribute('data-part', 'header-row');
    headerRow.setAttribute('role', 'row');
    const headerCols = [
      { key: 'status', label: 'Status' },
      { key: 'input', label: 'Input' },
      { key: 'actual', label: 'Output' },
      ...(this.showExpected ? [{ key: 'expected', label: 'Expected' }] : []),
      { key: 'score', label: 'Score' },
    ];
    for (const col of headerCols) {
      const th = document.createElement('th');
      th.setAttribute('data-part', 'header-cell');
      th.setAttribute('role', 'columnheader');
      th.setAttribute('aria-sort', this.sortByCol === col.key ? (this.sortOrd === 'asc' ? 'ascending' : 'descending') : 'none');
      th.setAttribute('tabindex', '0');
      th.style.cursor = 'pointer';
      th.textContent = col.label + this.sortIndicator(col.key);
      const onSort = () => {
        if (this.sortByCol === col.key) this.sortOrd = this.sortOrd === 'asc' ? 'desc' : 'asc';
        else { this.sortByCol = col.key; this.sortOrd = 'desc'; }
        this.send('SORT');
        this.rerender();
      };
      th.addEventListener('click', onSort);
      th.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); onSort(); } });
      this.disposers.push(() => th.removeEventListener('click', onSort));
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    if (sorted.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.setAttribute('data-part', 'empty-row');
      const emptyCell = document.createElement('td');
      emptyCell.setAttribute('colspan', String(this.showExpected ? 5 : 4));
      emptyCell.setAttribute('data-part', 'empty-cell');
      emptyCell.setAttribute('role', 'cell');
      emptyCell.textContent = 'No test cases match the current filter';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    } else {
      sorted.forEach((tc, index) => {
        const isSelected = this.selectedId === tc.id;
        const isFocused = this.focusIndex === index;
        const tr = document.createElement('tr');
        tr.setAttribute('data-part', 'row');
        tr.setAttribute('role', 'row');
        tr.setAttribute('data-status', tc.pass ? 'pass' : 'fail');
        tr.setAttribute('aria-selected', String(isSelected));
        tr.setAttribute('tabindex', isFocused ? '0' : '-1');
        const onClick = () => this.handleSelectRow(tc);
        tr.addEventListener('click', onClick);
        this.disposers.push(() => tr.removeEventListener('click', onClick));

        // Status
        const statusTd = document.createElement('td');
        statusTd.setAttribute('data-part', 'status');
        statusTd.setAttribute('role', 'cell');
        statusTd.setAttribute('data-pass', tc.pass ? 'true' : 'false');
        const badge = document.createElement('span');
        badge.setAttribute('data-part', 'pass-fail-badge');
        badge.setAttribute('aria-label', tc.pass ? 'Passed' : 'Failed');
        badge.textContent = tc.pass ? '\u2713 Pass' : '\u2717 Fail';
        statusTd.appendChild(badge);
        tr.appendChild(statusTd);

        // Input
        const inputTd = document.createElement('td');
        inputTd.setAttribute('data-part', 'input');
        inputTd.setAttribute('role', 'cell');
        inputTd.setAttribute('title', tc.input);
        inputTd.textContent = truncate(tc.input, 80);
        tr.appendChild(inputTd);

        // Output
        const outputTd = document.createElement('td');
        outputTd.setAttribute('data-part', 'output');
        outputTd.setAttribute('role', 'cell');
        outputTd.setAttribute('title', tc.actual);
        outputTd.textContent = truncate(tc.actual, 80);
        tr.appendChild(outputTd);

        // Expected
        if (this.showExpected) {
          const expectedTd = document.createElement('td');
          expectedTd.setAttribute('data-part', 'expected');
          expectedTd.setAttribute('role', 'cell');
          expectedTd.setAttribute('title', tc.expected);
          expectedTd.textContent = truncate(tc.expected, 80);
          tr.appendChild(expectedTd);
        }

        // Score
        const scoreTd = document.createElement('td');
        scoreTd.setAttribute('data-part', 'score-cell');
        scoreTd.setAttribute('role', 'cell');
        const scoreVal = document.createElement('span');
        scoreVal.setAttribute('data-part', 'score-value');
        scoreVal.textContent = String(tc.score);
        scoreTd.appendChild(scoreVal);
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
        scoreTd.appendChild(scoreBar);
        tr.appendChild(scoreTd);

        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);
    this.el.appendChild(table);

    // Detail panel
    const detail = document.createElement('div');
    detail.setAttribute('data-part', 'detail');
    detail.setAttribute('data-visible', this.state === 'rowSelected' && selectedCase ? 'true' : 'false');
    detail.setAttribute('aria-hidden', String(!(this.state === 'rowSelected' && selectedCase)));

    if (selectedCase) {
      const content = document.createElement('div');
      content.setAttribute('data-part', 'detail-content');

      // Header
      const detailHeader = document.createElement('div');
      detailHeader.setAttribute('data-part', 'detail-header');
      const detailStatus = document.createElement('span');
      detailStatus.setAttribute('data-part', 'detail-status');
      detailStatus.setAttribute('data-pass', selectedCase.pass ? 'true' : 'false');
      detailStatus.textContent = selectedCase.pass ? '\u2713 Passed' : '\u2717 Failed';
      detailHeader.appendChild(detailStatus);
      const detailScore = document.createElement('span');
      detailScore.setAttribute('data-part', 'detail-score');
      detailScore.textContent = `Score: ${selectedCase.score}`;
      detailHeader.appendChild(detailScore);
      const closeBtn = document.createElement('button');
      closeBtn.setAttribute('type', 'button');
      closeBtn.setAttribute('data-part', 'close-detail');
      closeBtn.setAttribute('aria-label', 'Close detail panel');
      closeBtn.textContent = '\u2715';
      const onClose = () => this.handleDeselect();
      closeBtn.addEventListener('click', onClose);
      this.disposers.push(() => closeBtn.removeEventListener('click', onClose));
      detailHeader.appendChild(closeBtn);
      content.appendChild(detailHeader);

      // Sections
      const sections = [
        { label: 'Input', part: 'detail-input', text: selectedCase.input },
        { label: 'Model Output', part: 'detail-output', text: selectedCase.actual },
        { label: 'Expected Output', part: 'detail-expected', text: selectedCase.expected },
      ];
      for (const sec of sections) {
        const section = document.createElement('div');
        section.setAttribute('data-part', 'detail-section');
        const h4 = document.createElement('h4');
        h4.setAttribute('data-part', 'detail-label');
        h4.textContent = sec.label;
        section.appendChild(h4);
        const pre = document.createElement('pre');
        pre.setAttribute('data-part', sec.part);
        pre.textContent = sec.text;
        section.appendChild(pre);
        content.appendChild(section);
      }

      // Diff
      if (selectedCase.actual !== selectedCase.expected) {
        const diffSection = document.createElement('div');
        diffSection.setAttribute('data-part', 'detail-section');
        const diffLabel = document.createElement('h4');
        diffLabel.setAttribute('data-part', 'detail-label');
        diffLabel.textContent = 'Diff';
        diffSection.appendChild(diffLabel);
        const diffDiv = document.createElement('div');
        diffDiv.setAttribute('data-part', 'detail-diff');
        const diffExpected = document.createElement('div');
        diffExpected.setAttribute('data-part', 'diff-expected');
        diffExpected.setAttribute('aria-label', 'Expected');
        const prefixMinus = document.createElement('span');
        prefixMinus.setAttribute('data-part', 'diff-prefix');
        prefixMinus.textContent = '-';
        diffExpected.appendChild(prefixMinus);
        diffExpected.appendChild(document.createTextNode(` ${selectedCase.expected}`));
        diffDiv.appendChild(diffExpected);
        const diffActual = document.createElement('div');
        diffActual.setAttribute('data-part', 'diff-actual');
        diffActual.setAttribute('aria-label', 'Actual');
        const prefixPlus = document.createElement('span');
        prefixPlus.setAttribute('data-part', 'diff-prefix');
        prefixPlus.textContent = '+';
        diffActual.appendChild(prefixPlus);
        diffActual.appendChild(document.createTextNode(` ${selectedCase.actual}`));
        diffDiv.appendChild(diffActual);
        diffSection.appendChild(diffDiv);
        content.appendChild(diffSection);
      }

      // Metrics
      if (selectedCase.metrics && Object.keys(selectedCase.metrics).length > 0) {
        const metricsSection = document.createElement('div');
        metricsSection.setAttribute('data-part', 'detail-section');
        const metricsLabel = document.createElement('h4');
        metricsLabel.setAttribute('data-part', 'detail-label');
        metricsLabel.textContent = 'Metrics';
        metricsSection.appendChild(metricsLabel);
        const metricsList = document.createElement('div');
        metricsList.setAttribute('data-part', 'metrics-list');
        for (const [metric, value] of Object.entries(selectedCase.metrics)) {
          const item = document.createElement('div');
          item.setAttribute('data-part', 'metric-item');
          const mName = document.createElement('span');
          mName.setAttribute('data-part', 'metric-name');
          mName.textContent = metric;
          item.appendChild(mName);
          const mVal = document.createElement('span');
          mVal.setAttribute('data-part', 'metric-value');
          mVal.textContent = String(value);
          item.appendChild(mVal);
          const mBar = document.createElement('div');
          mBar.setAttribute('data-part', 'metric-bar');
          mBar.setAttribute('role', 'progressbar');
          mBar.setAttribute('aria-valuenow', String(value));
          mBar.setAttribute('aria-valuemin', '0');
          mBar.setAttribute('aria-valuemax', '100');
          const mFill = document.createElement('div');
          mFill.setAttribute('data-part', 'metric-bar-fill');
          mFill.style.width = `${Math.min(100, value)}%`;
          mFill.setAttribute('aria-hidden', 'true');
          mBar.appendChild(mFill);
          item.appendChild(mBar);
          metricsList.appendChild(item);
        }
        metricsSection.appendChild(metricsList);
        content.appendChild(metricsSection);
      }

      detail.appendChild(content);
    }
    this.el.appendChild(detail);
  }
}

export default EvalResultsTable;
