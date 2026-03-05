import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type TimelockCountdownState = 'running' | 'warning' | 'critical' | 'expired' | 'executing' | 'completed' | 'paused';
export type TimelockCountdownEvent =
  | { type: 'TICK' }
  | { type: 'WARNING_THRESHOLD' }
  | { type: 'EXPIRE' }
  | { type: 'PAUSE' }
  | { type: 'CRITICAL_THRESHOLD' }
  | { type: 'EXECUTE' }
  | { type: 'RESET' }
  | { type: 'EXECUTE_COMPLETE' }
  | { type: 'EXECUTE_ERROR' }
  | { type: 'RESUME' };

export function timelockCountdownReducer(state: TimelockCountdownState, event: TimelockCountdownEvent): TimelockCountdownState {
  switch (state) {
    case 'running':
      if (event.type === 'TICK') return 'running';
      if (event.type === 'WARNING_THRESHOLD') return 'warning';
      if (event.type === 'EXPIRE') return 'expired';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'warning':
      if (event.type === 'TICK') return 'warning';
      if (event.type === 'CRITICAL_THRESHOLD') return 'critical';
      if (event.type === 'EXPIRE') return 'expired';
      return state;
    case 'critical':
      if (event.type === 'TICK') return 'critical';
      if (event.type === 'EXPIRE') return 'expired';
      return state;
    case 'expired':
      if (event.type === 'EXECUTE') return 'executing';
      if (event.type === 'RESET') return 'running';
      return state;
    case 'executing':
      if (event.type === 'EXECUTE_COMPLETE') return 'completed';
      if (event.type === 'EXECUTE_ERROR') return 'expired';
      return state;
    case 'completed':
      return state;
    case 'paused':
      if (event.type === 'RESUME') return 'running';
      return state;
    default:
      return state;
  }
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

function computeTimeRemaining(deadline: Date): TimeRemaining {
  const totalMs = Math.max(0, deadline.getTime() - Date.now());
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, totalMs };
}

function formatRemaining(tr: TimeRemaining): string {
  if (tr.totalMs <= 0) return '0s';
  const parts: string[] = [];
  if (tr.days > 0) parts.push(`${tr.days}d`);
  if (tr.hours > 0) parts.push(`${tr.hours}h`);
  if (tr.minutes > 0) parts.push(`${tr.minutes}m`);
  parts.push(`${tr.seconds}s`);
  return parts.join(' ');
}

export interface TimelockCountdownProps { [key: string]: unknown; class?: string; }
export interface TimelockCountdownResult { element: HTMLElement; dispose: () => void; }

