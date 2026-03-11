// ============================================================
// Gauge -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
  computed,
} from 'vue';

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface GaugeProps {
  value: number;
  min?: number;
  max?: number;
  thresholds?: GaugeThresholds;
  ariaLabel?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Gauge = defineComponent({
  name: 'Gauge',

  props: {
    value: { type: Number, required: true as const },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100 },
    thresholds: { type: null as unknown as PropType<any> },
    ariaLabel: { type: String },
    size: { type: String, default: 'md' },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();
    const polarToCartesian = computed(() => (angle: number) => {
          const rad = ((angle - 90) * Math.PI) / 180;
          return {
            x: cx + radius * Math.cos(rad),
            y: cy + radius * Math.sin(rad),
          };
        });
    const describeArc = computed(() => (start: number, end: number) => {
          const s = polarToCartesian(start);
          const e = polarToCartesian(end);
          const largeArc = end - start > 180 ? 1 : 0;
          return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
        });
    const trackPath = computed(() => describeArc(startAngle, endAngle));
    const fillPath = computed(() => (percentage > 0 ? describeArc(startAngle, fillAngle) : ''));
    const clampedValue = Math.min(Math.max(props.value, props.min), props.max);
    const percentage = (clampedValue - props.min) / (props.max - props.min);
    const thresholdLevel = getThresholdLevel(clampedValue, props.thresholds);
    const svgSize = 200;
    const cx = svgSize / 2;
    const cy = svgSize / 2;
    const radius = 80;
    const strokeWidth = 12;
    const sweepAngle = endAngle - startAngle;
    const fillAngle = startAngle + sweepAngle * percentage;
    const fillColor = getThresholdColor(thresholdLevel);

    return (): VNode =>
      h('div', {
        'role': 'meter',
        'aria-label': props.ariaLabel,
        'aria-valuenow': clampedValue,
        'aria-valuemin': props.min,
        'aria-valuemax': props.max,
        'aria-valuetext': `${clampedValue} of ${max}`,
        'data-surface-widget': '',
        'data-widget-name': 'gauge',
        'data-part': 'gauge',
        'data-threshold': thresholdLevel,
        'data-state': resolvedState,
        'data-size': props.size,
      }, [
        h('svg', { 'viewBox': `0 0 ${svgSize} ${svgSize}`, 'style': { width: '100%', height: 'auto' } }, [
          h('path', {
            'd': trackPath,
            'fill': 'none',
            'stroke': '#e5e7eb',
            'strokeWidth': strokeWidth,
            'strokeLinecap': 'round',
            'data-part': 'track',
            'aria-hidden': 'true',
          }),
          percentage > 0 ? h('path', {
              'd': fillPath,
              'fill': 'none',
              'stroke': fillColor,
              'strokeWidth': strokeWidth,
              'strokeLinecap': 'round',
              'data-part': 'fill',
              'data-percentage': Math.round(percentage * 100),
              'data-threshold': thresholdLevel,
              'aria-hidden': 'true',
            }) : null,
          h('text', {
            'x': cx,
            'y': cy,
            'textAnchor': 'middle',
            'dominantBaseline': 'central',
            'data-part': 'value',
            'aria-live': 'polite',
            'aria-atomic': 'true',
            'data-threshold': thresholdLevel,
            'style': { fontSize: '2rem', fontWeight: 'bold' },
          }, [
            clampedValue,
          ]),
        ]),
        props.ariaLabel ? h('span', { 'id': labelId, 'data-part': 'label' }, [
            props.ariaLabel,
          ]) : null,
        slots.default?.(),
      ]);
  },
});

export default Gauge;