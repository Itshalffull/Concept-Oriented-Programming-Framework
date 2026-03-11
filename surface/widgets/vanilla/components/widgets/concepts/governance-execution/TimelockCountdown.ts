/* ---------------------------------------------------------------------------
 * TimelockCountdown — Vanilla widget
 * States: running, warning, critical, expired, executing, completed, paused
 * ------------------------------------------------------------------------- */

export type TimelockCountdownState = 'running' | 'warning' | 'critical' | 'expired' | 'executing' | 'completed' | 'paused';
export type TimelockCountdownEvent =
  | { type: 'TICK' } | { type: 'WARNING_THRESHOLD' } | { type: 'EXPIRE' } | { type: 'PAUSE' }
  | { type: 'CRITICAL_THRESHOLD' } | { type: 'EXECUTE' } | { type: 'RESET' }
  | { type: 'EXECUTE_COMPLETE' } | { type: 'EXECUTE_ERROR' } | { type: 'RESUME' } | { type: 'CHALLENGE' };

export function timelockCountdownReducer(state: TimelockCountdownState, event: TimelockCountdownEvent): TimelockCountdownState {
  switch (state) {
    case 'running': if (event.type === 'TICK') return 'running'; if (event.type === 'WARNING_THRESHOLD') return 'warning'; if (event.type === 'EXPIRE') return 'expired'; if (event.type === 'PAUSE') return 'paused'; return state;
    case 'warning': if (event.type === 'TICK') return 'warning'; if (event.type === 'CRITICAL_THRESHOLD') return 'critical'; if (event.type === 'EXPIRE') return 'expired'; return state;
    case 'critical': if (event.type === 'TICK') return 'critical'; if (event.type === 'EXPIRE') return 'expired'; return state;
    case 'expired': if (event.type === 'EXECUTE') return 'executing'; if (event.type === 'RESET') return 'running'; return state;
    case 'executing': if (event.type === 'EXECUTE_COMPLETE') return 'completed'; if (event.type === 'EXECUTE_ERROR') return 'expired'; return state;
    case 'completed': return state;
    case 'paused': if (event.type === 'RESUME') return 'running'; return state;
    default: return state;
  }
}

interface TR { days: number; hours: number; minutes: number; seconds: number; totalMs: number; }
function compTR(dl: Date): TR { const ms = Math.max(0, dl.getTime() - Date.now()); const ts = Math.floor(ms / 1000); return { days: Math.floor(ts / 86400), hours: Math.floor((ts % 86400) / 3600), minutes: Math.floor((ts % 3600) / 60), seconds: ts % 60, totalMs: ms }; }
function fmtTR(tr: TR): string { if (tr.totalMs <= 0) return '0s'; const p: string[] = []; if (tr.days > 0) p.push(`${tr.days}d`); if (tr.hours > 0) p.push(`${tr.hours}h`); if (tr.minutes > 0) p.push(`${tr.minutes}m`); p.push(`${tr.seconds}s`); return p.join(' '); }

export interface TimelockCountdownProps {
  phase: string; deadline: string; elapsed: number; total: number;
  showChallenge?: boolean; warningThreshold?: number; criticalThreshold?: number;
  variant?: 'phase-based' | 'simple'; onExecute?: () => void; onChallenge?: () => void;
  className?: string; [key: string]: unknown;
}
export interface TimelockCountdownOptions { target: HTMLElement; props: TimelockCountdownProps; }
let _uid = 0;

export class TimelockCountdown {
  private el: HTMLElement;
  private props: TimelockCountdownProps;
  private state: TimelockCountdownState = 'running';
  private uid = ++_uid;
  private disposers: (() => void)[] = [];
  private intId: ReturnType<typeof setInterval> | null = null;
  private tr: TR;

