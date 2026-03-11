/* ---------------------------------------------------------------------------
 * ExecutionOverlay — Vanilla implementation
 *
 * Runtime state overlay for process execution with status-colored node
 * highlights, active step indicator, flow animation, elapsed timer,
 * and suspend/resume/cancel/retry controls.
 * ------------------------------------------------------------------------- */

export type ExecutionOverlayState = 'idle' | 'live' | 'suspended' | 'completed' | 'failed' | 'cancelled' | 'replay';
export type ExecutionOverlayEvent =
  | { type: 'START' }
  | { type: 'LOAD_REPLAY' }
  | { type: 'STEP_ADVANCE' }
  | { type: 'COMPLETE' }
  | { type: 'FAIL' }
  | { type: 'SUSPEND' }
  | { type: 'CANCEL' }
  | { type: 'RESUME' }
  | { type: 'RESET' }
  | { type: 'RETRY' }
  | { type: 'REPLAY_STEP' }
  | { type: 'REPLAY_END' };

export function executionOverlayReducer(state: ExecutionOverlayState, event: ExecutionOverlayEvent): ExecutionOverlayState {
  switch (state) {
    case 'idle':
      if (event.type === 'START') return 'live';
      if (event.type === 'LOAD_REPLAY') return 'replay';
      return state;
    case 'live':
      if (event.type === 'STEP_ADVANCE') return 'live';
      if (event.type === 'COMPLETE') return 'completed';
      if (event.type === 'FAIL') return 'failed';
      if (event.type === 'SUSPEND') return 'suspended';
      if (event.type === 'CANCEL') return 'cancelled';
      return state;
    case 'suspended':
      if (event.type === 'RESUME') return 'live';
      if (event.type === 'CANCEL') return 'cancelled';
      return state;
    case 'completed':
      if (event.type === 'RESET') return 'idle';
      return state;
    case 'failed':
      if (event.type === 'RESET') return 'idle';
      if (event.type === 'RETRY') return 'live';
      return state;
    case 'cancelled':
      if (event.type === 'RESET') return 'idle';
      return state;
    case 'replay':
      if (event.type === 'REPLAY_STEP') return 'replay';
      if (event.type === 'REPLAY_END') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface ExecutionStep {
  id: string;
  label: string;
  status: 'active' | 'complete' | 'pending' | 'failed' | 'skipped';
}

export interface ExecutionOverlayProps {
  [key: string]: unknown; className?: string;
  status?: string;
  activeStep?: string;
  startedAt?: string;
  endedAt?: string;
  mode?: 'live' | 'replay' | 'static';
  showControls?: boolean;
  showElapsed?: boolean;
  animateFlow?: boolean;
  steps?: ExecutionStep[];
  errorMessage?: string;
  onSuspend?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
}
export interface ExecutionOverlayOptions { target: HTMLElement; props: ExecutionOverlayProps; }

let _executionOverlayUid = 0;

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

function statusIcon(status: ExecutionStep['status']): string {
  switch (status) {
    case 'complete': return '\u2713';
    case 'active': return '\u25CF';
    case 'failed': return '\u2717';
    case 'skipped': return '\u2014';
    case 'pending': default: return '\u25CB';
  }
}

export class ExecutionOverlay {
  private el: HTMLElement;
  private props: ExecutionOverlayProps;
  private state: ExecutionOverlayState = 'idle';
  private disposers: Array<() => void> = [];
  private elapsed = 0;
  private timerHandle: ReturnType<typeof setInterval> | null = null;

  constructor(options: ExecutionOverlayOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'execution-overlay');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'execution-overlay-' + (++_executionOverlayUid);
    const onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKeyDown));
    this.autoTransition();
    this.startTimer();
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  send(type: string): void { this.state = executionOverlayReducer(this.state, { type } as any); this.el.setAttribute('data-state', this.state); }

  update(props: Partial<ExecutionOverlayProps>): void {
    Object.assign(this.props, props);
    this.autoTransition();
    this.startTimer();
    this.cleanupRender();
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void { this.stopTimer(); this.cleanup(); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private cleanupRender(): void { const kept = this.disposers.slice(0, 1); for (let i = 1; i < this.disposers.length; i++) this.disposers[i](); this.disposers = kept; }
  private rerender(): void { this.cleanupRender(); this.el.innerHTML = ''; this.render(); }

  private autoTransition(): void {
    const mode = (this.props.mode as string) ?? 'live';
    const status = (this.props.status as string) ?? '';
    if (mode === 'replay' && this.state === 'idle') this.send('LOAD_REPLAY');
    if (status === 'running' && this.state === 'idle') this.send('START');
    else if (status === 'completed' && this.state === 'live') this.send('COMPLETE');
    else if (status === 'failed' && this.state === 'live') this.send('FAIL');
    else if (status === 'suspended' && this.state === 'live') this.send('SUSPEND');
    else if (status === 'cancelled' && (this.state === 'live' || this.state === 'suspended')) this.send('CANCEL');
  }

  private startTimer(): void {
    this.stopTimer();
    if (this.state === 'live' && this.props.startedAt) {
      const start = new Date(this.props.startedAt as string).getTime();
      const tick = () => { this.elapsed = Date.now() - start; this.updateElapsed(); };
      tick();
      this.timerHandle = setInterval(tick, 1000);
    }
    if ((this.state === 'completed' || this.state === 'failed' || this.state === 'cancelled') && this.props.startedAt) {
      const start = new Date(this.props.startedAt as string).getTime();
      const end = this.props.endedAt ? new Date(this.props.endedAt as string).getTime() : Date.now();
      this.elapsed = end - start;
    }
  }

  private stopTimer(): void { if (this.timerHandle) { clearInterval(this.timerHandle); this.timerHandle = null; } }

  private updateElapsed(): void {
    const el = this.el.querySelector('[data-part="elapsed"]');
    if (el) { el.textContent = formatElapsed(this.elapsed); el.setAttribute('aria-label', `Elapsed time: ${formatElapsed(this.elapsed)}`); }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === ' ') {
      e.preventDefault();
      if (this.state === 'live') this.handleSuspend();
      else if (this.state === 'suspended') this.handleResume();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.state === 'live' || this.state === 'suspended') this.handleCancel();
    }
  }

  private handleSuspend(): void { this.send('SUSPEND'); this.props.onSuspend?.(); this.stopTimer(); this.rerender(); }
  private handleResume(): void { this.send('RESUME'); this.props.onResume?.(); this.startTimer(); this.rerender(); }
  private handleCancel(): void { this.send('CANCEL'); this.props.onCancel?.(); this.stopTimer(); this.rerender(); }
  private handleRetry(): void { this.send('RETRY'); this.props.onRetry?.(); this.startTimer(); this.rerender(); }

  private render(): void {
    const steps = (this.props.steps ?? []) as ExecutionStep[];
    const status = (this.props.status as string) ?? '';
    const activeStep = this.props.activeStep as string | undefined;
    const showControls = this.props.showControls !== false;
    const showElapsed = this.props.showElapsed !== false;
    const animateFlow = this.props.animateFlow !== false;
    const mode = (this.props.mode as string) ?? 'live';

    this.el.setAttribute('data-state', this.state);
    this.el.setAttribute('data-mode', mode);
    this.el.setAttribute('aria-label', `Process execution: ${status}`);
    this.el.setAttribute('aria-busy', String(this.state === 'live'));
    if (this.props.className) this.el.className = this.props.className as string;

    // Per-node status highlights
    for (const step of steps) {
      const overlay = document.createElement('div');
      overlay.setAttribute('data-part', 'node-overlay');
      overlay.setAttribute('data-status', step.status);
      overlay.setAttribute('data-step-id', step.id);
      overlay.setAttribute('aria-hidden', 'true');
      const icon = document.createElement('span');
      icon.setAttribute('data-part', 'step-icon');
      icon.textContent = statusIcon(step.status);
      overlay.appendChild(icon);
      const label = document.createElement('span');
      label.setAttribute('data-part', 'step-label');
      label.textContent = step.label;
      overlay.appendChild(label);
      this.el.appendChild(overlay);
    }

    // Active step marker
    const marker = document.createElement('div');
    marker.setAttribute('data-part', 'active-marker');
    marker.setAttribute('data-step', activeStep ?? '');
    marker.setAttribute('data-visible', activeStep ? 'true' : 'false');
    marker.setAttribute('aria-hidden', String(!activeStep));
    if (activeStep) {
      const pulse = document.createElement('span');
      pulse.setAttribute('data-part', 'pulse-indicator');
      pulse.setAttribute('aria-label', `Active step: ${activeStep}`);
      pulse.textContent = '\u25CF';
      marker.appendChild(pulse);
    }
    this.el.appendChild(marker);

    // Flow animation indicator
    const isFlowAnimating = animateFlow && (this.state === 'live' || this.state === 'replay');
    const flowAnim = document.createElement('div');
    flowAnim.setAttribute('data-part', 'flow-animation');
    flowAnim.setAttribute('data-active', isFlowAnimating ? 'true' : 'false');
    flowAnim.setAttribute('aria-hidden', 'true');
    this.el.appendChild(flowAnim);

    // Status bar
    const statusBar = document.createElement('div');
    statusBar.setAttribute('data-part', 'status-bar');
    statusBar.setAttribute('role', 'status');
    statusBar.setAttribute('aria-live', 'polite');
    statusBar.setAttribute('data-status', status);
    const statusLabel = document.createElement('span');
    statusLabel.setAttribute('data-part', 'status-label');
    statusLabel.textContent = status;
    statusBar.appendChild(statusLabel);
    if (showElapsed) {
      const elapsedSpan = document.createElement('span');
      elapsedSpan.setAttribute('data-part', 'elapsed');
      elapsedSpan.setAttribute('data-visible', 'true');
      elapsedSpan.setAttribute('aria-label', `Elapsed time: ${formatElapsed(this.elapsed)}`);
      elapsedSpan.textContent = formatElapsed(this.elapsed);
      statusBar.appendChild(elapsedSpan);
    }
    this.el.appendChild(statusBar);

    // Control buttons
    if (showControls) {
      const controls = document.createElement('div');
      controls.setAttribute('data-part', 'controls');
      controls.setAttribute('role', 'toolbar');
      controls.setAttribute('aria-label', 'Execution controls');
      controls.setAttribute('data-visible', 'true');

      if (this.state === 'live') {
        const suspendBtn = document.createElement('button');
        suspendBtn.setAttribute('type', 'button');
        suspendBtn.setAttribute('data-part', 'suspend-button');
        suspendBtn.setAttribute('aria-label', 'Suspend execution');
        suspendBtn.textContent = 'Suspend';
        const onSuspend = () => this.handleSuspend();
        suspendBtn.addEventListener('click', onSuspend);
        this.disposers.push(() => suspendBtn.removeEventListener('click', onSuspend));
        controls.appendChild(suspendBtn);
      }
      if (this.state === 'suspended') {
        const resumeBtn = document.createElement('button');
        resumeBtn.setAttribute('type', 'button');
        resumeBtn.setAttribute('data-part', 'resume-button');
        resumeBtn.setAttribute('aria-label', 'Resume execution');
        resumeBtn.textContent = 'Resume';
        const onResume = () => this.handleResume();
        resumeBtn.addEventListener('click', onResume);
        this.disposers.push(() => resumeBtn.removeEventListener('click', onResume));
        controls.appendChild(resumeBtn);
      }
      if (this.state === 'live' || this.state === 'suspended') {
        const cancelBtn = document.createElement('button');
        cancelBtn.setAttribute('type', 'button');
        cancelBtn.setAttribute('data-part', 'cancel-button');
        cancelBtn.setAttribute('aria-label', 'Cancel execution');
        cancelBtn.textContent = 'Cancel';
        const onCancel = () => this.handleCancel();
        cancelBtn.addEventListener('click', onCancel);
        this.disposers.push(() => cancelBtn.removeEventListener('click', onCancel));
        controls.appendChild(cancelBtn);
      }
      if (this.state === 'failed') {
        const retryBtn = document.createElement('button');
        retryBtn.setAttribute('type', 'button');
        retryBtn.setAttribute('data-part', 'retry-button');
        retryBtn.setAttribute('aria-label', 'Retry execution');
        retryBtn.textContent = 'Retry';
        const onRetry = () => this.handleRetry();
        retryBtn.addEventListener('click', onRetry);
        this.disposers.push(() => retryBtn.removeEventListener('click', onRetry));
        controls.appendChild(retryBtn);
      }
      this.el.appendChild(controls);
    }

    // Error banner
    const errorBanner = document.createElement('div');
    errorBanner.setAttribute('data-part', 'error-banner');
    errorBanner.setAttribute('role', 'alert');
    errorBanner.setAttribute('aria-live', 'assertive');
    errorBanner.setAttribute('data-visible', this.state === 'failed' ? 'true' : 'false');
    if (this.state === 'failed') {
      const errorMsg = document.createElement('span');
      errorMsg.setAttribute('data-part', 'error-message');
      errorMsg.textContent = (this.props.errorMessage as string) ?? 'Execution failed';
      errorBanner.appendChild(errorMsg);
    }
    this.el.appendChild(errorBanner);
  }
}

export default ExecutionOverlay;
