import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type TraceTimelineViewerState = 'idle' | 'playing' | 'cellSelected';
export type TraceTimelineViewerEvent =
  | { type: 'PLAY' }
  | { type: 'STEP_FORWARD' }
  | { type: 'STEP_BACKWARD' }
  | { type: 'SELECT_CELL' }
  | { type: 'ZOOM' }
  | { type: 'PAUSE' }
  | { type: 'STEP_END' }
  | { type: 'DESELECT' };

export function traceTimelineViewerReducer(state: TraceTimelineViewerState, event: TraceTimelineViewerEvent): TraceTimelineViewerState {
  switch (state) {
    case 'idle':
      if (event.type === 'PLAY') return 'playing';
      if (event.type === 'STEP_FORWARD') return 'idle';
      if (event.type === 'STEP_BACKWARD') return 'idle';
      if (event.type === 'SELECT_CELL') return 'cellSelected';
      if (event.type === 'ZOOM') return 'idle';
      return state;
    case 'playing':
      if (event.type === 'PAUSE') return 'idle';
      if (event.type === 'STEP_END') return 'idle';
      return state;
    case 'cellSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_CELL') return 'cellSelected';
      return state;
    default:
      return state;
  }
}

export interface TraceStep {
  index: number;
  label: string;
  state: Record<string, string>;
  isError?: boolean;
  timestamp?: string;
}

export interface TraceTimelineViewerProps { [key: string]: unknown; class?: string; }
export interface TraceTimelineViewerResult { element: HTMLElement; dispose: () => void; }

