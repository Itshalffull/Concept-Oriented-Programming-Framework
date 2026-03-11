import { defineComponent, h, ref } from 'vue';

export type SegmentedProgressBarState = 'idle' | 'animating' | 'segmentHovered';
export type SegmentedProgressBarEvent =
  | { type: 'HOVER_SEGMENT' }
  | { type: 'ANIMATE_IN' }
  | { type: 'ANIMATION_END' }
  | { type: 'LEAVE' };

export function segmentedProgressBarReducer(state: SegmentedProgressBarState, event: SegmentedProgressBarEvent): SegmentedProgressBarState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_SEGMENT') return 'segmentHovered';
      if (event.type === 'ANIMATE_IN') return 'animating';
      return state;
    case 'animating':
      if (event.type === 'ANIMATION_END') return 'idle';
      return state;
    case 'segmentHovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    default:
      return state;
  }
}

export const SegmentedProgressBar = defineComponent({
  name: 'SegmentedProgressBar',
  props: {
    segments: { type: Array, required: true },
    total: { type: Number, required: true },
    showLegend: { type: Boolean, default: true },
    showTotal: { type: Boolean, default: true },
    animate: { type: Boolean, default: true },
    size: { type: String, default: "md" },
  },
  setup(props, { slots }) {
    const state = ref<SegmentedProgressBarState>('idle');
    function send(type: string) {
      state.value = segmentedProgressBarReducer(state.value, { type } as any);
    }

    return () => h('div', {
      role: 'img',
      'aria-label': 'Horizontal progress bar divided into colored segments repres',
      'data-surface-widget': '',
      'data-widget-name': 'segmented-progress-bar',
      'data-part': 'root',
      'data-state': state.value,
      tabindex: 0,
    }, [
      h('div', { 'data-part': 'bar', 'data-state': state.value }, /* Horizontal bar divided into segments */ null),
      h('div', { 'data-part': 'segment', 'data-state': state.value }, /* Single colored segment */ null),
      h('span', { 'data-part': 'segment-label', 'data-state': state.value }, /* Tooltip label with count and percentage */ ''),
      h('div', { 'data-part': 'legend', 'data-state': state.value }, /* Optional color legend below the bar */ null),
      h('span', { 'data-part': 'total-label', 'data-state': state.value }, /* Total count display */ '')
    ]);
  },
});

export default SegmentedProgressBar;
