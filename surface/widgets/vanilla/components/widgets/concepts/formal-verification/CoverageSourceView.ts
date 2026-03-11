/* ---------------------------------------------------------------------------
 * CoverageSourceView — Vanilla widget
 * States: idle (initial), lineHovered
 * ------------------------------------------------------------------------- */

export type CoverageSourceViewState = 'idle' | 'lineHovered';
export type CoverageSourceViewEvent =
  | { type: 'HOVER_LINE'; lineIndex: number }
  | { type: 'FILTER'; status: CoverageFilter }
  | { type: 'JUMP_UNCOVERED' }
  | { type: 'LEAVE' }
  | { type: 'SELECT_LINE'; lineIndex: number };

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

export interface CoverageLine { number: number; text: string; coverage: CoverageStatus; coveredBy?: string; }
export interface CoverageSummary { totalLines: number; coveredLines: number; percentage: number; }

const GUTTER_COLORS: Record<string, string> = { covered: '#22c55e', uncovered: '#ef4444', partial: '#eab308' };
const FILTER_OPTIONS: CoverageFilter[] = ['all', 'covered', 'uncovered', 'partial'];

export interface CoverageSourceViewProps {
  lines: CoverageLine[]; summary: CoverageSummary; language?: string;
  showLineNumbers?: boolean; filterStatus?: CoverageFilter;
  onLineSelect?: (line: CoverageLine) => void; onFilterChange?: (filter: CoverageFilter) => void;
  className?: string; [key: string]: unknown;
}
export interface CoverageSourceViewOptions { target: HTMLElement; props: CoverageSourceViewProps; }
let _uid = 0;

export class CoverageSourceView {
  private el: HTMLElement;
  private props: CoverageSourceViewProps;
  private state: CoverageSourceViewState = 'idle';
  private uid = ++_uid;
  private disposers: (() => void)[] = [];
  private selectedLineIdx: number | null = null;
  private focusedLineIdx = 0;
  private hoveredLineIdx: number | null = null;
  private activeFilter: CoverageFilter;
  private lineRefs: HTMLDivElement[] = [];

  constructor(private options: CoverageSourceViewOptions) {
    this.props = { ...options.props };
    this.activeFilter = this.props.filterStatus ?? 'all';
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', ''); this.el.setAttribute('data-widget-name', 'coverage-source-view');
    this.el.setAttribute('data-part', 'root'); this.el.setAttribute('role', 'document');
    this.el.setAttribute('aria-label', 'Coverage source view'); this.el.setAttribute('tabindex', '0');
    this.el.id = 'coverage-source-view-' + this.uid;
    const kd = (e: KeyboardEvent) => this.onKey(e);
    this.el.addEventListener('keydown', kd); this.disposers.push(() => this.el.removeEventListener('keydown', kd));
    this.render(); options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  private sm(ev: CoverageSourceViewEvent): void { this.state = coverageSourceViewReducer(this.state, ev); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<CoverageSourceViewProps>): void {
    Object.assign(this.props, props);
    if (props.filterStatus !== undefined) this.activeFilter = props.filterStatus;
    this.render();
  }
  destroy(): void { this.disposers.forEach(d => d()); this.el.remove(); }

  private get filtered(): CoverageLine[] {
    if (this.activeFilter === 'all') return this.props.lines;
    return this.props.lines.filter(l => l.coverage === this.activeFilter);
  }

  private jumpToNextUncovered(): void {
    const fl = this.filtered; const start = this.focusedLineIdx + 1;
    for (let i = 0; i < fl.length; i++) {
      const idx = (start + i) % fl.length;
      if (fl[idx].coverage === 'uncovered') { this.focusedLineIdx = idx; this.sm({ type: 'JUMP_UNCOVERED' }); this.render(); this.lineRefs[idx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.ctrlKey && e.key === 'g') { e.preventDefault(); this.jumpToNextUncovered(); return; }
    if (e.key === 'f' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); const fb = this.el.querySelector('[data-part="filter-bar"] button'); if (fb instanceof HTMLElement) fb.focus(); return; }
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); this.focusedLineIdx = Math.max(0, this.focusedLineIdx - 1); this.render(); this.lineRefs[this.focusedLineIdx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); break;
      case 'ArrowDown': e.preventDefault(); this.focusedLineIdx = Math.min(this.filtered.length - 1, this.focusedLineIdx + 1); this.render(); this.lineRefs[this.focusedLineIdx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); break;
      case 'Enter': e.preventDefault(); this.selectLine(this.focusedLineIdx); break;
    }
  }

  private selectLine(idx: number): void {
    this.selectedLineIdx = idx;
    const line = this.filtered[idx];
    if (line) this.props.onLineSelect?.(line);
    this.render();
  }

  private setFilter(filter: CoverageFilter): void {
    this.activeFilter = filter; this.focusedLineIdx = 0; this.selectedLineIdx = null;
    this.sm({ type: 'FILTER', status: filter }); this.props.onFilterChange?.(filter); this.render();
  }

