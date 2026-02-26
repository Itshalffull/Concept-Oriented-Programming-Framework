// ============================================================
// ElevationBox — Vue 3 Component
//
// Wrapper element with box-shadow driven by Clef Surface elevation
// levels (0..5). Supports custom shadow layers as an override,
// and exposes reactive elevation changes through watchers.
// ============================================================

import {
  defineComponent,
  h,
  computed,
  type PropType,
  type VNode,
} from 'vue';

import type { ElevationLevel, ShadowLayer } from '../../shared/types.js';

import {
  elevationToCSS,
  shadowLayersToCSS,
} from '../../shared/surface-bridge.js';

export const ElevationBox = defineComponent({
  name: 'ElevationBox',

  props: {
    /** Elevation level (0 = flat, 5 = highest) */
    level: {
      type: Number as PropType<ElevationLevel>,
      default: 0,
      validator: (v: unknown) =>
        typeof v === 'number' && v >= 0 && v <= 5 && Number.isInteger(v),
    },
    /** Optional custom shadow layers (overrides level) */
    layers: {
      type: Array as PropType<ShadowLayer[]>,
      default: undefined,
    },
    /** HTML tag for the wrapper */
    tag: {
      type: String as PropType<string>,
      default: 'div',
    },
    /** Optional border radius */
    borderRadius: {
      type: String as PropType<string>,
      default: undefined,
    },
    /** Optional background color */
    background: {
      type: String as PropType<string>,
      default: undefined,
    },
    /** Optional padding */
    padding: {
      type: String as PropType<string>,
      default: undefined,
    },
    /** Whether to animate elevation transitions */
    animated: {
      type: Boolean as PropType<boolean>,
      default: true,
    },
  },

  setup(props, { slots }) {
    const boxShadow = computed<string>(() => {
      if (props.layers && props.layers.length > 0) {
        return shadowLayersToCSS(props.layers);
      }
      return elevationToCSS(props.level);
    });

    const style = computed<Record<string, string>>(() => {
      const s: Record<string, string> = {
        'box-shadow': boxShadow.value,
      };
      if (props.animated) {
        s['transition'] = 'box-shadow 200ms ease';
      }
      if (props.borderRadius) {
        s['border-radius'] = props.borderRadius;
      }
      if (props.background) {
        s['background'] = props.background;
      }
      if (props.padding) {
        s['padding'] = props.padding;
      }
      return s;
    });

    return (): VNode =>
      h(
        props.tag,
        {
          class: [
            'surface-elevation-box',
            `surface-elevation-box--level-${props.level}`,
          ],
          style: style.value,
          'data-elevation': props.level,
        },
        slots.default?.(),
      );
  },
});

export default ElevationBox;
