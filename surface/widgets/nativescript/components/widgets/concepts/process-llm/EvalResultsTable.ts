import {
  StackLayout,
  Label,
  Button,
  ScrollView,
  Progress,
} from '@nativescript/core';

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

export function createEvalResultsTable(props: EvalResultsTableProps): {
  view: StackLayout;
  dispose: () => void;
} {
  let state: EvalResultsTableState = 'idle';
  let selectedId: string | null = null;
  let sortByCol = props.sortBy ?? 'score';
  let sortOrd: 'asc' | 'desc' = props.sortOrder ?? 'desc';
  let activeFilter: string | undefined = props.filterStatus;
  const disposers: (() => void)[] = [];

  function send(event: EvalResultsTableEvent) {
    state = evalResultsTableReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'eval-results-table';
  root.automationText = 'Evaluation results';

  // Summary
  const summaryRow = new StackLayout();
  summaryRow.orientation = 'horizontal';
  summaryRow.marginBottom = 8;

  const scoreLbl = new Label();
  scoreLbl.fontWeight = 'bold';
  scoreLbl.fontSize = 18;
  summaryRow.addChild(scoreLbl);

  const passLbl = new Label();
  passLbl.marginLeft = 12;
  passLbl.fontSize = 13;
  summaryRow.addChild(passLbl);

  const failLbl = new Label();
  failLbl.marginLeft = 8;
  failLbl.fontSize = 13;
  summaryRow.addChild(failLbl);
  root.addChild(summaryRow);

  // Pass/fail bar
  const barRow = new StackLayout();
  barRow.orientation = 'horizontal';
  barRow.height = 6;
  barRow.borderRadius = 3;
  barRow.marginBottom = 8;
  root.addChild(barRow);

  // Filter buttons
  const filterRow = new StackLayout();
  filterRow.orientation = 'horizontal';
  filterRow.marginBottom = 8;
  root.addChild(filterRow);

  // Header row
  const headerRow = new StackLayout();
  headerRow.orientation = 'horizontal';
  headerRow.className = 'header-row';
  root.addChild(headerRow);

  // Data rows
  const rowScroll = new ScrollView();
  const rowContainer = new StackLayout();
  rowScroll.content = rowContainer;
  root.addChild(rowScroll);

  // Detail panel
  const detailPanel = new StackLayout();
  detailPanel.marginTop = 12;
  detailPanel.padding = 12;
  detailPanel.borderWidth = 1;
  detailPanel.borderColor = '#e5e7eb';
  detailPanel.borderRadius = 6;
  root.addChild(detailPanel);

  function sortIndicator(col: string): string {
    if (sortByCol !== col) return '';
    return sortOrd === 'asc' ? ' \u25B2' : ' \u25BC';
  }

  function update() {
    const { testCases, overallScore, passCount, failCount, showExpected } = props;
    const totalCount = passCount + failCount;
    const passPct = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

    scoreLbl.text = `${overallScore}%`;
    passLbl.text = `${passCount} passed`;
    failLbl.text = `${failCount} failed`;

    // Pass/fail bar
    barRow.removeChildren();
    if (totalCount > 0) {
      const passBar = new StackLayout();
      passBar.backgroundColor = '#22c55e';
      passBar.height = 6;
      barRow.addChild(passBar);

      const failBar = new StackLayout();
      failBar.backgroundColor = '#ef4444';
      failBar.height = 6;
      barRow.addChild(failBar);
    }

    // Filter buttons
    filterRow.removeChildren();
    const allBtn = new Button();
    allBtn.text = `All (${testCases.length})`;
    allBtn.className = !activeFilter ? 'filter-active' : 'filter-chip';
    allBtn.on('tap', () => {
      activeFilter = undefined;
      send({ type: 'FILTER', status: undefined });
    });
    filterRow.addChild(allBtn);

    const passBtn = new Button();
    passBtn.text = `Pass (${passCount})`;
    passBtn.className = activeFilter === 'pass' ? 'filter-active' : 'filter-chip';
    passBtn.on('tap', () => {
      activeFilter = activeFilter === 'pass' ? undefined : 'pass';
      send({ type: 'FILTER', status: activeFilter });
    });
    filterRow.addChild(passBtn);

    const failBtn = new Button();
    failBtn.text = `Fail (${failCount})`;
    failBtn.className = activeFilter === 'fail' ? 'filter-active' : 'filter-chip';
    failBtn.on('tap', () => {
      activeFilter = activeFilter === 'fail' ? undefined : 'fail';
      send({ type: 'FILTER', status: activeFilter });
    });
    filterRow.addChild(failBtn);

    // Filter and sort
    let filtered = testCases;
    if (activeFilter === 'pass') filtered = testCases.filter((tc) => tc.pass);
    else if (activeFilter === 'fail') filtered = testCases.filter((tc) => !tc.pass);

    const sorted = [...filtered].sort((a, b) => compareCases(a, b, sortByCol, sortOrd));

    // Header
    headerRow.removeChildren();
    const cols = showExpected !== false
      ? ['status', 'input', 'actual', 'expected', 'score']
      : ['status', 'input', 'actual', 'score'];
    const colLabels: Record<string, string> = {
      status: 'Status',
      input: 'Input',
      actual: 'Output',
      expected: 'Expected',
      score: 'Score',
    };
    for (const col of cols) {
      const hdrBtn = new Button();
      hdrBtn.text = `${colLabels[col]}${sortIndicator(col)}`;
      hdrBtn.className = 'header-cell';
      hdrBtn.on('tap', () => {
        if (sortByCol === col) {
          sortOrd = sortOrd === 'asc' ? 'desc' : 'asc';
        } else {
          sortByCol = col;
          sortOrd = 'desc';
        }
        send({ type: 'SORT', column: col });
      });
      headerRow.addChild(hdrBtn);
    }

    // Data rows
    rowContainer.removeChildren();
    if (sorted.length === 0) {
      const emptyLbl = new Label();
      emptyLbl.text = 'No test cases match the current filter';
      emptyLbl.textAlignment = 'center';
      emptyLbl.padding = 16;
      rowContainer.addChild(emptyLbl);
    } else {
      for (const tc of sorted) {
        const row = new StackLayout();
        row.orientation = 'horizontal';
        row.padding = '6 4';
        row.marginBottom = 2;
        row.borderWidth = selectedId === tc.id ? 2 : 0;
        row.borderColor = '#3b82f6';

        const statusCell = new Label();
        statusCell.text = tc.pass ? '\u2713 Pass' : '\u2717 Fail';
        statusCell.width = 60;
        statusCell.color = (tc.pass ? '#16a34a' : '#dc2626') as any;
        row.addChild(statusCell);

        const inputCell = new Label();
        inputCell.text = truncate(tc.input, 40);
        inputCell.width = 100;
        inputCell.fontSize = 12;
        row.addChild(inputCell);

        const actualCell = new Label();
        actualCell.text = truncate(tc.actual, 40);
        actualCell.width = 100;
        actualCell.fontSize = 12;
        row.addChild(actualCell);

        if (showExpected !== false) {
          const expCell = new Label();
          expCell.text = truncate(tc.expected, 40);
          expCell.width = 100;
          expCell.fontSize = 12;
          row.addChild(expCell);
        }

        const scoreCell = new Label();
        scoreCell.text = String(tc.score);
        scoreCell.width = 40;
        row.addChild(scoreCell);

        row.on('tap', () => {
          if (selectedId === tc.id) {
            selectedId = null;
            send({ type: 'DESELECT' });
          } else {
            selectedId = tc.id;
            send({ type: 'SELECT_ROW', id: tc.id });
            props.onSelect?.(tc);
          }
        });

        rowContainer.addChild(row);
      }
    }

    // Detail panel
    detailPanel.removeChildren();
    const selectedCase = selectedId ? sorted.find((tc) => tc.id === selectedId) : null;
    if (state === 'rowSelected' && selectedCase) {
      detailPanel.visibility = 'visible';

      const detailHeader = new StackLayout();
      detailHeader.orientation = 'horizontal';

      const detailStatus = new Label();
      detailStatus.text = selectedCase.pass ? '\u2713 Passed' : '\u2717 Failed';
      detailStatus.fontWeight = 'bold';
      detailStatus.color = (selectedCase.pass ? '#16a34a' : '#dc2626') as any;
      detailHeader.addChild(detailStatus);

      const detailScore = new Label();
      detailScore.text = `Score: ${selectedCase.score}`;
      detailScore.marginLeft = 12;
      detailHeader.addChild(detailScore);

      const closeBtn = new Button();
      closeBtn.text = '\u2715';
      closeBtn.marginLeft = 12;
      closeBtn.on('tap', () => {
        selectedId = null;
        send({ type: 'DESELECT' });
      });
      detailHeader.addChild(closeBtn);
      detailPanel.addChild(detailHeader);

      const inputSection = new StackLayout();
      inputSection.marginTop = 8;
      const inputHdr = new Label();
      inputHdr.text = 'Input';
      inputHdr.fontWeight = 'bold';
      inputSection.addChild(inputHdr);
      const inputVal = new Label();
      inputVal.text = selectedCase.input;
      inputVal.textWrap = true;
      inputVal.fontFamily = 'monospace';
      inputVal.fontSize = 12;
      inputSection.addChild(inputVal);
      detailPanel.addChild(inputSection);

      const outputSection = new StackLayout();
      outputSection.marginTop = 8;
      const outputHdr = new Label();
      outputHdr.text = 'Model Output';
      outputHdr.fontWeight = 'bold';
      outputSection.addChild(outputHdr);
      const outputVal = new Label();
      outputVal.text = selectedCase.actual;
      outputVal.textWrap = true;
      outputVal.fontFamily = 'monospace';
      outputVal.fontSize = 12;
      outputSection.addChild(outputVal);
      detailPanel.addChild(outputSection);

      const expectedSection = new StackLayout();
      expectedSection.marginTop = 8;
      const expectedHdr = new Label();
      expectedHdr.text = 'Expected Output';
      expectedHdr.fontWeight = 'bold';
      expectedSection.addChild(expectedHdr);
      const expectedVal = new Label();
      expectedVal.text = selectedCase.expected;
      expectedVal.textWrap = true;
      expectedVal.fontFamily = 'monospace';
      expectedVal.fontSize = 12;
      expectedSection.addChild(expectedVal);
      detailPanel.addChild(expectedSection);

      if (selectedCase.actual !== selectedCase.expected) {
        const diffSection = new StackLayout();
        diffSection.marginTop = 8;
        const diffHdr = new Label();
        diffHdr.text = 'Diff';
        diffHdr.fontWeight = 'bold';
        diffSection.addChild(diffHdr);

        const diffExp = new Label();
        diffExp.text = `- ${selectedCase.expected}`;
        diffExp.color = '#dc2626' as any;
        diffExp.fontFamily = 'monospace';
        diffExp.fontSize = 12;
        diffSection.addChild(diffExp);

        const diffAct = new Label();
        diffAct.text = `+ ${selectedCase.actual}`;
        diffAct.color = '#16a34a' as any;
        diffAct.fontFamily = 'monospace';
        diffAct.fontSize = 12;
        diffSection.addChild(diffAct);

        detailPanel.addChild(diffSection);
      }

      if (selectedCase.metrics && Object.keys(selectedCase.metrics).length > 0) {
        const metricsSection = new StackLayout();
        metricsSection.marginTop = 8;
        const metricsHdr = new Label();
        metricsHdr.text = 'Metrics';
        metricsHdr.fontWeight = 'bold';
        metricsSection.addChild(metricsHdr);

        for (const [metric, value] of Object.entries(selectedCase.metrics)) {
          const mRow = new StackLayout();
          mRow.orientation = 'horizontal';
          mRow.marginTop = 2;

          const mName = new Label();
          mName.text = metric;
          mName.width = 100;
          mRow.addChild(mName);

          const mVal = new Label();
          mVal.text = String(value);
          mVal.width = 40;
          mRow.addChild(mVal);

          const mBar = new Progress();
          mBar.value = Math.min(100, value);
          mBar.maxValue = 100;
          mRow.addChild(mBar);

          metricsSection.addChild(mRow);
        }

        detailPanel.addChild(metricsSection);
      }
    } else {
      detailPanel.visibility = 'collapsed';
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

export default createEvalResultsTable;
