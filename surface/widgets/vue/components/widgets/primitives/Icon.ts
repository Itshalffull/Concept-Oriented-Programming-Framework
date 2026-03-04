// ============================================================
// Icon -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
} from 'vue';

export interface IconProps {
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  decorative?: boolean;
  label?: string;
}

export const Icon = defineComponent({
  name: 'Icon',

  props: {
    name: { type: String, default: '' },
    size: { type: String, default: 'md' },
    decorative: { type: Boolean, default: true },
    label: { type: String },
  },

  setup(props, { slots, emit }) {

    return (): VNode =>
      h('span', {
        'role': props.decorative ? 'presentation' : 'img',
        'aria-hidden': props.decorative ? 'true' : 'false',
        'aria-label': props.decorative ? undefined : props.label,
        'data-surface-widget': '',
        'data-widget-name': 'icon',
        'data-part': 'root',
        'data-icon': props.name,
        'data-size': props.size,
      }, slots.default?.());
  },
});

export default Icon;