export function TimelockCountdown(props: TimelockCountdownProps): TimelockCountdownResult {
  const sig = surfaceCreateSignal<TimelockCountdownState>('running');
  const send = (type: string) => sig.set(timelockCountdownReducer(sig.get(), { type } as any));

  const phase = String(props.phase ?? '');
  const deadline = String(props.deadline ?? new Date().toISOString());
  const elapsed = typeof props.elapsed === 'number' ? props.elapsed : 0;
  const total = typeof props.total === 'number' ? props.total : 1;
  const showChallenge = props.showChallenge !== false;
  const warningThreshold = typeof props.warningThreshold === 'number' ? props.warningThreshold : 0.8;
  const criticalThreshold = typeof props.criticalThreshold === 'number' ? props.criticalThreshold : 0.95;
  const variant = String(props.variant ?? 'phase-based');
  const onExecute = props.onExecute as (() => void) | undefined;
  const onChallenge = props.onChallenge as (() => void) | undefined;

  const deadlineDate = new Date(deadline);
  const progress = total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0;
  const progressPercent = Math.round(progress * 100);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function getDisplayPhase(): string {
    const s = sig.get();
    switch (s) {
      case 'expired': return 'Ready to execute';
      case 'executing': return 'Executing...';
      case 'completed': return 'Execution complete';
      case 'paused': return `${phase} (paused)`;
      default: return phase;
    }
  }

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'timelock-countdown');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'timer');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-variant', variant);
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  const phaseLabelEl = document.createElement('span');
  phaseLabelEl.setAttribute('data-part', 'phase-label');
  phaseLabelEl.setAttribute('data-state', sig.get());
  phaseLabelEl.textContent = getDisplayPhase();
  root.appendChild(phaseLabelEl);

  const countdownTextEl = document.createElement('span');
  countdownTextEl.setAttribute('data-part', 'countdown-text');
  countdownTextEl.setAttribute('data-state', sig.get());
  countdownTextEl.setAttribute('aria-atomic', 'true');
  root.appendChild(countdownTextEl);

  const targetDateEl = document.createElement('span');
  targetDateEl.setAttribute('data-part', 'target-date');
  targetDateEl.setAttribute('data-state', sig.get());
  try {
    targetDateEl.textContent = deadlineDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' } as any);
  } catch {
    targetDateEl.textContent = deadline;
  }
  root.appendChild(targetDateEl);

  const progressBarEl = document.createElement('div');
  progressBarEl.setAttribute('data-part', 'progress-bar');
  progressBarEl.setAttribute('data-state', sig.get());
  progressBarEl.setAttribute('data-progress', String(progress));
  progressBarEl.setAttribute('role', 'progressbar');
  progressBarEl.setAttribute('aria-valuenow', String(progressPercent));
  progressBarEl.setAttribute('aria-valuemin', '0');
  progressBarEl.setAttribute('aria-valuemax', '100');
  progressBarEl.setAttribute('aria-label', `Timelock progress: ${progressPercent}%`);
  const progressFillEl = document.createElement('div');
  progressFillEl.setAttribute('data-part', 'progress-fill');
  progressFillEl.style.width = `${progressPercent}%`;
  progressFillEl.style.height = '100%';
  progressFillEl.style.transition = 'width 0.3s ease';
  progressBarEl.appendChild(progressFillEl);
  root.appendChild(progressBarEl);

  const executeButtonEl = document.createElement('button');
  executeButtonEl.type = 'button';
  executeButtonEl.setAttribute('data-part', 'execute-button');
  executeButtonEl.setAttribute('data-state', sig.get());
  executeButtonEl.setAttribute('aria-label', 'Execute proposal');
  executeButtonEl.setAttribute('tabindex', '0');
  executeButtonEl.textContent = 'Execute';
  executeButtonEl.addEventListener('click', handleExecute);
  root.appendChild(executeButtonEl);

  if (showChallenge) {
    const challengeButtonEl = document.createElement('button');
    challengeButtonEl.type = 'button';
    challengeButtonEl.setAttribute('data-part', 'challenge-button');
    challengeButtonEl.setAttribute('data-state', sig.get());
    challengeButtonEl.setAttribute('data-visible', 'true');
    challengeButtonEl.setAttribute('aria-label', 'Challenge execution');
    challengeButtonEl.setAttribute('tabindex', '0');
    challengeButtonEl.textContent = 'Challenge';
    challengeButtonEl.addEventListener('click', handleChallenge);
    root.appendChild(challengeButtonEl);
  }

  function handleExecute(): void {
    if (sig.get() === 'expired') {
      send('EXECUTE');
      onExecute?.();
    }
  }

  function handleChallenge(): void {
    const s = sig.get();
    if (s !== 'expired' && s !== 'completed' && s !== 'executing') {
      onChallenge?.();
    }
  }

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleExecute(); }
    if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); handleChallenge(); }
  });

  function updateDisplay(): void {
    const s = sig.get();
    const tr = computeTimeRemaining(deadlineDate);
    countdownTextEl.textContent = s === 'completed' ? 'Done' : formatRemaining(tr);
    countdownTextEl.setAttribute('data-state', s);
    countdownTextEl.setAttribute('data-urgency', s);
    phaseLabelEl.textContent = getDisplayPhase();
    phaseLabelEl.setAttribute('data-state', s);
    root.setAttribute('aria-label', `${getDisplayPhase()}: ${countdownTextEl.textContent}`);

    const executeDisabled = s !== 'expired';
    executeButtonEl.disabled = executeDisabled;
    executeButtonEl.setAttribute('aria-disabled', String(executeDisabled));
    executeButtonEl.setAttribute('data-state', s);
    executeButtonEl.textContent = s === 'executing' ? 'Executing...' : 'Execute';
  }

  function tick(): void {
    const tr = computeTimeRemaining(deadlineDate);
    if (tr.totalMs <= 0) {
      send('EXPIRE');
      stopInterval();
      updateDisplay();
      return;
    }
    const currentProgress = total > 0 ? Math.min(1, elapsed / total) : 0;
    const s = sig.get();
    if (s === 'running' && currentProgress >= warningThreshold) send('WARNING_THRESHOLD');
    else if (s === 'warning' && currentProgress >= criticalThreshold) send('CRITICAL_THRESHOLD');
    else send('TICK');
    updateDisplay();
  }

  function stopInterval(): void {
    if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
  }

  function startInterval(): void {
    stopInterval();
    const tickingStates = ['running', 'warning', 'critical'];
    if (tickingStates.includes(sig.get())) {
      tick();
      intervalId = setInterval(tick, 1000);
    }
  }

  // Check if already expired
  if (deadlineDate.getTime() <= Date.now()) {
    send('EXPIRE');
  }

  updateDisplay();
  startInterval();

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    const tickingStates = ['running', 'warning', 'critical'];
    if (!tickingStates.includes(s)) stopInterval();
    else if (intervalId === null) startInterval();
    updateDisplay();
  });

  return {
    element: root,
    dispose() { unsub(); stopInterval(); root.remove(); },
  };
}

export default TimelockCountdown;
