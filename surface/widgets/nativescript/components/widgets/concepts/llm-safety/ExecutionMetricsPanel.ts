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

export interface ExecutionMetricsPanelProps { [key: string]: unknown; }

export function createExecutionMetricsPanel(props: ExecutionMetricsPanelProps) {
  let state: ExecutionMetricsPanelState = 'idle';

  function send(type: string) {
    state = executionMetricsPanelReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createExecutionMetricsPanel;
