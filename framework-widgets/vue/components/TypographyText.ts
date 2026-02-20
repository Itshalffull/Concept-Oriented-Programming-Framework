// ============================================================
// TypographyText — Vue 3 Component
//
// Renders text styled according to a named TextStyle definition.
// Computes CSS from the type scale, font stack, and text style
// using the shared bridge utilities.
// ============================================================

import {
  defineComponent,
  h,
  computed,
  type PropType,
  type VNode,
} from 'vue';

import type {
  TextStyle,
  TypeScale,
  FontStack,
} from '../../shared/types.js';

import { textStyleToCSS } from '../../shared/coif-bridge.js';

export const TypographyText = defineComponent({
  name: 'TypographyText',

  props: {
    /** Named text style to apply */
    textStyle: {
      type: Object as PropType<TextStyle>,
      required: true,
    },
    /** Type scale (font size map from xs..4xl) */
    scale: {
      type: Object as PropType<TypeScale>,
      required: true,
    },
    /** Available font stacks */
    fontStacks: {
      type: Array as PropType<FontStack[]>,
      default: () => [],
    },
    /** HTML tag to render */
    tag: {
      type: String as PropType<string>,
      default: 'span',
    },
    /** Optional color override */
    color: {
      type: String as PropType<string>,
      default: undefined,
    },
    /** Text alignment */
    align: {
      type: String as PropType<'left' | 'center' | 'right' | 'justify'>,
      default: undefined,
    },
    /** Whether to truncate overflowing text with ellipsis */
    truncate: {
      type: Boolean as PropType<boolean>,
      default: false,
    },
  },

  setup(props, { slots }) {
    const computedStyle = computed<Record<string, string>>(() => {
      const base = textStyleToCSS(props.textStyle, props.scale, props.fontStacks);

      if (props.color) {
        base['color'] = props.color;
      }
      if (props.align) {
        base['text-align'] = props.align;
      }
      if (props.truncate) {
        base['overflow'] = 'hidden';
        base['text-overflow'] = 'ellipsis';
        base['white-space'] = 'nowrap';
      }

      return base;
    });

    return (): VNode =>
      h(
        props.tag,
        {
          class: [
            'coif-typography-text',
            `coif-typography-text--${props.textStyle.name}`,
          ],
          style: computedStyle.value,
          'data-text-style': props.textStyle.name,
          'data-scale': props.textStyle.scale,
        },
        slots.default?.(),
      );
  },
});

export default TypographyText;
