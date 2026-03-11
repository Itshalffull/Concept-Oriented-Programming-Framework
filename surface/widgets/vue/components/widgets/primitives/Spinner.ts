// ============================================================
// Spinner -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
} from 'vue';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  trackVisible?: boolean;
}

export const Spinner = defineComponent({
  name: 'Spinner',

  props: {
    size: { type: String, default: 'md' },
    label: { type: String },
    trackVisible: { type: Boolean, default: true },
  },

  setup(props, { slots, emit }) {
    const accessibleLabel = props.label || 'Loading';

    return (): VNode =>
      h('div', {
        'role': 'progressbar',
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-label': accessibleLabel,
        'aria-busy': 'true',
        'data-surface-widget': '',
        'data-widget-name': 'spinner',
        'data-part': 'root',
        'data-size': props.size,
      }, [
        h('span', {
          'data-part': 'track',
          'data-visible': props.trackVisible ? 'true' : 'false',
          'aria-hidden': 'true',
        }),
        h('span', { 'data-part': 'indicator', 'aria-hidden': 'true' }),
        props.label ? h('span', { 'data-part': 'label', 'data-visible': 'true' }, [
            props.label,
          ]) : null,
      ]);
  },
});

export default Spinner;