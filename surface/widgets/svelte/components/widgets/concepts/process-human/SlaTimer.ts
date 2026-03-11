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

/* --- Types --- */

export interface SlaTimerProps {
  [key: string]: unknown;
  class?: string;
  dueAt: string;
  status: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  showElapsed?: boolean;
  startedAt?: string;
  onBreach?: () => void;
  onWarning?: () => void;
  onCritical?: () => void;
}
export interface SlaTimerResult { element: HTMLElement; dispose: () => void; }

/* --- Helpers --- */

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatElapsedTime(ms: number): string {
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
  onTrack: 'On Track',
  warning: 'Warning',
  critical: 'Critical',
  breached: 'Breached',
  paused: 'Paused',
};

/* --- Component --- */

export function SlaTimer(props: SlaTimerProps): SlaTimerResult {
  const sig = surfaceCreateSignal<SlaTimerState>('onTrack');
  const send = (type: string) => sig.set(slaTimerReducer(sig.get(), { type } as any));

  const dueAt = (props.dueAt as string) ?? '';
  const warningThreshold = (props.warningThreshold as number) ?? 0.7;
  const criticalThreshold = (props.criticalThreshold as number) ?? 0.9;
  const showElapsed = props.showElapsed !== false;
  const startedAt = props.startedAt as string | undefined;
  const onBreach = props.onBreach as (() => void) | undefined;
  const onWarning = props.onWarning as (() => void) | undefined;
  const onCritical = props.onCritical as (() => void) | undefined;

  const dueTime = new Date(dueAt).getTime();
  const startTime = startedAt ? new Date(startedAt).getTime() : Date.now();
  const totalDuration = dueTime - startTime;

  let remaining = 0;
  let elapsed = 0;
  let progress = 0;
  let breachedFlag = false;
  let warningFlag = false;
  let criticalFlag = false;
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'sla-timer');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'timer');
  root.setAttribute('aria-label', `SLA timer: ${PHASE_LABELS[sig.get()]}`);
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Countdown
  const countdownEl = document.createElement('span');
  countdownEl.setAttribute('data-part', 'countdown');
  countdownEl.setAttribute('aria-label', `Time remaining: ${formatCountdown(remaining)}`);
  countdownEl.textContent = formatCountdown(remaining);
  root.appendChild(countdownEl);

  // Phase label
  const phaseEl = document.createElement('span');
  phaseEl.setAttribute('data-part', 'phase');
  phaseEl.setAttribute('role', 'status');
  phaseEl.setAttribute('data-phase', sig.get());
  phaseEl.textContent = PHASE_LABELS[sig.get()];
  root.appendChild(phaseEl);

  // Progress bar
  const progressDiv = document.createElement('div');
  progressDiv.setAttribute('data-part', 'progress');
  progressDiv.setAttribute('data-phase', sig.get());
  progressDiv.setAttribute('role', 'progressbar');
  progressDiv.setAttribute('aria-valuenow', '0');
  progressDiv.setAttribute('aria-valuemin', '0');
  progressDiv.setAttribute('aria-valuemax', '100');
  progressDiv.setAttribute('aria-label', 'SLA progress: 0%');
  root.appendChild(progressDiv);

  const progressFill = document.createElement('div');
  progressFill.setAttribute('data-part', 'progress-fill');
  progressFill.setAttribute('data-phase', sig.get());
  progressFill.style.width = '0%';
  progressFill.setAttribute('aria-hidden', 'true');
  progressDiv.appendChild(progressFill);

  // Elapsed
  const elapsedEl = document.createElement('span');
  elapsedEl.setAttribute('data-part', 'elapsed');
  elapsedEl.setAttribute('data-visible', 'true');
  elapsedEl.setAttribute('aria-label', `Elapsed time: ${formatElapsedTime(elapsed)}`);
  elapsedEl.textContent = `Elapsed: ${formatElapsedTime(elapsed)}`;
  if (showElapsed) root.appendChild(elapsedEl);

  // Pause/Resume button
  const pauseBtn = document.createElement('button');
  pauseBtn.type = 'button';
  pauseBtn.setAttribute('data-part', 'pause-resume');
  pauseBtn.setAttribute('aria-label', 'Pause timer');
  pauseBtn.textContent = 'Pause';
  root.appendChild(pauseBtn);

  pauseBtn.addEventListener('click', () => {
    const s = sig.get();
    if (s === 'paused') send('RESUME');
    else send('PAUSE');
  });

  function tick() {
    const now = Date.now();
    remaining = Math.max(0, dueTime - now);
    elapsed = now - startTime;
    progress = totalDuration > 0 ? Math.min(1, elapsed / totalDuration) : 1;
    const progressPercent = Math.round(progress * 100);

    countdownEl.textContent = sig.get() === 'breached' ? 'BREACHED' : formatCountdown(remaining);
    countdownEl.setAttribute('aria-label', `Time remaining: ${formatCountdown(remaining)}`);

    if (showElapsed) {
      elapsedEl.textContent = `Elapsed: ${formatElapsedTime(elapsed)}`;
      elapsedEl.setAttribute('aria-label', `Elapsed time: ${formatElapsedTime(elapsed)}`);
    }

    progressFill.style.width = `${progressPercent}%`;
    progressDiv.setAttribute('aria-valuenow', String(progressPercent));
    progressDiv.setAttribute('aria-label', `SLA progress: ${progressPercent}%`);

    send('TICK');

    if (remaining <= 0 && !breachedFlag) {
      breachedFlag = true;
      send('BREACH');
      onBreach?.();
    } else if (progress >= criticalThreshold && !criticalFlag && remaining > 0) {
      criticalFlag = true;
      send('CRITICAL_THRESHOLD');
      onCritical?.();
    } else if (progress >= warningThreshold && !warningFlag && remaining > 0) {
      warningFlag = true;
      send('WARNING_THRESHOLD');
      onWarning?.();
    }
  }

  function startTimer() {
    if (timerInterval) return;
    tick();
    timerInterval = setInterval(tick, 1000);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  startTimer();

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    root.setAttribute('aria-label', `SLA timer: ${PHASE_LABELS[s]}`);
    phaseEl.textContent = PHASE_LABELS[s];
    phaseEl.setAttribute('data-phase', s);
    progressDiv.setAttribute('data-phase', s);
    progressFill.setAttribute('data-phase', s);

    if (s === 'paused') {
      stopTimer();
      pauseBtn.textContent = 'Resume';
      pauseBtn.setAttribute('aria-label', 'Resume timer');
    } else {
      if (!timerInterval && s !== 'breached') startTimer();
      pauseBtn.textContent = 'Pause';
      pauseBtn.setAttribute('aria-label', 'Pause timer');
    }

    pauseBtn.style.display = s === 'breached' ? 'none' : '';
  });

  return {
    element: root,
    dispose() {
      unsub();
      stopTimer();
      root.remove();
    },
  };
}

export default SlaTimer;
