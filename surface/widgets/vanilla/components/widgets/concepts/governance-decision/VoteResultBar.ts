/* ---------------------------------------------------------------------------
 * VoteResultBar — Vanilla widget
 * States: idle (initial), animating, segmentHovered
 * ------------------------------------------------------------------------- */

export type VoteResultBarState = 'idle' | 'animating' | 'segmentHovered';
export type VoteResultBarEvent =
  | { type: 'HOVER_SEGMENT'; index: number } | { type: 'ANIMATE_IN' }
  | { type: 'ANIMATION_END' } | { type: 'UNHOVER' };

export function voteResultBarReducer(state: VoteResultBarState, event: VoteResultBarEvent): VoteResultBarState {
  switch (state) {
    case 'idle': if (event.type === 'HOVER_SEGMENT') return 'segmentHovered'; if (event.type === 'ANIMATE_IN') return 'animating'; return state;
    case 'animating': if (event.type === 'ANIMATION_END') return 'idle'; return state;
    case 'segmentHovered': if (event.type === 'UNHOVER') return 'idle'; if (event.type === 'HOVER_SEGMENT') return 'segmentHovered'; return state;
    default: return state;
  }
}

export interface VoteSegment { label: string; count: number; color?: string; }

const DEFAULT_COLORS = ['#4caf50','#f44336','#ff9800','#2196f3','#9c27b0','#00bcd4','#795548','#607d8b'];
function toPercent(c: number, t: number) { return t <= 0 ? 0 : Math.min(100, Math.max(0, (c / t) * 100)); }
function fmtPct(v: number) { const f = v.toFixed(1); return f.endsWith('.0') ? f.slice(0, -2) : f; }
const SIZE_MAP: Record<string, number> = { sm: 16, md: 24, lg: 36 };

export interface VoteResultBarProps {
  segments: VoteSegment[]; total?: number; variant?: 'binary' | 'multi' | 'weighted';
  showLabels?: boolean; showQuorum?: boolean; quorumThreshold?: number;
  animate?: boolean; size?: 'sm' | 'md' | 'lg';
  onSegmentHover?: (index: number | null, segment: VoteSegment | null) => void;
  className?: string; [key: string]: unknown;
}

export interface VoteResultBarOptions { target: HTMLElement; props: VoteResultBarProps; }
let _voteResultBarUid = 0;

export class VoteResultBar {
  private el: HTMLElement;
  private props: VoteResultBarProps;
  private state: VoteResultBarState = 'idle';
  private uid = ++_voteResultBarUid;
  private disposers: (() => void)[] = [];
  private hoveredIndex: number | null = null;
  private animated = false;

