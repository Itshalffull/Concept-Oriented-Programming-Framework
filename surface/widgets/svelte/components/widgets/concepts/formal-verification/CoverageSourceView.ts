import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type CoverageSourceViewState = 'idle' | 'lineHovered';
export type CoverageSourceViewEvent =
  | { type: 'HOVER_LINE'; lineIndex: number }
  | { type: 'FILTER'; status: CoverageFilter }
  | { type: 'JUMP_UNCOVERED' }
  | { type: 'LEAVE' }
  | { type: 'SELECT_LINE'; lineIndex: number }
  | { type: 'NAVIGATE'; direction: 'up' | 'down' };

export function coverageSourceViewReducer(state: CoverageSourceViewState, event: CoverageSourceViewEvent): CoverageSourceViewState {
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

const GUTTER_COLORS: Record<string, string> = {
  covered: '#22c55e',
  uncovered: '#ef4444',
  partial: '#eab308',
};

const FILTER_OPTIONS: CoverageFilter[] = ['all', 'covered', 'uncovered', 'partial'];

export interface CoverageSourceViewProps { [key: string]: unknown; class?: string; }
export interface CoverageSourceViewResult { element: HTMLElement; dispose: () => void; }

export function CoverageSourceView(props: CoverageSourceViewProps): CoverageSourceViewResult {
  const sig = surfaceCreateSignal<CoverageSourceViewState>('idle');
  const send = (evt: CoverageSourceViewEvent) => sig.set(coverageSourceViewReducer(sig.get(), evt));

  const lines = (props.lines ?? []) as CoverageLine[];
  const summary = (props.summary ?? { totalLines: 0, coveredLines: 0, percentage: 0 }) as CoverageSummary;
  const language = String(props.language ?? 'typescript');
  const showLineNumbers = props.showLineNumbers !== false;
  const onLineSelect = props.onLineSelect as ((line: CoverageLine) => void) | undefined;
  const onFilterChange = props.onFilterChange as ((filter: CoverageFilter) => void) | undefined;

  let activeFilter: CoverageFilter = (props.filterStatus as CoverageFilter) ?? 'all';
  let selectedLineIndex: number | null = null;
  let focusedLineIndex = 0;
  let hoveredLineIndex: number | null = null;
  const lineEls: HTMLDivElement[] = [];

  function getFilteredLines(): CoverageLine[] {
    if (activeFilter === 'all') return lines;
    return lines.filter((l) => l.coverage === activeFilter);
  }

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'coverage-source-view');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'document');
  root.setAttribute('aria-label', 'Coverage source view');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Summary header */
  const summaryEl = document.createElement('div');
  summaryEl.setAttribute('data-part', 'summary');
  summaryEl.setAttribute('data-state', sig.get());
  summaryEl.setAttribute('role', 'status');
  summaryEl.setAttribute('aria-live', 'polite');
  summaryEl.textContent = `Coverage: ${summary.percentage}% (${summary.coveredLines}/${summary.totalLines} lines)`;
  root.appendChild(summaryEl);

  /* Filter bar */
  const filterBarEl = document.createElement('div');
  filterBarEl.setAttribute('data-part', 'filter-bar');
  filterBarEl.setAttribute('data-state', sig.get());

  for (const filter of FILTER_OPTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-active', activeFilter === filter ? 'true' : 'false');
    btn.setAttribute('aria-pressed', String(activeFilter === filter));
    btn.textContent = filter.charAt(0).toUpperCase() + filter.slice(1);
    btn.addEventListener('click', () => handleFilterChange(filter));
    filterBarEl.appendChild(btn);
  }
  root.appendChild(filterBarEl);

  /* Code area */
  const codeAreaEl = document.createElement('div');
  codeAreaEl.setAttribute('role', 'code');
  codeAreaEl.style.overflow = 'auto';
  codeAreaEl.style.fontFamily = 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace';
  codeAreaEl.style.fontSize = '13px';
  codeAreaEl.style.lineHeight = '20px';
  codeAreaEl.style.position = 'relative';
  root.appendChild(codeAreaEl);

  /* Tooltip */
  const tooltipEl = document.createElement('div');
  tooltipEl.setAttribute('data-part', 'tooltip');
  tooltipEl.setAttribute('data-state', sig.get());
  tooltipEl.setAttribute('data-visible', 'false');
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.style.position = 'absolute';
  tooltipEl.style.visibility = 'hidden';
  tooltipEl.style.pointerEvents = 'none';
  tooltipEl.style.zIndex = '10';
  root.appendChild(tooltipEl);

  /* Line detail */
  const lineDetailEl = document.createElement('div');
  lineDetailEl.setAttribute('data-part', 'line-detail');
  lineDetailEl.setAttribute('data-state', sig.get());
  lineDetailEl.style.display = 'none';
  root.appendChild(lineDetailEl);

  function handleFilterChange(filter: CoverageFilter): void {
    activeFilter = filter;
    focusedLineIndex = 0;
    selectedLineIndex = null;
    send({ type: 'FILTER', status: filter });
    onFilterChange?.(filter);
    updateFilterBar();
    rebuildLines();
  }

  function updateFilterBar(): void {
    const buttons = filterBarEl.querySelectorAll('button');
    buttons.forEach((btn, i) => {
      const f = FILTER_OPTIONS[i];
      btn.setAttribute('data-active', activeFilter === f ? 'true' : 'false');
      btn.setAttribute('aria-pressed', String(activeFilter === f));
    });
  }

  function handleLineSelect(index: number): void {
    selectedLineIndex = index;
    const filtered = getFilteredLines();
    const line = filtered[index];
    if (line) onLineSelect?.(line);
    updateLineDetail();
    rebuildLines();
  }

  function jumpToNextUncovered(): void {
    const filtered = getFilteredLines();
    const startIdx = focusedLineIndex + 1;
    for (let i = 0; i < filtered.length; i++) {
      const idx = (startIdx + i) % filtered.length;
      if (filtered[idx].coverage === 'uncovered') {
        focusedLineIndex = idx;
        send({ type: 'JUMP_UNCOVERED' });
        rebuildLines();
        lineEls[focusedLineIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
    }
  }

  function rebuildLines(): void {
    codeAreaEl.innerHTML = '';
    lineEls.length = 0;
    const filtered = getFilteredLines();

    for (let i = 0; i < filtered.length; i++) {
      const line = filtered[i];
      const isSelected = selectedLineIndex === i;
      const isFocused = focusedLineIndex === i;

      const rowEl = document.createElement('div');
      rowEl.setAttribute('role', 'row');
      rowEl.setAttribute('aria-selected', String(isSelected));
      if (isFocused) rowEl.setAttribute('aria-current', 'true');
      rowEl.setAttribute('data-line-number', String(line.number));
      rowEl.setAttribute('data-coverage', line.coverage ?? 'none');
      rowEl.style.display = 'flex';
      rowEl.style.alignItems = 'stretch';
      rowEl.style.cursor = 'pointer';
      if (isSelected) {
        rowEl.style.background = '#dbeafe';
      } else if (isFocused) {
        rowEl.style.background = '#f1f5f9';
        rowEl.style.outline = '2px solid #6366f1';
        rowEl.style.outlineOffset = '-2px';
      }

      const idx = i;
      rowEl.addEventListener('click', () => handleLineSelect(idx));
      rowEl.addEventListener('mouseenter', () => {
        hoveredLineIndex = idx;
        send({ type: 'HOVER_LINE', lineIndex: idx });
        updateTooltip();
      });
      rowEl.addEventListener('mouseleave', () => {
        hoveredLineIndex = null;
        send({ type: 'LEAVE' });
        updateTooltip();
      });

      /* Coverage gutter */
      const gutterEl = document.createElement('div');
      gutterEl.setAttribute('data-part', 'coverage-gutter');
      gutterEl.setAttribute('data-state', sig.get());
      gutterEl.setAttribute('role', 'presentation');
      gutterEl.setAttribute('aria-hidden', 'true');
      gutterEl.style.width = '4px';
      gutterEl.style.flexShrink = '0';
      gutterEl.style.background = line.coverage ? (GUTTER_COLORS[line.coverage] ?? 'transparent') : 'transparent';
      rowEl.appendChild(gutterEl);

      /* Line number */
      if (showLineNumbers) {
        const numEl = document.createElement('div');
        numEl.setAttribute('data-part', 'line-numbers');
        numEl.setAttribute('data-state', sig.get());
        numEl.setAttribute('data-visible', 'true');
        numEl.setAttribute('role', 'rowheader');
        numEl.setAttribute('aria-label', `Line ${line.number}`);
        numEl.style.width = '48px';
        numEl.style.flexShrink = '0';
        numEl.style.textAlign = 'right';
        numEl.style.paddingRight = '12px';
        numEl.style.color = '#9ca3af';
        numEl.style.userSelect = 'none';
        numEl.textContent = String(line.number);
        rowEl.appendChild(numEl);
      }

      /* Source text */
      const textEl = document.createElement('div');
      textEl.setAttribute('data-part', 'source-text');
      textEl.setAttribute('data-state', sig.get());
      textEl.setAttribute('data-language', language);
      textEl.style.flex = '1';
      textEl.style.whiteSpace = 'pre';
      textEl.style.paddingRight = '12px';
      textEl.style.overflow = 'hidden';
      textEl.style.textOverflow = 'ellipsis';
      textEl.textContent = line.text;
      rowEl.appendChild(textEl);

      codeAreaEl.appendChild(rowEl);
      lineEls.push(rowEl as HTMLDivElement);
    }
  }

  function updateTooltip(): void {
    const filtered = getFilteredLines();
    const s = sig.get();
    if (s === 'lineHovered' && hoveredLineIndex !== null) {
      const hoveredLine = filtered[hoveredLineIndex];
      if (hoveredLine?.coveredBy) {
        tooltipEl.setAttribute('data-visible', 'true');
        tooltipEl.style.visibility = 'visible';
        tooltipEl.textContent = `Covered by: ${hoveredLine.coveredBy}`;
        return;
      }
    }
    tooltipEl.setAttribute('data-visible', 'false');
    tooltipEl.style.visibility = 'hidden';
  }

  function updateLineDetail(): void {
    const filtered = getFilteredLines();
    if (selectedLineIndex !== null && filtered[selectedLineIndex]) {
      const line = filtered[selectedLineIndex];
      lineDetailEl.style.display = '';
      lineDetailEl.innerHTML = '';
      const strong = document.createElement('strong');
      strong.textContent = `Line ${line.number}`;
      lineDetailEl.appendChild(strong);
      const dash = document.createTextNode(' \u2014 ');
      lineDetailEl.appendChild(dash);
      const statusText = line.coverage
        ? line.coverage.charAt(0).toUpperCase() + line.coverage.slice(1)
        : 'Not executable';
      lineDetailEl.appendChild(document.createTextNode(statusText));
      if (line.coveredBy) {
        const sp = document.createElement('span');
        sp.textContent = ` (covered by: ${line.coveredBy})`;
        lineDetailEl.appendChild(sp);
      }
    } else {
      lineDetailEl.style.display = 'none';
    }
  }

  root.addEventListener('keydown', (e) => {
    const filtered = getFilteredLines();
    if (e.ctrlKey && e.key === 'g') {
      e.preventDefault();
      jumpToNextUncovered();
      return;
    }
    if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const firstBtn = filterBarEl.querySelector('button');
      if (firstBtn instanceof HTMLElement) firstBtn.focus();
      return;
    }
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        focusedLineIndex = Math.max(0, focusedLineIndex - 1);
        rebuildLines();
        lineEls[focusedLineIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        break;
      case 'ArrowDown':
        e.preventDefault();
        focusedLineIndex = Math.min(filtered.length - 1, focusedLineIndex + 1);
        rebuildLines();
        lineEls[focusedLineIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        break;
      case 'Enter':
        e.preventDefault();
        handleLineSelect(focusedLineIndex);
        break;
    }
  });

  rebuildLines();

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    summaryEl.setAttribute('data-state', s);
    filterBarEl.setAttribute('data-state', s);
    tooltipEl.setAttribute('data-state', s);
    lineDetailEl.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default CoverageSourceView;
