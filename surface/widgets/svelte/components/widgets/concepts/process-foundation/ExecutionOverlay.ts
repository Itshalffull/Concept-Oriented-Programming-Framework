import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

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

/* --- Types --- */

export interface ExecutionStep {
  id: string;
  label: string;
  status: 'active' | 'complete' | 'pending' | 'failed' | 'skipped';
}

export interface ExecutionOverlayProps {
  [key: string]: unknown;
  class?: string;
  status: string;
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
export interface ExecutionOverlayResult { element: HTMLElement; dispose: () => void; }

/* --- Helpers --- */

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

/* --- Component --- */

export function ExecutionOverlay(props: ExecutionOverlayProps): ExecutionOverlayResult {
  const sig = surfaceCreateSignal<ExecutionOverlayState>('idle');
  const send = (type: string) => sig.set(executionOverlayReducer(sig.get(), { type } as any));

  const statusProp = (props.status as string) ?? '';
  const activeStep = props.activeStep as string | undefined;
  const startedAt = props.startedAt as string | undefined;
  const endedAt = props.endedAt as string | undefined;
  const mode = (props.mode as string) ?? 'live';
  const showControls = props.showControls !== false;
  const showElapsed = props.showElapsed !== false;
  const animateFlow = props.animateFlow !== false;
  const steps = (props.steps ?? []) as ExecutionStep[];
  const errorMessage = props.errorMessage as string | undefined;
  const onSuspend = props.onSuspend as (() => void) | undefined;
  const onResume = props.onResume as (() => void) | undefined;
  const onCancel = props.onCancel as (() => void) | undefined;
  const onRetry = props.onRetry as (() => void) | undefined;

  let elapsed = 0;
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  // Auto-transition based on mode/status
  if (mode === 'replay') send('LOAD_REPLAY');
  if (statusProp === 'running') send('START');

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'execution-overlay');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', `Process execution: ${statusProp}`);
  root.setAttribute('aria-busy', sig.get() === 'live' ? 'true' : 'false');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-mode', mode);
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Step overlays
  for (const step of steps) {
    const stepDiv = document.createElement('div');
    stepDiv.setAttribute('data-part', 'node-overlay');
    stepDiv.setAttribute('data-status', step.status);
    stepDiv.setAttribute('data-step-id', step.id);
    stepDiv.setAttribute('aria-hidden', 'true');

    const iconSpan = document.createElement('span');
    iconSpan.setAttribute('data-part', 'step-icon');
    iconSpan.textContent = statusIcon(step.status);
    stepDiv.appendChild(iconSpan);

    const labelSpan = document.createElement('span');
    labelSpan.setAttribute('data-part', 'step-label');
    labelSpan.textContent = step.label;
    stepDiv.appendChild(labelSpan);

    root.appendChild(stepDiv);
  }

  // Active marker
  const activeMarkerEl = document.createElement('div');
  activeMarkerEl.setAttribute('data-part', 'active-marker');
  activeMarkerEl.setAttribute('data-step', activeStep ?? '');
  activeMarkerEl.setAttribute('data-visible', activeStep ? 'true' : 'false');
  activeMarkerEl.setAttribute('aria-hidden', activeStep ? 'false' : 'true');
  if (activeStep) {
    const pulseSpan = document.createElement('span');
    pulseSpan.setAttribute('data-part', 'pulse-indicator');
    pulseSpan.setAttribute('aria-label', `Active step: ${activeStep}`);
    pulseSpan.textContent = '\u25CF';
    activeMarkerEl.appendChild(pulseSpan);
  }
  root.appendChild(activeMarkerEl);

  // Flow animation
  const flowEl = document.createElement('div');
  flowEl.setAttribute('data-part', 'flow-animation');
  flowEl.setAttribute('data-active', 'false');
  flowEl.setAttribute('aria-hidden', 'true');
  root.appendChild(flowEl);

  // Status bar
  const statusBarEl = document.createElement('div');
  statusBarEl.setAttribute('data-part', 'status-bar');
  statusBarEl.setAttribute('role', 'status');
  statusBarEl.setAttribute('aria-live', 'polite');
  statusBarEl.setAttribute('data-status', statusProp);
  root.appendChild(statusBarEl);

  const statusLabel = document.createElement('span');
  statusLabel.setAttribute('data-part', 'status-label');
  statusLabel.textContent = statusProp;
  statusBarEl.appendChild(statusLabel);

  const elapsedSpan = document.createElement('span');
  elapsedSpan.setAttribute('data-part', 'elapsed');
  elapsedSpan.setAttribute('data-visible', 'true');
  elapsedSpan.setAttribute('aria-label', `Elapsed time: ${formatElapsed(elapsed)}`);
  elapsedSpan.textContent = formatElapsed(elapsed);
  if (showElapsed) statusBarEl.appendChild(elapsedSpan);

