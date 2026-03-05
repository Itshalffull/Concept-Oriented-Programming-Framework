import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type CoverageSourceViewState = 'idle' | 'lineHovered';
export type CoverageSourceViewEvent =
  | { type: 'HOVER_LINE' }
  | { type: 'FILTER' }
  | { type: 'JUMP_UNCOVERED' }
  | { type: 'LEAVE' }
  | { type: 'SELECT_LINE' }
  | { type: 'NAVIGATE' };

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

export interface CoverageSourceViewProps { [key: string]: unknown; class?: string; }
export interface CoverageSourceViewResult { element: HTMLElement; dispose: () => void; }

export function CoverageSourceView(props: CoverageSourceViewProps): CoverageSourceViewResult {
  const sig = surfaceCreateSignal<CoverageSourceViewState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(coverageSourceViewReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'coverage-source-view');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'document');
  root.setAttribute('aria-label', 'Coverage source view');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Summary header */
  const summaryEl = document.createElement('div');
  summaryEl.setAttribute('data-part', 'summary');
  summaryEl.setAttribute('data-state', state());
  summaryEl.setAttribute('role', 'status');
  summaryEl.setAttribute('aria-live', 'polite');
  summaryEl.style.padding = '8px 12px';
  summaryEl.style.fontFamily = 'system-ui, sans-serif';
  summaryEl.style.fontSize = '14px';
  summaryEl.style.fontWeight = '600';
  summaryEl.style.borderBottom = '1px solid #e5e7eb';
  root.appendChild(summaryEl);

  /* Filter bar */
  const filterBarEl = document.createElement('div');
  filterBarEl.setAttribute('data-part', 'filter-bar');
  filterBarEl.setAttribute('data-state', state());
  filterBarEl.style.display = 'flex';
  filterBarEl.style.gap = '4px';
  filterBarEl.style.padding = '6px 12px';
  filterBarEl.style.borderBottom = '1px solid #e5e7eb';

  const filterOptions = ['all', 'covered', 'uncovered', 'partial'];
  filterOptions.forEach((filter) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-active', filter === 'all' ? 'true' : 'false');
    btn.setAttribute('aria-pressed', filter === 'all' ? 'true' : 'false');
    btn.textContent = filter.charAt(0).toUpperCase() + filter.slice(1);
    btn.style.padding = '2px 10px';
    btn.style.fontSize = '12px';
    btn.style.border = '1px solid #d1d5db';
    btn.style.borderRadius = '4px';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => send('FILTER'));
    filterBarEl.appendChild(btn);
  });
  root.appendChild(filterBarEl);

  /* Code area */
  const codeAreaEl = document.createElement('div');
  codeAreaEl.setAttribute('role', 'code');
  codeAreaEl.style.overflow = 'auto';
  codeAreaEl.style.fontFamily = 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace';
  codeAreaEl.style.fontSize = '13px';
  codeAreaEl.style.lineHeight = '20px';
  codeAreaEl.style.position = 'relative';

  /* Line row template */
  const lineRow = document.createElement('div');
  lineRow.setAttribute('role', 'row');
  lineRow.style.display = 'flex';
  lineRow.style.alignItems = 'stretch';
  lineRow.style.cursor = 'pointer';
  lineRow.addEventListener('mouseenter', () => send('HOVER_LINE'));
  lineRow.addEventListener('mouseleave', () => send('LEAVE'));

  /* Coverage gutter */
  const coverageGutterEl = document.createElement('div');
  coverageGutterEl.setAttribute('data-part', 'coverage-gutter');
  coverageGutterEl.setAttribute('data-state', state());
  coverageGutterEl.setAttribute('role', 'presentation');
  coverageGutterEl.setAttribute('aria-hidden', 'true');
  coverageGutterEl.style.width = '4px';
  coverageGutterEl.style.flexShrink = '0';
  lineRow.appendChild(coverageGutterEl);

  /* Line numbers */
  const lineNumbersEl = document.createElement('div');
  lineNumbersEl.setAttribute('data-part', 'line-numbers');
  lineNumbersEl.setAttribute('data-state', state());
  lineNumbersEl.setAttribute('data-visible', 'true');
  lineNumbersEl.setAttribute('role', 'rowheader');
  lineNumbersEl.style.width = '48px';
  lineNumbersEl.style.flexShrink = '0';
  lineNumbersEl.style.textAlign = 'right';
  lineNumbersEl.style.paddingRight = '12px';
  lineNumbersEl.style.color = '#9ca3af';
  lineNumbersEl.style.userSelect = 'none';
  lineRow.appendChild(lineNumbersEl);

  /* Source text */
  const sourceTextEl = document.createElement('div');
  sourceTextEl.setAttribute('data-part', 'source-text');
  sourceTextEl.setAttribute('data-state', state());
  sourceTextEl.style.flex = '1';
  sourceTextEl.style.whiteSpace = 'pre';
  sourceTextEl.style.paddingRight = '12px';
  sourceTextEl.style.overflow = 'hidden';
  sourceTextEl.style.textOverflow = 'ellipsis';
  lineRow.appendChild(sourceTextEl);

  codeAreaEl.appendChild(lineRow);
  root.appendChild(codeAreaEl);

  /* Tooltip */
  const tooltipEl = document.createElement('div');
  tooltipEl.setAttribute('data-part', 'tooltip');
  tooltipEl.setAttribute('data-state', state());
  tooltipEl.setAttribute('data-visible', 'false');
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.style.position = 'absolute';
  tooltipEl.style.padding = '4px 8px';
  tooltipEl.style.fontSize = '12px';
  tooltipEl.style.background = '#1f2937';
  tooltipEl.style.color = '#f9fafb';
  tooltipEl.style.borderRadius = '4px';
  tooltipEl.style.pointerEvents = 'none';
  tooltipEl.style.zIndex = '10';
  tooltipEl.style.whiteSpace = 'nowrap';
  tooltipEl.style.display = 'none';
  root.appendChild(tooltipEl);

  /* Line detail */
  const lineDetailEl = document.createElement('div');
  lineDetailEl.setAttribute('data-part', 'line-detail');
  lineDetailEl.setAttribute('data-state', state());
  lineDetailEl.style.padding = '8px 12px';
  lineDetailEl.style.borderTop = '1px solid #e5e7eb';
  lineDetailEl.style.fontSize = '13px';
  lineDetailEl.style.fontFamily = 'system-ui, sans-serif';
  lineDetailEl.style.display = 'none';
  root.appendChild(lineDetailEl);

  /* Keyboard handler */
  root.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'g') {
      e.preventDefault();
      send('JUMP_UNCOVERED');
      return;
    }
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowDown':
        e.preventDefault();
        break;
      case 'Enter':
        e.preventDefault();
        send('SELECT_LINE');
        break;
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    summaryEl.setAttribute('data-state', s);
    filterBarEl.setAttribute('data-state', s);
    coverageGutterEl.setAttribute('data-state', s);
    lineNumbersEl.setAttribute('data-state', s);
    sourceTextEl.setAttribute('data-state', s);
    tooltipEl.setAttribute('data-state', s);
    lineDetailEl.setAttribute('data-state', s);
    const isHovered = s === 'lineHovered';
    tooltipEl.setAttribute('data-visible', isHovered ? 'true' : 'false');
    tooltipEl.style.display = isHovered ? 'block' : 'none';
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default CoverageSourceView;
