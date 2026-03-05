import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  ScrollView,
  Color,
  View,
} from '@nativescript/core';

export type CoverageSourceViewState = 'idle' | 'lineHovered';
export type CoverageSourceViewEvent =
  | { type: 'HOVER_LINE'; lineIndex: number }
  | { type: 'FILTER'; status: CoverageFilter }
  | { type: 'JUMP_UNCOVERED' }
  | { type: 'LEAVE' }
  | { type: 'SELECT_LINE'; lineIndex: number };

export function coverageSourceViewReducer(
  state: CoverageSourceViewState,
  event: CoverageSourceViewEvent,
): CoverageSourceViewState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_LINE') return 'lineHovered';
      if (event.type === 'FILTER') return 'idle';
      if (event.type === 'JUMP_UNCOVERED') return 'idle';
      return state;
    case 'lineHovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    default:
      return state;
  }
}

export type CoverageStatus = 'covered' | 'uncovered' | 'partial' | null;
export type CoverageFilter = 'all' | 'covered' | 'uncovered' | 'partial';

export interface CoverageLine {
  number: number;
  text: string;
  coverage: CoverageStatus;
  coveredBy?: string;
}

export interface CoverageSummary {
  totalLines: number;
  coveredLines: number;
  percentage: number;
}

export interface CoverageSourceViewProps {
  lines: CoverageLine[];
  summary: CoverageSummary;
  language?: string;
  showLineNumbers?: boolean;
  filterStatus?: CoverageFilter;
  onLineSelect?: (line: CoverageLine) => void;
  onFilterChange?: (filter: CoverageFilter) => void;
}

const GUTTER_COLORS: Record<string, string> = {
  covered: '#22c55e',
  uncovered: '#ef4444',
  partial: '#eab308',
};

const FILTER_OPTIONS: CoverageFilter[] = ['all', 'covered', 'uncovered', 'partial'];

export function createCoverageSourceView(props: CoverageSourceViewProps): {
  view: View;
  dispose: () => void;
} {
  let state: CoverageSourceViewState = 'idle';
  let selectedLineIdx: number | null = null;
  let activeFilter: CoverageFilter = props.filterStatus ?? 'all';
  const disposers: (() => void)[] = [];

  const container = new StackLayout();
  container.className = 'clef-coverage-source-view';

  function sm(ev: CoverageSourceViewEvent): void {
    state = coverageSourceViewReducer(state, ev);
  }

  function getFiltered(): CoverageLine[] {
    if (activeFilter === 'all') return props.lines;
    return props.lines.filter((l) => l.coverage === activeFilter);
  }

  function render(): void {
    container.removeChildren();
    const filtered = getFiltered();

    // Summary header
    const summaryLabel = new Label();
    summaryLabel.text = `Coverage: ${props.summary.percentage}% (${props.summary.coveredLines}/${props.summary.totalLines} lines)`;
    summaryLabel.fontWeight = 'bold';
    summaryLabel.fontSize = 14;
    summaryLabel.padding = '8 12';
    summaryLabel.automationText = `Coverage: ${props.summary.percentage}%`;
    container.addChild(summaryLabel);

    // Filter bar
    const filterBar = new StackLayout();
    filterBar.orientation = 'horizontal';
    filterBar.padding = '6 12';

    FILTER_OPTIONS.forEach((filter) => {
      const btn = new Button();
      btn.text = filter.charAt(0).toUpperCase() + filter.slice(1);
      btn.fontSize = 12;
      btn.padding = '2 10';
      btn.borderWidth = 1;
      btn.borderColor = new Color('#d1d5db');
      btn.borderRadius = 4;
      btn.backgroundColor = activeFilter === filter ? new Color('#e0e7ff') : new Color('transparent');
      btn.fontWeight = activeFilter === filter ? 'bold' : 'normal';
      btn.marginRight = 4;

      const tapHandler = () => {
        activeFilter = filter;
        selectedLineIdx = null;
        sm({ type: 'FILTER', status: filter });
        props.onFilterChange?.(filter);
        render();
      };
      btn.on('tap', tapHandler);
      disposers.push(() => btn.off('tap', tapHandler));

      filterBar.addChild(btn);
    });
    container.addChild(filterBar);

    // Code area
    const scrollView = new ScrollView();
    const codeArea = new StackLayout();

    filtered.forEach((line, idx) => {
      const isSelected = selectedLineIdx === idx;

      const row = new GridLayout();
      row.columns = 'auto, auto, *';
      row.padding = '0 0';
      if (isSelected) {
        row.backgroundColor = new Color('#dbeafe');
      }

      // Coverage gutter
      const gutter = new Label();
      gutter.text = '';
      gutter.width = 4;
      gutter.backgroundColor = line.coverage
        ? new Color(GUTTER_COLORS[line.coverage] ?? 'transparent')
        : new Color('transparent');
      GridLayout.setColumn(gutter, 0);
      row.addChild(gutter);

      // Line number
      if (props.showLineNumbers !== false) {
        const lineNum = new Label();
        lineNum.text = String(line.number);
        lineNum.width = 48;
        lineNum.textAlignment = 'right';
        lineNum.color = new Color('#9ca3af');
        lineNum.fontSize = 13;
        lineNum.paddingRight = 12;
        GridLayout.setColumn(lineNum, 1);
        row.addChild(lineNum);
      }

      // Source text
      const sourceText = new Label();
      sourceText.text = line.text;
      sourceText.fontSize = 13;
      sourceText.fontFamily = 'monospace';
      GridLayout.setColumn(sourceText, 2);
      row.addChild(sourceText);

      // Tap to select
      const rowTapHandler = () => {
        selectedLineIdx = idx;
        sm({ type: 'SELECT_LINE', lineIndex: idx });
        if (line) props.onLineSelect?.(line);
        render();
      };
      row.on('tap', rowTapHandler);
      disposers.push(() => row.off('tap', rowTapHandler));

      row.automationText = `Line ${line.number}: ${line.text} - ${line.coverage ?? 'not executable'}`;
      codeArea.addChild(row);
    });

    scrollView.content = codeArea;
    container.addChild(scrollView);

    // Selected line detail
    if (selectedLineIdx !== null && filtered[selectedLineIdx]) {
      const sl = filtered[selectedLineIdx];
      const detail = new StackLayout();
      detail.padding = '8 12';
      detail.borderTopWidth = 1;
      detail.borderTopColor = new Color('#e5e7eb');

      const detailLabel = new Label();
      const covText = sl.coverage
        ? sl.coverage.charAt(0).toUpperCase() + sl.coverage.slice(1)
        : 'Not executable';
      let detailText = `Line ${sl.number} \u2014 ${covText}`;
      if (sl.coveredBy) detailText += ` (covered by: ${sl.coveredBy})`;
      detailLabel.text = detailText;
      detailLabel.fontSize = 13;
      detailLabel.textWrap = true;
      detail.addChild(detailLabel);

      container.addChild(detail);
    }
  }

  render();

  return {
    view: container,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createCoverageSourceView;
