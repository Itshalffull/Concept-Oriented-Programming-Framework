import {
  StackLayout,
  Label,
  Progress,
} from '@nativescript/core';

export type ExecutionMetricsPanelState = 'idle' | 'updating';
export type ExecutionMetricsPanelEvent =
  | { type: 'UPDATE' }
  | { type: 'UPDATE_COMPLETE' };

export function executionMetricsPanelReducer(state: ExecutionMetricsPanelState, event: ExecutionMetricsPanelEvent): ExecutionMetricsPanelState {
  switch (state) {
    case 'idle':
      if (event.type === 'UPDATE') return 'updating';
      return state;
    case 'updating':
      if (event.type === 'UPDATE_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface ExecutionMetricsPanelProps {
  totalTokens: number;
  totalCost: number;
  stepCount: number;
  errorRate: number;
  tokenLimit?: number;
  showLatency?: boolean;
  compact?: boolean;
  latencyAvg?: number;
  latencyP95?: number;
}

function tokenGaugeColor(totalTokens: number, tokenLimit: number | undefined): string {
  if (tokenLimit == null || tokenLimit <= 0) return 'green';
  const pct = (totalTokens / tokenLimit) * 100;
  if (pct >= 90) return 'red';
  if (pct >= 70) return 'yellow';
  return 'green';
}

function errorRateColor(rate: number): string {
  if (rate >= 5) return 'red';
  if (rate >= 1) return 'yellow';
  return 'green';
}

export function createExecutionMetricsPanel(props: ExecutionMetricsPanelProps): {
  view: StackLayout;
  dispose: () => void;
} {
  let state: ExecutionMetricsPanelState = 'idle';
  const disposers: (() => void)[] = [];

  function send(event: ExecutionMetricsPanelEvent) {
    state = executionMetricsPanelReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'execution-metrics-panel';
  root.automationText = 'Execution metrics';

  const stepLabel = new Label();
  root.addChild(stepLabel);

  const tokenRow = new StackLayout();
  const tokenLabel = new Label();
  tokenRow.addChild(tokenLabel);

  const tokenProgress = new Progress();
  tokenProgress.maxValue = 100;
  tokenRow.addChild(tokenProgress);

  const tokenPctLabel = new Label();
  tokenPctLabel.fontSize = 12;
  tokenRow.addChild(tokenPctLabel);
  root.addChild(tokenRow);

  const costLabel = new Label();
  root.addChild(costLabel);

  const latencyLabel = new Label();
  root.addChild(latencyLabel);

  const errorLabel = new Label();
  root.addChild(errorLabel);

  function update() {
    const { totalTokens, totalCost, stepCount, errorRate, tokenLimit, showLatency, latencyAvg, latencyP95 } = props;

    stepLabel.text = `${stepCount} step${stepCount !== 1 ? 's' : ''}`;

    const tokenPct =
      tokenLimit != null && tokenLimit > 0
        ? Math.min((totalTokens / tokenLimit) * 100, 100)
        : null;

    tokenLabel.text =
      tokenLimit != null
        ? `${totalTokens.toLocaleString()} / ${tokenLimit.toLocaleString()} tokens`
        : `${totalTokens.toLocaleString()} tokens`;

    if (tokenPct != null) {
      tokenProgress.value = tokenPct;
      tokenProgress.visibility = 'visible';
      tokenPctLabel.text = `${tokenPct.toFixed(1)}%`;
      tokenPctLabel.visibility = 'visible';
      const gc = tokenGaugeColor(totalTokens, tokenLimit);
      tokenProgress.className = `token-progress gauge-${gc}`;
    } else {
      tokenProgress.visibility = 'collapsed';
      tokenPctLabel.visibility = 'collapsed';
    }

    costLabel.text = `$${totalCost.toFixed(2)}`;

    if (showLatency !== false) {
      latencyLabel.visibility = 'visible';
      latencyLabel.text =
        latencyAvg != null && latencyP95 != null
          ? `avg ${latencyAvg.toFixed(1)}s / p95 ${latencyP95.toFixed(1)}s`
          : 'No latency data';
    } else {
      latencyLabel.visibility = 'collapsed';
    }

    const ec = errorRateColor(errorRate);
    errorLabel.text = `${errorRate.toFixed(1)}%`;
    errorLabel.className = `error-rate error-${ec}`;
  }

  update();

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createExecutionMetricsPanel;
