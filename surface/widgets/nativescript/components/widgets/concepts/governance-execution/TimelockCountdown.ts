import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  TextField,
  TextView,
  ScrollView,
  Progress,
  ActivityIndicator,
  Switch,
  WrapLayout,
  Color,
  View,
} from '@nativescript/core';

export type TimelockCountdownState = 'running' | 'warning' | 'critical' | 'expired' | 'executing' | 'paused';
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
    case 'running': if (event.type === 'TICK') return 'running'; if (event.type === 'WARNING_THRESHOLD') return 'warning'; if (event.type === 'EXPIRE') return 'expired'; if (event.type === 'PAUSE') return 'paused'; return state;
    case 'warning': if (event.type === 'TICK') return 'warning'; if (event.type === 'CRITICAL_THRESHOLD') return 'critical'; if (event.type === 'EXPIRE') return 'expired'; return state;
    case 'critical': if (event.type === 'TICK') return 'critical'; if (event.type === 'EXPIRE') return 'expired'; return state;
    case 'expired': if (event.type === 'EXECUTE') return 'executing'; if (event.type === 'RESET') return 'running'; return state;
    case 'executing': if (event.type === 'EXECUTE_COMPLETE') return 'expired'; if (event.type === 'EXECUTE_ERROR') return 'expired'; return state;
    case 'paused': if (event.type === 'RESUME') return 'running'; return state;
    default:
      return state;
  }
}



export interface TimelockCountdownProps {
  phase: string;
  deadline: string;
  elapsed: number;
  total: number;
  showChallenge?: boolean;
  warningThreshold?: number;
  criticalThreshold?: number;
  variant?: 'phase-based' | 'simple';
  onExecute?: () => void;
  onChallenge?: () => void;
}

export function createTimelockCountdown(props: TimelockCountdownProps): { view: View; dispose: () => void } {
  let state: TimelockCountdownState = 'running';
  const disposers: (() => void)[] = [];

  function send(event: TimelockCountdownEvent) {
    state = timelockCountdownReducer(state, event);
    update();
  }

  
  const STATE_COLORS: Record<string, string> = { running: '#22c55e', warning: '#eab308', critical: '#ef4444', expired: '#ef4444', executing: '#3b82f6', paused: '#9ca3af' };
  const root = new StackLayout();
  root.className = 'clef-timelock-countdown';
  root.automationText = 'Timelock countdown';
  root.padding = '12';

  const phaseLabel = new Label();
  phaseLabel.text = props.phase;
  phaseLabel.fontWeight = 'bold';
  phaseLabel.fontSize = 14;
  root.addChild(phaseLabel);

  const countdownLabel = new Label();
  countdownLabel.fontSize = 24;
  countdownLabel.fontWeight = 'bold';
  countdownLabel.textAlignment = 'center';
  countdownLabel.padding = '8 0';
  root.addChild(countdownLabel);

  const progressBar = new Progress();
  progressBar.maxValue = Math.max(1, props.total);
  progressBar.value = props.elapsed;
  progressBar.margin = '4 0';
  root.addChild(progressBar);

  const stateLabel = new Label();
  stateLabel.fontSize = 12;
  stateLabel.textAlignment = 'center';
  root.addChild(stateLabel);

  const actionRow = new StackLayout();
  actionRow.orientation = 'horizontal';
  actionRow.horizontalAlignment = 'center';
  actionRow.padding = '8 0';

  const execBtn = new Button();
  execBtn.text = 'Execute';
  execBtn.fontSize = 13;
  const eh = () => { send({ type: 'EXECUTE' }); props.onExecute?.(); };
  execBtn.on('tap', eh);
  disposers.push(() => execBtn.off('tap', eh));
  actionRow.addChild(execBtn);

  if (props.showChallenge !== false) {
    const challengeBtn = new Button();
    challengeBtn.text = 'Challenge';
    challengeBtn.fontSize = 13;
    challengeBtn.marginLeft = 8;
    const ch = () => props.onChallenge?.();
    challengeBtn.on('tap', ch);
    disposers.push(() => challengeBtn.off('tap', ch));
    actionRow.addChild(challengeBtn);
  }
  root.addChild(actionRow);

  // Timer
  function computeRemaining(): string {
    const deadline = new Date(props.deadline).getTime();
    const remaining = Math.max(0, deadline - Date.now());
    const secs = Math.floor(remaining / 1000);
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
    if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
    return m + 'm ' + s + 's';
  }

  const tickInterval = setInterval(() => {
    if (state === 'paused') return;
    const deadline = new Date(props.deadline).getTime();
    const remaining = Math.max(0, deadline - Date.now());
    const fraction = props.total > 0 ? props.elapsed / props.total : 0;
    const warnT = props.warningThreshold ?? 0.8;
    const critT = props.criticalThreshold ?? 0.95;

    if (remaining <= 0 && state !== 'expired' && state !== 'executing') send({ type: 'EXPIRE' });
    else if (fraction >= critT && state === 'warning') send({ type: 'CRITICAL_THRESHOLD' });
    else if (fraction >= warnT && state === 'running') send({ type: 'WARNING_THRESHOLD' });
    else send({ type: 'TICK' });
  }, 1000);
  disposers.push(() => clearInterval(tickInterval));

  function update() {
    countdownLabel.text = computeRemaining();
    countdownLabel.color = new Color(STATE_COLORS[state] ?? '#000000');
    stateLabel.text = state.charAt(0).toUpperCase() + state.slice(1);
    stateLabel.color = new Color(STATE_COLORS[state] ?? '#6b7280');
    progressBar.value = props.elapsed;
    execBtn.visibility = state === 'expired' ? 'visible' : 'collapse';
  }

  function update() {
    // State-dependent UI updates handled inline
  }

  update();

  return {
    view: root,
    dispose() { disposers.forEach(d => d()); },
  };
}

export default createTimelockCountdown;
