/* ---------------------------------------------------------------------------
 * TraceTimelineViewer — Vanilla widget
 * States: idle (initial), playing, cellSelected
 * ------------------------------------------------------------------------- */

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

export interface TraceStep { index: number; label: string; state: Record<string, string>; isError?: boolean; timestamp?: string; }

export interface TraceTimelineViewerProps {
  steps: TraceStep[]; variables?: string[]; currentStep?: number;
  playbackSpeed?: number; showChangesOnly?: boolean; zoom?: number;
  onStepChange?: (stepIndex: number) => void;
  className?: string; [key: string]: unknown;
}
export interface TraceTimelineViewerOptions { target: HTMLElement; props: TraceTimelineViewerProps; }
let _uid = 0;

export class TraceTimelineViewer {
  private el: HTMLElement;
  private props: TraceTimelineViewerProps;
  private widgetState: TraceTimelineViewerState = 'idle';
  private uid = ++_uid;
  private disposers: (() => void)[] = [];
  private intStep = 0;
  private selectedCell: { step: number; variable: string } | null = null;
  private playbackTimer: ReturnType<typeof setInterval> | null = null;
  private focusedLane = 0;

  constructor(private options: TraceTimelineViewerOptions) {
    this.props = { ...options.props };
    this.intStep = this.props.currentStep ?? 0;
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', ''); this.el.setAttribute('data-widget-name', 'trace-timeline-viewer');
    this.el.setAttribute('data-part', 'root'); this.el.setAttribute('role', 'grid');
    this.el.setAttribute('aria-label', 'Trace timeline'); this.el.setAttribute('tabindex', '0');
    this.el.id = 'trace-timeline-viewer-' + this.uid;
    const kd = (e: KeyboardEvent) => this.onKey(e);
    this.el.addEventListener('keydown', kd); this.disposers.push(() => this.el.removeEventListener('keydown', kd));
    this.render(); options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  private sm(ev: TraceTimelineViewerEvent): void { this.widgetState = traceTimelineViewerReducer(this.widgetState, ev); this.el.setAttribute('data-state', this.widgetState); }

  update(props: Partial<TraceTimelineViewerProps>): void {
    Object.assign(this.props, props);
    if (props.currentStep !== undefined) this.intStep = props.currentStep;
    this.syncPlayback(); this.render();
  }

  destroy(): void { this.stopPlayback(); this.disposers.forEach(d => d()); this.el.remove(); }

  private get activeStep(): number { return this.props.currentStep ?? this.intStep; }
  private get variables(): string[] {
    if (this.props.variables) return this.props.variables;
    const keys = new Set<string>(); for (const s of this.props.steps) for (const k of Object.keys(s.state)) keys.add(k);
    return Array.from(keys);
  }

  private goToStep(idx: number): void {
    const c = Math.max(0, Math.min(idx, this.props.steps.length - 1));
    this.intStep = c; this.props.onStepChange?.(c); this.render();
  }

  private didValueChange(stepIdx: number, variable: string): boolean {
    if (stepIdx === 0) return false;
    return this.props.steps[stepIdx - 1]?.state[variable] !== this.props.steps[stepIdx]?.state[variable];
  }

  private stopPlayback(): void { if (this.playbackTimer) { clearInterval(this.playbackTimer); this.playbackTimer = null; } }
  private syncPlayback(): void {
    this.stopPlayback();
    if (this.widgetState === 'playing') {
      const ms = Math.max(100, (1 / (this.props.playbackSpeed ?? 1)) * 1000);
      this.playbackTimer = setInterval(() => {
        const next = this.intStep + 1;
        if (next >= this.props.steps.length) { this.sm({ type: 'STEP_END' }); this.stopPlayback(); this.render(); return; }
        this.intStep = next; this.props.onStepChange?.(next); this.render();
      }, ms);
    }
  }

  private onKey(e: KeyboardEvent): void {
    const vars = this.variables;
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); this.sm({ type: 'STEP_FORWARD' }); this.goToStep(this.activeStep + 1); break;
      case 'ArrowLeft': e.preventDefault(); this.sm({ type: 'STEP_BACKWARD' }); this.goToStep(this.activeStep - 1); break;
      case ' ': e.preventDefault(); if (this.widgetState === 'playing') { this.sm({ type: 'PAUSE' }); this.stopPlayback(); } else { this.sm({ type: 'PLAY' }); this.syncPlayback(); } this.render(); break;
      case 'Home': e.preventDefault(); this.goToStep(0); break;
      case 'End': e.preventDefault(); this.goToStep(this.props.steps.length - 1); break;
      case 'ArrowUp': e.preventDefault(); this.focusedLane = Math.max(0, this.focusedLane - 1); this.render(); break;
      case 'ArrowDown': e.preventDefault(); this.focusedLane = Math.min(vars.length - 1, this.focusedLane + 1); this.render(); break;
      case 'Enter': e.preventDefault(); if (vars[this.focusedLane] !== undefined) { this.selectedCell = { step: this.activeStep, variable: vars[this.focusedLane] }; this.sm({ type: 'SELECT_CELL' }); this.render(); } break;
      case 'Escape': e.preventDefault(); this.selectedCell = null; this.sm({ type: 'DESELECT' }); this.render(); break;
    }
  }

  private render(): void {
    this.el.innerHTML = '';
    const p = this.props; const steps = p.steps; const vars = this.variables;
    const zoom = p.zoom ?? 1.0; const showChanges = p.showChangesOnly ?? false;
    const active = this.activeStep; const curData = steps[active] as TraceStep | undefined;

    this.el.setAttribute('data-state', this.widgetState); this.el.setAttribute('data-zoom', String(zoom));
    this.el.setAttribute('aria-rowcount', String(vars.length));
    if (p.className) this.el.className = p.className;

    // Time axis
    const ta = document.createElement('div'); ta.setAttribute('data-part', 'time-axis'); ta.setAttribute('data-state', this.widgetState);
    ta.setAttribute('data-step-count', String(steps.length)); ta.setAttribute('role', 'row');
    const corner = document.createElement('span'); corner.setAttribute('data-part', 'time-axis-corner'); corner.setAttribute('role', 'columnheader'); ta.appendChild(corner);
    steps.forEach(step => {
      const lbl = document.createElement('span'); lbl.setAttribute('data-part', 'time-axis-label'); lbl.setAttribute('data-step', String(step.index));
      if (step.isError) lbl.setAttribute('data-error', 'true');
      lbl.setAttribute('role', 'columnheader'); lbl.setAttribute('aria-label', `Step ${step.index}${step.isError ? ' (error)' : ''}`);
      if (step.isError) lbl.style.color = 'var(--trace-error-color, red)';
      lbl.textContent = String(step.index); ta.appendChild(lbl);
    });
    this.el.appendChild(ta);

    // Variable lanes
    const lanes = document.createElement('div'); lanes.setAttribute('data-part', 'lanes'); lanes.setAttribute('data-state', this.widgetState);
    vars.forEach((variable, laneIdx) => {
      const lane = document.createElement('div'); lane.setAttribute('data-part', 'lane'); lane.setAttribute('data-state', this.widgetState);
      lane.setAttribute('data-variable', variable); lane.setAttribute('role', 'row'); lane.setAttribute('aria-label', variable);
      if (laneIdx === this.focusedLane) lane.setAttribute('data-focused', 'true');

      const ll = document.createElement('span'); ll.setAttribute('data-part', 'lane-label'); ll.setAttribute('data-state', this.widgetState);
      ll.textContent = variable; lane.appendChild(ll);

      steps.forEach(step => {
        const value = step.state[variable] ?? '';
        const changed = this.didValueChange(step.index, variable);
        if (showChanges && !changed && step.index !== 0) return;

        const isCurrent = step.index === active;
        const isSel = this.selectedCell?.step === step.index && this.selectedCell?.variable === variable;

        const cell = document.createElement('div'); cell.setAttribute('data-part', 'cell'); cell.setAttribute('data-state', this.widgetState);
        cell.setAttribute('data-step', String(step.index)); cell.setAttribute('data-changed', changed ? 'true' : 'false');
        if (step.isError) cell.setAttribute('data-error', 'true');
        if (isSel) cell.setAttribute('data-selected', 'true');
        cell.setAttribute('role', 'gridcell'); cell.setAttribute('aria-label', `${variable} at step ${step.index}: ${value}`);
        if (isCurrent) cell.setAttribute('aria-current', 'step');
        cell.tabIndex = -1; cell.textContent = value;

        let styles = '';
        if (step.isError) styles += 'background-color:var(--trace-error-bg, #fee2e2);color:var(--trace-error-color, red);';
        if (changed) styles += 'font-weight:bold;';
        if (isSel) styles += 'outline:2px solid var(--trace-selected-outline, currentColor);';
        if (styles) cell.style.cssText = styles;

        cell.addEventListener('click', () => { this.selectedCell = { step: step.index, variable }; this.goToStep(step.index); this.sm({ type: 'SELECT_CELL' }); this.render(); });
        lane.appendChild(cell);
      });
      lanes.appendChild(lane);
    });
    this.el.appendChild(lanes);

    // Step cursor
    const sc = document.createElement('div'); sc.setAttribute('data-part', 'step-cursor'); sc.setAttribute('data-state', this.widgetState);
    sc.setAttribute('data-position', String(active)); sc.setAttribute('aria-hidden', 'true'); this.el.appendChild(sc);

    // Controls
    const ct = document.createElement('div'); ct.setAttribute('data-part', 'controls'); ct.setAttribute('data-state', this.widgetState);
    ct.setAttribute('role', 'toolbar'); ct.setAttribute('aria-label', 'Playback controls');

    const sbBtn = document.createElement('button'); sbBtn.type = 'button'; sbBtn.setAttribute('data-part', 'step-back-btn');
    sbBtn.setAttribute('aria-label', 'Step backward'); sbBtn.disabled = active <= 0; sbBtn.tabIndex = 0; sbBtn.innerHTML = '&laquo;';
    sbBtn.addEventListener('click', () => { this.sm({ type: 'STEP_BACKWARD' }); this.goToStep(active - 1); }); ct.appendChild(sbBtn);

    const ppBtn = document.createElement('button'); ppBtn.type = 'button'; ppBtn.setAttribute('data-part', 'play-pause-btn');
    ppBtn.setAttribute('aria-label', this.widgetState === 'playing' ? 'Pause' : 'Play'); ppBtn.tabIndex = 0;
    ppBtn.textContent = this.widgetState === 'playing' ? '\u23F8' : '\u25B6';
    ppBtn.addEventListener('click', () => { if (this.widgetState === 'playing') { this.sm({ type: 'PAUSE' }); this.stopPlayback(); } else { this.sm({ type: 'PLAY' }); this.syncPlayback(); } this.render(); }); ct.appendChild(ppBtn);

    const sfBtn = document.createElement('button'); sfBtn.type = 'button'; sfBtn.setAttribute('data-part', 'step-fwd-btn');
    sfBtn.setAttribute('aria-label', 'Step forward'); sfBtn.disabled = active >= steps.length - 1; sfBtn.tabIndex = 0; sfBtn.innerHTML = '&raquo;';
    sfBtn.addEventListener('click', () => { this.sm({ type: 'STEP_FORWARD' }); this.goToStep(active + 1); }); ct.appendChild(sfBtn);

    const counter = document.createElement('span'); counter.setAttribute('data-part', 'step-counter'); counter.setAttribute('aria-live', 'polite');
    counter.textContent = steps.length > 0 ? `${active + 1} / ${steps.length}` : '0 / 0'; ct.appendChild(counter);
    this.el.appendChild(ct);

    // Zoom controls
    const zc = document.createElement('div'); zc.setAttribute('data-part', 'zoom-control'); zc.setAttribute('data-state', this.widgetState);
    const ziBtn = document.createElement('button'); ziBtn.type = 'button'; ziBtn.setAttribute('data-part', 'zoom-in-btn');
    ziBtn.setAttribute('aria-label', 'Zoom in'); ziBtn.tabIndex = 0; ziBtn.textContent = '+';
    ziBtn.addEventListener('click', () => this.sm({ type: 'ZOOM' })); zc.appendChild(ziBtn);
    const zoBtn = document.createElement('button'); zoBtn.type = 'button'; zoBtn.setAttribute('data-part', 'zoom-out-btn');
    zoBtn.setAttribute('aria-label', 'Zoom out'); zoBtn.tabIndex = 0; zoBtn.textContent = '-';
    zoBtn.addEventListener('click', () => this.sm({ type: 'ZOOM' })); zc.appendChild(zoBtn);
    this.el.appendChild(zc);

    // Detail panel
    if (this.widgetState === 'cellSelected' && curData) {
      const dp = document.createElement('div'); dp.setAttribute('data-part', 'detail-panel'); dp.setAttribute('data-state', this.widgetState);
      dp.setAttribute('data-step', String(active)); dp.setAttribute('role', 'region');
      dp.setAttribute('aria-label', `State detail for step ${active}`); dp.setAttribute('aria-live', 'polite');

      const h3 = document.createElement('h3'); h3.setAttribute('data-part', 'detail-title');
      h3.textContent = `Step ${curData.index}: ${curData.label}`;
      if (curData.isError) { const eb = document.createElement('span'); eb.setAttribute('data-part', 'detail-error-badge'); eb.style.color = 'var(--trace-error-color, red)'; eb.textContent = ' (error)'; h3.appendChild(eb); }
      dp.appendChild(h3);

      if (curData.timestamp) { const ts = document.createElement('time'); ts.setAttribute('data-part', 'detail-timestamp'); ts.setAttribute('datetime', curData.timestamp); ts.textContent = curData.timestamp; dp.appendChild(ts); }

      const dl = document.createElement('dl'); dl.setAttribute('data-part', 'detail-state');
      Object.entries(curData.state).forEach(([key, value]) => {
        const entry = document.createElement('div'); entry.setAttribute('data-part', 'detail-entry');
        entry.setAttribute('data-changed', this.didValueChange(active, key) ? 'true' : 'false');
        const dt = document.createElement('dt'); dt.textContent = key; entry.appendChild(dt);
        const dd = document.createElement('dd'); if (this.didValueChange(active, key)) dd.style.fontWeight = 'bold'; dd.textContent = value; entry.appendChild(dd);
        dl.appendChild(entry);
      });
      dp.appendChild(dl); this.el.appendChild(dp);
    }
  }
}

export default TraceTimelineViewer;
