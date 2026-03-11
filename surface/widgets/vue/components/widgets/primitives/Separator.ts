// ============================================================
// Separator -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
} from 'vue';

export interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
}

export const Separator = defineComponent({
  name: 'Separator',

  props: {
    orientation: { type: String, default: 'horizontal' },
  },

  setup(props, { slots, emit }) {

    return (): VNode =>
      h('div', {
        'role': 'separator',
        'aria-orientation': props.orientation,
        'data-surface-widget': '',
        'data-widget-name': 'separator',
        'data-part': 'root',
        'data-orientation': props.orientation,
      });
  },
});

export default Separator;