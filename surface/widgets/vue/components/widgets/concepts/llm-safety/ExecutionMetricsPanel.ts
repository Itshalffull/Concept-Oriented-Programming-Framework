import { defineComponent, h, ref, computed, watch } from 'vue';

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

export const ExecutionMetricsPanel = defineComponent({
  name: 'ExecutionMetricsPanel',
  props: {
    totalTokens: { type: Number, required: true },
    totalCost: { type: Number, required: true },
    stepCount: { type: Number, required: true },
    errorRate: { type: Number, required: true },
    tokenLimit: { type: Number, default: undefined },
    latencyAvg: { type: Number, default: undefined },
    latencyP95: { type: Number, default: undefined },
    showLatency: { type: Boolean, default: true },
    compact: { type: Boolean, default: false },
  },
  setup(props) {
    const state = ref<ExecutionMetricsPanelState>('idle');

    function send(event: ExecutionMetricsPanelEvent) {
      state.value = executionMetricsPanelReducer(state.value, event);
    }

    watch([() => props.totalTokens, () => props.totalCost, () => props.stepCount], () => {
      send({ type: 'UPDATE' });
      setTimeout(() => send({ type: 'UPDATE_COMPLETE' }), 100);
    });

    const tokenPercent = computed(() => props.tokenLimit ? Math.round((props.totalTokens / props.tokenLimit) * 100) : 0);
    const costFormatted = computed(() => `$${props.totalCost.toFixed(4)}`);
    const errorPercent = computed(() => `${(props.errorRate * 100).toFixed(1)}%`);

    return () => {
      const children: any[] = [];

      // Step counter
      children.push(h('div', { 'data-part': 'step-counter', role: 'status' }, [
        h('span', { 'data-part': 'metric-label' }, 'Steps'),
        h('span', { 'data-part': 'metric-value' }, String(props.stepCount)),
      ]));

      // Token gauge
      children.push(h('div', { 'data-part': 'token-gauge' }, [
        h('span', { 'data-part': 'metric-label' }, 'Tokens'),
        h('span', { 'data-part': 'metric-value' }, String(props.totalTokens)),
        props.tokenLimit ? h('div', {
          'data-part': 'gauge-bar', role: 'progressbar',
          'aria-valuenow': tokenPercent.value, 'aria-valuemin': 0, 'aria-valuemax': 100,
          'aria-label': `Token usage: ${tokenPercent.value}%`,
        }, [
          h('div', {
            'data-part': 'gauge-fill',
            'data-warning': tokenPercent.value > 80 ? 'true' : 'false',
            style: { width: `${Math.min(100, tokenPercent.value)}%` },
            'aria-hidden': 'true',
          }),
        ]) : null,
        props.tokenLimit ? h('span', { 'data-part': 'limit-label' }, `/ ${props.tokenLimit}`) : null,
      ]));

      // Cost
      children.push(h('div', { 'data-part': 'cost-display', role: 'status' }, [
        h('span', { 'data-part': 'metric-label' }, 'Cost'),
        h('span', { 'data-part': 'metric-value' }, costFormatted.value),
      ]));

      // Latency
      if (props.showLatency && (props.latencyAvg != null || props.latencyP95 != null)) {
        children.push(h('div', { 'data-part': 'latency-card' }, [
          h('span', { 'data-part': 'metric-label' }, 'Latency'),
          props.latencyAvg != null ? h('span', { 'data-part': 'latency-avg' }, `Avg: ${props.latencyAvg}ms`) : null,
          props.latencyP95 != null ? h('span', { 'data-part': 'latency-p95' }, `P95: ${props.latencyP95}ms`) : null,
        ]));
      }

      // Error rate
      children.push(h('div', { 'data-part': 'error-rate', role: 'status' }, [
        h('span', { 'data-part': 'metric-label' }, 'Error Rate'),
        h('span', {
          'data-part': 'metric-value',
          'data-warning': props.errorRate > 0.1 ? 'true' : 'false',
        }, errorPercent.value),
      ]));

      return h('div', {
        role: 'region',
        'aria-label': 'Execution metrics',
        'data-surface-widget': '',
        'data-widget-name': 'execution-metrics-panel',
        'data-part': 'root',
        'data-state': state.value,
        'data-compact': props.compact ? 'true' : 'false',
        tabindex: 0,
      }, children);
    };
  },
});

export default ExecutionMetricsPanel;