  constructor(private options: TimelockCountdownOptions) {
    this.props = { ...options.props };
    this.tr = compTR(new Date(this.props.deadline));
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', ''); this.el.setAttribute('data-widget-name', 'timelock-countdown');
    this.el.setAttribute('data-part', 'root'); this.el.setAttribute('role', 'timer');
    this.el.setAttribute('aria-live', 'polite'); this.el.setAttribute('tabindex', '0');
    this.el.id = 'timelock-countdown-' + this.uid;
    const kd = (e: KeyboardEvent) => this.onKey(e);
    this.el.addEventListener('keydown', kd); this.disposers.push(() => this.el.removeEventListener('keydown', kd));
    if (new Date(this.props.deadline).getTime() <= Date.now()) this.sm({ type: 'EXPIRE' });
    this.startTick();
    this.render(); options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  private sm(ev: TimelockCountdownEvent): void { this.state = timelockCountdownReducer(this.state, ev); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<TimelockCountdownProps>): void { Object.assign(this.props, props); this.startTick(); this.render(); }
  destroy(): void { this.stopTick(); this.disposers.forEach(d => d()); this.el.remove(); }

  private stopTick(): void { if (this.intId !== null) { clearInterval(this.intId); this.intId = null; } }
  private startTick(): void {
    this.stopTick();
    if (!['running', 'warning', 'critical'].includes(this.state)) return;
    const tick = () => {
      this.tr = compTR(new Date(this.props.deadline));
      if (this.tr.totalMs <= 0) { this.sm({ type: 'EXPIRE' }); this.stopTick(); this.render(); return; }
      const prog = this.props.total > 0 ? Math.min(1, this.props.elapsed / this.props.total) : 0;
      if (this.state === 'running' && prog >= (this.props.warningThreshold ?? 0.8)) this.sm({ type: 'WARNING_THRESHOLD' });
      else if (this.state === 'warning' && prog >= (this.props.criticalThreshold ?? 0.95)) this.sm({ type: 'CRITICAL_THRESHOLD' });
      else this.sm({ type: 'TICK' });
      this.render();
    };
    tick();
    this.intId = setInterval(tick, 1000);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') { e.preventDefault(); if (this.state === 'expired') { this.sm({ type: 'EXECUTE' }); this.props.onExecute?.(); this.render(); } }
    if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); if (!['expired', 'completed', 'executing'].includes(this.state)) this.props.onChallenge?.(); }
  }

  private get phase(): string {
    switch (this.state) { case 'expired': return 'Ready to execute'; case 'executing': return 'Executing...'; case 'completed': return 'Execution complete'; case 'paused': return `${this.props.phase} (paused)`; default: return this.props.phase; }
  }

  private render(): void {
    this.el.innerHTML = '';
    const p = this.props;
    const prog = p.total > 0 ? Math.min(1, Math.max(0, p.elapsed / p.total)) : 0;
    const pct = Math.round(prog * 100);
    const ct = fmtTR(this.tr);
    this.el.setAttribute('data-state', this.state); this.el.setAttribute('data-variant', p.variant ?? 'phase-based');
    this.el.setAttribute('aria-label', `${this.phase}: ${ct}`);
    if (p.className) this.el.className = p.className;

    const pl = document.createElement('span'); pl.setAttribute('data-part', 'phase-label'); pl.setAttribute('data-state', this.state); pl.textContent = this.phase; this.el.appendChild(pl);
    const ctt = document.createElement('span'); ctt.setAttribute('data-part', 'countdown-text'); ctt.setAttribute('data-state', this.state); ctt.setAttribute('data-urgency', this.state); ctt.setAttribute('aria-atomic', 'true'); ctt.textContent = this.state === 'completed' ? 'Done' : ct; this.el.appendChild(ctt);
    const td = document.createElement('span'); td.setAttribute('data-part', 'target-date'); td.setAttribute('data-state', this.state);
    try { td.textContent = new Date(p.deadline).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' } as any); } catch { td.textContent = p.deadline; }
    this.el.appendChild(td);

    const pb = document.createElement('div'); pb.setAttribute('data-part', 'progress-bar'); pb.setAttribute('data-state', this.state); pb.setAttribute('data-progress', String(prog));
    pb.setAttribute('role', 'progressbar'); pb.setAttribute('aria-valuenow', String(pct)); pb.setAttribute('aria-valuemin', '0'); pb.setAttribute('aria-valuemax', '100'); pb.setAttribute('aria-label', `Timelock progress: ${pct}%`);
    const pf = document.createElement('div'); pf.setAttribute('data-part', 'progress-fill'); pf.style.cssText = `width:${pct}%;height:100%;transition:width 0.3s ease`; pb.appendChild(pf); this.el.appendChild(pb);

    const eb = document.createElement('button'); eb.type = 'button'; eb.setAttribute('data-part', 'execute-button'); eb.setAttribute('data-state', this.state);
    eb.setAttribute('aria-label', 'Execute proposal'); const ed = this.state !== 'expired'; eb.setAttribute('aria-disabled', String(ed)); eb.disabled = ed; eb.tabIndex = 0;
    eb.textContent = this.state === 'executing' ? 'Executing...' : 'Execute';
    eb.addEventListener('click', () => { if (this.state === 'expired') { this.sm({ type: 'EXECUTE' }); this.props.onExecute?.(); this.render(); } }); this.el.appendChild(eb);

    if (p.showChallenge !== false) {
      const cd = ['expired', 'completed', 'executing'].includes(this.state);
      const cb = document.createElement('button'); cb.type = 'button'; cb.setAttribute('data-part', 'challenge-button'); cb.setAttribute('data-state', this.state); cb.setAttribute('data-visible', 'true');
      cb.setAttribute('aria-label', 'Challenge execution'); cb.setAttribute('aria-disabled', String(cd)); cb.disabled = cd; cb.tabIndex = 0; cb.textContent = 'Challenge';
      cb.addEventListener('click', () => { if (!cd) this.props.onChallenge?.(); }); this.el.appendChild(cb);
    }
  }
}

export default TimelockCountdown;
