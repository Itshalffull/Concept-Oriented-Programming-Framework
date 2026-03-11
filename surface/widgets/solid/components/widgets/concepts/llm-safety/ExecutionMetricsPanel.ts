import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

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

export interface ExecutionMetricsPanelProps { [key: string]: unknown; class?: string; }
export interface ExecutionMetricsPanelResult { element: HTMLElement; dispose: () => void; }

export function ExecutionMetricsPanel(props: ExecutionMetricsPanelProps): ExecutionMetricsPanelResult {
  const sig = surfaceCreateSignal<ExecutionMetricsPanelState>('idle');
  const send = (event: ExecutionMetricsPanelEvent) => { sig.set(executionMetricsPanelReducer(sig.get(), event)); };

  const totalTokens = Number(props.totalTokens ?? 0);
  const totalCost = Number(props.totalCost ?? 0);
  const stepCount = Number(props.stepCount ?? 0);
  const errorRate = Number(props.errorRate ?? 0);
  const tokenLimit = props.tokenLimit as number | undefined;
  const showLatency = props.showLatency !== false;
  const compact = props.compact === true;
  const latencyAvg = props.latencyAvg as number | undefined;
  const latencyP95 = props.latencyP95 as number | undefined;

  const tokenPct = tokenLimit != null && tokenLimit > 0
    ? Math.min((totalTokens / tokenLimit) * 100, 100)
    : null;
  const gaugeColor = tokenGaugeColor(totalTokens, tokenLimit);
  const errColor = errorRateColor(errorRate);

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'execution-metrics-panel');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-compact', compact ? 'true' : 'false');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Execution metrics');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Step counter
  const stepCounterEl = document.createElement('div');
  stepCounterEl.setAttribute('data-part', 'step-counter');
  stepCounterEl.setAttribute('data-state', sig.get());
  stepCounterEl.setAttribute('role', 'status');
  stepCounterEl.setAttribute('aria-label', `Steps: ${stepCount}`);
  stepCounterEl.setAttribute('tabindex', '0');
  const stepIcon = document.createElement('span');
  stepIcon.setAttribute('aria-hidden', 'true');
  stepIcon.textContent = '\uD83D\uDCCB';
  stepCounterEl.appendChild(stepIcon);
  stepCounterEl.appendChild(document.createTextNode(' '));
  const stepText = document.createElement('span');
  stepText.textContent = `${stepCount} step${stepCount !== 1 ? 's' : ''}`;
  stepCounterEl.appendChild(stepText);
  root.appendChild(stepCounterEl);

  // Token gauge
  const tokenGaugeEl = document.createElement('div');
  tokenGaugeEl.setAttribute('data-part', 'token-gauge');
  tokenGaugeEl.setAttribute('data-state', sig.get());
  tokenGaugeEl.setAttribute('data-value', String(totalTokens));
  if (tokenLimit != null) tokenGaugeEl.setAttribute('data-max', String(tokenLimit));
  tokenGaugeEl.setAttribute('data-color', gaugeColor);
  tokenGaugeEl.setAttribute('role', 'meter');
  tokenGaugeEl.setAttribute('aria-label', `Tokens: ${totalTokens}`);
  tokenGaugeEl.setAttribute('aria-valuenow', String(totalTokens));
  tokenGaugeEl.setAttribute('aria-valuemin', '0');
  if (tokenLimit != null) tokenGaugeEl.setAttribute('aria-valuemax', String(tokenLimit));
  tokenGaugeEl.setAttribute('tabindex', '0');

  const tokenLabel = document.createElement('span');
  tokenLabel.textContent = `${totalTokens.toLocaleString()}${tokenLimit != null ? ` / ${tokenLimit.toLocaleString()}` : ''} tokens`;
  tokenGaugeEl.appendChild(tokenLabel);

  if (tokenPct != null) {
    const gaugeBar = document.createElement('div');
    gaugeBar.setAttribute('data-part', 'token-gauge-bar');
    gaugeBar.style.width = '100%';
    gaugeBar.style.height = '6px';
    gaugeBar.style.background = '#e0e0e0';
    gaugeBar.style.borderRadius = '3px';
    gaugeBar.style.marginTop = '4px';

    const gaugeFill = document.createElement('div');
    gaugeFill.setAttribute('data-part', 'token-gauge-fill');
    gaugeFill.setAttribute('data-color', gaugeColor);
    gaugeFill.style.width = `${tokenPct}%`;
    gaugeFill.style.height = '100%';
    gaugeFill.style.borderRadius = '3px';
    gaugeFill.style.background = gaugeColor === 'red' ? '#dc2626' : gaugeColor === 'yellow' ? '#ca8a04' : '#16a34a';
    gaugeFill.style.transition = 'width 0.3s ease';
    gaugeBar.appendChild(gaugeFill);
    tokenGaugeEl.appendChild(gaugeBar);

    const pctLabel = document.createElement('span');
    pctLabel.setAttribute('data-part', 'token-gauge-pct');
    pctLabel.textContent = `${tokenPct.toFixed(1)}%`;
    tokenGaugeEl.appendChild(pctLabel);
  }
  root.appendChild(tokenGaugeEl);

  // Cost display
  const costEl = document.createElement('div');
  costEl.setAttribute('data-part', 'cost');
  costEl.setAttribute('data-state', sig.get());
  costEl.setAttribute('role', 'status');
  costEl.setAttribute('aria-label', `Cost: $${totalCost.toFixed(2)}`);
  costEl.setAttribute('tabindex', '0');
  costEl.textContent = `$${totalCost.toFixed(2)}`;
  root.appendChild(costEl);

  // Latency card
  if (showLatency) {
    const latencyEl = document.createElement('div');
    latencyEl.setAttribute('data-part', 'latency');
    latencyEl.setAttribute('data-state', sig.get());
    latencyEl.setAttribute('data-visible', 'true');
    latencyEl.setAttribute('role', 'status');
    latencyEl.setAttribute('tabindex', '0');
    if (latencyAvg != null && latencyP95 != null) {
      latencyEl.setAttribute('aria-label', `Latency: average ${latencyAvg.toFixed(1)}s, p95 ${latencyP95.toFixed(1)}s`);
      latencyEl.textContent = `avg ${latencyAvg.toFixed(1)}s / p95 ${latencyP95.toFixed(1)}s`;
    } else {
      latencyEl.setAttribute('aria-label', 'Latency: no data');
      latencyEl.textContent = 'No latency data';
    }
    root.appendChild(latencyEl);
  }

  // Error rate
  const errorRateEl = document.createElement('div');
  errorRateEl.setAttribute('data-part', 'error-rate');
  errorRateEl.setAttribute('data-state', sig.get());
  errorRateEl.setAttribute('data-color', errColor);
  errorRateEl.setAttribute('role', 'status');
  errorRateEl.setAttribute('aria-label', `Error rate: ${errorRate}%`);
  errorRateEl.setAttribute('tabindex', '0');

  const errSpan = document.createElement('span');
  errSpan.style.color = errColor === 'red' ? '#dc2626' : errColor === 'yellow' ? '#ca8a04' : '#16a34a';
  errSpan.textContent = `${errorRate.toFixed(1)}%`;
  errorRateEl.appendChild(errSpan);
  root.appendChild(errorRateEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    stepCounterEl.setAttribute('data-state', s);
    tokenGaugeEl.setAttribute('data-state', s);
    costEl.setAttribute('data-state', s);
    errorRateEl.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default ExecutionMetricsPanel;
