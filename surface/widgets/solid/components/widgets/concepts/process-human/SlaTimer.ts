import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

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

const PHASE_LABELS: Record<string, string> = {
  onTrack: 'On Track',
  warning: 'Warning',
  critical: 'Critical',
  breached: 'Breached',
  paused: 'Paused',
};

export interface SlaTimerProps { [key: string]: unknown; class?: string; }
export interface SlaTimerResult { element: HTMLElement; dispose: () => void; }

export function SlaTimer(props: SlaTimerProps): SlaTimerResult {
  const sig = surfaceCreateSignal<SlaTimerState>('onTrack');
  const state = () => sig.get();
  const send = (type: string) => sig.set(slaTimerReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'sla-timer');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'timer');
  root.setAttribute('aria-label', 'SLA timer: On Track');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Countdown display */
  const countdownEl = document.createElement('span');
  countdownEl.setAttribute('data-part', 'countdown');
  countdownEl.setAttribute('aria-label', 'Time remaining: 00:00:00');
  countdownEl.textContent = '00:00:00';
  root.appendChild(countdownEl);

  /* Phase label */
  const phaseEl = document.createElement('span');
  phaseEl.setAttribute('data-part', 'phase');
  phaseEl.setAttribute('role', 'status');
  phaseEl.setAttribute('data-phase', 'onTrack');
  phaseEl.textContent = 'On Track';
  root.appendChild(phaseEl);

  /* Progress bar */
  const progressEl = document.createElement('div');
  progressEl.setAttribute('data-part', 'progress');
  progressEl.setAttribute('data-phase', 'onTrack');
  progressEl.setAttribute('role', 'progressbar');
  progressEl.setAttribute('aria-valuenow', '0');
  progressEl.setAttribute('aria-valuemin', '0');
  progressEl.setAttribute('aria-valuemax', '100');
  progressEl.setAttribute('aria-label', 'SLA progress: 0%');
  const progressFill = document.createElement('div');
  progressFill.setAttribute('data-part', 'progress-fill');
  progressFill.setAttribute('data-phase', 'onTrack');
  progressFill.setAttribute('aria-hidden', 'true');
  progressFill.style.width = '0%';
  progressEl.appendChild(progressFill);
  root.appendChild(progressEl);

  /* Elapsed time */
  const elapsedEl = document.createElement('span');
  elapsedEl.setAttribute('data-part', 'elapsed');
  elapsedEl.setAttribute('data-visible', 'true');
  elapsedEl.setAttribute('aria-label', 'Elapsed time: 0s');
  elapsedEl.textContent = 'Elapsed: 0s';
  root.appendChild(elapsedEl);

  /* Pause/Resume button */
  const pauseResumeBtn = document.createElement('button');
  pauseResumeBtn.type = 'button';
  pauseResumeBtn.setAttribute('data-part', 'pause-resume');
  pauseResumeBtn.setAttribute('aria-label', 'Pause timer');
  pauseResumeBtn.textContent = 'Pause';
  pauseResumeBtn.addEventListener('click', () => {
    if (sig.get() === 'paused') {
      send('RESUME');
    } else {
      send('PAUSE');
    }
  });
  root.appendChild(pauseResumeBtn);

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    root.setAttribute('aria-label', `SLA timer: ${PHASE_LABELS[s] ?? s}`);
    phaseEl.setAttribute('data-phase', s);
    phaseEl.textContent = PHASE_LABELS[s] ?? s;
    progressEl.setAttribute('data-phase', s);
    progressFill.setAttribute('data-phase', s);
    if (s === 'breached') {
      countdownEl.textContent = 'BREACHED';
      pauseResumeBtn.style.display = 'none';
    } else {
      pauseResumeBtn.style.display = 'inline';
      if (s === 'paused') {
        pauseResumeBtn.textContent = 'Resume';
        pauseResumeBtn.setAttribute('aria-label', 'Resume timer');
      } else {
        pauseResumeBtn.textContent = 'Pause';
        pauseResumeBtn.setAttribute('aria-label', 'Pause timer');
      }
    }
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default SlaTimer;
