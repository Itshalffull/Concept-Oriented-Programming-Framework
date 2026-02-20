// ============================================================
// LayoutContainer — Vue 3 Component
//
// Flex/grid container driven by COIF LayoutConfig. Reactively
// adjusts layout styles when the config or viewport breakpoint
// changes, applying responsive overrides when defined.
// ============================================================

import {
  defineComponent,
  h,
  computed,
  inject,
  type PropType,
  type VNode,
} from 'vue';

import type { LayoutConfig, Breakpoint } from '../../shared/types.js';

import { layoutToCSS } from '../../shared/coif-bridge.js';

import { VIEWPORT_KEY } from './ViewportProvider.js';

export const LayoutContainer = defineComponent({
  name: 'LayoutContainer',

  props: {
    /** Layout configuration describing the container kind and properties */
    config: {
      type: Object as PropType<LayoutConfig>,
      required: true,
    },
    /** HTML wrapper tag */
    tag: {
      type: String as PropType<string>,
      default: 'div',
    },
    /** Additional CSS class names */
    extraClass: {
      type: [String, Array, Object] as PropType<string | string[] | Record<string, boolean>>,
      default: undefined,
    },
    /** Additional inline styles (merged after layout styles) */
    extraStyle: {
      type: Object as PropType<Record<string, string>>,
      default: () => ({}),
    },
  },

  setup(props, { slots }) {
    // Optionally consume the injected viewport state from ViewportProvider
    const viewport = inject(VIEWPORT_KEY, null);

    // Current breakpoint (falls back to 'md' if no ViewportProvider)
    const breakpoint = computed<Breakpoint>(() =>
      viewport ? viewport.breakpoint : 'md',
    );

    // Merge base layout config with responsive overrides for current breakpoint
    const effectiveConfig = computed<LayoutConfig>(() => {
      const base = props.config;
      const responsive = base.responsive;
      if (!responsive) return base;

      const overrides = responsive[breakpoint.value];
      if (!overrides) return base;

      return { ...base, ...overrides, name: base.name, kind: overrides.kind ?? base.kind };
    });

    // Convert the effective layout config to CSS properties
    const layoutStyle = computed<Record<string, string>>(() => ({
      ...layoutToCSS(effectiveConfig.value),
      ...props.extraStyle,
    }));

    return (): VNode =>
      h(
        props.tag,
        {
          class: [
            'coif-layout-container',
            `coif-layout-container--${effectiveConfig.value.kind}`,
            props.extraClass,
          ],
          style: layoutStyle.value,
          'data-layout': effectiveConfig.value.kind,
          'data-breakpoint': breakpoint.value,
        },
        slots.default?.(),
      );
  },
});

export default LayoutContainer;
