/* ---------------------------------------------------------------------------
 * StatusGrid — Vanilla widget
 * States: idle (initial), cellHovered, cellSelected
 * ------------------------------------------------------------------------- */

export type StatusGridState = 'idle' | 'cellHovered' | 'cellSelected';
export type StatusGridEvent =
  | { type: 'HOVER_CELL'; row: number; col: number }
  | { type: 'CLICK_CELL'; row: number; col: number }
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

export type CellStatus = 'passed' | 'failed' | 'running' | 'pending' | 'timeout';
export interface StatusGridItem { id: string; name: string; status: CellStatus; duration?: number; }
export type StatusFilterValue = 'all' | 'passed' | 'failed';

const STATUS_COLORS: Record<CellStatus, string> = { passed: '#22c55e', failed: '#ef4444', running: '#3b82f6', pending: '#9ca3af', timeout: '#f97316' };
const STATUS_LABELS: Record<CellStatus, string> = { passed: 'Passed', failed: 'Failed', running: 'Running', pending: 'Pending', timeout: 'Timeout' };

function clamp(v: number, min: number, max: number): number { return Math.max(min, Math.min(max, v)); }
function fmtDur(ms: number): string { return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`; }

export interface StatusGridProps {
  items: StatusGridItem[]; columns?: number; showAggregates?: boolean;
  variant?: 'compact' | 'expanded'; onCellSelect?: (item: StatusGridItem) => void;
  filterStatus?: StatusFilterValue; className?: string; [key: string]: unknown;
}
export interface StatusGridOptions { target: HTMLElement; props: StatusGridProps; }
let _uid = 0;

export class StatusGrid {
  private el: HTMLElement;
  private props: StatusGridProps;
  private state: StatusGridState = 'idle';
  private uid = ++_uid;
  private disposers: (() => void)[] = [];
  private filter: StatusFilterValue;
  private hoveredIdx: number | null = null;
  private selectedIdx: number | null = null;
  private focusIdx = 0;
  private cellRefs: (HTMLDivElement | null)[] = [];

  constructor(private options: StatusGridOptions) {
    this.props = { ...options.props };
    this.filter = this.props.filterStatus ?? 'all';
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', ''); this.el.setAttribute('data-widget-name', 'status-grid');
    this.el.setAttribute('data-part', 'root'); this.el.setAttribute('role', 'grid');
    this.el.setAttribute('aria-label', 'Verification status matrix'); this.el.setAttribute('tabindex', '-1');
    this.el.id = 'status-grid-' + this.uid;
    const kd = (e: KeyboardEvent) => this.onKey(e);
    this.el.addEventListener('keydown', kd); this.disposers.push(() => this.el.removeEventListener('keydown', kd));
    this.render(); options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  private sm(ev: StatusGridEvent): void { this.state = statusGridReducer(this.state, ev); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<StatusGridProps>): void { Object.assign(this.props, props); if (props.filterStatus !== undefined) this.filter = props.filterStatus; this.render(); }
  destroy(): void { this.disposers.forEach(d => d()); this.el.remove(); }

  private get filtered(): StatusGridItem[] {
    if (this.filter === 'all') return this.props.items;
    return this.props.items.filter(i => i.status === this.filter);
  }
  private get cols(): number { return Math.min(this.props.columns ?? 4, this.filtered.length || 1); }

  private focusCell(idx: number): void { const c = clamp(idx, 0, this.filtered.length - 1); this.focusIdx = c; this.cellRefs[c]?.focus(); }

  private onKey(e: KeyboardEvent): void {
    const total = this.filtered.length; if (total === 0) return;
    let next = this.focusIdx;
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); next = this.focusIdx + 1; break;
      case 'ArrowLeft': e.preventDefault(); next = this.focusIdx - 1; break;
      case 'ArrowDown': e.preventDefault(); next = this.focusIdx + this.cols; break;
      case 'ArrowUp': e.preventDefault(); next = this.focusIdx - this.cols; break;
      case 'Enter': e.preventDefault(); { const row = Math.floor(this.focusIdx / this.cols); const col = this.focusIdx % this.cols; this.selectedIdx = this.focusIdx; this.sm({ type: 'CLICK_CELL', row, col }); if (this.filtered[this.focusIdx]) this.props.onCellSelect?.(this.filtered[this.focusIdx]); this.render(); } return;
      case 'Escape': e.preventDefault(); this.selectedIdx = null; this.sm({ type: 'DESELECT' } as StatusGridEvent); this.render(); return;
      default: return;
    }
    this.focusCell(next); this.render();
  }

  private render(): void {
    this.el.innerHTML = ''; this.cellRefs = [];
    const p = this.props; const isCompact = (p.variant ?? 'expanded') === 'compact';
    const showAgg = p.showAggregates !== false; const items = this.filtered;
    const cols = this.cols; const totalRows = Math.ceil(items.length / cols) || 1;

    this.el.setAttribute('data-state', this.state); this.el.setAttribute('data-variant', p.variant ?? 'expanded');
    this.el.setAttribute('aria-rowcount', String(totalRows)); this.el.setAttribute('aria-colcount', String(cols));
    if (p.className) this.el.className = p.className;

    // Counts
    const counts: Record<CellStatus, number> = { passed: 0, failed: 0, running: 0, pending: 0, timeout: 0 };
    for (const item of p.items) counts[item.status]++;
    const summaryParts: string[] = [];
    if (counts.passed > 0) summaryParts.push(`${counts.passed} passed`);
    if (counts.failed > 0) summaryParts.push(`${counts.failed} failed`);
    if (counts.running > 0) summaryParts.push(`${counts.running} running`);
    if (counts.pending > 0) summaryParts.push(`${counts.pending} pending`);
    if (counts.timeout > 0) summaryParts.push(`${counts.timeout} timeout`);

    // Summary bar
    if (showAgg) {
      const ar = document.createElement('div'); ar.setAttribute('data-part', 'aggregate-row'); ar.setAttribute('data-state', this.state); ar.setAttribute('data-visible', 'true');
      ar.setAttribute('aria-live', 'polite'); ar.style.cssText = `display:flex;align-items:center;gap:8px;padding:8px 0;font-size:${isCompact ? '12px' : '14px'}`;
      const st = document.createElement('span'); st.setAttribute('data-part', 'summary-text'); st.textContent = summaryParts.join(', '); ar.appendChild(st);
      this.el.appendChild(ar);
    }

    // Filter buttons
    const fb = document.createElement('div'); fb.setAttribute('data-part', 'filter-bar'); fb.setAttribute('data-state', this.state);
    fb.setAttribute('role', 'toolbar'); fb.setAttribute('aria-label', 'Filter verification results');
    fb.style.cssText = 'display:flex;gap:4px;padding:4px 0';
    (['all', 'passed', 'failed'] as StatusFilterValue[]).forEach(val => {
      const btn = document.createElement('button'); btn.type = 'button'; btn.setAttribute('data-part', 'filter-button');
      btn.setAttribute('data-active', this.filter === val ? 'true' : 'false');
      btn.setAttribute('aria-pressed', String(this.filter === val));
      btn.style.cssText = `padding:${isCompact ? '2px 8px' : '4px 12px'};border:1px solid ${this.filter === val ? '#6366f1' : '#d1d5db'};border-radius:4px;background:${this.filter === val ? '#eef2ff' : 'transparent'};cursor:pointer;font-size:${isCompact ? '11px' : '13px'};font-weight:${this.filter === val ? '600' : '400'}`;
      btn.textContent = val.charAt(0).toUpperCase() + val.slice(1);
      btn.addEventListener('click', () => { this.filter = val; this.selectedIdx = null; this.hoveredIdx = null; this.focusIdx = 0; this.sm({ type: 'FILTER' } as StatusGridEvent); this.render(); });
      fb.appendChild(btn);
    });
    this.el.appendChild(fb);

    // Grid
    const grid = document.createElement('div'); grid.setAttribute('data-part', 'grid'); grid.setAttribute('data-state', this.state);
    grid.setAttribute('role', 'rowgroup');
    grid.style.cssText = `display:grid;grid-template-columns:repeat(${cols}, 1fr);gap:${isCompact ? '2px' : '4px'};padding:4px 0`;

    items.forEach((item, idx) => {
      const row = Math.floor(idx / cols); const col = idx % cols;
      const isHov = this.hoveredIdx === idx; const isSel = this.selectedIdx === idx; const isFoc = this.focusIdx === idx;

      const cell = document.createElement('div');
      cell.setAttribute('role', 'gridcell'); cell.setAttribute('aria-rowindex', String(row + 1)); cell.setAttribute('aria-colindex', String(col + 1));
      cell.setAttribute('aria-label', `${item.name}: ${STATUS_LABELS[item.status]}${item.duration != null ? `, ${fmtDur(item.duration)}` : ''}`);
      cell.setAttribute('aria-selected', String(isSel));
      cell.setAttribute('data-part', 'cell'); cell.setAttribute('data-state', this.state); cell.setAttribute('data-status', item.status);
      cell.setAttribute('data-selected', isSel ? 'true' : 'false'); cell.setAttribute('data-hovered', isHov ? 'true' : 'false');
      cell.tabIndex = isFoc ? 0 : -1;
      cell.style.cssText = `display:flex;flex-direction:column;align-items:${isCompact ? 'center' : 'flex-start'};justify-content:center;padding:${isCompact ? '4px' : '8px 12px'};border-radius:4px;border:2px solid ${isSel ? '#6366f1' : isHov ? '#a5b4fc' : 'transparent'};cursor:pointer;background:${isHov ? '#f5f5f5' : 'transparent'};outline:none;min-height:${isCompact ? '32px' : '48px'};transition:border-color 0.15s,background 0.15s`;

      cell.addEventListener('mouseenter', () => { this.hoveredIdx = idx; this.sm({ type: 'HOVER_CELL', row, col }); this.render(); });
      cell.addEventListener('mouseleave', () => { this.hoveredIdx = null; this.sm({ type: 'LEAVE_CELL' } as StatusGridEvent); this.render(); });
      cell.addEventListener('click', () => { this.selectedIdx = idx; this.focusIdx = idx; this.sm({ type: 'CLICK_CELL', row, col }); if (items[idx]) this.props.onCellSelect?.(items[idx]); this.render(); });
      cell.addEventListener('focus', () => { this.focusIdx = idx; });

      // Status indicator
      const ind = document.createElement('div'); ind.setAttribute('data-part', 'cell-indicator'); ind.setAttribute('data-status', item.status); ind.setAttribute('aria-hidden', 'true');
      ind.style.cssText = `width:${isCompact ? '10px' : '14px'};height:${isCompact ? '10px' : '14px'};border-radius:50%;background-color:${STATUS_COLORS[item.status]};margin-bottom:${isCompact ? '2px' : '4px'};flex-shrink:0`;
      cell.appendChild(ind);

      // Label
      const lb = document.createElement('span'); lb.setAttribute('data-part', 'cell-label');
      lb.style.cssText = `font-size:${isCompact ? '10px' : '12px'};line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%`;
      lb.textContent = item.name; cell.appendChild(lb);

      // Duration
      if (!isCompact && item.duration != null) {
        const dur = document.createElement('span'); dur.setAttribute('data-part', 'cell-duration');
        dur.style.cssText = 'font-size:11px;color:#6b7280;margin-top:2px'; dur.textContent = fmtDur(item.duration); cell.appendChild(dur);
      }

      this.cellRefs.push(cell as HTMLDivElement);
      grid.appendChild(cell);
    });
    this.el.appendChild(grid);

    // Tooltip
    if (this.state === 'cellHovered' && this.hoveredIdx != null && items[this.hoveredIdx]) {
      const hi = items[this.hoveredIdx];
      const tt = document.createElement('div'); tt.setAttribute('role', 'tooltip'); tt.setAttribute('data-part', 'cell-tooltip'); tt.setAttribute('data-state', this.state);
      tt.style.cssText = 'padding:6px 10px;font-size:12px;background:#1f2937;color:#f9fafb;border-radius:4px;pointer-events:none';
      const strong = document.createElement('strong'); strong.textContent = hi.name; tt.appendChild(strong);
      tt.appendChild(document.createTextNode(` \u2014 ${STATUS_LABELS[hi.status]}`));
      if (hi.duration != null) tt.appendChild(document.createTextNode(` (${fmtDur(hi.duration)})`));
      this.el.appendChild(tt);
    }

    // Detail panel
    const selItem = this.selectedIdx != null ? items[this.selectedIdx] : null;
    if (this.state === 'cellSelected' && selItem) {
      const dp = document.createElement('div'); dp.setAttribute('data-part', 'cell-detail'); dp.setAttribute('data-state', this.state);
      dp.setAttribute('role', 'region'); dp.setAttribute('aria-label', `Details for ${selItem.name}`);
      dp.style.cssText = 'padding:12px;margin-top:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px';
      const nm = document.createElement('div'); nm.style.cssText = 'font-weight:600;margin-bottom:4px'; nm.textContent = selItem.name; dp.appendChild(nm);
      const sr = document.createElement('div'); sr.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:2px';
      const dot = document.createElement('span'); dot.setAttribute('aria-hidden', 'true');
      dot.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;background-color:${STATUS_COLORS[selItem.status]}`; sr.appendChild(dot);
      const stxt = document.createElement('span'); stxt.textContent = `Status: ${STATUS_LABELS[selItem.status]}`; sr.appendChild(stxt); dp.appendChild(sr);
      if (selItem.duration != null) { const dr = document.createElement('div'); dr.style.cssText = 'color:#6b7280'; dr.textContent = `Duration: ${fmtDur(selItem.duration)}`; dp.appendChild(dr); }
      this.el.appendChild(dp);
    }

    // Column aggregate placeholder
    if (showAgg) {
      const ac = document.createElement('div'); ac.setAttribute('data-part', 'aggregate-col'); ac.setAttribute('data-state', this.state);
      ac.setAttribute('data-visible', 'true'); ac.setAttribute('aria-hidden', 'true'); this.el.appendChild(ac);
    }
  }
}

export default StatusGrid;
