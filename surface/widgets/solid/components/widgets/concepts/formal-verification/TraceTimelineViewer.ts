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

export interface TraceTimelineViewerProps { [key: string]: unknown; class?: string; }
export interface TraceTimelineViewerResult { element: HTMLElement; dispose: () => void; }

export function TraceTimelineViewer(props: TraceTimelineViewerProps): TraceTimelineViewerResult {
  const sig = surfaceCreateSignal<TraceTimelineViewerState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(traceTimelineViewerReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'trace-timeline-viewer');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'grid');
  root.setAttribute('aria-label', 'Trace timeline');
  root.setAttribute('data-state', state());
  root.setAttribute('data-zoom', '1');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Time axis */
  const timeAxisEl = document.createElement('div');
  timeAxisEl.setAttribute('data-part', 'time-axis');
  timeAxisEl.setAttribute('data-state', state());
  timeAxisEl.setAttribute('role', 'row');

  const timeAxisCornerEl = document.createElement('span');
  timeAxisCornerEl.setAttribute('data-part', 'time-axis-corner');
  timeAxisCornerEl.setAttribute('role', 'columnheader');
  timeAxisEl.appendChild(timeAxisCornerEl);

  const timeAxisLabelEl = document.createElement('span');
  timeAxisLabelEl.setAttribute('data-part', 'time-axis-label');
  timeAxisLabelEl.setAttribute('data-step', '0');
  timeAxisLabelEl.setAttribute('role', 'columnheader');
  timeAxisLabelEl.setAttribute('aria-label', 'Step 0');
  timeAxisLabelEl.textContent = '0';
  timeAxisEl.appendChild(timeAxisLabelEl);

  root.appendChild(timeAxisEl);

  /* Variable lanes container */
  const lanesEl = document.createElement('div');
  lanesEl.setAttribute('data-part', 'lanes');
  lanesEl.setAttribute('data-state', state());

  /* Lane template */
  const laneEl = document.createElement('div');
  laneEl.setAttribute('data-part', 'lane');
  laneEl.setAttribute('data-state', state());
  laneEl.setAttribute('role', 'row');

  const laneLabelEl = document.createElement('span');
  laneLabelEl.setAttribute('data-part', 'lane-label');
  laneLabelEl.setAttribute('data-state', state());
  laneEl.appendChild(laneLabelEl);

  /* Cell template within lane */
  const cellEl = document.createElement('div');
  cellEl.setAttribute('data-part', 'cell');
  cellEl.setAttribute('data-state', state());
  cellEl.setAttribute('data-step', '0');
  cellEl.setAttribute('data-changed', 'false');
  cellEl.setAttribute('role', 'gridcell');
  cellEl.setAttribute('tabindex', '-1');
  cellEl.addEventListener('click', () => send('SELECT_CELL'));
  laneEl.appendChild(cellEl);

  lanesEl.appendChild(laneEl);
  root.appendChild(lanesEl);

  /* Step cursor */
  const stepCursorEl = document.createElement('div');
  stepCursorEl.setAttribute('data-part', 'step-cursor');
  stepCursorEl.setAttribute('data-state', state());
  stepCursorEl.setAttribute('data-position', '0');
  stepCursorEl.setAttribute('aria-hidden', 'true');
  root.appendChild(stepCursorEl);

  /* Playback controls */
  const controlsEl = document.createElement('div');
  controlsEl.setAttribute('data-part', 'controls');
  controlsEl.setAttribute('data-state', state());
  controlsEl.setAttribute('role', 'toolbar');
  controlsEl.setAttribute('aria-label', 'Playback controls');

  const stepBackBtnEl = document.createElement('button');
  stepBackBtnEl.type = 'button';
  stepBackBtnEl.setAttribute('data-part', 'step-back-btn');
  stepBackBtnEl.setAttribute('aria-label', 'Step backward');
  stepBackBtnEl.setAttribute('tabindex', '0');
  stepBackBtnEl.textContent = '\u00AB';
  stepBackBtnEl.addEventListener('click', () => {
    send('STEP_BACKWARD');
  });
  controlsEl.appendChild(stepBackBtnEl);

  const playPauseBtnEl = document.createElement('button');
  playPauseBtnEl.type = 'button';
  playPauseBtnEl.setAttribute('data-part', 'play-pause-btn');
  playPauseBtnEl.setAttribute('aria-label', 'Play');
  playPauseBtnEl.setAttribute('tabindex', '0');
  playPauseBtnEl.textContent = '\u25B6';
  playPauseBtnEl.addEventListener('click', () => {
    if (state() === 'playing') send('PAUSE');
    else send('PLAY');
  });
  controlsEl.appendChild(playPauseBtnEl);

  const stepFwdBtnEl = document.createElement('button');
  stepFwdBtnEl.type = 'button';
  stepFwdBtnEl.setAttribute('data-part', 'step-fwd-btn');
  stepFwdBtnEl.setAttribute('aria-label', 'Step forward');
  stepFwdBtnEl.setAttribute('tabindex', '0');
  stepFwdBtnEl.textContent = '\u00BB';
  stepFwdBtnEl.addEventListener('click', () => {
    send('STEP_FORWARD');
  });
  controlsEl.appendChild(stepFwdBtnEl);

  const controlsStepCounterEl = document.createElement('span');
  controlsStepCounterEl.setAttribute('data-part', 'step-counter');
  controlsStepCounterEl.setAttribute('aria-live', 'polite');
  controlsStepCounterEl.textContent = '0 / 0';
  controlsEl.appendChild(controlsStepCounterEl);

  root.appendChild(controlsEl);

  /* Zoom controls */
  const zoomControlEl = document.createElement('div');
  zoomControlEl.setAttribute('data-part', 'zoom-control');
  zoomControlEl.setAttribute('data-state', state());

  const zoomInBtnEl = document.createElement('button');
  zoomInBtnEl.type = 'button';
  zoomInBtnEl.setAttribute('data-part', 'zoom-in-btn');
  zoomInBtnEl.setAttribute('aria-label', 'Zoom in');
  zoomInBtnEl.setAttribute('tabindex', '0');
  zoomInBtnEl.textContent = '+';
  zoomInBtnEl.addEventListener('click', () => send('ZOOM'));
  zoomControlEl.appendChild(zoomInBtnEl);

  const zoomOutBtnEl = document.createElement('button');
  zoomOutBtnEl.type = 'button';
  zoomOutBtnEl.setAttribute('data-part', 'zoom-out-btn');
  zoomOutBtnEl.setAttribute('aria-label', 'Zoom out');
  zoomOutBtnEl.setAttribute('tabindex', '0');
  zoomOutBtnEl.textContent = '-';
  zoomOutBtnEl.addEventListener('click', () => send('ZOOM'));
  zoomControlEl.appendChild(zoomOutBtnEl);

  root.appendChild(zoomControlEl);

  /* Detail panel */
  const detailPanelEl = document.createElement('div');
  detailPanelEl.setAttribute('data-part', 'detail-panel');
  detailPanelEl.setAttribute('data-state', state());
  detailPanelEl.setAttribute('role', 'region');
  detailPanelEl.setAttribute('aria-label', 'State detail');
  detailPanelEl.setAttribute('aria-live', 'polite');
  detailPanelEl.style.display = 'none';

  const detailTitleEl = document.createElement('h3');
  detailTitleEl.setAttribute('data-part', 'detail-title');
  detailPanelEl.appendChild(detailTitleEl);

  const detailErrorBadgeEl = document.createElement('span');
  detailErrorBadgeEl.setAttribute('data-part', 'detail-error-badge');
  detailErrorBadgeEl.style.display = 'none';
  detailPanelEl.appendChild(detailErrorBadgeEl);

  const detailTimestampEl = document.createElement('time');
  detailTimestampEl.setAttribute('data-part', 'detail-timestamp');
  detailPanelEl.appendChild(detailTimestampEl);

  const detailStateEl = document.createElement('dl');
  detailStateEl.setAttribute('data-part', 'detail-state');

  const detailEntryEl = document.createElement('div');
  detailEntryEl.setAttribute('data-part', 'detail-entry');
  detailEntryEl.setAttribute('data-changed', 'false');

  const detailEntryDt = document.createElement('dt');
  detailEntryEl.appendChild(detailEntryDt);

  const detailEntryDd = document.createElement('dd');
  detailEntryEl.appendChild(detailEntryDd);

  detailStateEl.appendChild(detailEntryEl);
  detailPanelEl.appendChild(detailStateEl);

  root.appendChild(detailPanelEl);

  /* Keyboard handler */
  root.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        send('STEP_FORWARD');
        break;
      case 'ArrowLeft':
        e.preventDefault();
        send('STEP_BACKWARD');
        break;
      case ' ':
        e.preventDefault();
        if (state() === 'playing') send('PAUSE');
        else send('PLAY');
        break;
      case 'Home':
        e.preventDefault();
        break;
      case 'End':
        e.preventDefault();
        break;
      case 'ArrowUp':
        e.preventDefault();
        break;
      case 'ArrowDown':
        e.preventDefault();
        break;
      case 'Enter':
        e.preventDefault();
        send('SELECT_CELL');
        break;
      case 'Escape':
        e.preventDefault();
        send('DESELECT');
        break;
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    timeAxisEl.setAttribute('data-state', s);
    lanesEl.setAttribute('data-state', s);
    laneEl.setAttribute('data-state', s);
    laneLabelEl.setAttribute('data-state', s);
    cellEl.setAttribute('data-state', s);
    stepCursorEl.setAttribute('data-state', s);
    controlsEl.setAttribute('data-state', s);
    zoomControlEl.setAttribute('data-state', s);
    detailPanelEl.setAttribute('data-state', s);
    const isPlaying = s === 'playing';
    playPauseBtnEl.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    playPauseBtnEl.textContent = isPlaying ? '\u23F8' : '\u25B6';
    const isCellSelected = s === 'cellSelected';
    detailPanelEl.style.display = isCellSelected ? 'block' : 'none';
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default TraceTimelineViewer;
