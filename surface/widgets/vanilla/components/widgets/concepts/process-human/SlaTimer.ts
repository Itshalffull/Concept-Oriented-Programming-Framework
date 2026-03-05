/* ---------------------------------------------------------------------------
 * SlaTimer — Vanilla implementation
 *
 * Five-state countdown timer for SLA tracking with color-coded urgency
 * phases, progress bar, elapsed time display, and pause/resume control.
 * ------------------------------------------------------------------------- */

export type SlaTimerState = 'onTrack' | 'warning' | 'critical' | 'breached' | 'paused';
export type SlaTimerEvent =
  | { type: 'TICK' }
  | { type: 'WARNING_THRESHOLD' }
  | { type: 'PAUSE' }
  | { type: 'CRITICAL_THRESHOLD' }
  | { type: 'BREACH' }
  | { type: 'RESUME' };

export function slaTimerReducer(state: SlaTimerState, event: SlaTimerEvent): SlaTimerState {
  switch (state) {
    case 'onTrack':
      if (event.type === 'TICK') return 'onTrack';
      if (event.type === 'WARNING_THRESHOLD') return 'warning';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'warning':
      if (event.type === 'TICK') return 'warning';
      if (event.type === 'CRITICAL_THRESHOLD') return 'critical';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'critical':
      if (event.type === 'TICK') return 'critical';
      if (event.type === 'BREACH') return 'breached';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'breached':
      if (event.type === 'TICK') return 'breached';
      return state;
    case 'paused':
      if (event.type === 'RESUME') return 'onTrack';
      return state;
    default:
      return state;
  }
}

export interface SlaTimerProps {
  [key: string]: unknown; className?: string;
  dueAt?: string;
  status?: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  showElapsed?: boolean;
  startedAt?: string;
  onBreach?: () => void;
  onWarning?: () => void;
  onCritical?: () => void;
}
export interface SlaTimerOptions { target: HTMLElement; props: SlaTimerProps; }

