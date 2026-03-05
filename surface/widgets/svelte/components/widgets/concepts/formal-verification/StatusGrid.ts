import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type StatusGridState = 'idle' | 'cellHovered' | 'cellSelected';
export type StatusGridEvent =
  | { type: 'HOVER_CELL'; row: number; col: number }
  | { type: 'CLICK_CELL'; row: number; col: number }
  | { type: 'SORT' }
  | { type: 'FILTER' }
  | { type: 'LEAVE_CELL' }
  | { type: 'DESELECT' }
  | { type: 'FOCUS_NEXT_COL' }
  | { type: 'FOCUS_PREV_COL' }
  | { type: 'FOCUS_NEXT_ROW' }
  | { type: 'FOCUS_PREV_ROW' };

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

export type CellStatus = 'passed' | 'failed' | 'running' | 'pending' | 'timeout';

export interface StatusGridItem {
  id: string;
  name: string;
  status: CellStatus;
  duration?: number;
}

export type StatusFilterValue = 'all' | 'passed' | 'failed';

const STATUS_COLORS: Record<CellStatus, string> = {
  passed: '#22c55e',
  failed: '#ef4444',
  running: '#3b82f6',
  pending: '#9ca3af',
  timeout: '#f97316',
};

const STATUS_LABELS: Record<CellStatus, string> = {
  passed: 'Passed',
  failed: 'Failed',
  running: 'Running',
  pending: 'Pending',
  timeout: 'Timeout',
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export interface StatusGridProps { [key: string]: unknown; class?: string; }
export interface StatusGridResult { element: HTMLElement; dispose: () => void; }

export function StatusGrid(props: StatusGridProps): StatusGridResult {
  const sig = surfaceCreateSignal<StatusGridState>('idle');
  const send = (evt: StatusGridEvent) => sig.set(statusGridReducer(sig.get(), evt));

  const items = (props.items ?? []) as StatusGridItem[];
  const columns = typeof props.columns === 'number' ? props.columns : 4;
  const showAggregates = props.showAggregates !== false;
  const variant = String(props.variant ?? 'expanded') as 'compact' | 'expanded';
  const onCellSelect = props.onCellSelect as ((item: StatusGridItem) => void) | undefined;
  const isCompact = variant === 'compact';

  let filter: StatusFilterValue = (props.filterStatus as StatusFilterValue) ?? 'all';
  let hoveredIndex: number | null = null;
  let selectedIndex: number | null = null;
  let focusIndex = 0;
  const cellEls: HTMLDivElement[] = [];

  function getFilteredItems(): StatusGridItem[] {
    if (filter === 'all') return items;
    return items.filter((item) => item.status === filter);
  }

  function getCounts(): Record<CellStatus, number> {
    const c: Record<CellStatus, number> = { passed: 0, failed: 0, running: 0, pending: 0, timeout: 0 };
    for (const item of items) c[item.status]++;
    return c;
  }

  function getSummaryText(): string {
    const counts = getCounts();
    const parts: string[] = [];
    if (counts.passed > 0) parts.push(`${counts.passed} passed`);
    if (counts.failed > 0) parts.push(`${counts.failed} failed`);
    if (counts.running > 0) parts.push(`${counts.running} running`);
    if (counts.pending > 0) parts.push(`${counts.pending} pending`);
    if (counts.timeout > 0) parts.push(`${counts.timeout} timeout`);
    return parts.join(', ');
  }

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'status-grid');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'grid');
  root.setAttribute('aria-label', 'Verification status matrix');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-variant', variant);
  root.setAttribute('tabindex', '-1');
  if (props.class) root.className = props.class as string;

  /* Aggregate row */
  let aggregateRowEl: HTMLDivElement | null = null;
  if (showAggregates) {
    aggregateRowEl = document.createElement('div');
    aggregateRowEl.setAttribute('data-part', 'aggregate-row');
    aggregateRowEl.setAttribute('data-state', sig.get());
    aggregateRowEl.setAttribute('data-visible', 'true');
    aggregateRowEl.setAttribute('aria-live', 'polite');
    const summarySpan = document.createElement('span');
    summarySpan.setAttribute('data-part', 'summary-text');
    summarySpan.textContent = getSummaryText();
    aggregateRowEl.appendChild(summarySpan);
    root.appendChild(aggregateRowEl);
  }

  /* Filter bar */
  const filterBarEl = document.createElement('div');
  filterBarEl.setAttribute('data-part', 'filter-bar');
  filterBarEl.setAttribute('data-state', sig.get());
  filterBarEl.setAttribute('role', 'toolbar');
  filterBarEl.setAttribute('aria-label', 'Filter verification results');

  for (const value of ['all', 'passed', 'failed'] as const) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-part', 'filter-button');
    btn.setAttribute('data-active', filter === value ? 'true' : 'false');
    btn.setAttribute('aria-pressed', String(filter === value));
    btn.textContent = value.charAt(0).toUpperCase() + value.slice(1);
    btn.addEventListener('click', () => handleFilterClick(value));
    filterBarEl.appendChild(btn);
  }
  root.appendChild(filterBarEl);

  /* Grid container */
  const gridEl = document.createElement('div');
  gridEl.setAttribute('data-part', 'grid');
  gridEl.setAttribute('data-state', sig.get());
  gridEl.setAttribute('role', 'rowgroup');
  root.appendChild(gridEl);

  /* Tooltip */
  const tooltipEl = document.createElement('div');
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.setAttribute('data-part', 'cell-tooltip');
  tooltipEl.setAttribute('data-state', sig.get());
  tooltipEl.style.display = 'none';
  root.appendChild(tooltipEl);

  /* Detail panel */
  const detailEl = document.createElement('div');
  detailEl.setAttribute('data-part', 'cell-detail');
  detailEl.setAttribute('data-state', sig.get());
  detailEl.setAttribute('role', 'region');
  detailEl.style.display = 'none';
  root.appendChild(detailEl);

  /* Column aggregate */
  if (showAggregates) {
    const aggregateColEl = document.createElement('div');
    aggregateColEl.setAttribute('data-part', 'aggregate-col');
    aggregateColEl.setAttribute('data-state', sig.get());
    aggregateColEl.setAttribute('data-visible', 'true');
    aggregateColEl.setAttribute('aria-hidden', 'true');
    root.appendChild(aggregateColEl);
  }

  function handleFilterClick(value: StatusFilterValue): void {
    filter = value;
    selectedIndex = null;
    hoveredIndex = null;
    focusIndex = 0;
    send({ type: 'FILTER' } as any);
    updateFilterBar();
    rebuildGrid();
    updateTooltip();
    updateDetail();
  }

  function updateFilterBar(): void {
    const buttons = filterBarEl.querySelectorAll('button');
    const values: StatusFilterValue[] = ['all', 'passed', 'failed'];
    buttons.forEach((btn, i) => {
      btn.setAttribute('data-active', filter === values[i] ? 'true' : 'false');
      btn.setAttribute('aria-pressed', String(filter === values[i]));
    });
  }

  function rebuildGrid(): void {
    gridEl.innerHTML = '';
    cellEls.length = 0;
    const filtered = getFilteredItems();
    const totalCells = filtered.length;
    const actualCols = Math.min(columns, totalCells);
    const totalRows = Math.ceil(totalCells / actualCols) || 1;

    root.setAttribute('aria-rowcount', String(totalRows));
    root.setAttribute('aria-colcount', String(actualCols));
    gridEl.style.display = 'grid';
    gridEl.style.gridTemplateColumns = `repeat(${actualCols}, 1fr)`;
    gridEl.style.gap = isCompact ? '2px' : '4px';

    for (let i = 0; i < filtered.length; i++) {
      const item = filtered[i];
      const row = Math.floor(i / actualCols);
      const col = i % actualCols;
      const isSelected = selectedIndex === i;
      const isFocused = focusIndex === i;

      const cellEl = document.createElement('div');
      cellEl.setAttribute('role', 'gridcell');
      cellEl.setAttribute('aria-rowindex', String(row + 1));
      cellEl.setAttribute('aria-colindex', String(col + 1));
      cellEl.setAttribute('aria-label', `${item.name}: ${STATUS_LABELS[item.status]}${item.duration != null ? `, ${formatDuration(item.duration)}` : ''}`);
      cellEl.setAttribute('aria-selected', String(isSelected));
      cellEl.setAttribute('data-part', 'cell');
      cellEl.setAttribute('data-state', sig.get());
      cellEl.setAttribute('data-status', item.status);
      cellEl.setAttribute('data-selected', isSelected ? 'true' : 'false');
      cellEl.setAttribute('data-hovered', 'false');
      cellEl.setAttribute('tabindex', isFocused ? '0' : '-1');
      cellEl.style.cursor = 'pointer';
      cellEl.style.padding = isCompact ? '4px' : '8px 12px';
      cellEl.style.borderRadius = '4px';
      cellEl.style.border = `2px solid ${isSelected ? '#6366f1' : 'transparent'}`;
      cellEl.style.minHeight = isCompact ? '32px' : '48px';
      cellEl.style.outline = 'none';
      cellEl.style.transition = 'border-color 0.15s, background 0.15s';

      const idx = i;
      cellEl.addEventListener('mouseenter', () => {
        hoveredIndex = idx;
        cellEl.setAttribute('data-hovered', 'true');
        cellEl.style.background = '#f5f5f5';
        cellEl.style.borderColor = isSelected ? '#6366f1' : '#a5b4fc';
        send({ type: 'HOVER_CELL', row: Math.floor(idx / actualCols), col: idx % actualCols });
        updateTooltip();
      });
      cellEl.addEventListener('mouseleave', () => {
        hoveredIndex = null;
        cellEl.setAttribute('data-hovered', 'false');
        cellEl.style.background = 'transparent';
        cellEl.style.borderColor = selectedIndex === idx ? '#6366f1' : 'transparent';
        send({ type: 'LEAVE_CELL' } as any);
        updateTooltip();
      });
      cellEl.addEventListener('click', () => handleCellClick(idx));
      cellEl.addEventListener('focus', () => { focusIndex = idx; });

      /* Status indicator */
      const indicatorEl = document.createElement('div');
      indicatorEl.setAttribute('data-part', 'cell-indicator');
      indicatorEl.setAttribute('data-status', item.status);
      indicatorEl.setAttribute('aria-hidden', 'true');
      const sz = isCompact ? '10px' : '14px';
      indicatorEl.style.width = sz;
      indicatorEl.style.height = sz;
      indicatorEl.style.borderRadius = '50%';
      indicatorEl.style.backgroundColor = STATUS_COLORS[item.status];
      indicatorEl.style.marginBottom = isCompact ? '2px' : '4px';
      indicatorEl.style.flexShrink = '0';
      cellEl.appendChild(indicatorEl);

      /* Cell label */
      const labelEl = document.createElement('span');
      labelEl.setAttribute('data-part', 'cell-label');
      labelEl.style.fontSize = isCompact ? '10px' : '12px';
      labelEl.style.lineHeight = '1.2';
      labelEl.style.overflow = 'hidden';
      labelEl.style.textOverflow = 'ellipsis';
      labelEl.style.whiteSpace = 'nowrap';
      labelEl.style.maxWidth = '100%';
      labelEl.textContent = item.name;
      cellEl.appendChild(labelEl);

      /* Duration */
      if (!isCompact && item.duration != null) {
        const durEl = document.createElement('span');
        durEl.setAttribute('data-part', 'cell-duration');
        durEl.style.fontSize = '11px';
        durEl.style.color = '#6b7280';
        durEl.style.marginTop = '2px';
        durEl.textContent = formatDuration(item.duration);
        cellEl.appendChild(durEl);
      }

      gridEl.appendChild(cellEl);
      cellEls.push(cellEl);
    }
  }

  function handleCellClick(index: number): void {
    const filtered = getFilteredItems();
    const actualCols = Math.min(columns, filtered.length);
    const row = Math.floor(index / actualCols);
    const col = index % actualCols;
    selectedIndex = index;
    focusIndex = index;
    send({ type: 'CLICK_CELL', row, col });
    if (filtered[index]) onCellSelect?.(filtered[index]);
    rebuildGrid();
    updateDetail();
    cellEls[index]?.focus();
  }

  function updateTooltip(): void {
    const filtered = getFilteredItems();
    if (sig.get() === 'cellHovered' && hoveredIndex != null && filtered[hoveredIndex]) {
      const item = filtered[hoveredIndex];
      tooltipEl.style.display = '';
      tooltipEl.innerHTML = '';
      const strong = document.createElement('strong');
      strong.textContent = item.name;
      tooltipEl.appendChild(strong);
      tooltipEl.appendChild(document.createTextNode(` \u2014 ${STATUS_LABELS[item.status]}`));
      if (item.duration != null) {
        tooltipEl.appendChild(document.createTextNode(` (${formatDuration(item.duration)})`));
      }
    } else {
      tooltipEl.style.display = 'none';
    }
  }

  function updateDetail(): void {
    const filtered = getFilteredItems();
    if (sig.get() === 'cellSelected' && selectedIndex != null && filtered[selectedIndex]) {
      const item = filtered[selectedIndex];
      detailEl.style.display = '';
      detailEl.setAttribute('aria-label', `Details for ${item.name}`);
      detailEl.innerHTML = '';

      const nameDiv = document.createElement('div');
      nameDiv.style.fontWeight = '600';
      nameDiv.style.marginBottom = '4px';
      nameDiv.textContent = item.name;
      detailEl.appendChild(nameDiv);

      const statusRow = document.createElement('div');
      statusRow.style.display = 'flex';
      statusRow.style.alignItems = 'center';
      statusRow.style.gap = '6px';
      statusRow.style.marginBottom = '2px';
      const dot = document.createElement('span');
      dot.setAttribute('aria-hidden', 'true');
      dot.style.display = 'inline-block';
      dot.style.width = '10px';
      dot.style.height = '10px';
      dot.style.borderRadius = '50%';
      dot.style.backgroundColor = STATUS_COLORS[item.status];
      statusRow.appendChild(dot);
      statusRow.appendChild(document.createTextNode(`Status: ${STATUS_LABELS[item.status]}`));
      detailEl.appendChild(statusRow);

      if (item.duration != null) {
        const durDiv = document.createElement('div');
        durDiv.style.color = '#6b7280';
        durDiv.textContent = `Duration: ${formatDuration(item.duration)}`;
        detailEl.appendChild(durDiv);
      }
    } else {
      detailEl.style.display = 'none';
    }
  }

  root.addEventListener('keydown', (e) => {
    const filtered = getFilteredItems();
    const totalCells = filtered.length;
    if (totalCells === 0) return;
    const actualCols = Math.min(columns, totalCells);
    let nextIndex = focusIndex;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        nextIndex = focusIndex + 1;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        nextIndex = focusIndex - 1;
        break;
      case 'ArrowDown':
        e.preventDefault();
        nextIndex = focusIndex + actualCols;
        break;
      case 'ArrowUp':
        e.preventDefault();
        nextIndex = focusIndex - actualCols;
        break;
      case 'Enter': {
        e.preventDefault();
        handleCellClick(focusIndex);
        return;
      }
      case 'Escape':
        e.preventDefault();
        selectedIndex = null;
        send({ type: 'DESELECT' } as any);
        rebuildGrid();
        updateDetail();
        return;
      default:
        return;
    }

    const clamped = clamp(nextIndex, 0, totalCells - 1);
    focusIndex = clamped;
    cellEls[clamped]?.focus();
  });

  rebuildGrid();

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    updateTooltip();
    updateDetail();
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default StatusGrid;
