/* ---------------------------------------------------------------------------
 * GuardStatusPanel — Vanilla widget
 * States: idle (initial), guardSelected
 * ------------------------------------------------------------------------- */

export type GuardStatusPanelState = 'idle' | 'guardSelected';
export type GuardStatusPanelEvent = | { type: 'SELECT_GUARD'; id?: string } | { type: 'GUARD_TRIP' } | { type: 'DESELECT' };

export function guardStatusPanelReducer(state: GuardStatusPanelState, event: GuardStatusPanelEvent): GuardStatusPanelState {
  switch (state) {
    case 'idle': if (event.type === 'SELECT_GUARD') return 'guardSelected'; if (event.type === 'GUARD_TRIP') return 'idle'; return state;
    case 'guardSelected': if (event.type === 'DESELECT') return 'idle'; return state;
    default: return state;
  }
}

export type GuardStatus = 'passing' | 'failing' | 'pending' | 'bypassed';
export interface Guard { id?: string; name: string; description: string; status: GuardStatus; lastChecked?: string; }

const STATUS_ICONS: Record<GuardStatus, string> = { passing: '\u2713', failing: '\u2717', pending: '\u23F3', bypassed: '\u2298' };
const STATUS_LABELS: Record<GuardStatus, string> = { passing: 'Passing', failing: 'Failing', pending: 'Pending', bypassed: 'Bypassed' };

function deriveOverall(guards: Guard[]): string {
  if (!guards.length) return 'all-passing';
  if (guards.some(g => g.status === 'failing')) return 'has-failing';
  if (guards.some(g => g.status === 'pending')) return 'has-pending';
  return 'all-passing';
}

function fmtLC(iso: string): string {
  const d = new Date(iso); if (isNaN(d.getTime())) return iso;
  const ms = Math.abs(Date.now() - d.getTime()); const s = Math.floor(ms / 1000); const m = Math.floor(s / 60); const h = Math.floor(m / 60); const dy = Math.floor(h / 24);
  if (dy > 0) return `${dy}d ago`; if (h > 0) return `${h}h ago`; if (m > 0) return `${m}m ago`; return `${s}s ago`;
}

export interface GuardStatusPanelProps {
  guards: Guard[]; executionStatus: string; showConditions?: boolean;
  onGuardSelect?: (guard: Guard) => void; className?: string; [key: string]: unknown;
}
export interface GuardStatusPanelOptions { target: HTMLElement; props: GuardStatusPanelProps; }
let _uid = 0;

export class GuardStatusPanel {
  private el: HTMLElement;
  private props: GuardStatusPanelProps;
  private state: GuardStatusPanelState = 'idle';
  private uid = ++_uid;
  private disposers: (() => void)[] = [];
  private selectedId: string | null = null;
  private focusIdx = 0;
  private gRefs: HTMLDivElement[] = [];