  constructor(private options: VoteResultBarOptions) {
    this.props = { ...options.props };
    this.animated = !(this.props.animate !== false);
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'vote-result-bar');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'img');
    this.el.setAttribute('aria-label', 'Vote results');
    this.el.setAttribute('aria-roledescription', 'vote result bar');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'vote-result-bar-' + this.uid;
    this.el.style.position = 'relative';

    const onKD = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.el.addEventListener('keydown', onKD);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKD));

    this.render();
    options.target.appendChild(this.el);

    // Animate in
    if (this.props.animate !== false) {
      const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReduced) {
        this.state = voteResultBarReducer(this.state, { type: 'ANIMATE_IN' });
        requestAnimationFrame(() => {
          this.animated = true;
          this.render();
          const t = setTimeout(() => { this.state = voteResultBarReducer(this.state, { type: 'ANIMATION_END' }); this.el.setAttribute('data-state', this.state); }, 400);
          this.disposers.push(() => clearTimeout(t));
        });
      } else { this.animated = true; this.render(); }
    } else { this.animated = true; this.render(); }
  }

  getElement(): HTMLElement { return this.el; }

  private send(event: VoteResultBarEvent): void {
    this.state = voteResultBarReducer(this.state, event);
    this.el.setAttribute('data-state', this.state);
  }

  update(props: Partial<VoteResultBarProps>): void { Object.assign(this.props, props); this.render(); }
  destroy(): void { this.disposers.forEach(d => d()); this.el.remove(); }

  private get total(): number {
    const tp = this.props.total;
    if (tp != null && tp > 0) return tp;
    return this.props.segments.reduce((s, seg) => s + seg.count, 0);
  }

  private get computed() {
    return this.props.segments.map((seg, i) => ({
      ...seg, percent: toPercent(seg.count, this.total),
      resolvedColor: seg.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    }));
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const segs = this.props.segments;
    if (!segs.length) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); const n = this.hoveredIndex !== null ? (this.hoveredIndex < segs.length - 1 ? this.hoveredIndex + 1 : 0) : 0; this.hoverSeg(n); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); const p = this.hoveredIndex !== null ? (this.hoveredIndex > 0 ? this.hoveredIndex - 1 : segs.length - 1) : segs.length - 1; this.hoverSeg(p); }
    else if (e.key === 'Escape') { this.hoveredIndex = null; this.send({ type: 'UNHOVER' }); this.props.onSegmentHover?.(null, null); this.render(); }
  }

  private hoverSeg(i: number): void {
    this.hoveredIndex = i;
    this.send({ type: 'HOVER_SEGMENT', index: i });
    this.props.onSegmentHover?.(i, this.props.segments[i] ?? null);
    this.render();
  }

  private render(): void {
    this.el.innerHTML = '';
    const p = this.props;
    const variant = p.variant ?? 'binary';
    const showLabels = p.showLabels !== false;
    const showQuorum = p.showQuorum ?? false;
    const quorumThreshold = p.quorumThreshold ?? 0;
    const size = p.size ?? 'md';
    const barHeight = SIZE_MAP[size] ?? SIZE_MAP.md;
    const segs = this.computed;

    this.el.setAttribute('data-state', this.state);
    this.el.setAttribute('data-variant', variant);
    this.el.setAttribute('data-size', size);
    this.el.setAttribute('aria-description', `Vote results: ${segs.map(s => `${s.label}: ${s.count} votes (${fmtPct(s.percent)}%)`).join(', ')}. Total: ${this.total} votes.`);
    if (p.className) this.el.className = p.className;

    // Bar
    const bar = document.createElement('div');
    bar.setAttribute('data-part', 'bar'); bar.setAttribute('data-state', this.state); bar.setAttribute('data-total', String(this.total));
    bar.style.cssText = `display:flex;width:100%;height:${barHeight}px;border-radius:4px;overflow:hidden;position:relative;background-color:#e0e0e0`;

    segs.forEach((seg, i) => {
      const isHov = this.hoveredIndex === i;
      const wp = this.animated ? seg.percent : 0;
      const minW = seg.count === 0 && this.total > 0 ? '2px' : undefined;
      const sd = document.createElement('div');
      sd.setAttribute('data-part', 'segment'); sd.setAttribute('data-state', this.state); sd.setAttribute('data-choice', seg.label);
      sd.setAttribute('data-percent', fmtPct(seg.percent)); sd.setAttribute('data-color', seg.resolvedColor);
      if (isHov) sd.setAttribute('data-hovered', 'true');
      sd.setAttribute('role', 'img'); sd.setAttribute('aria-label', `${seg.label}: ${seg.count} votes (${fmtPct(seg.percent)}%)`);
      sd.tabIndex = -1;
      sd.style.cssText = `width:${minW ?? `${wp}%`};${minW ? `min-width:${minW};` : ''}background-color:${seg.resolvedColor};transition:${p.animate !== false ? 'width 0.4s ease-out, opacity 0.2s ease' : 'none'};opacity:${this.hoveredIndex !== null && !isHov ? '0.5' : '1'};position:relative;cursor:pointer`;
      sd.addEventListener('mouseenter', () => this.hoverSeg(i));
      sd.addEventListener('mouseleave', () => { this.hoveredIndex = null; this.send({ type: 'UNHOVER' }); this.props.onSegmentHover?.(null, null); this.render(); });
      if (isHov) {
        const tt = document.createElement('div'); tt.setAttribute('role', 'tooltip');
        tt.style.cssText = 'position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:4px;padding:4px 8px;background-color:rgba(0,0,0,0.85);color:#fff;font-size:12px;border-radius:4px;white-space:nowrap;pointer-events:none;z-index:10';
        tt.textContent = `${seg.label}: ${seg.count} votes (${fmtPct(seg.percent)}%)`; sd.appendChild(tt);
      }
      bar.appendChild(sd);
    });

    if (showQuorum && quorumThreshold > 0) {
      const qm = document.createElement('div'); qm.setAttribute('data-part', 'quorum-marker'); qm.setAttribute('data-state', this.state); qm.setAttribute('data-visible', 'true');
      qm.setAttribute('role', 'img'); qm.setAttribute('aria-label', `Quorum threshold at ${quorumThreshold}%`);
      qm.style.cssText = `position:absolute;left:${quorumThreshold}%;top:0;bottom:0;width:2px;background-color:#000;z-index:5;pointer-events:none`;
      bar.appendChild(qm);
    }
    this.el.appendChild(bar);

    // Labels
    if (showLabels) {
      const lc = document.createElement('div');
      lc.style.cssText = 'display:flex;justify-content:space-between;margin-top:4px;flex-wrap:wrap;gap:4px 12px';
      segs.forEach(seg => {
        const sp = document.createElement('span'); sp.setAttribute('data-part', 'segment-label'); sp.setAttribute('data-state', this.state); sp.setAttribute('data-visible', 'true');
        sp.style.cssText = `font-size:${size === 'sm' ? '11px' : size === 'lg' ? '14px' : '12px'};color:#555;display:inline-flex;align-items:center;gap:4px`;
        const dot = document.createElement('span'); dot.setAttribute('aria-hidden', 'true');
        dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${seg.resolvedColor}`;
        sp.appendChild(dot);
        sp.appendChild(document.createTextNode(` ${seg.label} ${seg.count} (${fmtPct(seg.percent)}%)`));
        lc.appendChild(sp);
      });
      this.el.appendChild(lc);
    }

    // Total
    const tl = document.createElement('span'); tl.setAttribute('data-part', 'total-label'); tl.setAttribute('data-state', this.state);
    tl.setAttribute('aria-label', `Total votes: ${this.total}`);
    tl.style.cssText = `display:block;margin-top:4px;font-size:${size === 'sm' ? '11px' : size === 'lg' ? '14px' : '12px'};color:#777`;
    tl.textContent = `Total: ${this.total}`; this.el.appendChild(tl);
  }
}

export default VoteResultBar;
