import { defineComponent, h, ref } from 'vue';

export type QuorumGaugeState = 'belowThreshold' | 'atThreshold' | 'aboveThreshold';
export type QuorumGaugeEvent =
  | { type: 'THRESHOLD_MET' }
  | { type: 'UPDATE' }
  | { type: 'EXCEED' }
  | { type: 'DROP_BELOW' };

export function quorumGaugeReducer(state: QuorumGaugeState, event: QuorumGaugeEvent): QuorumGaugeState {
  switch (state) {
    case 'belowThreshold':
      if (event.type === 'THRESHOLD_MET') return 'atThreshold';
      if (event.type === 'UPDATE') return 'belowThreshold';
      return state;
    case 'atThreshold':
      if (event.type === 'EXCEED') return 'aboveThreshold';
      if (event.type === 'DROP_BELOW') return 'belowThreshold';
      return state;
    case 'aboveThreshold':
      if (event.type === 'DROP_BELOW') return 'belowThreshold';
      if (event.type === 'UPDATE') return 'aboveThreshold';
      return state;
    default:
      return state;
  }
}

export const QuorumGauge = defineComponent({
  name: 'QuorumGauge',
  props: {
    current: { type: Number, required: true },
    threshold: { type: Number, required: true },
    total: { type: Number, required: true },
    variant: { type: String, default: "simple" },
    showLabels: { type: Boolean, default: true },
    animate: { type: Boolean, default: true },
    size: { type: String, default: "md" },
  },
  setup(props, { slots }) {
    const state = ref<QuorumGaugeState>('belowThreshold');
    function send(type: string) {
      state.value = quorumGaugeReducer(state.value, { type } as any);
    }

    return () => h('div', {
      role: 'progressbar',
      'aria-label': 'Progress bar with a threshold marker showing participation p',
      'data-surface-widget': '',
      'data-widget-name': 'quorum-gauge',
      'data-part': 'root',
      'data-state': state.value,
      tabindex: 0,
    }, [
      h('div', { 'data-part': 'progress-bar', 'data-state': state.value }, /* Horizontal bar showing current participation */ null),
      h('div', { 'data-part': 'fill', 'data-state': state.value }, /* Filled portion of the progress bar */ null),
      h('div', { 'data-part': 'threshold-marker', 'data-state': state.value }, /* Vertical line marking the quorum threshold */ null),
      h('span', { 'data-part': 'current-label', 'data-state': state.value }, /* Current count or percentage label */ ''),
      h('span', { 'data-part': 'threshold-label', 'data-state': state.value }, /* Threshold value label */ ''),
      h('div', { 'data-part': 'status-badge', 'data-state': state.value }, /* Badge showing "Quorum met" / "Quorum not met" */ null)
    ]);
  },
});

export default QuorumGauge;