  constructor(private options: GuardStatusPanelOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', ''); this.el.setAttribute('data-widget-name', 'guard-status-panel');
    this.el.setAttribute('data-part', 'root'); this.el.setAttribute('role', 'region');
    this.el.setAttribute('aria-label', 'Pre-execution guards'); this.el.setAttribute('tabindex', '-1');
    this.el.id = 'guard-status-panel-' + this.uid;
    const onKD = (e: KeyboardEvent) => this.onKey(e);
    this.el.addEventListener('keydown', onKD); this.disposers.push(() => this.el.removeEventListener('keydown', onKD));
    this.render(); options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  private send(ev: GuardStatusPanelEvent): void { this.state = guardStatusPanelReducer(this.state, ev); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<GuardStatusPanelProps>): void { Object.assign(this.props, props); this.render(); }
  destroy(): void { this.disposers.forEach(d => d()); this.el.remove(); }

  private toggle(guard: Guard, idx: number): void {
    const gid = guard.id ?? guard.name;
    if (this.state === 'guardSelected' && this.selectedId === gid) { this.selectedId = null; this.send({ type: 'DESELECT' }); }
    else { this.selectedId = gid; this.focusIdx = idx; this.send({ type: 'SELECT_GUARD', id: gid }); this.props.onGuardSelect?.(guard); }
    this.render();
  }

  private onKey(e: KeyboardEvent): void {
    const gs = this.props.guards; if (!gs.length) return;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); this.focusIdx = Math.min(this.focusIdx + 1, gs.length - 1); this.gRefs[this.focusIdx]?.focus(); break;
      case 'ArrowUp': e.preventDefault(); this.focusIdx = Math.max(this.focusIdx - 1, 0); this.gRefs[this.focusIdx]?.focus(); break;
      case 'Enter': e.preventDefault(); if (gs[this.focusIdx]) this.toggle(gs[this.focusIdx], this.focusIdx); break;
      case 'Escape': e.preventDefault(); if (this.state === 'guardSelected') { this.selectedId = null; this.send({ type: 'DESELECT' }); this.render(); } break;
    }
  }

  private render(): void {
    this.el.innerHTML = ''; this.gRefs = [];
    const p = this.props; const showCond = p.showConditions !== false;
    const overall = deriveOverall(p.guards); const passing = p.guards.filter(g => g.status === 'passing').length;
    const blocking = p.guards.some(g => g.status === 'failing');
    this.el.setAttribute('data-state', this.state); this.el.setAttribute('data-overall-status', overall);
    this.el.setAttribute('data-execution-status', p.executionStatus);
    if (p.className) this.el.className = p.className;

    const hd = document.createElement('div'); hd.setAttribute('data-part', 'header'); hd.setAttribute('data-state', this.state); hd.setAttribute('data-overall-status', overall);
    const h3 = document.createElement('h3'); h3.setAttribute('data-part', 'heading'); h3.textContent = 'Pre-execution Guards'; hd.appendChild(h3);
    const sm = document.createElement('span'); sm.setAttribute('data-part', 'summary'); sm.setAttribute('aria-live', 'polite'); sm.textContent = `${passing} of ${p.guards.length} guards passing`; hd.appendChild(sm);
    this.el.appendChild(hd);

    if (blocking) { const bb = document.createElement('div'); bb.setAttribute('data-part', 'blocking-banner'); bb.setAttribute('data-visible', 'true'); bb.setAttribute('role', 'alert'); bb.textContent = 'Execution is blocked by failing guards'; this.el.appendChild(bb); }

    const gl = document.createElement('div'); gl.setAttribute('data-part', 'guard-list'); gl.setAttribute('role', 'list');
    p.guards.forEach((g, i) => {
      const gid = g.id ?? g.name; const isSel = this.state === 'guardSelected' && this.selectedId === gid;
      const gi = document.createElement('div');
      gi.setAttribute('data-part', 'guard-item'); gi.setAttribute('data-status', g.status); gi.setAttribute('data-selected', isSel ? 'true' : 'false');
      gi.setAttribute('role', 'listitem'); gi.setAttribute('aria-label', `${g.name} \u2014 ${STATUS_LABELS[g.status]}`);
      gi.setAttribute('aria-expanded', String(isSel)); gi.tabIndex = this.focusIdx === i ? 0 : -1;
      gi.addEventListener('click', () => this.toggle(g, i));
      gi.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); this.toggle(g, i); } });
      this.gRefs.push(gi);

      const ic = document.createElement('span'); ic.setAttribute('data-part', 'guard-icon'); ic.setAttribute('data-status', g.status); ic.setAttribute('aria-hidden', 'true'); ic.textContent = STATUS_ICONS[g.status]; gi.appendChild(ic);
      const nm = document.createElement('span'); nm.setAttribute('data-part', 'guard-name'); nm.textContent = g.name; gi.appendChild(nm);
      if (showCond) { const cd = document.createElement('span'); cd.setAttribute('data-part', 'guard-condition'); cd.setAttribute('data-visible', 'true'); cd.textContent = g.description; gi.appendChild(cd); }
      const st = document.createElement('span'); st.setAttribute('data-part', 'guard-status'); st.setAttribute('data-status', g.status); st.textContent = STATUS_LABELS[g.status]; gi.appendChild(st);

      if (isSel) {
        const det = document.createElement('div'); det.setAttribute('data-part', 'guard-detail'); det.setAttribute('data-status', g.status);
        const dp = document.createElement('p'); dp.setAttribute('data-part', 'guard-detail-description'); dp.textContent = g.description; det.appendChild(dp);
        if (g.lastChecked) { const lc = document.createElement('span'); lc.setAttribute('data-part', 'guard-last-checked'); lc.textContent = `Last checked: ${fmtLC(g.lastChecked)}`; det.appendChild(lc); }
        gi.appendChild(det);
      }
      gl.appendChild(gi);
    });
    this.el.appendChild(gl);
  }
}

export default GuardStatusPanel;