  private render(): void {
    this.el.innerHTML = ''; this.lineRefs = [];
    const p = this.props; const showLN = p.showLineNumbers !== false; const language = p.language ?? 'typescript';
    const fl = this.filtered;
    this.el.setAttribute('data-state', this.state);
    if (p.className) this.el.className = p.className;

    // Summary
    const sm = document.createElement('div'); sm.setAttribute('data-part', 'summary'); sm.setAttribute('data-state', this.state);
    sm.setAttribute('role', 'status'); sm.setAttribute('aria-live', 'polite');
    sm.textContent = `Coverage: ${p.summary.percentage}% (${p.summary.coveredLines}/${p.summary.totalLines} lines)`;
    this.el.appendChild(sm);

    // Filter bar
    const fb = document.createElement('div'); fb.setAttribute('data-part', 'filter-bar'); fb.setAttribute('data-state', this.state);
    fb.style.cssText = 'display:flex;gap:4px;padding:6px 12px;border-bottom:1px solid #e5e7eb';
    FILTER_OPTIONS.forEach(filter => {
      const btn = document.createElement('button'); btn.type = 'button';
      btn.setAttribute('data-active', this.activeFilter === filter ? 'true' : 'false');
      btn.setAttribute('aria-pressed', String(this.activeFilter === filter));
      btn.style.cssText = `padding:2px 10px;font-size:12px;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;background:${this.activeFilter === filter ? '#e0e7ff' : 'transparent'};font-weight:${this.activeFilter === filter ? '600' : '400'}`;
      btn.textContent = filter.charAt(0).toUpperCase() + filter.slice(1);
      btn.addEventListener('click', () => this.setFilter(filter));
      fb.appendChild(btn);
    });
    this.el.appendChild(fb);

    // Code area
    const ca = document.createElement('div'); ca.setAttribute('role', 'code');
    ca.style.cssText = 'overflow:auto;font-family:ui-monospace,"Cascadia Code","Source Code Pro",Menlo,Consolas,monospace;font-size:13px;line-height:20px;position:relative';

    fl.forEach((line, idx) => {
      const isSel = this.selectedLineIdx === idx;
      const isFoc = this.focusedLineIdx === idx;
      const isHov = this.hoveredLineIdx === idx;

      const row = document.createElement('div'); row.setAttribute('role', 'row'); row.setAttribute('aria-selected', String(isSel));
      if (isFoc) row.setAttribute('aria-current', 'true');
      row.setAttribute('data-line-number', String(line.number)); row.setAttribute('data-coverage', line.coverage ?? 'none');
      row.style.cssText = `display:flex;align-items:stretch;cursor:pointer;background:${isSel ? '#dbeafe' : isFoc ? '#f1f5f9' : isHov ? '#f8fafc' : 'transparent'};outline:${isFoc ? '2px solid #6366f1' : 'none'};outline-offset:-2px`;

      row.addEventListener('click', () => this.selectLine(idx));
      row.addEventListener('mouseenter', () => { this.hoveredLineIdx = idx; this.sm({ type: 'HOVER_LINE', lineIndex: idx }); this.render(); });
      row.addEventListener('mouseleave', () => { this.hoveredLineIdx = null; this.sm({ type: 'LEAVE' }); this.render(); });

      // Coverage gutter
      const gut = document.createElement('div'); gut.setAttribute('data-part', 'coverage-gutter'); gut.setAttribute('data-state', this.state);
      gut.setAttribute('role', 'presentation'); gut.setAttribute('aria-hidden', 'true');
      gut.style.cssText = `width:4px;flex-shrink:0;background:${line.coverage ? (GUTTER_COLORS[line.coverage] ?? 'transparent') : 'transparent'}`;
      row.appendChild(gut);

      // Line number
      if (showLN) {
        const ln = document.createElement('div'); ln.setAttribute('data-part', 'line-numbers'); ln.setAttribute('data-state', this.state); ln.setAttribute('data-visible', 'true');
        ln.setAttribute('role', 'rowheader'); ln.setAttribute('aria-label', `Line ${line.number}`);
        ln.style.cssText = 'width:48px;flex-shrink:0;text-align:right;padding-right:12px;color:#9ca3af;user-select:none';
        ln.textContent = String(line.number); row.appendChild(ln);
      }

      // Source text
      const st = document.createElement('div'); st.setAttribute('data-part', 'source-text'); st.setAttribute('data-state', this.state); st.setAttribute('data-language', language);
      st.style.cssText = 'flex:1;white-space:pre;padding-right:12px;overflow:hidden;text-overflow:ellipsis';
      st.textContent = line.text; row.appendChild(st);

      this.lineRefs.push(row as HTMLDivElement);
      ca.appendChild(row);
    });
    this.el.appendChild(ca);

    // Hover tooltip
    if (this.state === 'lineHovered' && this.hoveredLineIdx !== null) {
      const hl = fl[this.hoveredLineIdx];
      if (hl?.coveredBy) {
        const tt = document.createElement('div'); tt.setAttribute('data-part', 'tooltip'); tt.setAttribute('data-state', this.state); tt.setAttribute('data-visible', 'true');
        tt.setAttribute('role', 'tooltip');
        tt.style.cssText = 'position:absolute;padding:4px 8px;font-size:12px;background:#1f2937;color:#f9fafb;border-radius:4px;pointer-events:none;z-index:10;white-space:nowrap';
        tt.textContent = `Covered by: ${hl.coveredBy}`; this.el.appendChild(tt);
      }
    }

    // Selected line detail
    if (this.selectedLineIdx !== null && fl[this.selectedLineIdx]) {
      const sl = fl[this.selectedLineIdx];
      const ld = document.createElement('div'); ld.setAttribute('data-part', 'line-detail'); ld.setAttribute('data-state', this.state);
      ld.style.cssText = 'padding:8px 12px;border-top:1px solid #e5e7eb;font-size:13px;font-family:system-ui,sans-serif';
      const strong = document.createElement('strong'); strong.textContent = `Line ${sl.number}`; ld.appendChild(strong);
      const covText = sl.coverage ? sl.coverage.charAt(0).toUpperCase() + sl.coverage.slice(1) : 'Not executable';
      ld.appendChild(document.createTextNode(` \u2014 ${covText}`));
      if (sl.coveredBy) { const sp = document.createElement('span'); sp.textContent = ` (covered by: ${sl.coveredBy})`; ld.appendChild(sp); }
      this.el.appendChild(ld);
    }
  }
}

export default CoverageSourceView;
