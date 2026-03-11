import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  ScrollView,
  Color,
  View,
} from '@nativescript/core';

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

export interface TraceTimelineViewerProps {
  steps: TraceStep[];
  variables?: string[];
  currentStep?: number;
  playbackSpeed?: number;
  showChangesOnly?: boolean;
  zoom?: number;
  onStepChange?: (stepIndex: number) => void;
}

export function createTraceTimelineViewer(props: TraceTimelineViewerProps): { view: View; dispose: () => void } {
  let widgetState: TraceTimelineViewerState = 'idle';
  let activeStep = props.currentStep ?? 0;
  let selectedCell: { step: number; variable: string } | null = null;
  let playbackTimer: ReturnType<typeof setInterval> | null = null;
  const disposers: (() => void)[] = [];

  const variables: string[] = props.variables ?? (() => {
    const keys = new Set<string>();
    for (const step of props.steps) for (const k of Object.keys(step.state)) keys.add(k);
    return Array.from(keys);
  })();

  function send(event: TraceTimelineViewerEvent) {
    widgetState = traceTimelineViewerReducer(widgetState, event);
    render();
  }

  function goToStep(idx: number) {
    activeStep = Math.max(0, Math.min(idx, props.steps.length - 1));
    props.onStepChange?.(activeStep);
  }

  function didChange(stepIdx: number, variable: string): boolean {
    if (stepIdx === 0) return false;
    return props.steps[stepIdx - 1]?.state[variable] !== props.steps[stepIdx]?.state[variable];
  }

  const root = new StackLayout();
  root.className = 'clef-trace-timeline-viewer';
  root.automationText = 'Trace timeline';

  function render() {
    root.removeChildren();

    // Time axis
    const timeRow = new ScrollView();
    timeRow.orientation = 'horizontal';
    const timeBar = new StackLayout();
    timeBar.orientation = 'horizontal';
    timeBar.padding = '4';
    const corner = new Label();
    corner.text = '';
    corner.width = 80;
    timeBar.addChild(corner);
    for (const step of props.steps) {
      const lbl = new Label();
      lbl.text = String(step.index);
      lbl.width = 60;
      lbl.textAlignment = 'center';
      lbl.fontSize = 11;
      if (step.isError) lbl.color = new Color('#ef4444');
      if (step.index === activeStep) lbl.fontWeight = 'bold';
      timeBar.addChild(lbl);
    }
    timeRow.content = timeBar;
    root.addChild(timeRow);

    // Variable lanes
    const scroll = new ScrollView();
    const lanes = new StackLayout();
    variables.forEach((variable) => {
      const lane = new ScrollView();
      lane.orientation = 'horizontal';
      const row = new StackLayout();
      row.orientation = 'horizontal';
      row.padding = '2 0';

      const varLabel = new Label();
      varLabel.text = variable;
      varLabel.width = 80;
      varLabel.fontSize = 12;
      varLabel.fontWeight = 'bold';
      row.addChild(varLabel);

      for (const step of props.steps) {
        const value = step.state[variable] ?? '';
        const changed = didChange(step.index, variable);
        if (props.showChangesOnly && !changed && step.index !== 0) {
          const empty = new Label();
          empty.text = '';
          empty.width = 60;
          row.addChild(empty);
          continue;
        }
        const cell = new Label();
        cell.text = value;
        cell.width = 60;
        cell.textAlignment = 'center';
        cell.fontSize = 11;
        if (changed) cell.fontWeight = 'bold';
        if (step.isError) cell.backgroundColor = new Color('#fee2e2');
        if (step.index === activeStep) cell.backgroundColor = new Color('#dbeafe');
        if (selectedCell?.step === step.index && selectedCell?.variable === variable) {
          cell.borderWidth = 2;
          cell.borderColor = new Color('#6366f1');
        }
        const cellHandler = () => {
          selectedCell = { step: step.index, variable };
          goToStep(step.index);
          send({ type: 'SELECT_CELL' });
        };
        cell.on('tap', cellHandler);
        disposers.push(() => cell.off('tap', cellHandler));
        row.addChild(cell);
      }
      lane.content = row;
      lanes.addChild(lane);
    });
    scroll.content = lanes;
    root.addChild(scroll);

    // Controls
    const controls = new StackLayout();
    controls.orientation = 'horizontal';
    controls.horizontalAlignment = 'center';
    controls.padding = '8';

    const backBtn = new Button();
    backBtn.text = '\u00AB';
    backBtn.isEnabled = activeStep > 0;
    const bh = () => { send({ type: 'STEP_BACKWARD' }); goToStep(activeStep - 1); };
    backBtn.on('tap', bh);
    disposers.push(() => backBtn.off('tap', bh));
    controls.addChild(backBtn);

    const ppBtn = new Button();
    ppBtn.text = widgetState === 'playing' ? '\u23F8' : '\u25B6';
    const pph = () => {
      if (widgetState === 'playing') send({ type: 'PAUSE' });
      else send({ type: 'PLAY' });
    };
    ppBtn.on('tap', pph);
    disposers.push(() => ppBtn.off('tap', pph));
    controls.addChild(ppBtn);

    const fwdBtn = new Button();
    fwdBtn.text = '\u00BB';
    fwdBtn.isEnabled = activeStep < props.steps.length - 1;
    const fh = () => { send({ type: 'STEP_FORWARD' }); goToStep(activeStep + 1); };
    fwdBtn.on('tap', fh);
    disposers.push(() => fwdBtn.off('tap', fh));
    controls.addChild(fwdBtn);

    const stepLabel = new Label();
    stepLabel.text = props.steps.length > 0 ? ` ${activeStep + 1} / ${props.steps.length}` : ' 0 / 0';
    stepLabel.fontSize = 13;
    stepLabel.marginLeft = 8;
    controls.addChild(stepLabel);

    root.addChild(controls);

    // Playback timer
    if (widgetState === 'playing' && !playbackTimer) {
      const ms = Math.max(100, (1 / (props.playbackSpeed ?? 1)) * 1000);
      playbackTimer = setInterval(() => {
        if (activeStep >= props.steps.length - 1) { send({ type: 'STEP_END' }); return; }
        goToStep(activeStep + 1);
        render();
      }, ms);
      disposers.push(() => { if (playbackTimer) { clearInterval(playbackTimer); playbackTimer = null; } });
    } else if (widgetState !== 'playing' && playbackTimer) {
      clearInterval(playbackTimer);
      playbackTimer = null;
    }

    // Detail panel
    if (widgetState === 'cellSelected' && props.steps[activeStep]) {
      const detail = new StackLayout();
      detail.padding = '8 12';
      detail.borderTopWidth = 1;
      detail.borderTopColor = new Color('#e5e7eb');
      const step = props.steps[activeStep];
      const title = new Label();
      title.text = `Step ${step.index}: ${step.label}${step.isError ? ' (error)' : ''}`;
      title.fontWeight = 'bold';
      title.fontSize = 14;
      detail.addChild(title);
      if (step.timestamp) {
        const ts = new Label();
        ts.text = step.timestamp;
        ts.fontSize = 12;
        ts.color = new Color('#6b7280');
        detail.addChild(ts);
      }
      for (const [k, v] of Object.entries(step.state)) {
        const entry = new Label();
        const ch = didChange(activeStep, k);
        entry.text = `${k}: ${v}`;
        entry.fontSize = 13;
        if (ch) entry.fontWeight = 'bold';
        detail.addChild(entry);
      }
      root.addChild(detail);
    }
  }

  render();

  return {
    view: root,
    dispose() { disposers.forEach(d => d()); if (playbackTimer) clearInterval(playbackTimer); },
  };
}

export default createTraceTimelineViewer;