export function TraceTimelineViewer(props: TraceTimelineViewerProps): TraceTimelineViewerResult {
  const sig = surfaceCreateSignal<TraceTimelineViewerState>('idle');
  const send = (type: string) => sig.set(traceTimelineViewerReducer(sig.get(), { type } as any));

  const steps = (props.steps ?? []) as TraceStep[];
  const playbackSpeed = typeof props.playbackSpeed === 'number' ? props.playbackSpeed : 1.0;
  const showChangesOnly = props.showChangesOnly === true;
  const zoom = typeof props.zoom === 'number' ? props.zoom : 1.0;
  const onStepChange = props.onStepChange as ((stepIndex: number) => void) | undefined;

  const variablesProp = props.variables as string[] | undefined;
  const variables: string[] = variablesProp ?? (() => {
    const keys = new Set<string>();
    for (const step of steps) {
      for (const k of Object.keys(step.state)) keys.add(k);
    }
    return Array.from(keys);
  })();

  let activeStep = typeof props.currentStep === 'number' ? props.currentStep : 0;
  let selectedCell: { step: number; variable: string } | null = null;
  let focusedLane = 0;
  let playbackIntervalId: ReturnType<typeof setInterval> | null = null;

  function goToStep(idx: number): void {
    const clamped = Math.max(0, Math.min(idx, steps.length - 1));
    activeStep = clamped;
    onStepChange?.(clamped);
    rebuildAll();
  }

  function didValueChange(stepIdx: number, variable: string): boolean {
    if (stepIdx === 0) return false;
    const prev = steps[stepIdx - 1]?.state[variable];
    const curr = steps[stepIdx]?.state[variable];
    return prev !== curr;
  }

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'trace-timeline-viewer');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'grid');
  root.setAttribute('aria-label', 'Trace timeline');
  root.setAttribute('aria-rowcount', String(variables.length));
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-zoom', String(zoom));
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Time axis */
  const timeAxisEl = document.createElement('div');
  timeAxisEl.setAttribute('data-part', 'time-axis');
  timeAxisEl.setAttribute('data-state', sig.get());
  timeAxisEl.setAttribute('data-step-count', String(steps.length));
  timeAxisEl.setAttribute('role', 'row');
  root.appendChild(timeAxisEl);

  /* Lanes container */
  const lanesEl = document.createElement('div');
  lanesEl.setAttribute('data-part', 'lanes');
  lanesEl.setAttribute('data-state', sig.get());
  root.appendChild(lanesEl);

  /* Step cursor */
  const stepCursorEl = document.createElement('div');
  stepCursorEl.setAttribute('data-part', 'step-cursor');
  stepCursorEl.setAttribute('data-state', sig.get());
  stepCursorEl.setAttribute('data-position', String(activeStep));
  stepCursorEl.setAttribute('aria-hidden', 'true');
  root.appendChild(stepCursorEl);

  /* Controls */
  const controlsEl = document.createElement('div');
  controlsEl.setAttribute('data-part', 'controls');
  controlsEl.setAttribute('data-state', sig.get());
  controlsEl.setAttribute('role', 'toolbar');
  controlsEl.setAttribute('aria-label', 'Playback controls');

  const stepBackBtn = document.createElement('button');
  stepBackBtn.type = 'button';
  stepBackBtn.setAttribute('data-part', 'step-back-btn');
  stepBackBtn.setAttribute('aria-label', 'Step backward');
  stepBackBtn.setAttribute('tabindex', '0');
  stepBackBtn.textContent = '\u00AB';
  stepBackBtn.addEventListener('click', () => { send('STEP_BACKWARD'); goToStep(activeStep - 1); });
  controlsEl.appendChild(stepBackBtn);

  const playPauseBtn = document.createElement('button');
  playPauseBtn.type = 'button';
  playPauseBtn.setAttribute('data-part', 'play-pause-btn');
  playPauseBtn.setAttribute('aria-label', 'Play');
  playPauseBtn.setAttribute('tabindex', '0');
  playPauseBtn.textContent = '\u25B6';
  playPauseBtn.addEventListener('click', () => {
    if (sig.get() === 'playing') { send('PAUSE'); } else { send('PLAY'); }
  });
  controlsEl.appendChild(playPauseBtn);

  const stepFwdBtn = document.createElement('button');
  stepFwdBtn.type = 'button';
  stepFwdBtn.setAttribute('data-part', 'step-fwd-btn');
  stepFwdBtn.setAttribute('aria-label', 'Step forward');
  stepFwdBtn.setAttribute('tabindex', '0');
  stepFwdBtn.textContent = '\u00BB';
  stepFwdBtn.addEventListener('click', () => { send('STEP_FORWARD'); goToStep(activeStep + 1); });
  controlsEl.appendChild(stepFwdBtn);

  const stepCounterEl = document.createElement('span');
  stepCounterEl.setAttribute('data-part', 'step-counter');
  stepCounterEl.setAttribute('aria-live', 'polite');
  controlsEl.appendChild(stepCounterEl);

  root.appendChild(controlsEl);

  /* Zoom controls */
  const zoomControlEl = document.createElement('div');
  zoomControlEl.setAttribute('data-part', 'zoom-control');
  zoomControlEl.setAttribute('data-state', sig.get());

  const zoomInBtn = document.createElement('button');
  zoomInBtn.type = 'button';
  zoomInBtn.setAttribute('data-part', 'zoom-in-btn');
  zoomInBtn.setAttribute('aria-label', 'Zoom in');
  zoomInBtn.setAttribute('tabindex', '0');
  zoomInBtn.textContent = '+';
  zoomInBtn.addEventListener('click', () => send('ZOOM'));
  zoomControlEl.appendChild(zoomInBtn);

  const zoomOutBtn = document.createElement('button');
  zoomOutBtn.type = 'button';
  zoomOutBtn.setAttribute('data-part', 'zoom-out-btn');
  zoomOutBtn.setAttribute('aria-label', 'Zoom out');
  zoomOutBtn.setAttribute('tabindex', '0');
  zoomOutBtn.textContent = '-';
  zoomOutBtn.addEventListener('click', () => send('ZOOM'));
  zoomControlEl.appendChild(zoomOutBtn);

  root.appendChild(zoomControlEl);

  /* Detail panel */
  const detailPanelEl = document.createElement('div');
  detailPanelEl.setAttribute('data-part', 'detail-panel');
  detailPanelEl.setAttribute('data-state', sig.get());
  detailPanelEl.setAttribute('role', 'region');
  detailPanelEl.setAttribute('aria-live', 'polite');
  detailPanelEl.style.display = 'none';
  root.appendChild(detailPanelEl);

  function rebuildAll(): void {
    rebuildTimeAxis();
    rebuildLanes();
    updateCursor();
    updateControls();
    updateDetailPanel();
  }

  function rebuildTimeAxis(): void {
    timeAxisEl.innerHTML = '';
    const cornerEl = document.createElement('span');
    cornerEl.setAttribute('data-part', 'time-axis-corner');
    cornerEl.setAttribute('role', 'columnheader');
    timeAxisEl.appendChild(cornerEl);

    for (const step of steps) {
      const labelEl = document.createElement('span');
      labelEl.setAttribute('data-part', 'time-axis-label');
      labelEl.setAttribute('data-step', String(step.index));
      if (step.isError) labelEl.setAttribute('data-error', 'true');
      labelEl.setAttribute('role', 'columnheader');
      labelEl.setAttribute('aria-label', `Step ${step.index}${step.isError ? ' (error)' : ''}`);
      if (step.isError) labelEl.style.color = 'var(--trace-error-color, red)';
      labelEl.textContent = String(step.index);
      timeAxisEl.appendChild(labelEl);
    }
  }

  function rebuildLanes(): void {
    lanesEl.innerHTML = '';

    for (let laneIdx = 0; laneIdx < variables.length; laneIdx++) {
      const variable = variables[laneIdx];
      const laneEl = document.createElement('div');
      laneEl.setAttribute('data-part', 'lane');
      laneEl.setAttribute('data-state', sig.get());
      laneEl.setAttribute('data-variable', variable);
      if (laneIdx === focusedLane) laneEl.setAttribute('data-focused', 'true');
      laneEl.setAttribute('role', 'row');
      laneEl.setAttribute('aria-label', variable);

      const laneLabelEl = document.createElement('span');
      laneLabelEl.setAttribute('data-part', 'lane-label');
      laneLabelEl.setAttribute('data-state', sig.get());
      laneLabelEl.textContent = variable;
      laneEl.appendChild(laneLabelEl);

      for (const step of steps) {
        const value = step.state[variable] ?? '';
        const changed = didValueChange(step.index, variable);
        if (showChangesOnly && !changed && step.index !== 0) continue;

        const isCurrent = step.index === activeStep;
        const isSelected = selectedCell?.step === step.index && selectedCell?.variable === variable;

        const cellEl = document.createElement('div');
        cellEl.setAttribute('data-part', 'cell');
        cellEl.setAttribute('data-state', sig.get());
        cellEl.setAttribute('data-step', String(step.index));
        cellEl.setAttribute('data-changed', changed ? 'true' : 'false');
        if (step.isError) cellEl.setAttribute('data-error', 'true');
        if (isSelected) cellEl.setAttribute('data-selected', 'true');
        cellEl.setAttribute('role', 'gridcell');
        cellEl.setAttribute('aria-label', `${variable} at step ${step.index}: ${value}`);
        if (isCurrent) cellEl.setAttribute('aria-current', 'step');
        cellEl.setAttribute('tabindex', '-1');

        if (step.isError) {
          cellEl.style.backgroundColor = 'var(--trace-error-bg, #fee2e2)';
          cellEl.style.color = 'var(--trace-error-color, red)';
        }
        if (changed) cellEl.style.fontWeight = 'bold';
        if (isSelected) cellEl.style.outline = '2px solid var(--trace-selected-outline, currentColor)';

        cellEl.textContent = value;
        cellEl.addEventListener('click', () => {
          selectedCell = { step: step.index, variable };
          goToStep(step.index);
          send('SELECT_CELL');
        });

        laneEl.appendChild(cellEl);
      }

      lanesEl.appendChild(laneEl);
    }
  }

  function updateCursor(): void {
    stepCursorEl.setAttribute('data-position', String(activeStep));
    stepCursorEl.setAttribute('data-state', sig.get());
  }

  function updateControls(): void {
    const s = sig.get();
    stepBackBtn.disabled = activeStep <= 0;
    stepFwdBtn.disabled = activeStep >= steps.length - 1;
    playPauseBtn.setAttribute('aria-label', s === 'playing' ? 'Pause' : 'Play');
    playPauseBtn.textContent = s === 'playing' ? '\u23F8' : '\u25B6';
    stepCounterEl.textContent = steps.length > 0 ? `${activeStep + 1} / ${steps.length}` : '0 / 0';
    controlsEl.setAttribute('data-state', s);
  }

  function updateDetailPanel(): void {
    const s = sig.get();
    const currentStepData = steps[activeStep] as TraceStep | undefined;

    if (s === 'cellSelected' && currentStepData) {
      detailPanelEl.style.display = '';
      detailPanelEl.setAttribute('data-step', String(activeStep));
      detailPanelEl.setAttribute('aria-label', `State detail for step ${activeStep}`);
      detailPanelEl.innerHTML = '';

      const h3 = document.createElement('h3');
      h3.setAttribute('data-part', 'detail-title');
      h3.textContent = `Step ${currentStepData.index}: ${currentStepData.label}`;
      if (currentStepData.isError) {
        const errorBadge = document.createElement('span');
        errorBadge.setAttribute('data-part', 'detail-error-badge');
        errorBadge.style.color = 'var(--trace-error-color, red)';
        errorBadge.textContent = ' (error)';
        h3.appendChild(errorBadge);
      }
      detailPanelEl.appendChild(h3);

      if (currentStepData.timestamp) {
        const timeEl = document.createElement('time');
        timeEl.setAttribute('data-part', 'detail-timestamp');
        timeEl.setAttribute('datetime', currentStepData.timestamp);
        timeEl.textContent = currentStepData.timestamp;
        detailPanelEl.appendChild(timeEl);
      }

      const dl = document.createElement('dl');
      dl.setAttribute('data-part', 'detail-state');
      for (const [key, value] of Object.entries(currentStepData.state)) {
        const entryDiv = document.createElement('div');
        entryDiv.setAttribute('data-part', 'detail-entry');
        entryDiv.setAttribute('data-changed', didValueChange(activeStep, key) ? 'true' : 'false');

        const dt = document.createElement('dt');
        dt.textContent = key;
        entryDiv.appendChild(dt);

        const dd = document.createElement('dd');
        dd.textContent = value;
        if (didValueChange(activeStep, key)) dd.style.fontWeight = 'bold';
        entryDiv.appendChild(dd);

        dl.appendChild(entryDiv);
      }
      detailPanelEl.appendChild(dl);
    } else {
      detailPanelEl.style.display = 'none';
    }
  }

  function startPlayback(): void {
    stopPlayback();
    const intervalMs = Math.max(100, (1 / playbackSpeed) * 1000);
    playbackIntervalId = setInterval(() => {
      const next = activeStep + 1;
      if (next >= steps.length) {
        send('STEP_END');
        return;
      }
      activeStep = next;
      onStepChange?.(next);
      rebuildAll();
    }, intervalMs);
  }

  function stopPlayback(): void {
    if (playbackIntervalId !== null) {
      clearInterval(playbackIntervalId);
      playbackIntervalId = null;
    }
  }

  root.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        send('STEP_FORWARD');
        goToStep(activeStep + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        send('STEP_BACKWARD');
        goToStep(activeStep - 1);
        break;
      case ' ':
        e.preventDefault();
        if (sig.get() === 'playing') { send('PAUSE'); } else { send('PLAY'); }
        break;
      case 'Home':
        e.preventDefault();
        goToStep(0);
        break;
      case 'End':
        e.preventDefault();
        goToStep(steps.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusedLane = Math.max(0, focusedLane - 1);
        rebuildLanes();
        break;
      case 'ArrowDown':
        e.preventDefault();
        focusedLane = Math.min(variables.length - 1, focusedLane + 1);
        rebuildLanes();
        break;
      case 'Enter':
        e.preventDefault();
        if (variables[focusedLane] !== undefined) {
          selectedCell = { step: activeStep, variable: variables[focusedLane] };
          send('SELECT_CELL');
          rebuildAll();
        }
        break;
      case 'Escape':
        e.preventDefault();
        selectedCell = null;
        send('DESELECT');
        rebuildAll();
        break;
    }
  });

  rebuildAll();

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    timeAxisEl.setAttribute('data-state', s);
    lanesEl.setAttribute('data-state', s);
    zoomControlEl.setAttribute('data-state', s);

    if (s === 'playing') {
      startPlayback();
    } else {
      stopPlayback();
    }
    updateControls();
    updateDetailPanel();
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

export default TraceTimelineViewer;
