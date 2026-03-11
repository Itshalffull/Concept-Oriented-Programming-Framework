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

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

function statusIcon(status: string): string {
  switch (status) {
    case 'complete': return '\u2713';
    case 'active': return '\u25CF';
    case 'failed': return '\u2717';
    case 'skipped': return '\u2014';
    default: return '\u25CB';
  }
}

export interface ExecutionOverlayProps { [key: string]: unknown; class?: string; }
export interface ExecutionOverlayResult { element: HTMLElement; dispose: () => void; }

export function ExecutionOverlay(props: ExecutionOverlayProps): ExecutionOverlayResult {
  const sig = surfaceCreateSignal<ExecutionOverlayState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(executionOverlayReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'execution-overlay');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Process execution');
  root.setAttribute('aria-busy', 'false');
  root.setAttribute('data-state', state());
  root.setAttribute('data-mode', 'live');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Node overlay template */
  const nodeOverlayEl = document.createElement('div');
  nodeOverlayEl.setAttribute('data-part', 'node-overlay');
  nodeOverlayEl.setAttribute('data-status', 'pending');
  nodeOverlayEl.setAttribute('aria-hidden', 'true');
  const stepIconSpan = document.createElement('span');
  stepIconSpan.setAttribute('data-part', 'step-icon');
  stepIconSpan.textContent = statusIcon('pending');
  nodeOverlayEl.appendChild(stepIconSpan);
  const stepLabelSpan = document.createElement('span');
  stepLabelSpan.setAttribute('data-part', 'step-label');
  stepLabelSpan.textContent = 'Step';
  nodeOverlayEl.appendChild(stepLabelSpan);
  root.appendChild(nodeOverlayEl);

  /* Active step marker */
  const activeMarkerEl = document.createElement('div');
  activeMarkerEl.setAttribute('data-part', 'active-marker');
  activeMarkerEl.setAttribute('data-step', '');
  activeMarkerEl.setAttribute('data-visible', 'false');
  activeMarkerEl.setAttribute('aria-hidden', 'true');
  const pulseIndicator = document.createElement('span');
  pulseIndicator.setAttribute('data-part', 'pulse-indicator');
  pulseIndicator.textContent = '\u25CF';
  activeMarkerEl.appendChild(pulseIndicator);
  root.appendChild(activeMarkerEl);

  /* Flow animation indicator */
  const flowAnimationEl = document.createElement('div');
  flowAnimationEl.setAttribute('data-part', 'flow-animation');
  flowAnimationEl.setAttribute('data-active', 'false');
  flowAnimationEl.setAttribute('aria-hidden', 'true');
  root.appendChild(flowAnimationEl);

  /* Status bar */
  const statusBarEl = document.createElement('div');
  statusBarEl.setAttribute('data-part', 'status-bar');
  statusBarEl.setAttribute('role', 'status');
  statusBarEl.setAttribute('aria-live', 'polite');
  const statusLabelEl = document.createElement('span');
  statusLabelEl.setAttribute('data-part', 'status-label');
  statusLabelEl.textContent = 'Idle';
  statusBarEl.appendChild(statusLabelEl);
  const elapsedEl = document.createElement('span');
  elapsedEl.setAttribute('data-part', 'elapsed');
  elapsedEl.setAttribute('data-visible', 'true');
  elapsedEl.textContent = formatElapsed(0);
  statusBarEl.appendChild(elapsedEl);
  root.appendChild(statusBarEl);

  /* Control buttons */
  const controlsEl = document.createElement('div');
  controlsEl.setAttribute('data-part', 'controls');
  controlsEl.setAttribute('role', 'toolbar');
  controlsEl.setAttribute('aria-label', 'Execution controls');
  controlsEl.setAttribute('data-visible', 'true');

  const suspendBtn = document.createElement('button');
  suspendBtn.type = 'button';
  suspendBtn.setAttribute('data-part', 'suspend-button');
  suspendBtn.setAttribute('aria-label', 'Suspend execution');
  suspendBtn.textContent = 'Suspend';
  suspendBtn.style.display = 'none';
  suspendBtn.addEventListener('click', () => { send('SUSPEND'); });
  controlsEl.appendChild(suspendBtn);

  const resumeBtn = document.createElement('button');
  resumeBtn.type = 'button';
  resumeBtn.setAttribute('data-part', 'resume-button');
  resumeBtn.setAttribute('aria-label', 'Resume execution');
  resumeBtn.textContent = 'Resume';
  resumeBtn.style.display = 'none';
  resumeBtn.addEventListener('click', () => { send('RESUME'); });
  controlsEl.appendChild(resumeBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.setAttribute('data-part', 'cancel-button');
  cancelBtn.setAttribute('aria-label', 'Cancel execution');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.display = 'none';
  cancelBtn.addEventListener('click', () => { send('CANCEL'); });
  controlsEl.appendChild(cancelBtn);

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.setAttribute('data-part', 'retry-button');
  retryBtn.setAttribute('aria-label', 'Retry execution');
  retryBtn.textContent = 'Retry';
  retryBtn.style.display = 'none';
  retryBtn.addEventListener('click', () => { send('RETRY'); });
  controlsEl.appendChild(retryBtn);

  root.appendChild(controlsEl);

  /* Error banner */
  const errorBannerEl = document.createElement('div');
  errorBannerEl.setAttribute('data-part', 'error-banner');
  errorBannerEl.setAttribute('role', 'alert');
  errorBannerEl.setAttribute('aria-live', 'assertive');
  errorBannerEl.setAttribute('data-visible', 'false');
  const errorMsgEl = document.createElement('span');
  errorMsgEl.setAttribute('data-part', 'error-message');
  errorMsgEl.textContent = 'Execution failed';
  errorMsgEl.style.display = 'none';
  errorBannerEl.appendChild(errorMsgEl);
  root.appendChild(errorBannerEl);

  /* Keyboard controls */
  root.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      const s = sig.get();
      if (s === 'live') send('SUSPEND');
      else if (s === 'suspended') send('RESUME');
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      const s = sig.get();
      if (s === 'live' || s === 'suspended') send('CANCEL');
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    root.setAttribute('aria-busy', s === 'live' ? 'true' : 'false');
    statusLabelEl.textContent = s.charAt(0).toUpperCase() + s.slice(1);
    const isFlowActive = s === 'live' || s === 'replay';
    flowAnimationEl.setAttribute('data-active', isFlowActive ? 'true' : 'false');
    suspendBtn.style.display = s === 'live' ? 'inline' : 'none';
    resumeBtn.style.display = s === 'suspended' ? 'inline' : 'none';
    cancelBtn.style.display = (s === 'live' || s === 'suspended') ? 'inline' : 'none';
    retryBtn.style.display = s === 'failed' ? 'inline' : 'none';
    const showError = s === 'failed';
    errorBannerEl.setAttribute('data-visible', showError ? 'true' : 'false');
    errorMsgEl.style.display = showError ? 'inline' : 'none';
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default ExecutionOverlay;
