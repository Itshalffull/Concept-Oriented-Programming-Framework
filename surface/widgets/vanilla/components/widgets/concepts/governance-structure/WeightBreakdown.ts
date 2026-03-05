/* ---------------------------------------------------------------------------
 * WeightBreakdown — Vanilla widget
 * States: idle (initial), segmentHovered
 * ------------------------------------------------------------------------- */

export type WeightBreakdownState = 'idle' | 'segmentHovered';
export type WeightBreakdownEvent = | { type: 'HOVER_SEGMENT'; source: string } | { type: 'LEAVE' };

export function weightBreakdownReducer(state: WeightBreakdownState, event: WeightBreakdownEvent): WeightBreakdownState {
  switch (state) { case 'idle': if (event.type === 'HOVER_SEGMENT') return 'segmentHovered'; return state; case 'segmentHovered': if (event.type === 'LEAVE') return 'idle'; return state; default: return state; }
}

export type WeightSourceType = 'token' | 'delegation' | 'reputation' | 'manual';
export interface WeightSource { label: string; weight: number; type: WeightSourceType; }

const SRC_COLORS: Record<WeightSourceType, string> = { token: 'var(--weight-token, #3b82f6)', delegation: 'var(--weight-delegation, #8b5cf6)', reputation: 'var(--weight-reputation, #10b981)', manual: 'var(--weight-manual, #f59e0b)' };

function fmtW(v: number): string { return Number(v.toFixed(2)).toString(); }
function prepSegs(sources: WeightSource[], total: number) { return [...sources].sort((a, b) => b.weight - a.weight).map(s => ({ ...s, percent: total > 0 ? (s.weight / total) * 100 : 0 })); }

export interface WeightBreakdownProps {
  sources: WeightSource[]; totalWeight: number; participant: string;
  variant?: 'bar' | 'donut'; showLegend?: boolean; showTotal?: boolean;
  className?: string; [key: string]: unknown;
}
export interface WeightBreakdownOptions { target: HTMLElement; props: WeightBreakdownProps; }
let _uid = 0;

export class WeightBreakdown {
  private el: HTMLElement;
  private props: WeightBreakdownProps;
  private state: WeightBreakdownState = 'idle';
  private uid = ++_uid;
  private disposers: (() => void)[] = [];
  private hovered: string | null = null;
  private focusedIdx = -1;

