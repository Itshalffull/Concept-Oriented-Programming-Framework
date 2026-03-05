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
  | { type: 'RESUME' }
  | { type: 'CHALLENGE' };

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

export interface TimelockCountdownProps { [key: string]: unknown; class?: string; }
export interface TimelockCountdownResult { element: HTMLElement; dispose: () => void; }

export function TimelockCountdown(props: TimelockCountdownProps): TimelockCountdownResult {
  const sig = surfaceCreateSignal<TimelockCountdownState>('running');
  const state = () => sig.get();
  const send = (type: string) => sig.set(timelockCountdownReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'timelock-countdown');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'timer');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('data-state', state());
  root.setAttribute('data-variant', 'phase-based');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Phase label */
  const phaseLabelEl = document.createElement('span');
  phaseLabelEl.setAttribute('data-part', 'phase-label');
  phaseLabelEl.setAttribute('data-state', state());
  root.appendChild(phaseLabelEl);

  /* Countdown text */
  const countdownTextEl = document.createElement('span');
  countdownTextEl.setAttribute('data-part', 'countdown-text');
  countdownTextEl.setAttribute('data-state', state());
  countdownTextEl.setAttribute('data-urgency', state());
  countdownTextEl.setAttribute('aria-atomic', 'true');
  root.appendChild(countdownTextEl);

  /* Target date */
  const targetDateEl = document.createElement('span');
  targetDateEl.setAttribute('data-part', 'target-date');
  targetDateEl.setAttribute('data-state', state());
  root.appendChild(targetDateEl);

  /* Progress bar */
  const progressBarEl = document.createElement('div');
  progressBarEl.setAttribute('data-part', 'progress-bar');
  progressBarEl.setAttribute('data-state', state());
  progressBarEl.setAttribute('role', 'progressbar');
  progressBarEl.setAttribute('aria-valuenow', '0');
  progressBarEl.setAttribute('aria-valuemin', '0');
  progressBarEl.setAttribute('aria-valuemax', '100');
  progressBarEl.setAttribute('aria-label', 'Timelock progress');

  const progressFillEl = document.createElement('div');
  progressFillEl.setAttribute('data-part', 'progress-fill');
  progressFillEl.style.width = '0%';
  progressFillEl.style.height = '100%';
  progressFillEl.style.transition = 'width 0.3s ease';
  progressBarEl.appendChild(progressFillEl);
  root.appendChild(progressBarEl);

  /* Execute button */
  const executeButtonEl = document.createElement('button');
  executeButtonEl.type = 'button';
  executeButtonEl.setAttribute('data-part', 'execute-button');
  executeButtonEl.setAttribute('data-state', state());
  executeButtonEl.setAttribute('aria-label', 'Execute proposal');
  executeButtonEl.setAttribute('tabindex', '0');
  executeButtonEl.disabled = true;
  executeButtonEl.setAttribute('aria-disabled', 'true');
  executeButtonEl.textContent = 'Execute';
  executeButtonEl.addEventListener('click', () => {
    if (state() === 'expired') send('EXECUTE');
  });
  root.appendChild(executeButtonEl);

  /* Challenge button */
  const challengeButtonEl = document.createElement('button');
  challengeButtonEl.type = 'button';
  challengeButtonEl.setAttribute('data-part', 'challenge-button');
  challengeButtonEl.setAttribute('data-state', state());
  challengeButtonEl.setAttribute('data-visible', 'true');
  challengeButtonEl.setAttribute('aria-label', 'Challenge execution');
  challengeButtonEl.setAttribute('tabindex', '0');
  challengeButtonEl.textContent = 'Challenge';
  root.appendChild(challengeButtonEl);

  /* Keyboard handler */
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (state() === 'expired') send('EXECUTE');
    }
    if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const disabledStates = ['expired', 'completed', 'executing'];
      if (!disabledStates.includes(state())) {
        // Challenge action
      }
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    phaseLabelEl.setAttribute('data-state', s);
    countdownTextEl.setAttribute('data-state', s);
    countdownTextEl.setAttribute('data-urgency', s);
    targetDateEl.setAttribute('data-state', s);
    progressBarEl.setAttribute('data-state', s);
    executeButtonEl.setAttribute('data-state', s);
    challengeButtonEl.setAttribute('data-state', s);

    const executeDisabled = s !== 'expired';
    executeButtonEl.disabled = executeDisabled;
    executeButtonEl.setAttribute('aria-disabled', String(executeDisabled));
    executeButtonEl.textContent = s === 'executing' ? 'Executing...' : 'Execute';

    const challengeDisabled = s === 'expired' || s === 'completed' || s === 'executing';
    challengeButtonEl.disabled = challengeDisabled;
    challengeButtonEl.setAttribute('aria-disabled', String(challengeDisabled));

    if (s === 'completed') {
      countdownTextEl.textContent = 'Done';
    }
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default TimelockCountdown;
