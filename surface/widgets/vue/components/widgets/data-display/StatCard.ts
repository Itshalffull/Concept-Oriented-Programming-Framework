// ============================================================
// StatCard -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
} from 'vue';

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface StatCardTrend {
  direction: 'up' | 'down' | 'neutral';
  value: string;
}

export interface StatCardProps {
  label: string;
  value: string;
  trend?: StatCardTrend;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatCard = defineComponent({
  name: 'StatCard',

  props: {
    label: { type: String, required: true as const },
    value: { type: String, required: true as const },
    trend: { type: null as unknown as PropType<any> },
    description: { type: String },
    size: { type: String, default: 'md' },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();
    const trendDirection = props.trend?.direction ?? 'none';

    return (): VNode =>
      h('div', {
        'role': 'region',
        'aria-label': props.label,
        'aria-roledescription': 'statistic',
        'data-surface-widget': '',
        'data-widget-name': 'stat-card',
        'data-part': 'stat-card',
        'data-trend': trendDirection,
        'data-state': state.value,
        'data-size': props.size,
      }, [
        h('span', { 'id': labelId, 'data-part': 'label' }, [
          props.label,
        ]),
        h('span', {
          'data-part': 'value',
          'data-trend': trendDirection,
          'aria-live': 'polite',
          'aria-atomic': 'true',
        }, [
          props.value,
        ]),
        props.trend ? h('div', {
            'data-part': 'trend',
            'data-direction': props.trend.direction,
            'data-visible': 'true',
            'aria-label': `${trend.direction} by ${trend.value}`,
          }, [
            h('span', {
              'data-part': 'trend-icon',
              'data-direction': props.trend.direction,
              'aria-hidden': 'true',
            }, [
              props.trend.direction === 'up' && '\u2191',
              props.trend.direction === 'down' && '\u2193',
              props.trend.direction === 'neutral' && '\u2192',
            ]),
            h('span', { 'data-part': 'trend-value', 'data-direction': props.trend.direction }, [
              props.trend.value,
            ]),
          ]) : null,
        props.description ? h('span', { 'id': descriptionId, 'data-part': 'description' }, [
            props.description,
          ]) : null,
        slots.default?.(),
      ]);
  },
});

export default StatCard;