import {
  StackLayout,
  Label,
  Button,
  Progress,
  View,
} from '@nativescript/core';

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

export interface TraceStepControlsProps {
  currentStep: number;
  totalSteps: number;
  playing: boolean;
  speed?: number;
  showSpeed?: boolean;
  onStepForward?: () => void;
  onStepBack?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (step: number) => void;
  onFirst?: () => void;
  onLast?: () => void;
  onSpeedChange?: (speed: number) => void;
}

const SPEED_OPTIONS = [1, 2, 4];

export function createTraceStepControls(props: TraceStepControlsProps): { view: View; dispose: () => void } {
  let state: TraceStepControlsState = props.playing ? 'playing' : 'paused';
  let playInterval: ReturnType<typeof setInterval> | null = null;
  const disposers: (() => void)[] = [];

  function send(event: TraceStepControlsEvent) {
    state = traceStepControlsReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'clef-trace-step-controls';
  root.automationText = 'Trace step controls';

  // Transport row
  const transport = new StackLayout();
  transport.orientation = 'horizontal';
  transport.horizontalAlignment = 'center';
  transport.padding = '8';

  const jumpStartBtn = new Button();
  jumpStartBtn.text = '\u25C4\u2502';
  jumpStartBtn.fontSize = 14;
  jumpStartBtn.width = 44;
  const jsHandler = () => { if (props.currentStep > 0) { send({ type: 'JUMP_START' }); props.onFirst?.(); } };
  jumpStartBtn.on('tap', jsHandler);
  disposers.push(() => jumpStartBtn.off('tap', jsHandler));
  transport.addChild(jumpStartBtn);

  const stepBackBtn = new Button();
  stepBackBtn.text = '\u25C4';
  stepBackBtn.fontSize = 14;
  stepBackBtn.width = 44;
  const sbHandler = () => { if (props.currentStep > 0) { send({ type: 'STEP_BACK' }); props.onStepBack?.(); } };
  stepBackBtn.on('tap', sbHandler);
  disposers.push(() => stepBackBtn.off('tap', sbHandler));
  transport.addChild(stepBackBtn);

  const playPauseBtn = new Button();
  playPauseBtn.fontSize = 14;
  playPauseBtn.width = 44;
  const ppHandler = () => {
    if (state === 'playing') { send({ type: 'PAUSE' }); props.onPause?.(); }
    else if (props.currentStep < props.totalSteps - 1) { send({ type: 'PLAY' }); props.onPlay?.(); }
  };
  playPauseBtn.on('tap', ppHandler);
  disposers.push(() => playPauseBtn.off('tap', ppHandler));
  transport.addChild(playPauseBtn);

  const stepFwdBtn = new Button();
  stepFwdBtn.text = '\u25BA';
  stepFwdBtn.fontSize = 14;
  stepFwdBtn.width = 44;
  const sfHandler = () => { if (props.currentStep < props.totalSteps - 1) { send({ type: 'STEP_FWD' }); props.onStepForward?.(); } };
  stepFwdBtn.on('tap', sfHandler);
  disposers.push(() => stepFwdBtn.off('tap', sfHandler));
  transport.addChild(stepFwdBtn);

  const jumpEndBtn = new Button();
  jumpEndBtn.text = '\u2502\u25BA';
  jumpEndBtn.fontSize = 14;
  jumpEndBtn.width = 44;
  const jeHandler = () => { if (props.currentStep < props.totalSteps - 1) { send({ type: 'JUMP_END' }); props.onLast?.(); } };
  jumpEndBtn.on('tap', jeHandler);
  disposers.push(() => jumpEndBtn.off('tap', jeHandler));
  transport.addChild(jumpEndBtn);

  root.addChild(transport);

  const counterLabel = new Label();
  counterLabel.textAlignment = 'center';
  counterLabel.fontSize = 13;
  counterLabel.padding = '4';
  root.addChild(counterLabel);

  const progressBar = new Progress();
  progressBar.maxValue = Math.max(1, props.totalSteps);
  progressBar.margin = '4 12';
  root.addChild(progressBar);

  if (props.showSpeed !== false) {
    const speedRow = new StackLayout();
    speedRow.orientation = 'horizontal';
    speedRow.horizontalAlignment = 'center';
    speedRow.padding = '4';
    for (const s of SPEED_OPTIONS) {
      const btn = new Button();
      btn.text = `${s}x`;
      btn.fontSize = 12;
      btn.width = 44;
      btn.marginRight = 4;
      const h = () => props.onSpeedChange?.(s);
      btn.on('tap', h);
      disposers.push(() => btn.off('tap', h));
      speedRow.addChild(btn);
    }
    root.addChild(speedRow);
  }

  function startPlayback() {
    stopPlayback();
    const ms = 1000 / (props.speed ?? 1);
    playInterval = setInterval(() => props.onStepForward?.(), ms);
  }
  function stopPlayback() { if (playInterval) { clearInterval(playInterval); playInterval = null; } }

  function update() {
    playPauseBtn.text = state === 'playing' ? '\u23F8' : '\u25B6';
    counterLabel.text = `Step ${props.currentStep + 1} of ${props.totalSteps}`;
    progressBar.value = props.currentStep + 1;
    progressBar.maxValue = Math.max(1, props.totalSteps);
    jumpStartBtn.isEnabled = props.currentStep > 0;
    stepBackBtn.isEnabled = props.currentStep > 0;
    stepFwdBtn.isEnabled = props.currentStep < props.totalSteps - 1;
    jumpEndBtn.isEnabled = props.currentStep < props.totalSteps - 1;
    if (state === 'playing') startPlayback(); else stopPlayback();
  }

  disposers.push(stopPlayback);
  update();

  return {
    view: root,
    dispose() { disposers.forEach(d => d()); },
  };
}

export default createTraceStepControls;
