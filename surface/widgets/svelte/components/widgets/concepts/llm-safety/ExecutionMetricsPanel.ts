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

export interface ExecutionMetricsPanelProps { [key: string]: unknown; class?: string; }
export interface ExecutionMetricsPanelResult { element: HTMLElement; dispose: () => void; }

export function ExecutionMetricsPanel(props: ExecutionMetricsPanelProps): ExecutionMetricsPanelResult {
  const sig = surfaceCreateSignal<ExecutionMetricsPanelState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(executionMetricsPanelReducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'execution-metrics-panel');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Execution metrics');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  const stepCounterEl = document.createElement('div');
  stepCounterEl.setAttribute('data-part', 'step-counter');
  stepCounterEl.setAttribute('role', 'status');
  stepCounterEl.setAttribute('aria-label', 'Step count');
  root.appendChild(stepCounterEl);

  const tokenGaugeEl = document.createElement('div');
  tokenGaugeEl.setAttribute('data-part', 'token-gauge');
  tokenGaugeEl.setAttribute('role', 'meter');
  tokenGaugeEl.setAttribute('aria-label', 'Token usage');
  root.appendChild(tokenGaugeEl);

  const costDisplayEl = document.createElement('div');
  costDisplayEl.setAttribute('data-part', 'cost-display');
  costDisplayEl.setAttribute('aria-label', 'Estimated cost');
  root.appendChild(costDisplayEl);

  const latencyCardEl = document.createElement('div');
  latencyCardEl.setAttribute('data-part', 'latency-card');
  latencyCardEl.setAttribute('aria-label', 'Latency metrics');
  root.appendChild(latencyCardEl);

  const errorRateEl = document.createElement('div');
  errorRateEl.setAttribute('data-part', 'error-rate');
  errorRateEl.setAttribute('aria-label', 'Error rate');
  root.appendChild(errorRateEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    stepCounterEl.setAttribute('data-state', s);
    tokenGaugeEl.setAttribute('data-state', s);
    costDisplayEl.setAttribute('data-state', s);
    latencyCardEl.setAttribute('data-state', s);
    errorRateEl.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default ExecutionMetricsPanel;