  // Controls
  const controlsEl = document.createElement('div');
  controlsEl.setAttribute('data-part', 'controls');
  controlsEl.setAttribute('role', 'toolbar');
  controlsEl.setAttribute('aria-label', 'Execution controls');
  controlsEl.setAttribute('data-visible', 'true');
  if (showControls) root.appendChild(controlsEl);

  const suspendBtn = document.createElement('button');
  suspendBtn.type = 'button';
  suspendBtn.setAttribute('data-part', 'suspend-button');
  suspendBtn.setAttribute('aria-label', 'Suspend execution');
  suspendBtn.textContent = 'Suspend';
  suspendBtn.addEventListener('click', () => { send('SUSPEND'); onSuspend?.(); });
  controlsEl.appendChild(suspendBtn);

  const resumeBtn = document.createElement('button');
  resumeBtn.type = 'button';
  resumeBtn.setAttribute('data-part', 'resume-button');
  resumeBtn.setAttribute('aria-label', 'Resume execution');
  resumeBtn.textContent = 'Resume';
  resumeBtn.style.display = 'none';
  resumeBtn.addEventListener('click', () => { send('RESUME'); onResume?.(); });
  controlsEl.appendChild(resumeBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.setAttribute('data-part', 'cancel-button');
  cancelBtn.setAttribute('aria-label', 'Cancel execution');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => { send('CANCEL'); onCancel?.(); });
  controlsEl.appendChild(cancelBtn);

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.setAttribute('data-part', 'retry-button');
  retryBtn.setAttribute('aria-label', 'Retry execution');
  retryBtn.textContent = 'Retry';
  retryBtn.style.display = 'none';
  retryBtn.addEventListener('click', () => { send('RETRY'); onRetry?.(); });
  controlsEl.appendChild(retryBtn);

  // Error banner
  const errorEl = document.createElement('div');
  errorEl.setAttribute('data-part', 'error-banner');
  errorEl.setAttribute('role', 'alert');
  errorEl.setAttribute('aria-live', 'assertive');
  errorEl.setAttribute('data-visible', 'false');
  errorEl.style.display = 'none';
  root.appendChild(errorEl);

  // Elapsed timer
  function startTimer() {
    if (timerInterval) return;
    if (!startedAt) return;
    const startMs = new Date(startedAt).getTime();
    const tick = () => {
      elapsed = Date.now() - startMs;
      elapsedSpan.textContent = formatElapsed(elapsed);
      elapsedSpan.setAttribute('aria-label', `Elapsed time: ${formatElapsed(elapsed)}`);
    };
    tick();
    timerInterval = setInterval(tick, 1000);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (startedAt) {
      const startMs = new Date(startedAt).getTime();
      const endMs = endedAt ? new Date(endedAt).getTime() : Date.now();
      elapsed = endMs - startMs;
      elapsedSpan.textContent = formatElapsed(elapsed);
    }
  }

  // Keyboard
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault();
      const s = sig.get();
      if (s === 'live') { send('SUSPEND'); onSuspend?.(); }
      else if (s === 'suspended') { send('RESUME'); onResume?.(); }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      const s = sig.get();
      if (s === 'live' || s === 'suspended') { send('CANCEL'); onCancel?.(); }
    }
  });

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    root.setAttribute('aria-busy', s === 'live' ? 'true' : 'false');
    statusBarEl.setAttribute('data-state', s);

    const isFlowAnimating = animateFlow && (s === 'live' || s === 'replay');
    flowEl.setAttribute('data-active', isFlowAnimating ? 'true' : 'false');

    suspendBtn.style.display = s === 'live' ? '' : 'none';
    resumeBtn.style.display = s === 'suspended' ? '' : 'none';
    cancelBtn.style.display = s === 'live' || s === 'suspended' ? '' : 'none';
    retryBtn.style.display = s === 'failed' ? '' : 'none';

    errorEl.style.display = s === 'failed' ? '' : 'none';
    errorEl.setAttribute('data-visible', s === 'failed' ? 'true' : 'false');
    if (s === 'failed') {
      errorEl.innerHTML = '';
      const errSpan = document.createElement('span');
      errSpan.setAttribute('data-part', 'error-message');
      errSpan.textContent = errorMessage ?? 'Execution failed';
      errorEl.appendChild(errSpan);
    }

    if (s === 'live') startTimer();
    else stopTimer();
  });

  return {
    element: root,
    dispose() {
      unsub();
      if (timerInterval) clearInterval(timerInterval);
      root.remove();
    },
  };
}

export default ExecutionOverlay;
