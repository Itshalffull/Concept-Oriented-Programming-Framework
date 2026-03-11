import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type TraceStepControlsState = 'paused' | 'playing';
export type TraceStepControlsEvent =
  | { type: 'PLAY' }
  | { type: 'STEP_FWD' }
  | { type: 'STEP_BACK' }
  | { type: 'JUMP_START' }
  | { type: 'JUMP_END' }
  | { type: 'PAUSE' }
  | { type: 'REACH_END' };

export function traceStepControlsReducer(state: TraceStepControlsState, event: TraceStepControlsEvent): TraceStepControlsState {
  switch (state) {
    case 'paused':
      if (event.type === 'PLAY') return 'playing';
      if (event.type === 'STEP_FWD') return 'paused';
      if (event.type === 'STEP_BACK') return 'paused';
      if (event.type === 'JUMP_START') return 'paused';
      if (event.type === 'JUMP_END') return 'paused';
      return state;
    case 'playing':
      if (event.type === 'PAUSE') return 'paused';
      if (event.type === 'REACH_END') return 'paused';
      return state;
    default:
      return state;
  }
}

export interface TraceStepControlsProps { [key: string]: unknown; class?: string; }
export interface TraceStepControlsResult { element: HTMLElement; dispose: () => void; }

export function TraceStepControls(props: TraceStepControlsProps): TraceStepControlsResult {
  const sig = surfaceCreateSignal<TraceStepControlsState>('paused');
  const state = () => sig.get();
  const send = (type: string) => sig.set(traceStepControlsReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'trace-step-controls');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'Trace step controls');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Transport controls container */
  const transportEl = document.createElement('div');
  transportEl.setAttribute('data-part', 'transport');
  transportEl.setAttribute('data-state', state());

  /* Jump to start button */
  const jumpStartEl = document.createElement('button');
  jumpStartEl.type = 'button';
  jumpStartEl.setAttribute('data-part', 'jump-start');
  jumpStartEl.setAttribute('data-state', state());
  jumpStartEl.setAttribute('aria-label', 'Jump to start');
  jumpStartEl.setAttribute('tabindex', '-1');
  jumpStartEl.textContent = '\u25C4\u2502';
  jumpStartEl.addEventListener('click', () => send('JUMP_START'));
  transportEl.appendChild(jumpStartEl);

  /* Step back button */
  const stepBackEl = document.createElement('button');
  stepBackEl.type = 'button';
  stepBackEl.setAttribute('data-part', 'step-back');
  stepBackEl.setAttribute('data-state', state());
  stepBackEl.setAttribute('aria-label', 'Step backward');
  stepBackEl.setAttribute('tabindex', '-1');
  stepBackEl.textContent = '\u25C4';
  stepBackEl.addEventListener('click', () => send('STEP_BACK'));
  transportEl.appendChild(stepBackEl);

  /* Play/Pause button */
  const playPauseEl = document.createElement('button');
  playPauseEl.type = 'button';
  playPauseEl.setAttribute('data-part', 'play-pause');
  playPauseEl.setAttribute('data-state', state());
  playPauseEl.setAttribute('aria-label', 'Play');
  playPauseEl.setAttribute('tabindex', '0');
  playPauseEl.textContent = '\u25B6';
  playPauseEl.addEventListener('click', () => {
    if (state() === 'playing') send('PAUSE');
    else send('PLAY');
  });
  transportEl.appendChild(playPauseEl);

  /* Step forward button */
  const stepFwdEl = document.createElement('button');
  stepFwdEl.type = 'button';
  stepFwdEl.setAttribute('data-part', 'step-fwd');
  stepFwdEl.setAttribute('data-state', state());
  stepFwdEl.setAttribute('aria-label', 'Step forward');
  stepFwdEl.setAttribute('tabindex', '-1');
  stepFwdEl.textContent = '\u25BA';
  stepFwdEl.addEventListener('click', () => send('STEP_FWD'));
  transportEl.appendChild(stepFwdEl);

  /* Jump to end button */
  const jumpEndEl = document.createElement('button');
  jumpEndEl.type = 'button';
  jumpEndEl.setAttribute('data-part', 'jump-end');
  jumpEndEl.setAttribute('data-state', state());
  jumpEndEl.setAttribute('aria-label', 'Jump to end');
  jumpEndEl.setAttribute('tabindex', '-1');
  jumpEndEl.textContent = '\u2502\u25BA';
  jumpEndEl.addEventListener('click', () => send('JUMP_END'));
  transportEl.appendChild(jumpEndEl);

  root.appendChild(transportEl);

  /* Step counter */
  const stepCounterEl = document.createElement('span');
  stepCounterEl.setAttribute('data-part', 'step-counter');
  stepCounterEl.setAttribute('data-state', state());
  stepCounterEl.setAttribute('role', 'status');
  stepCounterEl.setAttribute('aria-live', 'polite');
  stepCounterEl.setAttribute('aria-label', 'Step 1 of 1');
  stepCounterEl.textContent = 'Step 1 of 1';
  root.appendChild(stepCounterEl);

  /* Progress bar */
  const progressBarEl = document.createElement('div');
  progressBarEl.setAttribute('data-part', 'progress-bar');
  progressBarEl.setAttribute('data-state', state());
  progressBarEl.setAttribute('role', 'progressbar');
  progressBarEl.setAttribute('aria-valuenow', '1');
  progressBarEl.setAttribute('aria-valuemin', '1');
  progressBarEl.setAttribute('aria-valuemax', '1');
  progressBarEl.setAttribute('aria-label', 'Trace progress');
  progressBarEl.style.cursor = 'pointer';
  progressBarEl.style.position = 'relative';

  const progressFillEl = document.createElement('div');
  progressFillEl.setAttribute('data-part', 'progress-fill');
  progressFillEl.setAttribute('data-state', state());
  progressFillEl.style.width = '0%';
  progressFillEl.style.height = '100%';
  progressFillEl.style.position = 'absolute';
  progressFillEl.style.top = '0';
  progressFillEl.style.left = '0';
  progressBarEl.appendChild(progressFillEl);

  root.appendChild(progressBarEl);

  /* Speed control */
  const speedControlEl = document.createElement('div');
  speedControlEl.setAttribute('data-part', 'speed-control');
  speedControlEl.setAttribute('data-state', state());
  speedControlEl.setAttribute('data-visible', 'true');

  const speedOptions = [1, 2, 4];
  speedOptions.forEach((s) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-part', 'speed-option');
    btn.setAttribute('data-state', state());
    btn.setAttribute('data-selected', s === 1 ? 'true' : 'false');
    btn.setAttribute('aria-label', `Playback speed ${s}x`);
    btn.setAttribute('aria-pressed', s === 1 ? 'true' : 'false');
    btn.textContent = `${s}x`;
    btn.addEventListener('click', () => {
      /* Update selected states on all speed buttons */
      const buttons = speedControlEl.querySelectorAll('[data-part="speed-option"]');
      buttons.forEach((b) => {
        b.setAttribute('data-selected', 'false');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.setAttribute('data-selected', 'true');
      btn.setAttribute('aria-pressed', 'true');
    });
    speedControlEl.appendChild(btn);
  });
  root.appendChild(speedControlEl);

  /* Keyboard handler */
  root.addEventListener('keydown', (e) => {
    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (state() === 'playing') send('PAUSE');
        else send('PLAY');
        break;
      case 'ArrowRight':
        e.preventDefault();
        send('STEP_FWD');
        break;
      case 'ArrowLeft':
        e.preventDefault();
        send('STEP_BACK');
        break;
      case 'Home':
        e.preventDefault();
        send('JUMP_START');
        break;
      case 'End':
        e.preventDefault();
        send('JUMP_END');
        break;
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    transportEl.setAttribute('data-state', s);
    jumpStartEl.setAttribute('data-state', s);
    stepBackEl.setAttribute('data-state', s);
    playPauseEl.setAttribute('data-state', s);
    stepFwdEl.setAttribute('data-state', s);
    jumpEndEl.setAttribute('data-state', s);
    stepCounterEl.setAttribute('data-state', s);
    progressBarEl.setAttribute('data-state', s);
    progressFillEl.setAttribute('data-state', s);
    speedControlEl.setAttribute('data-state', s);
    const isPlaying = s === 'playing';
    playPauseEl.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    playPauseEl.textContent = isPlaying ? '\u23F8' : '\u25B6';
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default TraceStepControls;
