// ============================================================
// VisuallyHidden -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
} from 'vue';

export interface VisuallyHiddenProps {
  text?: string;
}

export const VisuallyHidden = defineComponent({
  name: 'VisuallyHidden',

  props: {
    text: { type: String, default: '' },
  },

  setup(props, { slots, emit }) {

    return (): VNode =>
      h('span', {
        'style': visuallyHiddenStyle,
        'data-surface-widget': '',
        'data-widget-name': 'visually-hidden',
        'data-part': 'root',
      }, [
        slots.default?.() || props.text,
      ]);
  },
});

export default VisuallyHidden;