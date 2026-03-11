// ============================================================
// Label -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
} from 'vue';

export interface LabelProps {
  text?: string;
  htmlFor?: string;
  required?: boolean;
}

export const Label = defineComponent({
  name: 'Label',

  props: {
    text: { type: String, default: '' },
    htmlFor: { type: String },
    required: { type: Boolean, default: false },
  },

  setup(props, { slots, emit }) {

    return (): VNode =>
      h('label', {
        'for': props.htmlFor,
        'data-surface-widget': '',
        'data-widget-name': 'label',
        'data-part': 'root',
      }, [
        slots.default?.() || props.text,
        h('span', {
          'data-part': 'required-indicator',
          'data-visible': props.required ? 'true' : 'false',
          'aria-hidden': 'true',
        }, [
          props.required ? ' *' : '',
        ]),
      ]);
  },
});

export default Label;