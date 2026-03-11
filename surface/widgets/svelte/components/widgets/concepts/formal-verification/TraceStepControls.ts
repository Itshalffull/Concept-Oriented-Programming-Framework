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

const SPEED_OPTIONS = [1, 2, 4] as const;
type PlaybackSpeed = (typeof SPEED_OPTIONS)[number];

export interface TraceStepControlsProps { [key: string]: unknown; class?: string; }
export interface TraceStepControlsResult { element: HTMLElement; dispose: () => void; }

export function TraceStepControls(props: TraceStepControlsProps): TraceStepControlsResult {
  const currentStep = typeof props.currentStep === 'number' ? props.currentStep : 0;
  const totalSteps = typeof props.totalSteps === 'number' ? props.totalSteps : 0;
  const playing = props.playing === true;
  const speed = typeof props.speed === 'number' ? props.speed : 1;
  const showSpeed = props.showSpeed !== false;
  const onStepForward = props.onStepForward as (() => void) | undefined;
  const onStepBack = props.onStepBack as (() => void) | undefined;
  const onPlay = props.onPlay as (() => void) | undefined;
  const onPause = props.onPause as (() => void) | undefined;
  const onSeek = props.onSeek as ((step: number) => void) | undefined;
  const onFirst = props.onFirst as (() => void) | undefined;
  const onLast = props.onLast as (() => void) | undefined;
  const onSpeedChange = props.onSpeedChange as ((speed: number) => void) | undefined;

  const sig = surfaceCreateSignal<TraceStepControlsState>(playing ? 'playing' : 'paused');
  const send = (type: string) => sig.set(traceStepControlsReducer(sig.get(), { type } as any));

  let playIntervalId: ReturnType<typeof setInterval> | null = null;

  const atFirst = currentStep <= 0;
  const atLast = currentStep >= totalSteps - 1;
  const progressPercent = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'trace-step-controls');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'Trace step controls');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Transport controls */
  const transportEl = document.createElement('div');
  transportEl.setAttribute('data-part', 'transport');
  transportEl.setAttribute('data-state', sig.get());

  const buttons: HTMLButtonElement[] = [];
  let rovingIndex = 2; // start on play/pause

  function makeButton(part: string, label: string, icon: string, disabled: boolean, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-part', part);
    btn.setAttribute('data-state', sig.get());
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-disabled', String(disabled));
    btn.disabled = disabled;
    btn.textContent = icon;
    btn.addEventListener('click', onClick);
    return btn;
  }

  const jumpStartBtn = makeButton('jump-start', 'Jump to start', '\u25C4\u2502', atFirst, handleJumpStart);
  const stepBackBtn = makeButton('step-back', 'Step backward', '\u25C4', atFirst, handleStepBack);
  const playPauseBtn = makeButton('play-pause', playing ? 'Pause' : 'Play', playing ? '\u23F8' : '\u25B6', false, handlePlayPause);
  const stepFwdBtn = makeButton('step-fwd', 'Step forward', '\u25BA', atLast, handleStepForward);
  const jumpEndBtn = makeButton('jump-end', 'Jump to end', '\u2502\u25BA', atLast, handleJumpEnd);

  buttons.push(jumpStartBtn, stepBackBtn, playPauseBtn, stepFwdBtn, jumpEndBtn);

  for (let i = 0; i < buttons.length; i++) {
    buttons[i].setAttribute('tabindex', i === rovingIndex ? '0' : '-1');
    const idx = i;
    buttons[i].addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setRovingFocus(idx + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setRovingFocus(idx - 1);
      }
    });
    transportEl.appendChild(buttons[i]);
  }
  root.appendChild(transportEl);

  /* Step counter */
  const stepCounterEl = document.createElement('span');
  stepCounterEl.setAttribute('data-part', 'step-counter');
  stepCounterEl.setAttribute('data-state', sig.get());
  stepCounterEl.setAttribute('role', 'status');
  stepCounterEl.setAttribute('aria-live', 'polite');
  stepCounterEl.setAttribute('aria-label', `Step ${currentStep + 1} of ${totalSteps}`);
  stepCounterEl.textContent = `Step ${currentStep + 1} of ${totalSteps}`;
  root.appendChild(stepCounterEl);

  /* Progress bar */
  const progressBarEl = document.createElement('div');
  progressBarEl.setAttribute('data-part', 'progress-bar');
  progressBarEl.setAttribute('data-state', sig.get());
  progressBarEl.setAttribute('role', 'progressbar');
  progressBarEl.setAttribute('aria-valuenow', String(currentStep + 1));
  progressBarEl.setAttribute('aria-valuemin', '1');
  progressBarEl.setAttribute('aria-valuemax', String(totalSteps));
  progressBarEl.setAttribute('aria-label', 'Trace progress');
  progressBarEl.style.cursor = 'pointer';
  progressBarEl.style.position = 'relative';
  progressBarEl.addEventListener('click', (e) => {
    if (totalSteps <= 0) return;
    const rect = progressBarEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const step = Math.round(ratio * (totalSteps - 1));
    const clamped = Math.max(0, Math.min(totalSteps - 1, step));
    onSeek?.(clamped);
  });

  const progressFillEl = document.createElement('div');
  progressFillEl.setAttribute('data-part', 'progress-fill');
  progressFillEl.setAttribute('data-state', sig.get());
  progressFillEl.style.width = `${progressPercent}%`;
  progressFillEl.style.height = '100%';
  progressFillEl.style.position = 'absolute';
  progressFillEl.style.top = '0';
  progressFillEl.style.left = '0';
  progressBarEl.appendChild(progressFillEl);
  root.appendChild(progressBarEl);

  /* Speed control */
  if (showSpeed) {
    const speedControlEl = document.createElement('div');
    speedControlEl.setAttribute('data-part', 'speed-control');
    speedControlEl.setAttribute('data-state', sig.get());
    speedControlEl.setAttribute('data-visible', 'true');

    for (const s of SPEED_OPTIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-part', 'speed-option');
      btn.setAttribute('data-state', sig.get());
      btn.setAttribute('data-selected', s === speed ? 'true' : 'false');
      btn.setAttribute('aria-label', `Playback speed ${s}x`);
      btn.setAttribute('aria-pressed', s === speed ? 'true' : 'false');
      btn.textContent = `${s}x`;
      btn.addEventListener('click', () => onSpeedChange?.(s));
      speedControlEl.appendChild(btn);
    }
    root.appendChild(speedControlEl);
  }

  function setRovingFocus(index: number): void {
    const clamped = Math.max(0, Math.min(4, index));
    rovingIndex = clamped;
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('tabindex', i === clamped ? '0' : '-1');
    }
    buttons[clamped]?.focus();
  }

  function handlePlayPause(): void {
    if (sig.get() === 'playing') {
      send('PAUSE');
      onPause?.();
    } else {
      if (atLast) return;
      send('PLAY');
      onPlay?.();
    }
  }

  function handleStepForward(): void {
    if (atLast) return;
    send('STEP_FWD');
    onStepForward?.();
  }

  function handleStepBack(): void {
    if (atFirst) return;
    send('STEP_BACK');
    onStepBack?.();
  }

  function handleJumpStart(): void {
    if (atFirst) return;
    send('JUMP_START');
    onFirst?.();
  }

  function handleJumpEnd(): void {
    if (atLast) return;
    send('JUMP_END');
    onLast?.();
  }

  function startPlayback(): void {
    stopPlayback();
    const intervalMs = 1000 / speed;
    playIntervalId = setInterval(() => {
      onStepForward?.();
    }, intervalMs);
  }

  function stopPlayback(): void {
    if (playIntervalId !== null) {
      clearInterval(playIntervalId);
      playIntervalId = null;
    }
  }

  root.addEventListener('keydown', (e) => {
    switch (e.key) {
      case ' ':
        e.preventDefault();
        handlePlayPause();
        break;
      case 'ArrowRight':
        e.preventDefault();
        handleStepForward();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        handleStepBack();
        break;
      case 'Home':
        e.preventDefault();
        handleJumpStart();
        break;
      case 'End':
        e.preventDefault();
        handleJumpEnd();
        break;
    }
  });

  // Start playback if initially playing
  if (playing) startPlayback();

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    transportEl.setAttribute('data-state', s);
    stepCounterEl.setAttribute('data-state', s);
    progressBarEl.setAttribute('data-state', s);
    progressFillEl.setAttribute('data-state', s);

    playPauseBtn.setAttribute('aria-label', s === 'playing' ? 'Pause' : 'Play');
    playPauseBtn.textContent = s === 'playing' ? '\u23F8' : '\u25B6';
    playPauseBtn.setAttribute('data-state', s);

    if (s === 'playing') {
      startPlayback();
    } else {
      stopPlayback();
    }
  });

  return {
    element: root,
    dispose() {
      unsub();
      stopPlayback();
      root.remove();
    },
  };
}

export default TraceStepControls;