let _slaTimerUid = 0;

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatElapsed(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

const PHASE_LABELS: Record<SlaTimerState, string> = {
  onTrack: 'On Track', warning: 'Warning', critical: 'Critical', breached: 'Breached', paused: 'Paused',
};

export class SlaTimer {
  private el: HTMLElement;
  private props: SlaTimerProps;
  private state: SlaTimerState = 'onTrack';
  private disposers: Array<() => void> = [];
  private remaining = 0;
  private elapsed = 0;
  private progress = 0;
  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private breached = false;
  private warningFired = false;
  private criticalFired = false;

  constructor(options: SlaTimerOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'sla-timer');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'timer');
    this.el.setAttribute('aria-live', 'polite');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'sla-timer-' + (++_slaTimerUid);
    this.startTimer();
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  send(type: string): void { this.state = slaTimerReducer(this.state, { type } as any); this.el.setAttribute('data-state', this.state); }

  update(props: Partial<SlaTimerProps>): void {
    Object.assign(this.props, props);
    this.stopTimer();
    this.startTimer();
    this.cleanupRender();
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void { this.stopTimer(); this.cleanup(); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private cleanupRender(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private rerender(): void { this.cleanupRender(); this.el.innerHTML = ''; this.render(); }

  private get dueTime(): number { return new Date((this.props.dueAt as string) ?? '').getTime(); }
  private get startTime(): number { return this.props.startedAt ? new Date(this.props.startedAt as string).getTime() : Date.now(); }
  private get totalDuration(): number { return this.dueTime - this.startTime; }
  private get warningThreshold(): number { return (this.props.warningThreshold as number) ?? 0.7; }
  private get criticalThreshold(): number { return (this.props.criticalThreshold as number) ?? 0.9; }

  private startTimer(): void {
    if (this.state === 'paused') return;
    const tick = () => {
      const now = Date.now();
      this.remaining = Math.max(0, this.dueTime - now);
      this.elapsed = now - this.startTime;
      this.progress = this.totalDuration > 0 ? Math.min(1, this.elapsed / this.totalDuration) : 1;
      this.send('TICK');

      if (this.remaining <= 0 && !this.breached) {
        this.breached = true;
        this.send('BREACH');
        this.props.onBreach?.();
      } else if (this.progress >= this.criticalThreshold && !this.criticalFired && this.remaining > 0) {
        this.criticalFired = true;
        this.send('CRITICAL_THRESHOLD');
        this.props.onCritical?.();
      } else if (this.progress >= this.warningThreshold && !this.warningFired && this.remaining > 0) {
        this.warningFired = true;
        this.send('WARNING_THRESHOLD');
        this.props.onWarning?.();
      }

      this.updateDisplay();
    };
    tick();
    this.timerHandle = setInterval(tick, 1000);
  }

  private stopTimer(): void { if (this.timerHandle) { clearInterval(this.timerHandle); this.timerHandle = null; } }

  private updateDisplay(): void {
    const countdown = this.el.querySelector('[data-part="countdown"]');
    if (countdown) {
      countdown.textContent = this.state === 'breached' ? 'BREACHED' : formatCountdown(this.remaining);
      countdown.setAttribute('aria-label', `Time remaining: ${formatCountdown(this.remaining)}`);
    }
    const phase = this.el.querySelector('[data-part="phase"]');
    if (phase) { phase.textContent = PHASE_LABELS[this.state]; phase.setAttribute('data-phase', this.state); }
    const progressPercent = Math.round(this.progress * 100);
    const progressFill = this.el.querySelector('[data-part="progress-fill"]') as HTMLElement;
    if (progressFill) { progressFill.style.width = `${progressPercent}%`; progressFill.setAttribute('data-phase', this.state); }
    const progressBar = this.el.querySelector('[data-part="progress"]');
    if (progressBar) {
      progressBar.setAttribute('aria-valuenow', String(progressPercent));
      progressBar.setAttribute('aria-label', `SLA progress: ${progressPercent}%`);
      progressBar.setAttribute('data-phase', this.state);
    }
    const elapsedEl = this.el.querySelector('[data-part="elapsed"]');
    if (elapsedEl) { elapsedEl.textContent = `Elapsed: ${formatElapsed(this.elapsed)}`; elapsedEl.setAttribute('aria-label', `Elapsed time: ${formatElapsed(this.elapsed)}`); }
    this.el.setAttribute('data-state', this.state);
    this.el.setAttribute('aria-label', `SLA timer: ${PHASE_LABELS[this.state]}`);
  }

  private render(): void {
    const showElapsed = this.props.showElapsed !== false;
    const progressPercent = Math.round(this.progress * 100);

    this.el.setAttribute('data-state', this.state);
    this.el.setAttribute('aria-label', `SLA timer: ${PHASE_LABELS[this.state]}`);
    if (this.props.className) this.el.className = this.props.className as string;

    // Countdown
    const countdown = document.createElement('span');
    countdown.setAttribute('data-part', 'countdown');
    countdown.setAttribute('aria-label', `Time remaining: ${formatCountdown(this.remaining)}`);
    countdown.textContent = this.state === 'breached' ? 'BREACHED' : formatCountdown(this.remaining);
    this.el.appendChild(countdown);

    // Phase label
    const phase = document.createElement('span');
    phase.setAttribute('data-part', 'phase');
    phase.setAttribute('role', 'status');
    phase.setAttribute('data-phase', this.state);
    phase.textContent = PHASE_LABELS[this.state];
    this.el.appendChild(phase);

    // Progress bar
    const progressDiv = document.createElement('div');
    progressDiv.setAttribute('data-part', 'progress');
    progressDiv.setAttribute('data-phase', this.state);
    progressDiv.setAttribute('role', 'progressbar');
    progressDiv.setAttribute('aria-valuenow', String(progressPercent));
    progressDiv.setAttribute('aria-valuemin', '0');
    progressDiv.setAttribute('aria-valuemax', '100');
    progressDiv.setAttribute('aria-label', `SLA progress: ${progressPercent}%`);
    const fill = document.createElement('div');
    fill.setAttribute('data-part', 'progress-fill');
    fill.setAttribute('data-phase', this.state);
    fill.style.width = `${progressPercent}%`;
    fill.setAttribute('aria-hidden', 'true');
    progressDiv.appendChild(fill);
    this.el.appendChild(progressDiv);

    // Elapsed time
    if (showElapsed) {
      const elapsedSpan = document.createElement('span');
      elapsedSpan.setAttribute('data-part', 'elapsed');
      elapsedSpan.setAttribute('data-visible', 'true');
      elapsedSpan.setAttribute('aria-label', `Elapsed time: ${formatElapsed(this.elapsed)}`);
      elapsedSpan.textContent = `Elapsed: ${formatElapsed(this.elapsed)}`;
      this.el.appendChild(elapsedSpan);
    }

    // Pause/Resume control
    if (this.state !== 'breached') {
      const btn = document.createElement('button');
      btn.setAttribute('type', 'button');
      btn.setAttribute('data-part', 'pause-resume');
      btn.setAttribute('aria-label', this.state === 'paused' ? 'Resume timer' : 'Pause timer');
      btn.textContent = this.state === 'paused' ? 'Resume' : 'Pause';
      const onClick = () => {
        if (this.state === 'paused') { this.send('RESUME'); this.startTimer(); } else { this.send('PAUSE'); this.stopTimer(); }
        this.rerender();
      };
      btn.addEventListener('click', onClick);
      this.disposers.push(() => btn.removeEventListener('click', onClick));
      this.el.appendChild(btn);
    }
  }
}

export default SlaTimer;