  constructor(private options: WeightBreakdownOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', ''); this.el.setAttribute('data-widget-name', 'weight-breakdown');
    this.el.setAttribute('data-part', 'root'); this.el.setAttribute('role', 'img');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'weight-breakdown-' + this.uid;
    const kd = (e: KeyboardEvent) => this.onKey(e);
    this.el.addEventListener('keydown', kd); this.disposers.push(() => this.el.removeEventListener('keydown', kd));
    this.render(); options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  private sm(ev: WeightBreakdownEvent): void { this.state = weightBreakdownReducer(this.state, ev); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<WeightBreakdownProps>): void { Object.assign(this.props, props); this.render(); }
  destroy(): void { this.disposers.forEach(d => d()); this.el.remove(); }

  private onKey(e: KeyboardEvent): void {
    const segs = prepSegs(this.props.sources, this.props.totalWeight); if (!segs.length) return;
    let next = this.focusedIdx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); next = this.focusedIdx < segs.length - 1 ? this.focusedIdx + 1 : 0; }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); next = this.focusedIdx > 0 ? this.focusedIdx - 1 : segs.length - 1; }
    if (next !== this.focusedIdx) { this.focusedIdx = next; this.hovered = segs[next].label; this.sm({ type: 'HOVER_SEGMENT', source: segs[next].label }); this.render(); }
  }

  private render(): void {
    this.el.innerHTML = '';
    const p = this.props; const variant = p.variant ?? 'bar'; const showLeg = p.showLegend !== false; const showTot = p.showTotal !== false;
    const segs = prepSegs(p.sources, p.totalWeight);
    this.el.setAttribute('data-state', this.state); this.el.setAttribute('data-variant', variant);
    this.el.setAttribute('aria-label', `Weight breakdown for ${p.participant}: ${fmtW(p.totalWeight)} total`);
    if (p.className) this.el.className = p.className;

    if (showTot) { const t = document.createElement('span'); t.setAttribute('data-part', 'total'); t.setAttribute('data-visible', 'true'); t.setAttribute('aria-label', `Total weight: ${fmtW(p.totalWeight)}`); t.textContent = fmtW(p.totalWeight); this.el.appendChild(t); }

    const chart = document.createElement('div'); chart.setAttribute('data-part', 'chart');
    if (variant === 'bar') {
      segs.forEach((seg, i) => {
        const d = document.createElement('div'); d.setAttribute('data-part', 'segment'); d.setAttribute('data-source', seg.type);
        d.setAttribute('data-highlighted', this.hovered === seg.label ? 'true' : 'false');
        d.setAttribute('role', 'img'); d.setAttribute('aria-label', `${seg.label}: ${fmtW(seg.weight)} (${fmtW(seg.percent)}%)`);
        d.tabIndex = -1;
        d.style.cssText = `width:${seg.percent}%;background-color:${SRC_COLORS[seg.type]};display:inline-block;height:100%;opacity:${this.hovered && this.hovered !== seg.label ? '0.5' : '1'};transition:opacity 150ms ease`;
        d.addEventListener('mouseenter', () => { this.hovered = seg.label; this.sm({ type: 'HOVER_SEGMENT', source: seg.label }); this.render(); });
        d.addEventListener('mouseleave', () => { this.hovered = null; this.sm({ type: 'LEAVE' }); this.render(); });
        chart.appendChild(d);
      });
    } else {
      // Donut as SVG
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('role', 'presentation'); svg.style.cssText = 'width:100%;height:100%';
      let cumAngle = -90;
      segs.forEach(seg => {
        const angle = (seg.percent / 100) * 360;
        const startA = cumAngle; const endA = cumAngle + angle; cumAngle = endA;
        const r = 40; const cx = 50; const cy = 50;
        const sr = (startA * Math.PI) / 180; const er = (endA * Math.PI) / 180;
        const la = angle > 180 ? 1 : 0;
        const x1 = cx + r * Math.cos(sr); const y1 = cy + r * Math.sin(sr);
        const x2 = cx + r * Math.cos(er); const y2 = cy + r * Math.sin(er);
        const d = angle >= 360 ? `M ${cx - r},${cy} A ${r},${r} 0 1,1 ${cx + r},${cy} A ${r},${r} 0 1,1 ${cx - r},${cy}` : `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${la},1 ${x2},${y2} Z`;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d); path.setAttribute('fill', SRC_COLORS[seg.type]);
        path.setAttribute('data-part', 'segment'); path.setAttribute('data-source', seg.type);
        path.setAttribute('opacity', this.hovered && this.hovered !== seg.label ? '0.5' : '1');
        path.style.cssText = 'transition:opacity 150ms ease;cursor:pointer';
        path.addEventListener('mouseenter', () => { this.hovered = seg.label; this.sm({ type: 'HOVER_SEGMENT', source: seg.label }); this.render(); });
        path.addEventListener('mouseleave', () => { this.hovered = null; this.sm({ type: 'LEAVE' }); this.render(); });
        svg.appendChild(path);
      });
      if (showTot) {
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', '50'); txt.setAttribute('y', '50'); txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('dominant-baseline', 'central');
        txt.setAttribute('data-part', 'donut-center'); txt.style.cssText = 'font-size:8px;font-weight:bold';
        txt.textContent = fmtW(p.totalWeight); svg.appendChild(txt);
      }
      chart.appendChild(svg);
    }
    this.el.appendChild(chart);

    if (showLeg) {
      const leg = document.createElement('div'); leg.setAttribute('data-part', 'legend'); leg.setAttribute('data-visible', 'true');
      segs.forEach(seg => {
        const li = document.createElement('div'); li.setAttribute('data-part', 'legend-item'); li.setAttribute('data-source', seg.type);
        li.setAttribute('aria-label', `${seg.label}: ${fmtW(seg.percent)}%`);
        const sw = document.createElement('span'); sw.setAttribute('data-part', 'legend-swatch'); sw.setAttribute('aria-hidden', 'true');
        sw.style.cssText = `display:inline-block;width:12px;height:12px;border-radius:2px;background-color:${SRC_COLORS[seg.type]};margin-right:4px`;
        li.appendChild(sw);
        const lb = document.createElement('span'); lb.setAttribute('data-part', 'legend-label'); lb.textContent = seg.label; li.appendChild(lb);
        const pc = document.createElement('span'); pc.setAttribute('data-part', 'legend-percent'); pc.textContent = ` ${fmtW(seg.percent)}%`; li.appendChild(pc);
        const vl = document.createElement('span'); vl.setAttribute('data-part', 'legend-value'); vl.textContent = ` (${fmtW(seg.weight)})`; li.appendChild(vl);
        leg.appendChild(li);
      });
      this.el.appendChild(leg);
    }

    // Tooltip
    const tt = document.createElement('div'); tt.setAttribute('data-part', 'tooltip'); tt.setAttribute('role', 'tooltip');
    tt.setAttribute('data-visible', this.state === 'segmentHovered' ? 'true' : 'false');
    tt.setAttribute('aria-hidden', this.state !== 'segmentHovered' ? 'true' : 'false');
    tt.style.cssText = `visibility:${this.state === 'segmentHovered' ? 'visible' : 'hidden'};position:absolute`;
    if (this.hovered) {
      const seg = segs.find(s => s.label === this.hovered);
      if (seg) {
        const addS = (part: string, text: string) => { const s = document.createElement('span'); s.setAttribute('data-part', part); s.textContent = text; tt.appendChild(s); };
        addS('tooltip-label', seg.label); addS('tooltip-type', seg.type); addS('tooltip-value', fmtW(seg.weight)); addS('tooltip-percent', `${fmtW(seg.percent)}%`);
      }
    }
    this.el.appendChild(tt);
  }
}

export default WeightBreakdown;
