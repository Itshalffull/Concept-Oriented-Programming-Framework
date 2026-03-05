import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type StatusGridState = 'idle' | 'cellHovered' | 'cellSelected';
export type StatusGridEvent =
  | { type: 'HOVER_CELL' }
  | { type: 'CLICK_CELL' }
  | { type: 'SORT' }
  | { type: 'FILTER' }
  | { type: 'LEAVE_CELL' }
  | { type: 'DESELECT' };

export function statusGridReducer(state: StatusGridState, event: StatusGridEvent): StatusGridState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_CELL') return 'cellHovered';
      if (event.type === 'CLICK_CELL') return 'cellSelected';
      if (event.type === 'SORT') return 'idle';
      if (event.type === 'FILTER') return 'idle';
      return state;
    case 'cellHovered':
      if (event.type === 'LEAVE_CELL') return 'idle';
      if (event.type === 'CLICK_CELL') return 'cellSelected';
      return state;
    case 'cellSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'CLICK_CELL') return 'cellSelected';
      return state;
    default:
      return state;
  }
}

export interface StatusGridProps { [key: string]: unknown; class?: string; }
export interface StatusGridResult { element: HTMLElement; dispose: () => void; }

export function StatusGrid(props: StatusGridProps): StatusGridResult {
  const sig = surfaceCreateSignal<StatusGridState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(statusGridReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'status-grid');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'grid');
  root.setAttribute('aria-label', 'Verification status matrix');
  root.setAttribute('data-state', state());
  root.setAttribute('data-variant', 'expanded');
  root.setAttribute('tabindex', '-1');
  if (props.class) root.className = props.class as string;

  /* Aggregate summary row */
  const aggregateRowEl = document.createElement('div');
  aggregateRowEl.setAttribute('data-part', 'aggregate-row');
  aggregateRowEl.setAttribute('data-state', state());
  aggregateRowEl.setAttribute('data-visible', 'true');
  aggregateRowEl.setAttribute('aria-live', 'polite');
  aggregateRowEl.style.display = 'flex';
  aggregateRowEl.style.alignItems = 'center';
  aggregateRowEl.style.gap = '8px';
  aggregateRowEl.style.padding = '8px 0';
  aggregateRowEl.style.fontSize = '14px';

  const summaryTextEl = document.createElement('span');
  summaryTextEl.setAttribute('data-part', 'summary-text');
  aggregateRowEl.appendChild(summaryTextEl);
  root.appendChild(aggregateRowEl);

  /* Filter bar */
  const filterBarEl = document.createElement('div');
  filterBarEl.setAttribute('data-part', 'filter-bar');
  filterBarEl.setAttribute('data-state', state());
  filterBarEl.setAttribute('role', 'toolbar');
  filterBarEl.setAttribute('aria-label', 'Filter verification results');
  filterBarEl.style.display = 'flex';
  filterBarEl.style.gap = '4px';
  filterBarEl.style.padding = '4px 0';

  const filterOptions = ['all', 'passed', 'failed'];
  filterOptions.forEach((value) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-part', 'filter-button');
    btn.setAttribute('data-active', value === 'all' ? 'true' : 'false');
    btn.setAttribute('aria-pressed', value === 'all' ? 'true' : 'false');
    btn.textContent = value.charAt(0).toUpperCase() + value.slice(1);
    btn.style.padding = '4px 12px';
    btn.style.border = '1px solid #d1d5db';
    btn.style.borderRadius = '4px';
    btn.style.background = 'transparent';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '13px';
    btn.addEventListener('click', () => send('FILTER'));
    filterBarEl.appendChild(btn);
  });
  root.appendChild(filterBarEl);

  /* Grid of cells */
  const gridEl = document.createElement('div');
  gridEl.setAttribute('data-part', 'grid');
  gridEl.setAttribute('data-state', state());
  gridEl.setAttribute('role', 'rowgroup');
  gridEl.style.display = 'grid';
  gridEl.style.gridTemplateColumns = 'repeat(4, 1fr)';
  gridEl.style.gap = '4px';
  gridEl.style.padding = '4px 0';

  /* Cell template */
  const cellEl = document.createElement('div');
  cellEl.setAttribute('data-part', 'cell');
  cellEl.setAttribute('data-state', state());
  cellEl.setAttribute('data-status', 'pending');
  cellEl.setAttribute('data-selected', 'false');
  cellEl.setAttribute('data-hovered', 'false');
  cellEl.setAttribute('role', 'gridcell');
  cellEl.setAttribute('tabindex', '0');
  cellEl.style.display = 'flex';
  cellEl.style.flexDirection = 'column';
  cellEl.style.alignItems = 'flex-start';
  cellEl.style.justifyContent = 'center';
  cellEl.style.padding = '8px 12px';
  cellEl.style.borderRadius = '4px';
  cellEl.style.border = '2px solid transparent';
  cellEl.style.cursor = 'pointer';
  cellEl.style.outline = 'none';
  cellEl.style.minHeight = '48px';
  cellEl.style.transition = 'border-color 0.15s, background 0.15s';
  cellEl.addEventListener('mouseenter', () => {
    send('HOVER_CELL');
    cellEl.setAttribute('data-hovered', 'true');
  });
  cellEl.addEventListener('mouseleave', () => {
    send('LEAVE_CELL');
    cellEl.setAttribute('data-hovered', 'false');
  });
  cellEl.addEventListener('click', () => {
    send('CLICK_CELL');
    cellEl.setAttribute('data-selected', 'true');
  });

  /* Cell indicator */
  const cellIndicatorEl = document.createElement('div');
  cellIndicatorEl.setAttribute('data-part', 'cell-indicator');
  cellIndicatorEl.setAttribute('data-status', 'pending');
  cellIndicatorEl.setAttribute('aria-hidden', 'true');
  cellIndicatorEl.style.width = '14px';
  cellIndicatorEl.style.height = '14px';
  cellIndicatorEl.style.borderRadius = '50%';
  cellIndicatorEl.style.backgroundColor = '#9ca3af';
  cellIndicatorEl.style.marginBottom = '4px';
  cellIndicatorEl.style.flexShrink = '0';
  cellEl.appendChild(cellIndicatorEl);

  /* Cell label */
  const cellLabelEl = document.createElement('span');
  cellLabelEl.setAttribute('data-part', 'cell-label');
  cellLabelEl.style.fontSize = '12px';
  cellLabelEl.style.lineHeight = '1.2';
  cellLabelEl.style.overflow = 'hidden';
  cellLabelEl.style.textOverflow = 'ellipsis';
  cellLabelEl.style.whiteSpace = 'nowrap';
  cellLabelEl.style.maxWidth = '100%';
  cellEl.appendChild(cellLabelEl);

  /* Cell duration */
  const cellDurationEl = document.createElement('span');
  cellDurationEl.setAttribute('data-part', 'cell-duration');
  cellDurationEl.style.fontSize = '11px';
  cellDurationEl.style.color = '#6b7280';
  cellDurationEl.style.marginTop = '2px';
  cellEl.appendChild(cellDurationEl);

  gridEl.appendChild(cellEl);
  root.appendChild(gridEl);

  /* Cell tooltip */
  const cellTooltipEl = document.createElement('div');
  cellTooltipEl.setAttribute('data-part', 'cell-tooltip');
  cellTooltipEl.setAttribute('data-state', state());
  cellTooltipEl.setAttribute('role', 'tooltip');
  cellTooltipEl.setAttribute('data-visible', 'false');
  cellTooltipEl.style.padding = '6px 10px';
  cellTooltipEl.style.fontSize = '12px';
  cellTooltipEl.style.background = '#1f2937';
  cellTooltipEl.style.color = '#f9fafb';
  cellTooltipEl.style.borderRadius = '4px';
  cellTooltipEl.style.pointerEvents = 'none';
  cellTooltipEl.style.display = 'none';
  root.appendChild(cellTooltipEl);

  /* Cell detail panel */
  const cellDetailEl = document.createElement('div');
  cellDetailEl.setAttribute('data-part', 'cell-detail');
  cellDetailEl.setAttribute('data-state', state());
  cellDetailEl.setAttribute('role', 'region');
  cellDetailEl.setAttribute('aria-label', 'Cell details');
  cellDetailEl.style.padding = '12px';
  cellDetailEl.style.marginTop = '8px';
  cellDetailEl.style.border = '1px solid #e5e7eb';
  cellDetailEl.style.borderRadius = '6px';
  cellDetailEl.style.fontSize = '13px';
  cellDetailEl.style.display = 'none';

  const detailNameEl = document.createElement('div');
  detailNameEl.setAttribute('data-part', 'detail-name');
  detailNameEl.style.fontWeight = '600';
  detailNameEl.style.marginBottom = '4px';
  cellDetailEl.appendChild(detailNameEl);

  const detailStatusRow = document.createElement('div');
  detailStatusRow.style.display = 'flex';
  detailStatusRow.style.alignItems = 'center';
  detailStatusRow.style.gap = '6px';
  detailStatusRow.style.marginBottom = '2px';

  const detailIndicatorEl = document.createElement('span');
  detailIndicatorEl.setAttribute('aria-hidden', 'true');
  detailIndicatorEl.style.display = 'inline-block';
  detailIndicatorEl.style.width = '10px';
  detailIndicatorEl.style.height = '10px';
  detailIndicatorEl.style.borderRadius = '50%';
  detailStatusRow.appendChild(detailIndicatorEl);

  const detailStatusTextEl = document.createElement('span');
  detailStatusRow.appendChild(detailStatusTextEl);
  cellDetailEl.appendChild(detailStatusRow);

  const detailDurationEl = document.createElement('div');
  detailDurationEl.setAttribute('data-part', 'detail-duration');
  detailDurationEl.style.color = '#6b7280';
  cellDetailEl.appendChild(detailDurationEl);

  root.appendChild(cellDetailEl);

  /* Column aggregate */
  const aggregateColEl = document.createElement('div');
  aggregateColEl.setAttribute('data-part', 'aggregate-col');
  aggregateColEl.setAttribute('data-state', state());
  aggregateColEl.setAttribute('data-visible', 'true');
  aggregateColEl.setAttribute('aria-hidden', 'true');
  root.appendChild(aggregateColEl);

  /* Keyboard navigation */
  root.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        break;
      case 'ArrowDown':
        e.preventDefault();
        break;
      case 'ArrowUp':
        e.preventDefault();
        break;
      case 'Enter':
        e.preventDefault();
        send('CLICK_CELL');
        break;
      case 'Escape':
        e.preventDefault();
        send('DESELECT');
        break;
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    gridEl.setAttribute('data-state', s);
    aggregateRowEl.setAttribute('data-state', s);
    filterBarEl.setAttribute('data-state', s);
    cellEl.setAttribute('data-state', s);
    cellTooltipEl.setAttribute('data-state', s);
    cellDetailEl.setAttribute('data-state', s);
    aggregateColEl.setAttribute('data-state', s);
    const isHovered = s === 'cellHovered';
    cellTooltipEl.setAttribute('data-visible', isHovered ? 'true' : 'false');
    cellTooltipEl.style.display = isHovered ? 'block' : 'none';
    const isSelected = s === 'cellSelected';
    cellDetailEl.style.display = isSelected ? 'block' : 'none';
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default StatusGrid;
